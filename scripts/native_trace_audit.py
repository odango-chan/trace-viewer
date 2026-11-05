#!/usr/bin/env python3
"""Strict, dependency-free structural audit of ca-agent-demo TraceStore v2 files.

No telemetry is emitted. No modification or upload of input files.
NOT an authoritative replacement for upstream TraceStore.load_run().
Only synthetic fixtures may be passed to CI; never add real Run files to a public repo.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
from typing import Any

RUN_FIELDS = frozenset({
    "trace_format_version", "run_id", "intentInterpretationLlmCalls",
    "skillRoutingLlmCalls", "planningLlmCalls", "totalLlmCalls",
    "started_at", "ended_at", "duration_ms", "spans",
})
EVENT_FIELDS = frozenset({"sequence", "stage", "kind", "summary", "data", "material_ref"})
SPAN_FIELDS = frozenset({
    "span_id", "name", "stage", "status", "started_at", "ended_at",
    "duration_ms", "parent_id", "attributes",
})
RUN_ID_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}\Z")
DIGEST_RE = re.compile(r"[a-f0-9]{64}\Z")
# The owner uses exact property names; overzealous normalizing would change the schema.
KNOWN_STAGES = {
    "HOST", "INTENT", "SKILL_ROUTING", "CONTEXT", "PREDEFINED", "FORMAL",
    "LLM_PLANNING", "LINKER", "ADMISSION", "RUNTIME", "REPLAN",
}
SECRET_KEY = re.compile(
    r"(?:api[_-]?key|access[_-]?token|password|credential|secret|authorization|"
    r"provider[_-]?binding|runtime[_-]?pc|raw[_-]?evidence|chain[_-]?of[_-]?thought|"
    r"reasoning|scratchpad|internal[_-]?thought|analysis|thinking)", re.I,
)
SECRET_VALUE = re.compile(r"(?:sk-[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{16,})", re.I)


class UnsafeInput(ValueError):
    pass


def _safe_content(value: Any, path: str) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if SECRET_KEY.search(str(key)):
                raise UnsafeInput(f"secret-like field at {path}.{key}")
            _safe_content(child, f"{path}.{key}")
    elif isinstance(value, list):
        for i, child in enumerate(value):
            _safe_content(child, f"{path}[{i}]")
    elif isinstance(value, str):
        if SECRET_VALUE.search(value):
            raise UnsafeInput(f"credential-like content at {path}")
        try:
            nested = json.loads(value)
        except (ValueError, TypeError):
            nested = None
        if isinstance(nested, (dict, list)):
            _safe_content(nested, path + ".json")


def _canonical(value: Any) -> bytes:
    """Match the JSON-subset of current Python canonical_json (not cross-language proof)."""
    return json.dumps(value, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":"), allow_nan=False).encode("utf-8")


def _parse_json_file(path: Path, max_bytes: int) -> Any:
    if path.is_symlink() or not path.is_file():
        raise UnsafeInput(f"not a regular file: {path.name}")
    if path.stat().st_size > max_bytes:
        raise UnsafeInput(f"oversized file: {path.name}")
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=lambda val: (_ for _ in ()).throw(
        ValueError(f"invalid JSON constant {val}")))


def audit_trace_store_run(run_dir: Path, *, max_bytes: int = 8_000_000,
                          max_events: int = 30_000) -> dict[str, Any]:
    if run_dir.is_symlink() or not run_dir.is_dir():
        raise UnsafeInput("run directory must be a real directory")
    if not RUN_ID_RE.fullmatch(run_dir.name):
        raise UnsafeInput("unsafe run_id")
    metadata = _parse_json_file(run_dir / "run.json", max_bytes)
    if not isinstance(metadata, dict) or frozenset(metadata) != RUN_FIELDS:
        raise ValueError("invalid metadata keys")
    if metadata["trace_format_version"] != 2 or metadata["run_id"] != run_dir.name:
        raise ValueError("version or run identity mismatch")
    counts = [metadata[k] for k in (
        "intentInterpretationLlmCalls", "skillRoutingLlmCalls", "planningLlmCalls", "totalLlmCalls"
    )]
    if any(type(v) is not int or v < 0 for v in counts) or sum(counts[:3]) != counts[-1]:
        raise ValueError("invalid stage-separated LLM counters")
    if any(not isinstance(metadata[k], str) for k in ("started_at", "ended_at")):
        raise ValueError("invalid wall clock fields")
    if type(metadata["duration_ms"]) not in (int, float) or metadata["duration_ms"] < 0:
        raise ValueError("invalid duration_ms")
    spans = metadata["spans"]
    if not isinstance(spans, list):
        raise ValueError("invalid spans")
    seen_spans = set()
    for span in spans:
        if not isinstance(span, dict) or frozenset(span) != SPAN_FIELDS:
            raise ValueError("invalid span keys")
        if not isinstance(span["span_id"], str) or not span["span_id"] or span["span_id"] in seen_spans:
            raise ValueError("invalid span identity")
        if span["parent_id"] is not None and span["parent_id"] not in seen_spans:
            raise ValueError("unknown or out-of-order span parent")
        if span["status"] not in ("RUNNING", "COMPLETED", "FAILED"):
            raise ValueError("invalid span status")
        if (span["status"] == "RUNNING") != (span["ended_at"] is None):
            raise ValueError("invalid span ended_at")
        seen_spans.add(span["span_id"])
    events_file = run_dir / "trace.jsonl"
    if events_file.is_symlink() or not events_file.is_file() or events_file.stat().st_size > max_bytes:
        raise UnsafeInput("missing or unsafe trace.jsonl")
    events_raw = events_file.read_bytes()
    events = []
    refs = set()
    for line in events_raw.splitlines():
        if not line.strip():
            continue
        if len(events) >= max_events:
            raise UnsafeInput("too many events")
        ev = json.loads(line, parse_constant=lambda val: (_ for _ in ()).throw(
            ValueError(f"invalid JSON constant {val}")))
        index = len(events)
        if not isinstance(ev, dict) or frozenset(ev) != EVENT_FIELDS or type(ev["sequence"]) is not int or ev["sequence"] != index:
            raise ValueError(f"invalid sequence/shape at {index}")
        if ev["stage"] not in KNOWN_STAGES or not isinstance(ev["kind"], str) or not ev["kind"]:
            raise ValueError(f"invalid stage or kind at {index}")
        if not isinstance(ev["summary"], str):
            raise ValueError(f"invalid summary at {index}")
        data = ev["data"]
        if not isinstance(data, list) or any(not isinstance(x, list) or len(x) != 2 or not isinstance(x[0], str) for x in data):
            raise ValueError(f"raw event data must be sorted pair-array at {index}")
        keys = [x[0] for x in data]
        if keys != sorted(keys) or len(set(keys)) != len(keys):
            raise ValueError(f"data keys must be sorted and unique at {index}")
        _safe_content({"kind": ev["kind"], "summary": ev["summary"],
                       "data": {k: v for k, v in data}}, f"events[{index}]")
        ref = ev["material_ref"]
        if ref is not None:
            if not isinstance(ref, str) or not DIGEST_RE.fullmatch(ref):
                raise ValueError(f"invalid material_ref at {index}")
            refs.add(ref)
        # Preserve the original ordinal and original serialized record digest.
        # Do not synthesize an event timestamp or artificial Span duration.
        events.append({"sequence": index, "kind": ev["kind"], "stage": ev["stage"],
                       "materialRef": ref, "lineSha256": "sha256:" + hashlib.sha256(line).hexdigest(),
                       "nativeLocator": f"trace.jsonl#sequence={index}",
                       "hasNativeEventTimestamp": False})
    materials_dir = run_dir / "materials"
    if materials_dir.is_symlink() or not materials_dir.is_dir():
        raise UnsafeInput("missing or unsafe materials directory")
    material_names = set()
    for p in materials_dir.iterdir():
        if p.is_symlink() or not p.is_file() or not p.name.endswith(".json") or not DIGEST_RE.fullmatch(p.stem):
            raise UnsafeInput("unsafe material file")
        value = _parse_json_file(p, max_bytes)
        _safe_content(value, f"materials.{p.stem}")
        if hashlib.sha256(_canonical(value)).hexdigest() != p.stem:
            raise ValueError("material digest mismatch")
        material_names.add(p.stem)
    if not refs.issubset(material_names):
        raise ValueError("unresolved material_ref")
    _safe_content(metadata, "run")
    return {
        "sourceAuthority": "ca-agent-demo",
        "sourceContract": "TraceStore/v2",
        "runId": run_dir.name,
        "eventCount": len(events),
        "eventSequenceOrigin": 0,
        "materialFileCount": len(material_names),
        "traceJsonlSha256": "sha256:" + hashlib.sha256(events_raw).hexdigest(),
        "nativeEvents": events,
        "otlpMapping": {
            "executionSpan": "NOT_DERIVABLE_FROM_PER_EVENT_TIMESTAMPS",
            "nativeSequenceAndLocator": "PRESERVED",
            "eventTiming": "UNAVAILABLE",
            "nativeMaterialDigest": "VALIDATED_LOCALLY",
            "ownerValidation": "NOT_RUN_REQUIRES_CA_AGENT_DEMO_TRACESTORE_LOAD_RUN",
            "evidenceCompleteness": "UNPROVEN",
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Read-only structural audit; outputs no raw materials")
    parser.add_argument("run_dir", type=Path)
    parser.add_argument("--proof-file", type=Path)
    args = parser.parse_args()
    result = audit_trace_store_run(args.run_dir)
    encoded = json.dumps(result, ensure_ascii=False, indent=2)
    if args.proof_file:
        args.proof_file.write_text(encoded + "\n", encoding="utf-8")
    print(encoded)


if __name__ == "__main__":
    main()
