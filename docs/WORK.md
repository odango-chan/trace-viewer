# Trace Viewer 当前状态

**Updated: 2026-11-05**
**Reviewed baseline: D1.1 real archived P8-D4 report import at main@2680e6fae1225c3b39b000da3ce7cc700883678f**
**Scope: D0–D0.8 synthetic/PoC + D1 strict TraceStore v2 folder reader (synthetic owner Golden) + D1.1 real P8-D4 archived diagnostic JSONL (private live-record UI proof); actual complete real TraceStore v2 remains NOT_RUN.**

| 范围 | 设计 | 实现 | 验收 |
|---|---|---|---|
| D0 文档治理 / 责任边界 | ACCEPTED | IMPLEMENTED | main 已核验；[CI](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423) |
| D0 浅色 Web 壳 / 合成 DSH 轨迹 | ACCEPTED (D0) | IMPLEMENTED | [CI 单测/类型检查/静态构建 PASS](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423)；Browser NOT_RUN |
| D0 Synthetic 异常、确定性对照样本 | ACCEPTED (D0) | IMPLEMENTED | 5 unit tests PASS（[CI](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423)） |
| D0.5 当前输入格式/原生 owner 契约盘点 | REVIEWED | DOCS_ONLY | 上游代码审阅，D1 importer / native fixture 验收 NOT_RUN；[要求](contracts/trace-inputs.md) |
| D0.6 OpenTelemetry GenAI ↔ CA 映射与 Phoenix PoC | CANDIDATE | PoC IMPLEMENTED | **PASS**：2 traces / 9 spans / Phoenix readback 9 / 5 native attributes；[report](experiments/phoenix-otel-poc.md) · [Actions](https://github.com/odango-chan/trace-viewer/actions/runs/41814143545)；**Chromium UI trace list PASS** [Phoenix Chromium UI CI](https://github.com/odango-chan/trace-viewer/actions/runs/41948042278)；完整 DSH parity / 真实 owner / Evidence completeness NOT_RUN |
| D0.7 TraceStore v2 本地只读审计 | DESIGN GATE | **8 synthetic tests IMPLEMENTED** | **8/8 PASS** [Native v2 audit CI](https://github.com/odango-chan/trace-viewer/actions/runs/41948042263)；Producer golden fixture、full owner loader、real Run、OTLP round-trip NOT_RUN；[loss audit](experiments/native-otel-gap.md) |
| D0.8 Console Demo-inspired Viewer modes | ACCEPTED for synthetic UI | IMPLEMENTED (4 modes, exact folding, 4 lanes, Inspector, 2 anomaly fixtures) | **Node 10/10 + Python 8/8 CI PASS** [verify](https://github.com/odango-chan/trace-viewer/actions/runs/41956588953); **Chromium 8 checks PASS** [run](https://github.com/odango-chan/trace-viewer/actions/runs/41956396421) + [screenshot](https://github.com/odango-chan/trace-viewer/actions/runs/41956396421/artifacts/13383166824); Console full UI parity & owner import NOT_RUN; [matrix](design/console-prototype-parity.md) |
| D1 ca-agent-demo TraceStore v2 本地目录导入 | IMPLEMENTED STRICT SUBSET | Browser read-only parser + material SHA / Source Inspector; producer runtime unchanged | **Owner Writer/Loader 2/2 PASS; JS 7/7 groups PASS; Chromium native folders PASS** [private owner CI](https://github.com/odango-chan/ca-agent-demo/actions/runs/41959276561); real 5GC run, full browser parity and all owner lineage cases NOT_RUN; [report](experiments/native-d1-import.md) |
| D1.1 真实 5GC 归档诊断 JSONL | REVIEW EXPORT ONLY | Independent `REVIEW_DIAGNOSTIC` local reader; raw summary/data/material dropped; file line not owner seq | **REAL P8-D4 106 lines = 21 spans + 85 events; private JS 4/4, Chromium PASS, no external requests** [owner CI](https://github.com/odango-chan/ca-agent-demo/actions/runs/41961642639); no owner-native v2 closure; [report](experiments/real-p8d4-review-import.md) |
| D2 ca-console / ca-runtime owner-native Run/Trajectory Adapter | PROPOSED | NOT_STARTED | NOT_RUN |
| D3 Model Input/Output、ToolResult、Evidence 和 Unknown/Reconcile 详情 | PROPOSED | NOT_STARTED | NOT_RUN |
| D4 Process / Procedure Flow、原文版本 identity、Skill Studio 深链 | PROPOSED | NOT_STARTED | NOT_RUN |
| D5 只读远程数据、live event refresh、Console 嵌入 | PROPOSED | NOT_STARTED | NOT_RUN |

本仓初始 UI fixtures 仍为手工合成（标记 `SYNTHETIC`）；D1 新增 Owner 原生代码生成的两份**合成 Golden**，非真实 DeepSeek、真实 5GC 或 CreatedSession E2E。任意本地目录仅受当前 JS 严格子集校验，不自动取得完整 Owner Loader 认证。

当前支持和真实缺口依 [TRACEABILITY](TRACEABILITY.md)；不要把 docs 已有设计等同实现。

D0 + D0.8 验收：GitHub Actions `npm test` **10/10 PASS**、`npm run typecheck` **PASS**、`npm run build` **PASS**、静态产物检查 **PASS**。这是基于合成 fixture 的工程门禁；**D0 Viewer UI 的 Chromium 合成验收已 PASS**（8 checks）；Pages、ca-console/Runtime typed owner Adapter、完整真实 TraceStore v2 Run 验收仍 **NOT_RUN**；P8-D4 **归档真实诊断报告**已独立验证可读，不能等同于 Live E2E 重执行。**独立 Phoenix Chromium project/trace-list smoke PASS**，并不等同于 D0 Viewer UI 或完整 DSH parity。
