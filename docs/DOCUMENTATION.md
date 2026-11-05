# Documentation Governance

参考 [Skill Studio AGENTS](https://github.com/odango-chan/ca-skill-studio-demo/blob/main/AGENTS.md) 与 [CA Console 文档治理](https://github.com/odango-chan/ca-console/blob/main/docs/DOCUMENTATION.md)。

- `README.md` 只导航：不要堆逐阶段流水账。
- `docs/specs/unified-trace-v0.2.md` 是当前**唯一跨 Agent/Harness/Runtime 的统一 Trace 候选规范**；v0.1 是历史草案；DRAFT 未批准时不将它冒充机器契约或 Producer 的迁移授权。
- `docs/design/trace-*-audit.md` 与旧 D1/Phoenix/DSH 实验是**需求与实现证据**，不能当作未来规范的第二套定义。
- `docs/WORK.md` 只存唯一当前状态；验收没有实际执行一律 NOT_RUN。
- `docs/TRACEABILITY.md` 用可追溯的设计/owner 来源、代码、测试、证据定位符。
- `docs/architecture/ownership.md` 是内部 ownership 与 authority 唯一真源。
- `docs/design/trajectory-viewer.md` 是 Viewer UX 唯一真源。
- `docs/design/source-adapters.md` 是 Adapter 非权威投影约定。
- `docs/contracts/trace-inputs.md` 是 Viewer 对现有 owner-native 输入格式的只读消费要求与资格清单（不拥有 producer Schema）。
- `docs/decisions/` 记录架构取舍原因；`docs/ROADMAP.md` 记录阶段目标，执行工作使用 Issue。
- 上游专用契约不要复制成私有 `v2`；直接引用上游 owner 的文档与具体 pin。
- 不将本地绝对路径、未经脱敏的 model payload、订阅者身份或私有日志作为公开验收附件。
