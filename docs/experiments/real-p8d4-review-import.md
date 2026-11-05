# D1.1 — Existing P8-D4 REAL diagnostic archive (read-only, no re-execution)

**Status: PRIVATE_REAL_REPORT_READBACK_PASS + CHROMIUM_UI_PASS; not TraceStore v2**
**Date: 2026-11-05**
**Source repository: private `odango-chan/ca-agent-demo`**
**Source file: `artifacts/reviews/20261104-createdsession-p8d4-final-live-e2e/evidence/runtime-trace-attempt2.jsonl`**
**Proof: [Private owner run 41961642639](https://github.com/odango-chan/ca-agent-demo/actions/runs/41961642639)**
**Viewer pinned for private proof: `eeee4659342f424f6bcfcc0f2281f4bb82dc44d9`**

## 1. What we actually found

The P8-D4 final 5GC E2E report archived on 2026-11-04 includes a **real execution-derived runtime diagnostic JSONL**. It is not hand-written synthetic test data, and we did not regenerate or change the 5GC execution. Its basic observed structure:

| Record class | Count |
|---|---:|
| Total JSONL lines | 106 |
| Timed diagnostic spans | 21 |
| Semantic diagnostic events | 85 |
| `CALL_RESULT` | 14 |
| `GRAPH_TRANSITION` | 18 |
| `PREDICATE_EVALUATED` | 21 |
| `VERIFY_RESULT` | 21 |
| `PROCEDURE_TERMINAL` | 6 |
| `SKILL_RESULT` | 5 |

The two **different** line shapes are (1) `kind="span"` with `name/stage/status/startedAt/endedAt/durationMs`, and (2) semantic event with `kind/data/diag/material/summary`. They are a **diagnostic report projection, not the TraceStore v2 Writer files**.

Do not claim any of these:
- `TraceStore.load_run` validation of this archive: **NOT_APPLICABLE**. No `run.json`, `trace.jsonl`, or `materials/<sha256>.json` are archived with it.
- Exact persisted owner event `sequence`, eventId, per-event occurredAt, signed closure, or `ca-runtime RunEvent.v1`: **NOT_PRESENT/NOT_VERIFIED**. JSONL **file line number is only a locator**.
- Rebuilding exact DSH Model inputs, ToolResult delivery, or provenance from `summary`/timing: **NOT_ALLOWED**.
- Evidence material content integrity or full cross-owner E2E correctness: the overall private run report contains separate evidences, but this JSONL alone does **not** prove closure.

An original live workspace such as `/tmp/opencode/p8d4/run2` is mentioned by the archived report, but it is **not available through the GitHub copy**. A complete `.runs/<run_id>/` TraceStore v2 directory was not located in the checked-in repository tree. We cannot reconstruct it from this diagnostic export.

## 2. Separate adapter for a distinct source

`site/review-diagnostic.mjs` accepts **one local `.jsonl` file** with strict bounded shapes and returns a **separate** `REVIEW_DIAGNOSTIC` presentation kind:
- 4 MiB / 10,000 lines safety ceiling.
- Source authority `ca-agent-demo:review-export`, `ownerSequence=null`, and `sourceLine=<physical file line>`.
- Native event kind and only allowlisted explicit status values; diagnostic timed span duration is displayed only when genuinely present.
- Deliberately discards complete `data`, `material`, `diag`, and raw `summary` before returning any records to React. There are **zero invented causalRefs**.
- Browser only, read-only: no runtime/provider API, request re-execution, file upload, local storage or backend.
- The Viewer badge must say **ARCHIVED DIAGNOSTIC · NOT OWNER NATIVE**, not TraceStore v2; Inspector shows locator plus null owner sequence.

Unit tests: `tests/review-diagnostic.test.mjs` exercise synthetic shape/metadata, no sensitive body leakage, and negative cases. The same file has an optional real-capture test gated on `REAL_DIAGNOSTIC_PATH`; public CI skips it. A separate `tests/review_real_ui.py` opens the actual file in a headless browser **inside the private owner workspace** without screenshots, DOM export or raw traces in logs.

## 3. Executed private verification

Private CI passed (1) existing **2/2** synthetic Owner Writer/Loader Golden runs, (2) native v2 importer **7/7** negative/interoperability test groups, (3) diagnostic reader **4/4** test groups including the actual private P8-D4 archived file, (4) native Golden Chromium, and (5) real archived diagnostic Chromium. The real test asserts **106** source file lines, **21** diagnostic spans, **85** diagnostic events, **null native owner sequence for all records**, local display of source references, and no external browser requests. No screenshot, DOM dump, complete diagnostics, evidence body or real file copy is uploaded to public or private artifacts; only synthetic Writer proof metadata is uploaded.

[Private acceptance run](https://github.com/odango-chan/ca-agent-demo/actions/runs/41961642639). This is an acceptance of **viewing the archived real report**. It is not a new 5GC execution, a replay, an auditable RunEvent material closure, or a full native v2 real Run.

## 4. Next true-native gate

To test an **actual** TraceStore v2 full native real-world Run rather than a runtime report:
1. Acquire a complete source directory from a deliberately preserved Owner Run, **in its authorized private environment**, not from a diagnostic dump.
2. Call existing `TraceStore.load_run` and record the validation status and schema/source version.
3. Validate in Viewer with no leakage, and compare exact event count, owner sequences, model correlation, spans and canonical digest references.
4. Never publicly upload real 5GC, model prompts, identifiers, N1/N2, material bodies or redacted raw file copies.

This archive provides useful **REAL RECORD UI coverage** independently of the synthetic Golden v2 compatibility proofs. It must not be labeled `NATIVE_TRACE_STORE_V2_PASS`.

## 5. Viewer V1 local Inspector readback (Draft PR #2, 2026-11-05)

[Viewer PR #2](https://github.com/odango-chan/trace-viewer/pull/2) adds an explicit on-demand, local-only review preview. The original diagnostic importer continues to discard all `data`, `diag`, `material` and raw `summary` from its presentation model. Only after the user selects a supported source line and presses **Show allowed local fields** does the reader re-open the same local File object and project bounded, allowlisted scalar metadata. The preview resets when the selection or Run changes.

**Private read-only proof:** The actual archived attempt 2 file was fetched inside the authorized private GitHub context and used only as in-memory input to the branch's importer and preview functions. It yielded 106 lines (21 span + 85 semantic events); **85/85 supported semantic records** were accessible through the allowlisted preview, including all 14 CALL_RESULT, 18 GRAPH_TRANSITION, 21 PREDICATE_EVALUATED, 21 VERIFY_RESULT, 6 PROCEDURE_TERMINAL and 5 SKILL_RESULT. No source body, subscriber identifiers, values, raw diagnostic, material bytes or private artifact copy were emitted or committed.

The 21 Predicate and 21 Verify verdicts in attempt 2 are all PASS. That file cannot validate UNKNOWN/failure navigation; synthetic FAIL/UNKNOWN tests cover that path instead. Some diagnostic fields are deliberately withheld because they are not safe scalars; **19 Predicate `reason` values are null**, displayed as `NOT PROVIDED IN SOURCE`, not as redactions. Evidence-ref counts indicate source presence, **not evidence verification**.

**Verification status:** 23/24 isolated V8 test cases PASS, 1 private file-path-dependent Node test SKIPPED, 0 FAIL. The new **synthetic Chromium interaction suite is PASS (11/11)** and Node 24 unit/typecheck/build are PASS on [the verified Viewer code commit](https://github.com/odango-chan/trace-viewer/commit/1b5cfc22ebd3d2caaa0368bd8a6e8816a61e7222). However, the direct private readback is **not** a Chromium acceptance of this real archived file, Owner Loader conformance, material digest verification or Q1–Q6 full diagnostic closure. Those remain pending before merging PR #2.

## 6. Standalone attempt 1 diagnosis report (Viewer V1, Draft PR #2)

The original private E2E archive also contains `evidence/attempt1-diagnosis.json`, a **standalone unversioned reviewer diagnosis**, not a Runtime event stream or a material-verifiable TraceStore. This document reports the first failure at the `RAN Adoption` stage in `await-ran-result`, with Owner result `UNRESOLVED`, reason `WAIT_BUDGET_EXHAUSTED`, and three observations. Separately, its network-effect statement says the AMF accepted the earlier N1/N2 transfer; the review attributes the waiter's uncertainty to attempt selector bindings. These are **reported findings**, not new cross-Owner facts invented by the Viewer.

[Viewer PR #2](https://github.com/odango-chan/trace-viewer/pull/2) adds `site/review-finding.mjs` and an **independent local report panel**:

- Import is an explicitly selected, bounded local JSON file, not a remote fetch, not a new Run and not a Trace event. Unknown shape or unsafe text is rejected; original long root-cause prose, binding values, sensitive identifiers and arbitrary fields are never returned.
- Allowed fields cover only report owner/outcome, failure location, predicate, wait reason, reported observation count, reported network effect, and limited remediation hints. Binding **names** may be shown; their values are not.
- The panel says **not linked to the selected Run**, **Owner evidence not verified**, and **no native event sequence or causal edge established**. Switching Runs hides the panel. A user can explicitly reopen it without attaching it.
- **Private in-memory readback PASS** of the existing attempt 1 JSON with no raw values, original root-cause text or private source copy emitted. Synthetic unit tests and Chromium verify the UI/provenance boundary. [Node verify](https://github.com/odango-chan/trace-viewer/actions/runs/42028586438) PASS; [Chromium smoke](https://github.com/odango-chan/trace-viewer/actions/runs/42028586420) **13/13 PASS**.

**Limits:** This is a report viewing slice for S1, not reconstruction of attempt 1's missing Runtime stream or independent Fabric/AMF proof. The report's network-effect and root-cause statements remain source assertions until the underlying owner artifacts and exact identity linkage can be verified. Authentic private-file Chromium interaction, complete Q1–Q6 answers and cross-Owner evidence closure are **NOT_RUN / NOT_VERIFIED**.
