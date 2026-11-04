# Trace Viewer 当前状态

**Updated: 2026-11-04**
**Reviewed baseline: main@c21cdc97376209c5e5fb958d1ce7a406b88db488**（初始化 + 类型修正）
**Scope: D0 浏览器原型 + D0.5 原生格式盘点；尚未接受生产 Trace。**

| 范围 | 设计 | 实现 | 验收 |
|---|---|---|---|
| D0 文档治理 / 责任边界 | ACCEPTED | IMPLEMENTED | main 已核验；[CI](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423) |
| D0 浅色 Web 壳 / 合成 DSH 轨迹 | ACCEPTED (D0) | IMPLEMENTED | [CI 单测/类型检查/静态构建 PASS](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423)；Browser NOT_RUN |
| D0 Synthetic 异常、确定性对照样本 | ACCEPTED (D0) | IMPLEMENTED | 5 unit tests PASS（[CI](https://github.com/odango-chan/trace-viewer/actions/runs/41803355423)） |
| D0.5 当前输入格式/原生 owner 契约盘点 | REVIEWED | DOCS_ONLY | 上游代码审阅，D1 importer / native fixture 验收 NOT_RUN；[要求](contracts/trace-inputs.md) |
| D1 ca-agent-demo TraceRun JSONL + run metadata + materials 离线导入 | PROPOSED | NOT_STARTED | NOT_RUN |
| D2 ca-console / ca-runtime owner-native Run/Trajectory Adapter | PROPOSED | NOT_STARTED | NOT_RUN |
| D3 Model Input/Output、ToolResult、Evidence 和 Unknown/Reconcile 详情 | PROPOSED | NOT_STARTED | NOT_RUN |
| D4 Process / Procedure Flow、原文版本 identity、Skill Studio 深链 | PROPOSED | NOT_STARTED | NOT_RUN |
| D5 只读远程数据、live event refresh、Console 嵌入 | PROPOSED | NOT_STARTED | NOT_RUN |

本仓初始数据来自自行构造的合成 fixtures（永远标注 `SYNTHETIC`），并不代表 CA Console 原生数据、DeepSeek 官方协议、真实模型调用或 CreatedSession E2E。

当前支持和真实缺口依 [TRACEABILITY](TRACEABILITY.md)；不要把 docs 已有设计等同实现。

D0 验收：GitHub Actions `npm test` **5/5 PASS**、`npm run typecheck` **PASS**、`npm run build` **PASS**、静态产物检查 **PASS**。这是基于合成 fixture 的工程门禁；浏览器手动/Playwright、Pages、真实 owner Adapter、Live E2E 仍 **NOT_RUN**。
