# Trace Viewer 文档地图

**Status: Initial D0 baseline · 2026-11-04**

请按以下顺序阅读：

1. [README](../README.md) / [AGENTS](../AGENTS.md) — 定位与贡献规则
2. [WORK](WORK.md) — 当前事实（不把静态 Demo 视为生产 Trace）
3. [TRACEABILITY](TRACEABILITY.md) — 规范 → 代码 → 测试 → 验收
4. [Owner / Authority](architecture/ownership.md) — 权限与跨仓边界
5. [Trajectory UX](design/trajectory-viewer.md) — DSH-inspired 折叠轨迹与确定性下钻
6. [Trace 输入格式要求](contracts/trace-inputs.md) — **D0.5：基于当前真实 owner 格式冻结消费要求**
7. [Source Adapters](design/source-adapters.md) — 多来源只读适配
8. [OTel GenAI 映射与缺口](design/otel-genai-mapping.md) — D0.6 字段级映射；不是跨仓正式机器契约
9. [Phoenix × OTLP PoC](experiments/phoenix-otel-poc.md) — 合成 E2E 实测与 CI 证据
10. [Native TraceStore ↔ OTel 结构缺口与审计](experiments/native-otel-gap.md) — D0.7 8 个合成用例、不可伪造事件时间
11. [ROADMAP](ROADMAP.md) — 后续里程碑
12. [ADR-0001](decisions/0001-owner-native-viewer.md) — Owner-native、无第二真源
13. [DOCUMENTATION](DOCUMENTATION.md) — 文档规范

外部 canonical 阅读材料： [CA Console 设计](https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md)、[Console 完整轨迹原型](https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-prototype.html)、[异常场景](https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-anomaly-prototype.html)、[Agent Demo Trace](https://github.com/odango-chan/ca-agent-demo/blob/main/docs/design/run-trace.md)。

这些是上游 owner 的现有设计，并不是 Trace Viewer 自己重新发布的 canonical 业务契约。
