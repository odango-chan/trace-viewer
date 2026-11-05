# 统一 Trace 第三维审计：可复现、离线评测与后续学习

**状态：需求审计 / 提议，尚非冻结机器契约 · 2026-11-05**
**范围：Agent / DSH 为重点，同时覆盖 Harness、Runtime、Service Fabric 与外部环境**
**本轮仅复核和收敛需求：不改 Producer、不创建 Replay Event 类型、不启动训练管线、不冻结 OTLP 格式。**

> **实证更新（2026-11-05）**：私有 03/04 两份真实 ProductTask Owner 归档已核验 **Request/Response Snapshot JSON SHA、实际模型 user 消息中的完整 Tool Catalog 与 Owner SurfaceDigest、ToolResult/Next Model ref+body、无副作用 Observation Stub 均 PASS**。[审计证据](../experiments/agent-replay-archive-audit.md)。这条 ProductTask 路线的 Skill/Reference 为 **N/A**；另需测试需要 Skill Context 的 DSH/Planner 路线。完整 L0 执行环境 PARTIAL、L1/L2 全程 NOT_RUN、训练资格 NOT_QUALIFIED。

> **DSH Skill/Reference 纵切更新**：`ca-dsh` 真正的 ModelInput/Output Snapshot Builder 已通过 source-only synthetic owner-event Golden，验证 Skill/Reference 真实 Surface 可见性、Source refs、内容摘要及错误关联/不可见拒绝。[验收范围](../experiments/dsh-skill-replay-golden.md)。genuine DSH Session + 官方 JSONL 后端 `flush → close → fresh Context read` 和 ModelInput/Output 一致性 **PASS（synthetic）**，[证据](../experiments/dsh-skill-replay-golden.md)。完整 DSH Agent Loop 的真实 Skill/Reference material closure **NOT_RUN**；完整 L0/L2 和训练资格仍未达标。

## 0. 产品目标更新

原 [可诊断性审计](trace-debuggability-audit.md) 将 Q1–Q6 作为第一版的排障回答能力。现在补充同等级的 **可复现**，并为 **可学习**保留可信输入：

> **统一 Trace = 可诊断的执行记录 + 可复核/可重演的执行材料 + 可衍生为有质量依据的评测样本。**

注意：三者共享一次采集的源事实与受控材料，不是三套互相复制的轨迹。**Trace ≠ Replay Engine ≠ Training Dataset**；工具负责投影，源事实/原始材料不因此迁移 authority。

### 明确不同的“复现”级别

| 层级 | 问题 | 可保证什么 | 不应声称什么 |
|---|---|---|---|
| L0 **忠实重建（review/reconstruction）** | 能否离线还原当时 Agent 实际看到的请求，以及每步返回什么？ | 源记录、ModelInput/Output、ToolResult、版本、因果闭包可一致读取；按摘要验证内容与来源 | 能重新生成相同模型文字 |
| L1 **模型决策重跑（model rerun）** | 在冻结相同输入、Tool catalog、模型配置下再询问模型会怎样？ | 同一可见输入/配置可以重新提交，输出可与历史对比并统计差异 | 在服务端模型版本、非确定内核、采样/seed、流式顺序变化下保证逐字节一致 |
| L2 **隔离执行重演（sandboxed execution replay）** | 对相同 Tool 响应和模拟环境状态，能否重演 Agent/Runtime 控制流？ | 使用记录的 Tool/Observation 回放或隔离 Sandbox/Sim、冻结状态/seed/时钟时，可检查流程、状态和恢复决策 | 复用真实 5GC 操作产生原先相同外部世界变化；重放带副作用的请求 |
| L3 **真实环境再次执行（new execution）** | 在真实外部系统重新运行是否结果相同？ | 生成**全新的 run/attempt/operation 身份**，可对比而不能作为同一次复现证明 | 认为它是无副作用 replay，或重用旧 mutation identity |

第一版 Demo **必须具备 L0；至少完成一个 Agent L1 或 L2 的隔离实验**，并明确其他层级的 NOT_RUN。L3 默认不自动触发。

