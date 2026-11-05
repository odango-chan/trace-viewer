# Unified Trace Specification v0.2

**Status: DRAFT — architecture direction accepted, [minimality review identifies 6 freeze blockers](../reviews/unified-trace-v0.2-minimality-review.md); NOT FROZEN / NOT IMPLEMENTATION-AUTHORIZED**  
**Date: 2026-11-05**  
**Supersedes:** [v0.1 historical draft](unified-trace-v0.1.md) as the **only active candidate**.  
**Review basis:** [v0.1 architecture review, 6 P0](../reviews/unified-trace-v0.1-architecture-review.md). **Current independent review:** [v0.2 minimality / four adversarial scenarios](../reviews/unified-trace-v0.2-minimality-review.md).  
**Scope:** Agent, Harness, Runtime and external/tool execution; deterministic, LLM-only and mixed. **No source-code changes are authorized by this document.**

> **One semantic contract**, not one global business state machine, not one physical storage format, and not a DSH/Runtime-specific event format.

Normative language: **MUST = 必须**, **MUST NOT = 禁止**, **SHOULD = 应**, **MAY = 可**. These define *candidate* semantics until review approval. Logical field names/examples are not yet a machine Schema or published SDK API.

## 1. Outcomes: diagnose, reconstruct, learn

A compliant capture must allow authorized reviewers to answer:

- **Diagnose** — what ran, in what confirmed causal order, with what inputs, observations, decisions, owner-reported results, reasons and evidence; what is missing?
- **Reconstruct** — which exact effective outbound model request and Tool/Runtime observations were used *at the time*, under which versions; can authorized content be checked after export and reopening?
- **Learn** — can trace-derived examples be assessed independently for quality and use permission, without confusing a successful operation with a correct Agent decision?

No fake Model activity in deterministic-only runs; no reduction of Predicate/Verification to unstructured text; no automatic training, Skill mutation, external Tool execution or real 5GC replay.

**Important L0 boundary:** "Model-visible" in this specification means the **effective request dispatched by the Agent/adapter to the provider**. Unless the provider explicitly attests its internal prompt transformation, Trace MUST NOT claim to know hidden server-side prompt additions or the model's unobservable internal state.

## 2. Small logical model (four responsibilities, one contract)

| Responsibility | Definition | Implementation consequence |
|---|---|---|
| **Execution context** | Identifies a business execution across Runs, Attempts, callbacks and multiple telemetry traces; not a mandatory new persisted object | Propagated correlation fields on records, plus explicit late links |
| **Record** | A single stable, immutable **Activity** (bounded work) or **Fact** (discrete occurrence) | Both share identity, source, time, relations and material links |
| **Material** | An immutable versioned content object used for accurate inputs, outputs, diagnostic observations and evidence | Separate content bytes, integrity, access and retention; never infer from attributes |
| **Capture closure** | A verifiable declaration of what source-stream range was recorded, lost, sealed and retrievable | Express as a normal Fact with a Material manifest, not a fourth event database |

There is **no mandatory universal Owner business EventStore**, no mandatory new global Run entity, and no separate TrainingTrace or ReplayEvent contract. Existing DSH/RunEvent ideas are evidence about requirements, **not constraints on future Producer implementations**.

## 3. Identity, context propagation and lifetime (P0-1)

### 3.1 Identity roles

| Identity | Minting authority and lifetime | Required usage |
|---|---|---|
| `executionRef` | The **trusted root ingress/initiator** mints one stable opaque unique ID for a logical task; continuation/resume inherits it | Exactly one per rooted business execution; never equated with OTLP TraceId |
| `runRef` | An executor mints a new ID when a new actual run starts | A root may own multiple runs; keep the executor's ID unchanged through export |
| `attemptRef` | The attempting Owner mints a **new identity for each real retry** within a run | The same operation retried must never overwrite the previous attempt |
| `recordRef` | The emitting Owner (or a deterministic, owner-scoped mapping from its native immutable ID) creates it **once** | Globally unique by namespace/authority, stable across retries of *delivery*, exports and rereads |
| `activityRef` | The executor mints once for a real Activity attempt, independent of the delivery transport | Used by start/end facts and its final immutable Activity summary |
| `operationRef` / `requestRef` | The initiator mints one per logical request or mutation; distinguish operation identity from individual attempt IDs | Propagates through asynchronous response, ToolResult, Reconcile and external callbacks |
| `sourceStreamRef` + `streamEpochRef` + `ownerSequence` | Source Owner specifies a stream and restart/epoch; sequence applies only within that pair | Retained for reliable local ordering and completeness; no global cross-Owner sequence |

