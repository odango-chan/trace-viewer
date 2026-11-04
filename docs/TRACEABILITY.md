# Trace Viewer 实施追溯

**Date: 2026-11-04 · Initial D0 snapshot**

| Scope | Canonical design | Code / artifact | Test | Evidence |
|---|---|---|---|---|
| Repo governance | [DOCUMENTATION](DOCUMENTATION.md)、[ownership](architecture/ownership.md) | `AGENTS.md`、`README.md`、`docs/*` | doc links / review | GitHub commit after push; NOT_RUN before verification |
| D0 synthetic, owner-labeled records | [source-adapters](design/source-adapters.md) | `site/fixtures.mjs`、`site/projection.mjs` | `tests/projection.test.mjs` | local / CI NOT_RUN until executed |
| D0 DSH-inspired foldable Turn/Tool/Runtime UI | [trajectory-viewer](design/trajectory-viewer.md) | `site/app.tsx`、`site/light.css` | `tests/projection.test.mjs` + future browser test | Browser NOT_RUN |
| D1 native Agent Demo import | [source-adapters](design/source-adapters.md) | NOT_STARTED | NOT_RUN | NOT_RUN |
| D2 Console/Runtime adapter | [source-adapters](design/source-adapters.md) | NOT_STARTED | NOT_RUN | NOT_RUN |

**约束：** `IMPLEMENTED`、`PASS`、`LIVE_PASS` 不得互换；没有 owner source refs 的样本只允许示意，不能作为跨仓真实证据。
