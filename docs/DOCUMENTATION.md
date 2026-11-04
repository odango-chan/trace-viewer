# Documentation Governance

参考 [Skill Studio AGENTS](https://github.com/odango-chan/ca-skill-studio-demo/blob/main/AGENTS.md) 与 [CA Console 文档治理](https://github.com/odango-chan/ca-console/blob/main/docs/DOCUMENTATION.md)。

- `README.md` 只导航：不要堆逐阶段流水账。
- `docs/WORK.md` 只存唯一当前状态；验收没有实际执行一律 NOT_RUN。
- `docs/TRACEABILITY.md` 用可追溯的设计/owner 来源、代码、测试、证据定位符。
- `docs/architecture/ownership.md` 是内部 ownership 与 authority 唯一真源。
- `docs/design/trajectory-viewer.md` 是 Viewer UX 唯一真源。
- `docs/design/source-adapters.md` 是 Adapter 非权威投影约定。
- `docs/decisions/` 记录架构取舍原因；`docs/ROADMAP.md` 记录阶段目标，执行工作使用 Issue。
- 上游专用契约不要复制成私有 `v2`；直接引用上游 owner 的文档与具体 pin。
- 不将本地绝对路径、未经脱敏的 model payload、订阅者身份或私有日志作为公开验收附件。