All IDs are **opaque**, unique within their declared scope, and MUST NOT encode secrets, personal identity, bearer tokens or arbitrary untrusted text. A Producer MUST document generation and scope; the Profile will later freeze one interoperable serialization. A common URI syntax is **not required**.

### 3.2 Propagation and orphans

1. Trusted root ingress mints `executionRef`. Every new downstream request **within a traceable trust boundary** SHOULD carry it plus the stable `requestRef/operationRef` and, if known, caller `activityRef`; the receiver verifies trusted origin and propagates the same ID.
2. An Owner receiving a message **without verified execution context** MUST preserve its authentic local request/operation identity and record it as **ORPHAN** (scope.executionRef omitted). It MUST NOT fabricate an apparent continuation of a known business execution merely to satisfy a field.
3. A genuinely independent root may mint a fresh `executionRef`; this is **different from an orphan missing upstream context**. Explicitly linking multiple executions later is allowed, but their identities stay distinct.
4. A late-arriving verified correlation MUST be emitted as an **immutable `trace.execution.linked` Fact** referring to the orphan record(s) and the confirmed Execution, including the originating correlation evidence. No silent mutation of old events or timestamp-only linkage.
5. Multiple Execution associations and shared external effects are represented by **explicit separate linking facts**, not by forcing one record into the wrong business scope. Unresolved associations stay unresolved.
6. A restarted or resumed executor MUST preserve inherited execution identity when present, but issue fresh `runRef/attemptRef` where a new real run/attempt occurs. `trace_id/span_id` may change independently.

### 3.3 Minimal propagated context (conceptual)

A trusted invocation carries: `executionRef`, `requestRef` **or** `operationRef`, optional `parentActivityRef`, and producer security/authority context. This is **not an instruction to expose these identifiers in every network protocol**, which may require a trusted mapping, and is not an excuse to trust arbitrary end-user headers.

## 4. Record model and lifecycle (P0-2)

### 4.1 Shared immutable record

| Logical field | Requirement | Rule |
|---|---|---|
| `profileVersion` | MUST | Logical Trace Profile version, distinct from Owner's source schema/type version |
| `recordRef` / `recordKind` | MUST | Stable ID, `ACTIVITY` or `FACT` |
| `type` + `typeVersion` | MUST | Namespaced semantic type; only registered core types carry cross-implementation required fields |
| `scope` | MUST | `executionRef` if verified, else explicit `ORPHAN`; `runRef/attemptRef` when applicable |
| `emitter` | MUST | Component/instance/version that captured and emitted this record |
| `source` | MUST | Authority Owner and immutable source record ID (or the record itself when native), source type/version and optionally stream/epoch/sequence |
| `time` | MUST | Fact occurrence time if available or explicit missing reason; Activity start/end as known, observed time separate |
| `relations[]` | MAY empty | Typed and source-proven refs; missing target is not silently guessed |
| `materials[]` | MAY empty | Role + immutable content descriptor/ref; conditionally mandatory for registered types |
| `fields` | MAY | Small structured, versioned type-specific facts, **not** an unrestricted substitute for required material |
| `telemetry` | MAY | OTel trace/span context when available, never the business identity authority |

**Conflict rule:** Delivery duplicate with identical `recordRef` and canonical content is **one record**. Same `recordRef` with different canonical content is **CONFLICT**, not last-writer-wins. A new real execution/retry has a different identity even when parameters are identical. Any correction or reclassification of an immutable Fact is another linked Fact, never an edit of its original payload.

### 4.2 Activity capture, start/end, crash and retries

**Single canonical rule:** An Activity has **one immutable final summary Record** when it settles, plus optional immutable `trace.activity.started` / `trace.activity.observed` Facts for live display and in-flight checkpoints. Start/end Facts and final summary use the same `activityRef` but **different recordRefs**.

