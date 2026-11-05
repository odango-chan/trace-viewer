# ConnectionAgent · Trace Viewer

**只读的 Agent / Harness / Runtime 执行轨迹可视化 Demo。** 本仓沿用 [Skill Studio](https://github.com/odango-chan/ca-skill-studio-demo) 的轻量 Web 与文档治理方式，继承 [CA Console 的 DSH-inspired Trajectory 阅读模型](https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md)，不把轨迹简化为一张确定性 Procedure 图。

> 当前状态：**D1 原生 TraceStore v2 合成 Golden PASS；D1.1 真实 P8-D4 诊断 JSONL 的独立只读导入与私有 Chromium PASS；完整真实业务 TraceStore v2 仍未验收**。默认示例均为合成数据；额外可手动导入经验证的本地真实诊断文件，但不能把诊断导出当作原生全量执行证据。接口仍在演进；请以 [WORK](docs/WORK.md) 为准。

## Viewer 当前主线与 Trace 规范状态

**当前优先工作是 Viewer 的真实来源阅读、异常定位和 Inspector 下钻，而不是继续扩大 Trace 规范工作。** 先复用已实现的 TraceStore v2 和真实诊断 JSONL 本地导入，用真实故障故事验收 Q1–Q6；不要求等统一机器 Schema 冻结才改善 Viewer。
已形成 [**Unified Trace Specification v0.2（DRAFT，当前唯一候选）**](docs/specs/unified-trace-v0.2.md)，针对 [v0.1 评审指出的六项 P0](docs/reviews/unified-trace-v0.1-architecture-review.md) 完成了语义层修订；[**v0.2 独立反例评审**](docs/reviews/unified-trace-v0.2-minimality-review.md) 指出的六项减重问题已按正文修订；[**语义冻结复审**](docs/reviews/unified-trace-v0.2-semantic-freeze-review.md) 认为架构/轻量化基本通过，但四项关键条款现已补入候选语义，仍需机器 Schema/一致性验收，以**可诊断、可复现、可学习**为目标，覆盖执行身份、Activity/Fact、因果关系、诊断与模型可见材料、完整性和一致性门禁。现有多个 Viewer Adapter、DSH Session 测试与 Phoenix PoC 是**历史现状/选型证据**，不是规范标准；在 v0.2 评审定型前**暂停继续修改各 Producer**。v0.1 仅保留为[历史草案](docs/specs/unified-trace-v0.1.md)。

## 统一 Trace 长期目标（非 Viewer MVP 前置）

目标是**一套对外 Trace 契约**，覆盖 Agent、Harness、Runtime 诊断、确定性/LLM/混合执行；当前多格式仅服务存量兼容。**第一版同时验收可诊断与 Agent 可复现**：既能定位步骤、解释原因、核验证据，也能让宣称 AGENT_L0 的 Agent 在授权范围内重建当时实际外发模型请求及 ToolResult；隔离重演为后续独立能力，训练/自学习只要求合格数据来源，不自动训练。优先阅读 [诊断审计 Q1–Q6/S1–S3](docs/design/trace-debuggability-audit.md) 与 [Agent Replay/可学习审计 Q7–Q9/S4](docs/design/trace-reproducibility-learning-audit.md) 和 [真实 Model→Tool→Model 的摘要/ToolCatalog/Observation Stub 复核](docs/experiments/agent-replay-archive-audit.md)，再看 [需求库存 R01–R16](docs/design/trace-requirements-audit.md) 和 [候选 OTel/OTLP 评估](docs/design/trace-unification-assessment.md)。**OTLP 尚未冻结为最终方案，Producer 未改。**

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

开发界面默认使用 **synthetic / illustration only** 样本。已可从左侧选择 **Import TraceStore v2 folder**，在浏览器本地读取 `ca-agent-demo` 的 `run.json`、`trace.jsonl`、`materials/<digest>.json` 只读目录；结构与 SHA 检查通过后显示为 **LOCAL NATIVE · NOT OWNER VERIFIED**。该严格子集已有 Owner Writer/Loader 生成的合成 Golden 跨仓证明，但浏览器不会执行上游完整 Loader，真实业务 Run / ca-console owner-native Adapter 仍待验收。另可选择 **Import archived diagnostic JSONL**，在浏览器里只读查看真实执行归档的报告行与显式状态；原始材料、诊断正文不会自动呈现，文件行号不是 Owner Sequence。跨仓私有验收见 [D1.1 真实归档](docs/experiments/real-p8d4-review-import.md)。不得把诊断报告当作可验证的完整 TraceStore v2。

## 文档

[**当前 Unified Trace v0.2 草案**](docs/specs/unified-trace-v0.2.md) · [v0.1 历史评审](docs/reviews/unified-trace-v0.1-architecture-review.md) · [Unified Trace v0.1 草案](docs/specs/unified-trace-v0.1.md) · [AGENTS.md](AGENTS.md) · [文档地图](docs/README.md) · [当前状态](docs/WORK.md) · [实现追溯](docs/TRACEABILITY.md) · [架构边界](docs/architecture/ownership.md) · [排障可回答性审计](docs/design/trace-debuggability-audit.md) · [可复现/可学习审计](docs/design/trace-reproducibility-learning-audit.md) · [真实 Replay 归档闭包审计](docs/experiments/agent-replay-archive-audit.md) · [UX 基线](docs/design/trajectory-viewer.md) · [Console Demo 对照](docs/design/console-prototype-parity.md) · [输入格式要求](docs/contracts/trace-inputs.md) · [OTel GenAI 字段映射](docs/design/otel-genai-mapping.md) · [Phoenix PoC/Chromium UI 实测](docs/experiments/phoenix-otel-poc.md) · [Native ↔ OTel 缺口](docs/experiments/native-otel-gap.md) · [D1 Owner Golden 互操作](docs/experiments/native-d1-import.md) · [D1.1 真实 P8-D4 诊断导入](docs/experiments/real-p8d4-review-import.md) · [Adapter 方案](docs/design/source-adapters.md) · [里程碑](docs/ROADMAP.md)

本仓不直接修改其他仓的业务行为、Schema、Source/Runtime 规则。Pages 发布和真实浏览器验收只有在工作流实际通过后才标记为 PASS。
