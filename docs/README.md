# Trace Viewer 文档地图

**Status: Unified Trace v0.2 DRAFT（当前唯一候选规范）；v0.1、D1/DSH/Runtime/Phoenix 均为历史分析/实现证据 · 2026-11-05**

请按以下顺序阅读：

1. [README](../README.md) / [AGENTS](../AGENTS.md) — 定位与贡献规则
2. [WORK](WORK.md) — 当前事实（不把静态 Demo 视为生产 Trace）
3. [Unified Trace Specification v0.2](specs/unified-trace-v0.2.md) — **当前唯一候选规范正文**；已覆盖 6 P0，但未冻结、未通过机器一致性测试
4. [v0.1 架构评审与冻结阻塞](reviews/unified-trace-v0.1-architecture-review.md) — 六项修订来源；[v0.1 历史草案](specs/unified-trace-v0.1.md) 仅供对照
5. [排障可回答性审计](design/trace-debuggability-audit.md) — 诊断 Q1–Q6、P8-D4 来源缺口、S1–S3
6. [Agent 可复现 / 可学习准备](design/trace-reproducibility-learning-audit.md) — **共同的第一版验收入口**：L0–L2、Q7–Q9/S4、既有 DSH 快照/Benchmark 闭包
7. [DSH Skill/Reference Owner Golden](experiments/dsh-skill-replay-golden.md) — source-only Snapshot Builder PASS、完整 DSH Agent Loop 仍待验收
8. [Agent Replay 真实归档审计](experiments/agent-replay-archive-audit.md) — 两份 Owner Model→Tool→Model 材料，精确交接 PASS、完整 L0 PARTIAL
9. [Trace 需求与现状审计](design/trace-requirements-audit.md) — R01–R16 需求完整性库存，不等于第一版全部交付
10. [Trace 统一评估](design/trace-unification-assessment.md) — 当前 Agent/Runtime/Console/OTel 对照，未来一个 Trace 契约的候选路线
11. [TRACEABILITY](TRACEABILITY.md) — 规范 → 代码 → 测试 → 验收
12. [Owner / Authority](architecture/ownership.md) — 权限与跨仓边界
13. [Trajectory UX](design/trajectory-viewer.md) — DSH-inspired 折叠轨迹与确定性下钻
14. [Console 轨迹 Demo 对照](design/console-prototype-parity.md) — D0.8 四阅读模式、Model/Tool folding、异常案例和实际 UI 验收
15. [Trace 输入格式要求](contracts/trace-inputs.md) — **D0.5：基于当前真实 owner 格式冻结消费要求**
16. [Source Adapters](design/source-adapters.md) — 多来源只读适配
17. [OTel GenAI 映射与缺口](design/otel-genai-mapping.md) — D0.6 字段级映射；不是跨仓正式机器契约
18. [Phoenix × OTLP PoC](experiments/phoenix-otel-poc.md) — 合成 E2E 实测与 CI 证据
19. [D1.1 P8-D4 真实诊断 JSONL 导入](experiments/real-p8d4-review-import.md) — 私有 CI 106 行与 Chromium 实测，报告不是原生 v2
20. [D1 Owner-generated Golden 互操作与浏览器导入](experiments/native-d1-import.md) — 上游 Writer/Loader 与 Viewer 双重验收
21. [Native TraceStore ↔ OTel 结构缺口与审计](experiments/native-otel-gap.md) — D0.7 8 个合成用例、不可伪造事件时间
22. [ROADMAP](ROADMAP.md) — 后续里程碑
23. [ADR-0001](decisions/0001-owner-native-viewer.md) — Owner-native、无第二真源
24. [DOCUMENTATION](DOCUMENTATION.md) — 文档规范

外部 canonical 阅读材料： [CA Console 设计](https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md)、[Console 完整轨迹原型](https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-prototype.html)、[异常场景](https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-anomaly-prototype.html)、[Agent Demo Trace](https://github.com/odango-chan/ca-agent-demo/blob/main/docs/design/run-trace.md)。

这些是上游 owner 的现有设计，并不是 Trace Viewer 自己重新发布的 canonical 业务契约。