- Activity summary MUST state `activityRef`, source, start/end if known, and **technical activity outcome** (`COMPLETED`, `ERROR`, `CANCELLED`, `UNRESOLVED`). A summary with a missing end time MUST explain why; no fabricated zero duration.
- A start Fact without a confirmed finish or closure is **last-known STARTED / terminal UNKNOWN**, not proof of business failure or perpetual RUNNING. Live UI may say *possibly ongoing*, clearly distinguished from confirmed facts.
- A late finish is recorded with real source time. A duplicate finish is deduplicated by ID; genuinely distinct attempts must not be collapsed.
- Crashes/restarts may produce an `UNRESOLVED` summary only when an authorized Owner issues that conclusion; silence is `UNKNOWN` to the reader. Reconcile may later add new Facts without rewriting prior uncertainty.
- Nested `parentActivityRef` is asserted only when the Owner knows it; no parent fabrication from wall-clock overlap or source order.
- Activity technical outcome never implies the Runtime mutation or external world state.

**Fact** is append-only. The exported form of an Activity summary and its start Facts MUST preserve their identities and relationships across online, durable and offline representations.

### 4.3 Time rules

Fact `occurredAt` and Activity `startedAt/endedAt` represent **source clocks** (UTC timestamp with defined precision/timebase). `observedAt` belongs to the observer and may differ; missing source time MUST have a reason. Owner-local sequence is the primary source ordering when a verified scope exists. Cross-host wall-clock ordering is **not causal proof**; intervals/durations MUST use one clock origin (preferably monotonic duration where recorded). Unknown clock quality or clock skew MUST be disclosed when relevant. No fabricated 0ms spans or export-time source timestamps.

## 5. Typed causal relations (P0-3)

A relation is `{kind, targetKind, targetRef, evidenceRef?}` on a Record. The source is the containing record. Forward references are legal: target not yet present is **UNRESOLVED**, not invalid by default. A `relation` is **CONFIRMED** only when the creating Owner has the target's exact identity or a trusted correlation receipt; guessed correlation belongs in non-normative UI suggestions, **never** in conformance/replay closure.

| `kind` | Allowed source → target | Meaning |
|---|---|---|
| `parent` | Activity or Fact → Activity identity | Known structural/nesting parent, not just adjacent timeline |
| `causedBy` | Activity/Fact → Record | Explicit action or fact that caused this record |
| `resultOf` | Result Fact → request/invocation Fact or Activity | Response belongs to precisely that request |
| `consumes` | Model dispatch/decision Fact or Activity → Material or previous Result Fact | **Effective outbound input** includes this exact content/ref; MUST be backed by the frozen input material |
| `retryOf` | retry Activity/Fact → prior Activity/Attempt identity | Explicit attempt relation; new attempt keeps unique IDs |
| `reconciles` | Reconcile Fact → operation/request/unknown-result identity | Confirmed attempt to resolve earlier uncertainty |
| `belongsTo` | `trace.execution.linked` Fact → Execution identity | Verified late association of orphan source refs to an Execution |

**Do not introduce `deliveredTo` or `evidenceFor` as ambiguous multi-purpose edges.** A Tool result being delivered is a separate Fact with confirmed **receiver identity** and `resultOf` link. A Material supports a diagnostic Fact by being in that Fact's `materials` with `role: evidence/diagnostic`.

**Delivery vs consumption:** `tool.result.observed` proves source produced a result; `tool.result.delivered` proves a named receiver observed it (Host vs Adapter distinguished); `model.request.dispatched` with exact effective input + `consumes` proves what the Agent/Adapter submitted to Provider. It MUST NOT be elevated to "Provider internal model certainly received it" unless a separate Provider receipt exists.

## 6. Small core type registry (P0-4)

All types have §4 common fields. **Required semantic content is not satisfied by a free-text summary.** A core type MAY refer to typed `fields` or sealed `materials` of the required role; a capture MUST declare `NOT_CAPTURED` if critical content is omitted, never silently omit it.

