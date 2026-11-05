# Trace Viewer 里程碑

**Updated · 2026-11-05**

**本轮纠偏（当前生效）**：Stage A 当前唯一候选为 [**Unified Trace v0.2 草案**](specs/unified-trace-v0.2.md)。v0.1 [架构审查](reviews/unified-trace-v0.1-architecture-review.md) 的六项 P0 已在 **v0.2 文本语义**处理：Execution 传递与孤儿关联、不可变记录/活动生命周期、精确关系、核心类型 Registry、Material/Owner Stream Closure、单一语义与在线/离线编码解耦。**下一步只做独立反例审查→规范批准→机器 Schema/黑盒向量；不得提前修改 Producer。**

**v0.2 独立评审更新**：[极简与反例评审](reviews/unified-trace-v0.2-minimality-review.md) 发现六项新的轻量化问题（身份必填、Activity Summary、Registry 范围、Material 等级、Model 可见边界、Online/Durable lossless 表述）。**接下来的规范工作只做减重：公共最小字段 + 条件能力 + 各等级验收**；v0.2 暂不可冻结，机器 Schema 暂缓。

**Stage B — Demo 重新实现：PAUSED / NOT_AUTHORIZED。** 规范批准之后再决定各 Producer/Consumer 一次性迁移顺序与旧 Adapter 清理。**下列 D0–D5 和 DSH 验收是历史工作/候选清单，不是当前要继续执行的步骤**；不要因阅读旧交接自动启动 DSH/Runtime/Agent Demo 代码开发。

**当前主线已调整：** 第一版必须同时验证 [真实执行可排障](design/trace-debuggability-audit.md) 的 **Q1–Q6/S1–S3** 与 [Agent 可复现/可学习准备](design/trace-reproducibility-learning-audit.md) 的 **Q7–Q9/S4**。下表 D2–D5 是之前的功能候选，**不是需要按顺序全部建设的既定工作包**；OTLP/Profile/多 Producer 改造等待上述排障实证。

**Agent 纵切进展：** 两份真实 ca-agent ProductTask Owner 归档的 Model Request/Response 摘要、**嵌入 user 消息的完整 Tool Catalog 与 Owner Surface Digest**、ToolResult/Next Model 精确关联全部 PASS；无副作用 Observation Stub 对照 PASS，[私有 CI](https://github.com/odango-chan/ca-console/actions/runs/41979646464)。Skill Context 对 **此 ProductTask 路线为 N/A**；L0 完整执行环境和全 L2 控制流重演仍待验收。**Skill-dependent DSH/Agent 路线首轮 source-only Owner Builder Golden 已 PASS**（Skill/Reference 可见、摘要/关联与负例），[证据](experiments/dsh-skill-replay-golden.md)；genuine DSH Session + 官方 JSONL 后端跨 Context 重开 **已 PASS（合成）**，**完整 Agent Loop 的 Session 集成与真实 Skill/Reference Owner closure 仍待验收**，不重复修已保存的 Catalog。详见 [ProductTask 实证](experiments/agent-replay-archive-audit.md)。

**两个最小实证纵切：** (A) 在授权私有环境，取 P8-D4 一个 Predicate、一个 CALL_RESULT 和一个异常转移，做受控诊断 Inspector，按 Q1–Q6 验收；(B) 取一轮真实生成的 Agent Model/Tool 输入输出，核验 exact model-visible snapshot / ToolResult delivery，完成 L0 离线重建与至少一个 L1/L2 隔离实验，按 Q7–Q9 验收。两条共享来源/材料原则，**不建设独立 Replay 平台或 Training Trace 合同**。**不得**以 106 行能加载替代诊断回答能力。

| 里程碑 | 目标 | 明确不做 |
|---|---|---|
| D0 Initialization | Repo governance、浅色单页骨架、显著 synthetic DSH Turn/Tool/Runtime 与确定性示例 | 不声称真实 Trace、没有 owner adapter |
| D0.5 Trace input contracts | 以当前 owner implementation 为准，盘点 v2 TraceStore 文件、Console Runtime/Agent API、验证/缺失/脱敏要求，冻结 D1/D2 前置门禁 | 不自建统一 wire schema、不偷改 producer |
| D0.6 Phoenix / OpenTelemetry selection spike | 2 个合成根 Trace；OTLP→Phoenix→API readback；Owner-native ↔ GenAI 字段映射与缺失报告 | 不将合成 PoC 称为真实 Owner/Evidence 验收，UI parity 需另测 |
| D0.7 Native source loss audit | TraceStore.v2 结构/序号/material digest / no-fabricated-event-time 8 synthetic tests | 不宣称真实 owner golden fixture、完整 Procedure/Model lineage 或 OTLP round-trip |
| D0.8 Console parity in Viewer | 基于两个 Console Prototype 的四阅读模式、Inspector、明确 ref folding、Host/Runtime 异常语义，使用新合成 fixture 与 Chromium UI 8 checks PASS（仅 synthetic） | 不复制私有源码/假定 Demo 是生产证据 |
| D1 Offline Agent Demo | **第一条纵切 PASS（Owner-generated synthetic golden）**：原生目录浏览器导入、格式/digest/基础 lineage 及负向验证；继续补 Owner 全部语义校验和真实授权数据 | 不变更 Agent Demo Producer，不声称真实 Run 或 OTLP Roundtrip |
| D1.1 Real archived diagnostic review | **PASS for real report UI**：独立 JSONL 适配，读取 106 行、21 spans/85 事件，源行号明确不等于 owner sequence，私有浏览器无外部请求 | 不重建完整 TraceStore v2，不声明 Evidence closure，不上传私有原文 |
| D2 Console / Runtime | 按 `runId`/owner 序号读取 typed records；correlation 只依据确切 refs；保留四泳道 | 不产生 `UnifiedTrajectoryEvent` 真源 |
| D3 Forensics | Model Input/Output、Tool Call/Result、Harness gates、Evidence、异常优先展开、UNKNOWN/reconcile、历史事件截断 | 不用 renderer 判定业务成功 |
| D4 Flow & comparison | 动态的 Procedure 节点路径 / retries、Run Diff、Source identity 深链到 Skill Studio | 不在 Viewer 编辑 Skill 或重执行 |
| D5 Integration | 可选只读 remote adapter / SSE、Console deep link、Pages 合规部署 | 不获得 runtime mutation authority |

前置要求：[D0.5 Trace 输入格式清单](contracts/trace-inputs.md)；已获得上游 Python Writer/Loader 真正生成的**合成 Golden**，通过私有 Owner 隔离 CI。D1 第一条纵切已验收；但完整 D1 Owner parity 与真实业务 Run 依然待验证。

**第一条独立纵切：** 真实 `ca-agent-demo` 一次确定性执行的持久化 Trace 可重开，展现 exactly matched Runtime node/predicate/evidence refs，再开展 Web D1 验收。

**第二条独立纵切：** DSH-inspired Model → Tool → Harness → Runtime → ToolResult → next Model Turn，包含异常恢复与显式因果。**额外判定**：可从冻结的 ModelInput/Output 与 ToolResult 交付材料重建模型真实可见内容，隔离重跑或 stub 回放得到对照结果；训练样本只做资格审查，不自动训练。
