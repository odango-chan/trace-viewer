# D1.1 — Existing P8-D4 REAL diagnostic archive (read-only, no re-execution)

**Status: REAL_CAPTURE_FOUND / STRUCTURE_INSPECTED; private browser acceptance PENDING**
**Date: 2026-11-05**
**Source repository: private \`odango-chan/ca-agent-demo\`**
**Source file: \`artifacts/reviews/20261104-createdsession-p8d4-final-live-e2e/evidence/runtime-trace-attempt2.jsonl\`**
**Proof workflow: [private owner interop](https://github.com/odango-chan/ca-agent-demo/actions/workflows/trace-viewer-native-golden.yml)**

## 1. What we actually found

The P8-D4 final 5GC E2E report archived on 2026-11-04 includes a **real execution-derived runtime diagnostic JSONL**. It is not hand-written synthetic test data, and we did not regenerate or change the 5GC execution. Its basic observed structure:

| Record class | Count |
|---|---:|
| Total JSONL lines | 106 |
| Timed diagnostic spans | 21 |
| Semantic diagnostic events | 85 |
| \`CALL_RESULT\` | 14 |
| \`GRAPH_TRANSITION\` | 18 |
| \`PREDICATE_EVALUATED\` | 21 |
| \`VERIFY_RESULT\` | 21 |
| \`PROCEDURE_TERMINAL\` | 6 |
| \`SKILL_RESULT\` | 5 |

The two **different** line shapes are (1) \`kind="span"\` with \`name/stage/status/startedAt/endedAt/durationMs\`, and (2) semantic event with \`kind/data/diag/material/summary\`. They are a **diagnostic report projection, not the TraceStore v2 Writer files**.

Do not claim any of these:
- \`TraceStore.load_run\` validation of this archive: **NOT_APPLICABLE**. No \`run.json\`, \`trace.jsonl\`, or \`materials/<sha256>.json\` are archived with it.
- Exact persisted owner event \`sequence\`, eventId, per-event occurredAt, signed closure, or \`ca-runtime RunEvent.v1\`: **NOT_PRESENT/NOT_VERIFIED**. JSONL **file line number is only a locator**.
- Rebuilding exact DSH Model inputs, ToolResult delivery, or provenance from \`summary\`/timing: **NOT_ALLOWED**.
- Evidence material content integrity or full cross-owner E2E correctness: the overall private run report contains separate evidences, but this JSONL alone does **not** prove closure.

An original live workspace such as \`/tmp/opencode/p8d4/run2\` is mentioned by the archived report, but it is **not available through the GitHub copy**. A complete \`.runs/<run_id>/\` TraceStore v2 directory was not located in the checked-in repository tree. We cannot reconstruct it from this diagnostic export.

## 2. Separate adapter for a distinct source

\`site/review-diagnostic.mjs\` accepts **one local \`.jsonl\` file** with strict bounded shapes and returns a **separate** \`REVIEW_DIAGNOSTIC\` presentation kind:
- 4 MiB / 10,000 lines safety ceiling.
- Source authority \`ca-agent-demo:review-export\`, \`ownerSequence=null\`, and \`sourceLine=<physical file line>\`.
- Native event kind and only allowlisted explicit status values; diagnostic timed span duration is displayed only when genuinely present.
- Deliberately discards complete \`data\`, \`material\`, \`diag\`, and raw \`summary\` before returning any records to React. There are **zero invented causalRefs**.
- Browser only, read-only: no runtime/provider API, request re-execution, file upload, local storage or backend.
- The Viewer badge must say **ARCHIVED DIAGNOSTIC · NOT OWNER NATIVE**, not TraceStore v2; Inspector shows locator plus null owner sequence.

Unit tests: \`tests/review-diagnostic.test.mjs\` exercise synthetic shape/metadata, no sensitive body leakage, and negative cases. The same file has an optional real-capture test gated on \`REAL_DIAGNOSTIC_PATH\`; public CI skips it. A separate \`tests/review_real_ui.py\` opens the actual file in a headless browser **inside the private owner workspace** without screenshots, DOM export or raw traces in logs.

## 3. Next true-native gate

To test an **actual** TraceStore v2 full native real-world Run rather than a runtime report:
1. Acquire a complete source directory from a deliberately preserved Owner Run, **in its authorized private environment**, not from a diagnostic dump.
2. Call existing \`TraceStore.load_run\` and record the validation status and schema/source version.
3. Validate in Viewer with no leakage, and compare exact event count, owner sequences, model correlation, spans and canonical digest references.
4. Never publicly upload real 5GC, model prompts, identifiers, N1/N2, material bodies or redacted raw file copies.

This archive provides useful **REAL RECORD UI coverage** independently of the synthetic Golden v2 compatibility proofs. It must not be labeled \`NATIVE_TRACE_STORE_V2_PASS\`.