| Type family / examples | Mandatory type-specific meaning | Required material / relation when content exists |
|---|---|---|
| **Model** `model.request.dispatched`, `model.response.observed`, `model.attempt.failed` | Interaction/attempt identity, actual provider/model and effective configuration, dispatch or response boundary, request↔result correlation; failures include cause/phase | **`model-effective-request`** (exact outbound request incl. ordered messages/tool catalog and injected Skill/Reference), **`model-response`** for obtained output, attempt metadata and digest; response `resultOf` dispatch |
| **Tool** `tool.call.requested`, `tool.result.observed`, `tool.result.delivered` | requestRef, tool identity/version, specific attempt, outcome, receiver/knowledge on delivery | **`tool-arguments`**, **`tool-result`** and confirmed `resultOf`; delivery Fact names receiver; next model request requires its own `consumes` |
| **Runtime flow** `runtime.procedure.transitioned`, `runtime.procedure.terminal` | Invocation and node/edge identity, previous/next or terminal state, transition reason | Detailed flow/observation material when nontrivial; links to exact procedure invocation |
| **Runtime validation** `runtime.predicate.evaluated`, `runtime.verification.evaluated` | Predicate/verification identity, verdict, expected/observed or explicit `NOT_AVAILABLE`, reason, evidence source | **`diagnostic`**, **`evidence`** refs with typed expected/observed/why; no mere "passed" summary |
| **Operation** `operation.outcome.observed`, `operation.reconcile.resolved` | OperationRef, asserted Owner, certainty/outcome dimension, reconcile target and independent evidence | **`operation-evidence`** where needed; no collapsing UNKNOWN to SUCCESS |
| **Correlation** `trace.execution.linked` | Verified target execution, originally orphan sourceRef(s), evidence of linking | `belongsTo` plus correlation proof |
| **Capture** `trace.capture.closed`, `trace.capture.loss.observed` | Owner stream segment, epoch, asserted scope, checkpoint, loss/unknown counts | **`capture-manifest`** and missing-content/loss signals |

`trace.activity.started`/`trace.activity.observed` are **lifecycle Facts**, not separate domain-specific schemas.

The registry is a **minimum cross-domain set**, not an enumeration of CreatedSession, SSC, Fabric or every 3GPP procedure. Extensions MUST use a namespaced `type`+version and MUST NOT redefine core type meaning. No business-specific branch conditions in the Trace infrastructure.

### Independent outcome dimensions

Do **not** write a universal `success`. The asserted Owner and meaning must stay distinct: Activity technical completion; Runtime Procedure terminal; Operation effect/certainty (`OUTCOME_UNKNOWN` allowed); Reconcile result; Host knowledge and ToolResult delivery; external/world disposition; material completeness. Multiple conflicting Owner facts can simultaneously be true. Consumers display differences; they MUST NOT "fix" them.

## 7. Material, privacy and verifiable closure (P0-5)

### 7.1 Material descriptor

A Material is referenced by immutable `materialRef`. Descriptor includes at least `role`, `mediaType`, `contentVersion/encodingProfile`, `digestAlgorithm`, `digest`, `sourceOwner`, `classification`, `retentionPolicyRef` (when applicable) and recoverability. A digest covers a clearly defined **byte domain or canonical encoding**; it is invalid to compare raw UTF-8 bytes with JSON-normalized bytes without recording the transform.

Different roles MUST NOT be conflated: `model-effective-request` vs provider-wire request vs a UI summary; raw ToolResult vs Host-delivered ToolResult vs model-effective context; original evidence vs a redacted derivative. If redaction transforms content, it creates **another descriptor + digest + provenance**, not the same ref.

**Access and capture are independent dimensions:**

- Source capture: `CAPTURED / NOT_CAPTURED / LOST / UNKNOWN`.
- Content integrity: `VERIFIED / MISMATCH / NOT_VERIFIED`.
- Current retrieval: `AVAILABLE / ACCESS_DENIED / REDACTED / EXPIRED / UNAVAILABLE`.
- These states are **not** interchangeable. `ACCESS_DENIED` does not imply source failure; a content hash without retrievable authorized bytes does not imply L0 reconstructible.

Material may be in a separate secure store. Only authorized access can retrieve raw sensitive material; public Viewer or OTLP attributes MUST default to safe metadata. Exclude unobservable hidden reasoning; model-provided reasoning fields, prompts, secrets, identifiers and untrusted Tool text receive explicit classification, retention and usage restrictions. Material deletion/retention expiry may be announced in an immutable tombstone/update Fact; old Trace metadata is not silently overwritten, and L0 qualification may degrade.

### 7.2 Scope-specific capture closure

One universal `Execution COMPLETE` flag is **not sufficient** for multi-Owner systems. Owners SHOULD emit a `trace.capture.closed` Fact whose `capture-manifest` Material covers **one finite (Owner, sourceStreamRef, streamEpochRef, sequence range or authoritative checkpoint)**:

- owner/scope, first/last ID or checkpoint; whether source is **SEALED**; capture/export Profile versions;
- expected source records or asserted checkpoint + actual preserved record references/counts; when unknown, declare `UNKNOWN`, not fabricated counts;
- explicit sampling, dropped/filtered/truncated records, late/duplicate/conflicting records, unresolved references;
- referenced material roles/digests, known missing or restricted material; manifest's own verification algorithm/encoding;
- source capture status `COMPLETE / PARTIAL / UNKNOWN` **for this one scoped segment** and associated observed evidence.