## 1. 实际 Agent Replay 需要冻结哪些内容

源 authority 对照：[DSH Agent Trajectory](https://github.com/odango-chan/connectionagent/blob/main/docs/design/agent-trajectory.md) 的 ModelInputSnapshot、ModelOutputSnapshot、Tool Call/Delivery 与 [Trajectory / Offline Evaluation Closure](https://github.com/odango-chan/connectionagent/blob/main/docs/architecture/trajectory-and-offline-evaluation.md)。

| 对象 | 第一版最小保留 | 原因 / 漏掉后的后果 |
|---|---|---|
| 一次决策的**真实可见输入** | 有效的 system/user/assistant/tool 消息、当次上下文折叠/替换、精确消息顺序、Tool catalog/schema、请求主体 bytes 或无损规范形式及 content digest | 当前最新 Prompt/Skill/tool 表不等于当时真正提交给模型的内容；只保留 digest 而材料已过期，不可重建 |
| 模型能力与实际配置 | Provider/model ID、可观测的模型版本/指纹（如果提供）、温度/top_p/max tokens/seed（若支持）、响应格式、effective adapter defaults、实际请求/响应边界 | 只记录“DeepSeek/GPT”不足以判断是否可比较；不承诺服务端不可得的模型权重 |
| Skill/Prompt/Reference 的有效版本 | frozen Skill identity、实际加载并注入的 SKILL.md/Reference materials、Toolset identity、系统提示词最终渲染结果及其来源 | 当前 `main` 的 Skill.md、静态 System Prompt 模板不能替代执行时注入内容 |
| 模型输出/尝试 | 模型响应原文/可见输出、实际 Tool Call ID/原始参数、finish reason、中断/失败 attempt、流式片段若必要、token usage | 只有最终 Tool 名字或最终答案，丢掉决策轨迹与重试 |
| Tool 请求与交付 | 原始 args 与 schema、callId/requestId、执行结果的 source、**实际交付给模型的 ToolResult 内容**、Delivery/Host knowledge 时间与状态 | Runtime 已完成 ≠ Host 知道结果 ≠ 模型收到该 ToolResult；不能从 Runtime Output 逆推出下一轮输入 |
| 状态/环境与控制 | task/run/attempt、clock/seed（若存在）、observation/source revision、环境快照/模拟器版本、权限/Assurance/授权版本、side-effect fence | 相同模型决策并不意味着相同外部事实；真实网络输入不能离线凭空生成 |
| 因果/完整性/安全 | sourceAuthority、typed source ref/schema、owner local seq、明确关联 refs、材料摘要、缺失/脱敏/保留策略、闭包完整性标记 | 不完整的轨迹不能被标成 REPRODUCIBLE 或直接成为高置信训练样本 |

**模型可见边界非常重要：** Evaluator-only Source Facts、GroundTruth、隐藏的未来 Runtime 结果等可以留在评测材料中，但**绝不能混入该决策的 ModelInputSnapshot**。当前有权读取的信息与模型当时确实看到的信息是两个不同集合。

**System Prompt / CoT 限制：** 可保存模型确实收到的 System Prompt、Skill Context 与可见响应，但不收集模型未输出的隐藏推理链；持久化 Prompt/Tool Args 要避免秘钥与个人数据泄露，必须受权限和保留策略约束。内容如因授权/保留限制不可复原，L0 明确报告 PARTIAL/UNAVAILABLE，不伪装可复现。

## 2. 当前已有的设计与实际实现差距

| 来源 | 已有明确基础 | 对“可复现”尚未证明的内容 |
|---|---|---|
| **connectionagent Agent trajectory（设计）** | 完整的 ModelInputSnapshot/OutputSnapshot、dispatch-time folded surface、`sourceEventSeqs`、Tool catalog/Prompt assembly、原样 Tool Args、ToolResult delivery、provider attempts；已规划 frozen materials | 是否所有 Host/分支都真实实现闭包保存、每轮安全留存与重开，不能仅凭设计文档判定 PASS |
| **connectionagent trajectory-and-offline-evaluation（Accepted/Frozen）** | 已明确 typed evidence closure、owner source 引用、review material 与 evaluator-only 数据边界、Model-visible input 完整冻结 | Benchmark 的跨 Owner machine closure 仍有缺口；不能把 Viewer 自己的 timeline 当作可训练原始来源 |
| **ca-agent-demo TraceStore v2（代码）** | 事件顺序、immutable material digest、某些 Model Request Assembly material、Skill 上下文与响应记录、原生 Writer/Loader | 全路径真实 ModelInput/Output、每次 ToolResult 是否模型实际接收、版本/参数/环境闭包，以及 L1/L2 隔离 replay **NOT_RUN**；单有 JSONL 不等于重演输入齐全 |
| **ca-console snapshots（部分验收）** | 归档中已有模型 request/response digest 与部分 source refs；Trace View 支持展开交互 | Console 视图/投影不应作为唯一训练材料；需回到 Host 原生的模型输入/输出材料 |
| **Runtime / P8-D4 real diagnostic** | Procedure、Predicate、Call Result、Evidence refs、21 timed spans / 85 facts，足够支持部分诊断和复核 | 此归档**不包含当次全部 Agent Model-visible 输入/响应**；真实外部 5GC 世界也不能仅从报告安全重演；严禁对它声称 Agent replay PASS |
| **Phoenix / OTLP synthetic** | 证实 Span/属性 ingest/readback 与基础 UI；可用于通用时间线 | 仅保留 Span 与结构化日志**不自动**构成 exact material closure、训练数据集或可复现的 Agent 请求；完整 Logs/material roundtrip **NOT_RUN** |

### 一项需要显式解决的架构冲突

[ConnectionAgent 已冻结的离线轨迹原则](https://github.com/odango-chan/connectionagent/blob/main/docs/architecture/trajectory-and-offline-evaluation.md) 明确 **No universal trajectory schema / No mandatory projection layer**，同时要求 typed owner-native evidence closure。我们在 Trace Viewer 新提出“一个 Trace 契约”时，**不能默默覆盖旧的 Frozen 基线**。

**当前建议的兼容解释（待架构确认）：** 一个共享的**可观测/交换与阅读 Profile**（OTel/OTLP 优先候选），不引入第二份权威通用 EventStore，不抹掉 DSH SessionEvent、Runtime RunEvent 等 typed source；Replay/Training 使用受控的 typed source/material closure。若将来真要替换 Owner 原生机器契约，则应显式评审并更新原冻结基线，而不是只改 Viewer 文档。

## 3. “可学习”是从合格轨迹派生数据集，不是训练进程直接读 Logs

需要把三种东西分开：

```text
Owner-native Events + exact frozen materials
            │
            ├── Diagnose / Inspector (read-only)
            ├── Reconstruct / replay sandbox (L0/L1/L2)
            └── Offline evaluator (Case / GroundTruth / Oracle)
                           │
                   admitted evidence / validity
                           │
               Training/eval sample extraction
                    （版本、许可、质量门禁）
```

**训练样本的来源资格**应至少具备：样本 ID、原始 Run/Session/ModelInteraction/ToolCall refs、源 schema/digest、可见输入/实际输出内容或授权的安全材料引用、Model/Tool/Skill 版本、Outcome/Validity/quality 标签来源、筛选与脱敏规则、数据使用授权/保留约束、评估数据切分与版本。不能因为 Runtime SUCCEEDED 就给 Agent 每一步打“正确”标签，也不能把模型自述当 GroundTruth。

- **监督模仿 / SFT 候选**：有确切 model-visible input 与输出、已验证行为可接受的样本；需要人工/Oracle 的质量判断。
- **离线评估 / regression**：同一 frozen input/Tool environment，可比较新 Model/Prompt/Skill 变化；独立保存 Case、Oracle、Validity、Verdict，不污染训练集。
- **偏好/自我改进候选**：应有独立的正负对照、评价标准和审核来源；自动反馈可做候选建议，但**不自动修改模型、Skill 或线上策略**。
- **失败案例**：对调试和学习同样有价值；以 FAIL/UNKNOWN/INCONCLUSIVE 的真实来源标注，不要丢弃或当成成功示范。
- **信任与数据治理**：恶意 ToolResult/外部文本可能含提示注入，训练前应按不可信内容处理；敏感内容脱敏，尊重来源许可和数据使用同意；避免训练/评测集泄漏。

复用现有 [GroundTruth/Oracle/Verdict 定义](https://github.com/odango-chan/connectionagent/blob/main/docs/architecture/benchmark-groundtruth-and-oracle.md)，不在 Trace Viewer 重新定义一个同名的成功标签系统。

## 4. MVP 新验收问题：Q7–Q9（追加 Q1–Q6）

| 编号 | 评审者的问题 | 第一版可验收标准 |
|---|---|---|
| **Q7：当时 Agent 到底看到了什么？** | 固定一轮实际调用：能在授权私有环境重建 **dispatch-time ModelInput**（实际 system/messages/tool catalog/加载的 Skill 内容），逐材料验证 sourceRefs 和 digests；缺失处明确 Partial |
| **Q8：能否重新运行或重演这一步？** | 至少一次隔离验证：用冻结输入重跑一个模型调用（L1）或在 Tool stub 中重演模型/Tool 交互（L2）；结果比较与历史差异可见，不要求 LLM 文字逐字一致、禁止复发真实 mutation |
| **Q9：这条轨迹能否进入训练/评测样本候选池？** | 按 source closure、内容权限、模型/Skill/Tool 版本、Evaluator/人工标签来源、缺失状态输出 `ELIGIBLE / PARTIAL / REJECTED` 的**只读资格报告**；第一版不自动训练 |

最小新增故事 **S4：Agent Replay/Evaluation seed**：

1. 用 Agent Demo 或 DSH Owner 真实生成的一轮非敏感/合成 Tool 交互，包含 Model Input/Output、Tool call、ToolResult delivery、后续模型 request；优先用既有 DSH ModelInputSnapshot builder，不新建通用事件模型。
2. 冻结 **exact model-visible input**、当时 Tool catalog 和 Skill/Prompt 生效版本，验证所有源 ref / material digests；声明可回放完整性及不可见内容。
3. L0 在离线 Viewer 重建同一轮模型输入；L1 或 L2 在**无外部副作用的隔离环境**下重跑或对照；保存差异，不声称数学意义确定性。
4. 用独立 Oracle/人工反馈为样本标注 `VALID/PASS/FAIL/INCONCLUSIVE` 等**已有评测语义**；输出只读资格报告，真实训练与自学习工作流后置。
5. 验收明确区分：`TRACE_VISIBLE`、`RECONSTRUCTIBLE`、`REEXECUTABLE_IN_SANDBOX`、`TRAINING_CANDIDATE`、`NOT_AVAILABLE`。它们**不是**单一 `trace_success` 标志。

### 第一版边界（控制 Demo 厚度）

**现在要求：** Q1–Q9、S1–S4 的能力矩阵；选一个实际 Agent 轮次做 L0 + 隔离 L1/L2 PoC，证明模型可见材料真实且完整；保存 Replay 资格报告、Source refs、缺失标记。

**暂时不做：** 自动 fine-tuning、RLHF/DPO 管线、自主更新 Prompt/Skill、线上自动采纳建议、真实 5GC 原地重放、生产级大规模数据湖或多种冗余 Trace/Training schema。

**下一项工作不是马上实现 Replay Engine**：先找一个已有 DSH 或 Agent Demo 的有效 Model request/ToolResult 闭包，看实际存了哪些、缺了哪些；把 L0 的完整性和 L1/L2 的可能性做成明确验收。否则新增再漂亮的 UI 或 OTLP Span 都无法兑现“可复现”。
