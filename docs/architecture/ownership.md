# Trace Viewer Ownership / Authority

**Status: Accepted for D0 · 2026-11-04**

## One-way, read-only consumption

~~~text
ca-agent / Agent Host native records         ca-runtime / RuntimeHost
  ModelInput/Output · ToolCall/Result          RunEvent · Outcome · Reconcile · Evidence
                  \                          /
                   explicit owner refs only
                           |
ca-agent-demo TraceRun v2 -> Source Adapters <- ca-console read-side typed sources
                           |
                presentation projection
          (cards / folding / lanes / playback)
                           |
                    Trace Viewer UI
~~~

Viewer records are never the source of execution truth. Cross-owner order is **partial**, not global: sourceAuthority, schema/version, owner record identity, local sequence/revision, digest, explicit correlation/causal refs must survive. Only identical explicit refs authorize a causal edge; timestamps can be used for display, never identity joins.

## Owners

| Owner | Authority | Viewer may do |
|---|---|---|
| ca-agent / Agent Host | Model-visible Request, structured Output, Tool call/result and context as actually observed | Show exactly available model input, output and correlation; do not invent unseen prompts |
| ca-runtime | Run / Harness Gate / Mutation Outcome / Reconcile / terminal | Consume typed native records, preserve distinct outcome fields |
| ca-agent-demo | Demo TraceRecorder / Frozen Graph / Procedure / Predicate / Observation and TraceStore v2 | Read persisted events/materials offline, show original identities, no control writes |
| Service Fabric / Provider / 5GC owners | Their respective network operation/evidence | Show explicit owner evidence, not deduced network actions |
| ca-console | Product-level Run/Task navigation and trajectory read projection | Link to Viewer or embed it; don't duplicate its API authority |
| ca-skill-studio-demo | Skill source / editor UI | Deep-link by admitted Skill identity and source node; no editor embedded here |

## Safety

- Public Pages receives only synthetic non-sensitive fixtures; any user local import stays local.
- Sensitive hidden reasoning, credentials, raw network payloads, identities must never be fetched by default or emitted to logs.
- Viewer must never offer execution/disposition/mutation control.
- Runtime `SUCCEEDED`, Predicate `PASS`, journal certainty, Fabric `UNRESOLVED` are **independent reported facts**; do not collapse into synthetic pass/fail.
- Unknown + missing refs remain visible as UNKNOWN/UNAVAILABLE, not success.