**COMPLETE** is allowed only if the source Owner positively attests the finite sealed scope and record coverage; successfully opening a file, seeing N lines, or using unsampled telemetry does not prove closure. Capture manifest itself MUST be verified, not self-certifying by existence.

A cross-Owner Execution may expose an **aggregate view** of known closed ranges and explicit unknown owners/segments; unless a trusted participant inventory and all source closures exist, its global completeness is **UNKNOWN**, not COMPLETE.

**Replay L0 eligibility is independent:** it requires the exact effective outbound model request, archived response/attempts, known Tool/Observation deliveries, effective Skill/Reference and Tool schema, source relationships, available authorized materials and matching digests. A fully captured telemetry stream can still have **L0 PARTIAL** if Material wasn't saved. Partial redaction/expiry also affects current L0.

## 8. Online, durable and offline representations (P0-6)

**Normative rule: one semantic Profile; physical encodings MAY differ.** Online telemetry, durable capture and offline archive MUST preserve a **lossless common subset** consisting of all required IDs, source/type versions, causal refs, immutable Fact contents and Material descriptors. An encoding incapable of representing a required field is NOT a complete conformance implementation; it may be a **lossy observability view** only.

| Channel | Intended use | Guarantees |
|---|---|---|
| **Durable capture / archive** | Diagnose accurately and enable L0 reconstruction | Required semantic data and authorized Material must be recoverable and integrity checked; must include scoped closure status |
| **Online telemetry / OTLP candidate** | Live viewing, performance, monitoring, filtering | Useful projection; may be sampled/limited and MUST explicitly declare its coverage limit; may not be the only Replay source |
| **Offline export** | Transfer of finite Execution/Run subgraph and Material closure | Same stable refs, digests, relationships, type semantics and missing statuses; import can verify or return PARTIAL |

