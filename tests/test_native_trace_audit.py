"""Synthetic schema-shaped fixtures only; never real model/NF traces."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from native_trace_audit import audit_trace_store_run, _canonical


class NativeAuditTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name) / "synthetic-run"
        self.root.mkdir()
        (self.root / "materials").mkdir()
        self.meta = {
            "trace_format_version": 2, "run_id": "synthetic-run",
            "intentInterpretationLlmCalls": 0, "skillRoutingLlmCalls": 0,
            "planningLlmCalls": 0, "totalLlmCalls": 0,
            "started_at": "2026-01-01T00:00:00.000Z",
            "ended_at": "2026-01-01T00:00:01.000Z",
            "duration_ms": 1000.0, "spans": [],
        }
        self.events = []
        self.save()

    def save(self):
        (self.root / "run.json").write_text(json.dumps(self.meta), encoding="utf-8")
        (self.root / "trace.jsonl").write_text(
            "".join(json.dumps(x, ensure_ascii=False, sort_keys=True,
                               separators=(",", ":")) + "\n" for x in self.events),
            encoding="utf-8",
        )

    def add(self, *, kind="DEMO_MODE", data=None, ref=None):
        self.events.append({
            "sequence": len(self.events), "stage": "HOST", "kind": kind,
            "summary": "synthetic only", "data": sorted((data or {}).items()),
            "material_ref": ref,
        })
        self.save()

    def material(self, value):
        digest = hashlib.sha256(_canonical(value)).hexdigest()
        (self.root / "materials" / f"{digest}.json").write_bytes(_canonical(value) + b"\n")
        return digest

    def test_empty_valid_run_preserves_absence_of_event_timing(self):
        got = audit_trace_store_run(self.root)
        self.assertEqual(0, got["eventCount"])
        self.assertEqual("UNAVAILABLE", got["otlpMapping"]["eventTiming"])
        self.assertEqual("UNPROVEN", got["otlpMapping"]["evidenceCompleteness"])

    def test_pair_array_unicode_and_digest_reference(self):
        ref = self.material({"名字": "合成数据", "value": 1})
        self.add(data={"a": 1, "b": [2, 3]}, ref=ref)
        self.add(kind="RUN_SUCCEEDED")
        got = audit_trace_store_run(self.root)
        self.assertEqual(2, got["eventCount"])
        self.assertEqual(1, got["materialFileCount"])
        self.assertEqual("trace.jsonl#sequence=0", got["nativeEvents"][0]["nativeLocator"])
        self.assertFalse(got["nativeEvents"][0]["hasNativeEventTimestamp"])

    def test_bad_sequence_rejected(self):
        self.add()
        self.events[0]["sequence"] = 1
        self.save()
        with self.assertRaisesRegex(ValueError, "sequence"):
            audit_trace_store_run(self.root)

    def test_unsorted_pair_array_rejected(self):
        self.add(data={"a": 1, "b": 2})
        self.events[0]["data"] = [["b", 2], ["a", 1]]
        self.save()
        with self.assertRaisesRegex(ValueError, "sorted"):
            audit_trace_store_run(self.root)

    def test_wrong_digest_rejected(self):
        ref = self.material({"safe": "value"})
        (self.root / "materials" / f"{ref}.json").write_text('{"safe":"different"}')
        with self.assertRaisesRegex(ValueError, "digest mismatch"):
            audit_trace_store_run(self.root)

    def test_missing_material_rejected(self):
        self.add(ref="a" * 64)
        with self.assertRaisesRegex(ValueError, "unresolved"):
            audit_trace_store_run(self.root)

    def test_extra_metadata_rejected(self):
        self.meta["fakeStatus"] = "SUCCEEDED"
        self.save()
        with self.assertRaisesRegex(ValueError, "metadata keys"):
            audit_trace_store_run(self.root)

    def test_secret_bearing_material_rejected(self):
        ref = self.material({"api_key": "do-not-share"})
        self.add(ref=ref)
        with self.assertRaisesRegex(ValueError, "secret-like"):
            audit_trace_store_run(self.root)


if __name__ == "__main__":
    unittest.main()
