# Trace Viewer 当前状态

**Updated: 2026-11-04**
**Scope: D0 仓库初始化；尚未接受生产 Trace。**

| 范围 | 设计 | 实现 | 验收 |
|---|---|---|---|
| D0 文档治理 / 责任边界 | ACCEPTED (local baseline) | INITIALIZED | 远端提交核验待记录 |
| D0 浅色 Web 壳 / 合成 DSH 轨迹 | INITIAL BASELINE | INITIALIZED | local/CI/Browser NOT_RUN |
| D0 Synthetic 定时异常、对照样本 | INITIAL BASELINE | INITIALIZED | tests NOT_RUN |
| D1 ca-agent-demo TraceRun JSONL + run metadata + materials 离线导入 | PROPOSED | NOT_STARTED | NOT_RUN |
| D2 ca-console / ca-runtime owner-native Run/Trajectory Adapter | PROPOSED | NOT_STARTED | NOT_RUN |
| D3 Model Input/Output、ToolResult、Evidence 和 Unknown/Reconcile 详情 | PROPOSED | NOT_STARTED | NOT_RUN |
| D4 Process / Procedure Flow、原文版本 identity、Skill Studio 深链 | PROPOSED | NOT_STARTED | NOT_RUN |
| D5 只读远程数据、live event refresh、Console 嵌入 | PROPOSED | NOT_STARTED | NOT_RUN |

本仓初始数据来自自行构造的合成 fixtures（永远标注 `SYNTHETIC`），并不代表 CA Console 原生数据、DeepSeek 官方协议、真实模型调用或 CreatedSession E2E。

当前支持和真实缺口依 [TRACEABILITY](TRACEABILITY.md)；不要把 docs 已有设计等同实现。