This **does not yet select** OTLP, JSONL, protobuf, ZIP, Phoenix or storage products. Standard [OTel Logs](https://opentelemetry.io/docs/specs/otel/logs/data-model/) distinguish source Timestamp from ObservedTimestamp; [OTel Tracing SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/) supports sampling and limits, so its output alone is not proof of complete capture. The [GenAI SemConv](https://github.com/open-telemetry/semantic-conventions-genai) is a moving candidate mapping, **not** our source of business authority. Do not force every Fact into a fake zero-length Span, or every Material body into Span attributes.

**Round-trip requirement:** Same logical record across durable → offline → reimport must retain identity, type-specific required content, relation targets, source occurrence/clock uncertainty, material digest and observed completeness. Sampling/transformations MUST be visible rather than silently appearing complete.

## 9. Replay and learning boundaries

**L0 (required design capability):** For each Model dispatch, reconstruct **what the Agent/adapter sent**, including ordered messages, injected context/Skill/References actually present, Tool Catalog/schema, effective provider settings and attempt/response, with source proofs and integrity. If provider internal prompt or model weights are not known, mark that unknown rather than claiming bit-exact model replay. L0 PASS is **historical input reconstruction**, not deterministic regeneration.

**L1:** optional later model rerun with frozen input and diff; no guarantee of identical model output.  
**L2:** optional later isolated Agent/Tool/Observation stub replay; must prohibit external mutations and separate historical vs newly generated IDs.  
**L3:** real external execution is a new run and is not a safe "replay".

**Learning** is a derived, separately admitted evaluation/training candidate with precise source refs/digests, independent Oracle/human labels and provenance, data rights, sensitive-content filtering, retention, eval/train split and leakage prevention. Runtime `SUCCEEDED` or self-reported LLM praise is not a quality label. Never auto-train or update Skills in a Trace Producer.

## 10. Conformance: anti-examples to execute after semantic approval

Future black-box conformance vectors are **specified but NOT_RUN**. These must be language-agnostic; a weak model must not replace them with handpicked screenshots.

| Gate | Positive requirement | Negative test / expected rejection |
|---|---|---|
| **C01 — Deterministic diagnostics** | Procedure/PDR-like steps and Predicate/Verification expected/observed/why/evidence preserved; no Model needed | Dropping reason/material and replacing with PASS-only string fails |
| **C02 — Model → Tool → Model** | Exact outbound request+Tool Catalog+Skill/Reference actually injected, ToolResult delivery and next dispatched input refs/digests | Only current Skill version or ToolResult hash with missing original bytes cannot L0 PASS |
| **C03 — Cross-owner correlation** | Explicit root context propagation and multiple Run/trace with distinct Owner outcomes | Three Owners generating unrelated `executionRef` for one propagated request fails |
| **C04 — Async, retries, reordering** | Stable request/operation identity, unique attempts, verified orphan late link and no inferred adjacency | Late callback bound by timestamp or reused attempt ID fails |
| **C05 — Idempotence and lifecycle** | Duplicate record delivery deduped; start Fact plus settled immutable Activity, crash remains UNKNOWN absent source conclusion | Same recordRef/different bytes accepted silently; missing end interpreted FAILED fails |
| **C06 — Material integrity/absence** | Exact encoding/digest check, ACCESS_DENIED vs NOT_CAPTURED vs LOST, explicit source-segment closure | Tampered material, public raw prompt, missing records declared COMPLETE fails |
| **C07 — Owner outcome truth** | Host RESULT_UNKNOWN and Runtime SUCCEEDED coexist; later Reconcile separately recorded | Derived single universal SUCCESS overwrites Host uncertainty fails |
| **C08 — Online/offline identity** | Durable→archive→readback preserves refs, type, causality, material digests and closure | OTLP sampled view imported as complete archive fails |
| **C09 — Replay safety** | L0 reconstruction without external Tool, L2 only in explicit isolated stub | Replay reissues real 5GC mutation or uses old operationRef to perform new side effect fails |
| **C10 — Learning eligibility** | Independent validity/quality, permissions, provenance, split and missing-data check | Runtime SUCCEEDED automatically marks every Agent Tool choice positive training sample fails |

## 11. Two counterexample walkthroughs (synthetic, no implementation)

### A — Runtime result exists, Agent does not know

Root `executionRef=E` → Agent Run A sends `operationRef=O` → Runtime Run R records mutation `COMMITTED` → network drops Host response → Host Fact `RESULT_UNKNOWN` → Reconcile Fact `reconciles O` observes committed. The Runtime outcome and Host knowledge are **not contradictory records to normalize away**: both appear with source Owner and timestamps. Activity technically completed in Runtime does not certify Agent knowledge. Replay cannot reapply O; L0 material links the Tool and independent Reconcile.

### B — Orphan asynchronous callback and hidden Skill Reference

An external callback arrives with `requestRef=Q` but no trustworthy E: source Fact keeps **ORPHAN + Q**. Later a verified correlation Fact associates that record with E and cites its trusted receipt; old source record remains unmodified. In another Agent Turn, `ca_read_reference` ran, but its ToolResult was removed by context compaction before dispatch: historical Tool result is still recorded, **not** in that Model request's `consumes`/effective request. A Viewer that claims the Reference was model-visible **fails C02** even if the Tool call succeeded.

## 12. What is closed vs still undecided

| v0.1 review blocker | v0.2 draft resolution | Remaining freeze work |
|---|---|---|
| P0-1 identity propagation | §3 trusted root, opaque identities, orphan + append-only late association | Concrete interoperability ID/context binding and cross-trust mapping |
| P0-2 lifecycle/idempotence | §4 immutable summary+facts, exact replay/delivery duplicates, crash rules | JSON/protobuf schema with unique constraints and producer conformance vectors |
| P0-3 ambiguous relations | §5 typed source/target and proof; delivery separate from consumption | Detailed typed relation validator |
| P0-4 type registry | §6 small core type families and required material roles | Machine-readable registry and enums |
| P0-5 material/closure | §7 Material encoding/integrity, source-stream closure, independent L0 status | File/package format, secure local retention and checkable manifest |
| P0-6 transport conflation | §8 one semantic Profile with online projection vs durable/offline guarantees | OTLP mapping round-trip and final wire/archive decision |

**Draft-level P0 topics are now explicitly addressed; this is not equivalent to independent review PASS or frozen v1.** Open decisions: final stable ID serialization; one chosen durable/offline encoding; OTLP+GenAI version pin and mapping; Material canonical bytes & privacy policy; machine type registry and conformance fixtures.

**Next step:** conduct a hostile architecture review of v0.2 against C01–C10, then approve/revise semantics; only afterward design formal machine Schema and black-box fixtures. **No DSH, Runtime, Agent Demo, Fabric or Console Producer edits in this phase.**
