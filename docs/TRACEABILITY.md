# Trace Viewer 实施追溯

**Date: 2026-11-04 · D0 engineering CI verified**

| Scope | Canonical design | Code / artifact | Test | Evidence |
|---|---|---|---|---|
| Repo governance | [DOCUMENTATION](DOCUMENTATION.md)、[ownership](architecture/ownership.md) | `AGENTS.md`、`README.md`、`docs/*` | doc links / review | [main commit](https://github.com/odango-chan/trace-viewer/commit/c21cdc97376209c5e5fb958d1ce7a406b88db488); [CI](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423) |
| D0 synthetic, owner-labeled records | [source-adapters](design/source-adapters.md) | `site/fixtures.mjs`、`site/projection.mjs` | `tests/projection.test.mjs` | [CI unit tests 5/5 PASS](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423); [CI build/typecheck PASS](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423); Browser NOT_RUN |
| D0 DSH-inspired foldable Turn/Tool/Runtime UI | [trajectory-viewer](design/trajectory-viewer.md) | `site/app.tsx`、`site/light.css` | `tests/projection.test.mjs` + future browser test | Browser NOT_RUN |
| D1 native Agent Demo import | [source-adapters](design/source-adapters.md) | NOT_STARTED | NOT_RUN | NOT_RUN |
| D2 Console/Runtime adapter | [source-adapters](design/source-adapters.md) | NOT_STARTED | NOT_RUN | NOT_RUN |

**约束：** `IMPLEMENTED`、`PASS`、`LIVE_PASS` 不得互换；没有 owner source refs 的样本只允许示意，不能作为跨仓真实证据。
