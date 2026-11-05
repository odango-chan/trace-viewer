# Trace Viewer 当前状态

**Updated: 2026-11-05**
**Reviewed baseline: Phoenix UI and native TraceStore audit at main@139febf227e5fc8b6ecc5ff326992a85539f8440**
**Scope: D0 synthetic browser shell + D0.5 input inventory + D0.6 Phoenix/OTel PoC + D0.7 native structural audit + D0.8 Console UI parity; still no production Trace import.**

| 范围 | 设计 | 实现 | 验收 |
|---|---|---|---|
| D0 文档治理 / 责任边界 | ACCEPTED | IMPLEMENTED | main 已核验；[CI](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423) |
| D0 浅色 Web 壳 / 合成 DSH 轨迹 | ACCEPTED (D0) | IMPLEMENTED | [CI 单测/类型检查/静态构建 PASS](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423)；Browser NOT_RUN |
| D0 Synthetic 异常、确定性对照样本 | ACCEPTED (D0) | IMPLEMENTED | 5 unit tests PASS（[CI](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423)） |
| D0.5 当前输入格式/原生 owner 契约盘点 | REVIEWED | DOCS_ONLY | 上游代码审阅，D1 importer / native fixture 验收 NOT_RUN；[要求](contracts/trace-inputs.md) |
| D0.6 OpenTelemetry GenAI ↔ CA 映射与 Phoenix PoC | CANDIDATE | PoC IMPLEMENTED | **PASS**：2 traces / 9 spans / Phoenix readback 9 / 5 native attributes；[report](experiments/phoenix-otel-poc.md) · [Actions](https://github.com/odango-chan/trace-viewer/actions/runs/41814143545)；**Chromium UI trace list PASS** [Phoenix Chromium UI CI](https://github.com/odango-chan/trace-viewer/actions/runs/41948042278)；完整 DSH parity / 真实 owner / Evidence completeness NOT_RUN |
| D0.7 TraceStore v2 本地只读审计 | DESIGN GATE | **8 synthetic tests IMPLEMENTED** | **8/8 PASS** [Native v2 audit CI](https://github.com/odango-chan/trace-viewer/actions/runs/41948042263)；Producer golden fixture、full owner loader、real Run、OTLP round-trip NOT_RUN；[loss audit](experiments/native-otel-gap.md) |
| D0.8 Console Demo-inspired Viewer modes | ACCEPTED for synthetic UI | IMPLEMENTED (4 modes, exact folding, 4 lanes, Inspector, 2 anomaly fixtures) | Unit tests PASS; [browser workflow](https://github.com/odango-chan/trace-viewer/actions/workflows/viewer-ui.yml) PENDING at time of documentation; [matrix](design/console-prototype-parity.md) |
| D1 ca-agent-demo TraceRun JSONL + run metadata + materials 离线导入 | PROPOSED | NOT_STARTED | NOT_RUN |
| D2 ca-console / ca-runtime owner-native Run/Trajectory Adapter | PROPOSED | NOT_STARTED | NOT_RUN |
| D3 Model Input/Output、ToolResult、Evidence 和 Unknown/Reconcile 详情 | PROPOSED | NOT_STARTED | NOT_RUN |
| D4 Process / Procedure Flow、原文版本 identity、Skill Studio 深链 | PROPOSED | NOT_STARTED | NOT_RUN |
| D5 只读远程数据、live event refresh、Console 嵌入 | PROPOSED | NOT_STARTED | NOT_RUN |

本仓初始数据来自自行构造的合成 fixtures（永远标注 `SYNTHETIC`），并不代表 CA Console 原生数据、DeepSeek 官方协议、真实模型调用或 CreatedSession E2E。

当前支持和真实缺口依 [TRACEABILITY](TRACEABILITY.md)；不要把 docs 已有设计等同实现。

D0 验收：GitHub Actions `npm test` **5/5 PASS**、`npm run typecheck` **PASS**、`npm run build` **PASS**、静态产物检查 **PASS**。这是基于合成 fixture 的工程门禁；D0 UI 原型本身的浏览器验收、Pages、真实 owner Adapter、Live E2E 仍 **NOT_RUN**。**独立 Phoenix Chromium project/trace-list smoke PASS**，并不等同于 D0 Viewer UI 或完整 DSH parity。
