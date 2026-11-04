# ConnectionAgent · Trace Viewer

**只读的 Agent / Harness / Runtime 执行轨迹可视化 Demo。** 本仓沿用 [Skill Studio](https://github.com/odango-chan/ca-skill-studio-demo) 的轻量 Web 与文档治理方式，继承 [CA Console 的 DSH-inspired Trajectory 阅读模型](https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md)，不把轨迹简化为一张确定性 Procedure 图。

> 当前状态：**D0 仓库初始化**。示例是明确标注的合成数据，不代表真实 Agent、Runtime 或 5GC 验收。接口仍在演进；请以 [WORK](docs/WORK.md) 为准。

## 定位

- **Trace Viewer**：从 owner-native records **只读**呈现 Turn/Step、Model Interaction、Tool Interaction、Harness gates、Runtime、Observation、Evidence、Reconcile 与异常恢复。
- **ca-console**：产品级 Run / Task 管理与入口；**ca-agent-demo**：Demo TraceRecorder / TraceStore / 冻结执行记录；**ca-runtime** 与其他 owner：拥有真实执行与证据；**Skill Studio**：Skill Source 编辑，不负责执行真值。
- 仅已明确关联的记录才连线；缺失来源显示 **UNAVAILABLE**。不制造跨 owner 全局序号，不重新计算执行终态，不收集模型隐藏推理链。

## 本地使用

需要 Node.js 24+。

```bash
npm install
npm test
npm run typecheck
npm run build
npm run dev
```

开发界面默认使用 **synthetic / illustration only** 样本。D1 才正式接入 `ca-agent-demo` 的 `run.json`、`trace.jsonl`、`materials/<digest>.json` 只读导入；后续再做 `ca-console` owner-native Run/Trajectory Adapter。不得把伪造数据包装成真实 Trace。

## 文档

[AGENTS.md](AGENTS.md) · [文档地图](docs/README.md) · [当前状态](docs/WORK.md) · [实现追溯](docs/TRACEABILITY.md) · [架构边界](docs/architecture/ownership.md) · [UX 基线](docs/design/trajectory-viewer.md) · [Adapter 方案](docs/design/source-adapters.md) · [里程碑](docs/ROADMAP.md)

本仓不直接修改其他仓的业务行为、Schema、Source/Runtime 规则。Pages 发布和真实浏览器验收只有在工作流实际通过后才标记为 PASS。
