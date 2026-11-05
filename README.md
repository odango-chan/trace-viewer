# ConnectionAgent · Trace Viewer

**只读的 Agent / Harness / Runtime 执行轨迹可视化 Demo。** 本仓沿用 [Skill Studio](https://github.com/odango-chan/ca-skill-studio-demo) 的轻量 Web 与文档治理方式，继承 [CA Console 的 DSH-inspired Trajectory 阅读模型](https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md)，不把轨迹简化为一张确定性 Procedure 图。

> 当前状态：**D1 首条 Owner Writer/Loader → Viewer 本地目录导入纵切 PASS（仅合成 Golden）；Console-inspired 四模式与 Phoenix PoC 继续保留；真实业务 Run 仍未验收**。示例是明确标注的合成数据，不代表真实 Agent、Runtime 或 5GC 验收。接口仍在演进；请以 [WORK](docs/WORK.md) 为准。

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

开发界面默认使用 **synthetic / illustration only** 样本。已可从左侧选择 **Import TraceStore v2 folder**，在浏览器本地读取 `ca-agent-demo` 的 `run.json`、`trace.jsonl`、`materials/<digest>.json` 只读目录；结构与 SHA 检查通过后显示为 **LOCAL NATIVE · NOT OWNER VERIFIED**。该严格子集已有 Owner Writer/Loader 生成的合成 Golden 跨仓证明，但浏览器不会执行上游完整 Loader，真实业务 Run / ca-console owner-native Adapter 仍待验收。不得把伪造数据包装成真实 Trace。

## 文档

[AGENTS.md](AGENTS.md) · [文档地图](docs/README.md) · [当前状态](docs/WORK.md) · [实现追溯](docs/TRACEABILITY.md) · [架构边界](docs/architecture/ownership.md) · [UX 基线](docs/design/trajectory-viewer.md) · [Console Demo 对照](docs/design/console-prototype-parity.md) · [输入格式要求](docs/contracts/trace-inputs.md) · [OTel GenAI 字段映射](docs/design/otel-genai-mapping.md) · [Phoenix PoC/Chromium UI 实测](docs/experiments/phoenix-otel-poc.md) · [Native ↔ OTel 缺口](docs/experiments/native-otel-gap.md) · [D1 Owner Golden 互操作](docs/experiments/native-d1-import.md) · [Adapter 方案](docs/design/source-adapters.md) · [里程碑](docs/ROADMAP.md)

本仓不直接修改其他仓的业务行为、Schema、Source/Runtime 规则。Pages 发布和真实浏览器验收只有在工作流实际通过后才标记为 PASS。
