# Unified Trace Specification v0.1

**状态：DRAFT / 讨论基线，尚未冻结机器 Schema**
**日期：2026-11-05**
**定位：跨 Agent、Harness、Runtime 与外部工具的统一执行轨迹规范**
**原则：规范先行，现有各仓 Demo 后续按它适配；此版本不要求也不启动 Producer 改造。**

本文件是统一 Trace 的**唯一候选规范正文**。现状分析与已有实验见 [需求审计](../design/trace-requirements-audit.md)、[诊断可回答性](../design/trace-debuggability-audit.md)、[可复现与学习](../design/trace-reproducibility-learning-audit.md)。它们用于解释本规范**为什么**这样设计，不反向决定新规范的存储结构。

规范用「**必须**」表达 v0.1 候选的强制行为；「**应**」表达推荐；「**可**」表达可选。**DRAFT 不等于已批准实施。** 字段名是待冻结的逻辑字段，不是承诺已经存在的 API/JSON 文件。

## 1. 产品目标与适用范围

统一 Trace 是一份**可信的执行过程记录**，用于：

1. **可诊断**：回答发生了什么、为什么、哪个步骤/Owner 确认了什么、证据在哪里、哪里未知。
2. **可复现**：准确重建模型当时实际可见的输入、工具定义和反馈；在隔离环境中安全地重演部分执行，并指出不能复现的条件。
3. **可学习**：在权威事实、来源和独立质量判断齐备后，能提取离线评测/训练**候选**，而不是直接把 Trace 当训练语料。

适用 **纯确定性、纯 LLM 和混合执行**。Runtime 的 Predicate、Verification、Graph Transition、Call Result 与 Agent Model/Tool 同等重要。

**非目标**：用 Trace 替代 Runtime 业务状态机；自动重发真实 5GC 修改；记录不可见的模型隐藏推理；保证非确定性模型输出逐字节相同；v0.1 就建设海量检索/数据湖/训练器；长期维持多套并列的 Trace 交换标准。

## 2. 总体语义：一个逻辑契约

采用以下**最小核心概念**（**不是五套协议或数据库**）：

| 概念 | 定义 | 不等同于 |
|---|---|---|
| **Execution**（执行范围） | 用户业务目标/任务在多次 Run、Attempt、暂停和恢复之间的逻辑集合，具稳定唯一的 `executionRef` | 单次 HTTP 请求、单个 OTel traceId |
| **Run / Attempt**（执行实例） | 一次实际运行与其中的尝试/重试；均用有来源的 ID/ref，必要时跨多个 Execution 关联 | 全局统一自增序号 |
| **Activity**（活动） | 具有边界的执行过程：Model Invoke、Tool Execute、Procedure、Operation、Wait、Reconcile 等；能记录真实开始/结束与父子关系 | 每一条 Runtime 离散事件 |
| **Fact**（事实/事件） | 某个时间点发生的可陈述事实：Predicate evaluated、Tool result delivered、Graph transition、Host knowledge、Terminal 等 | 一句自由文本日志或臆测的结果 |
| **Material**（材料） | 真实输入/输出、Prompt、Tool Catalog、Observation、诊断详情、Snapshot 或 Evidence 的可定位不可变内容，带摘要、媒体类型、权限/可用性 | 公开的 Span attributes 或某个字符串 Digest 本身 |

**Execution、Activity、Fact 与 Material 共用同一套身份、来源、关联、时间和完整性规则。** 可以用一种或多种标准数据结构编码，不能因此衍生出多个相互矛盾的业务语义合同。

每条 Activity/Fact 必须具备**独立、稳定、可寻址的记录身份**。不能依赖 UI 行号、前端数组索引、时间排序来定义身份。

## 3. 候选统一记录模型（逻辑层）

### 3.1 公共记录

| 逻辑字段（建议名） | 要求 | 语义 |
|---|---|---|
| `specVersion` | 必须 | 本 Trace Profile 的版本；与来源业务 schema version 分开 |
| `recordRef` | 必须 | 在所有参与者中唯一、稳定、可被引用；不得因导出重生成而漂移 |
| `recordKind` | 必须 | `activity` 或 `fact`；两者共享公共结构 |
| `name` | 必须 | 有命名空间的类型名，例如 `runtime.predicate.evaluated`、`agent.model.request`；不是自由格式状态码 |
| `executionRef` | 必须 | 跨重试/恢复关联的逻辑执行；开始前未知时由采集端生成并保留 |
| `runRef` / `attemptRef` | 条件必填 | 记录属于 Run/Attempt 时必须填写；无 Attempt 的顶层事实可省略 |
| `producer` | 必须 | 真实写入/采集方及其组件版本 |
| `source` | 必须 | 权威来源身份、源记录引用和源 schema/profile（当存在）；采集方 ≠ 权威来源时须分别标明 |
| `occurredAt` | 新生产记录必须，时钟不可用时明确缺失原因 | 源事件实际发生时间；不得用导出或查看时间填充 |
| `observedAt` | 可选；转采集时应填 | 采集系统观察时间，不等于 `occurredAt` |
| `ownerSequence` | 有原生序号时必须保留 | **只在原 Owner 范围内有效**，不得误当全局序号 |
| `relations[]` | 可空，但需真实引用 | 明确因果、请求结果、消费、重试、恢复、证据关联；未知必须保持未知 |
| `materials[]` | 有可复核详情时必须引用 | 内容寻址的材料引用以及角色、分类、可用性，不把大内容强塞公用 attributes |
| `attributes` | 可选 | 小且安全的结构化事实；语义由 `name` 及版本化 Profile 定义 |

记录内容需支持有类型的标量、集合和对象，不得为了统一格式把 Predicate 的 expected/observed、ToolResult 或 Verification 诊断强制压成单句 `summary`。

**Identity 规则**：`recordRef` 与 `executionRef` 是业务范围/源可寻址引用；底层 OTLP `trace_id`、Span ID 是可选的遥测关联 ID，不代替它们。跨进程新 Trace、暂停恢复和多 Attempt 必须可属于同一 Execution。不存在强制跨 Owner 递增序号。

### 3.2 Activity 与 Fact

- **Activity** 必须有活动名称、作用域、开始时间（若源端可知）、可选真实结束时间、稳定 `activityRef`（可由 `recordRef` 承担）；未结束仅为 **OPEN/UNKNOWN**，不能推导失败。Span 父子关系仅当已知时才写。
- **Fact** 必须有类型、来源和所观察的事实（安全内联字段或 Material 引用）；`occurredAt` 属于发生时间。**没有已知发生时刻的旧记录允许缺失时间并标明 `missingReason`，绝不编造零耗时 Span。**
- Runtime/Agent 的专有语义由**版本化类型及字段**扩展，不要求引入一份业务特有的 Trace Envelope。未来 CreatedSession 等技能名称只能是某次执行的业务值，不能成为规范层的必选字段。

### 3.3 关联的最低语义

所有关系都从**当前记录指向已经确定的目标引用**，至少支持：

| 关系 | 含义与不允许的推断 |
|---|---|
| `parent` | 确认的活动嵌套；同一线程或靠近时间不证明父子 |
| `causedBy` | 当前事实/活动由哪个事件或决定触发 |
| `resultOf` | 当前结果属于哪条确切请求/调用 |
| `deliveredTo` | 此结果真正交付到哪一端；执行完成不等于交付完成 |
| `consumes` | 本次 Model/Tool 决策实际使用了哪个输入/Result 或 Material |
| `retryOf` | 当前 Attempt 相对既有 Attempt 的重试关系 |
| `reconciles` | 一次恢复/调和针对先前哪个未知操作 |
| `evidenceFor` | 此源材料支持哪一条判断 |

**不确定的关系不得从时间邻近、相似 payload 或相同名字推断**。如需表达「候选关联」，必须与 verified relation 分开标记，不能进入 L0 Replay 闭包。

### 3.4 Outcome/Knowledge 必须分维度

**禁止通用 `success` 或单一状态字段覆盖所有业务结论。**

- Activity 技术状态（completed/error/cancelled/unknown），只描述 Activity 自身。
- Runtime Run/Procedure terminal，描述该 Runtime Owner 的完成声明。
- Operation outcome / mutation certainty，描述具体操作副作用和是否确定。
- Reconcile resolution，描述是否由恢复观察补足确定性。
- Host knowledge / ToolResult delivery，描述 Host 与 Model 是否**实际收到**结果。
- External disposition，描述外部系统的独立事实。

例如：Runtime 已报告 `SUCCEEDED`，但 Host `RESULT_UNKNOWN`；或 mutation 先 `OUTCOME_UNKNOWN`、之后 Reconcile `COMMITTED`。它们可以同时为真。消费者必须同时保留，不得相互推导或覆盖。

## 4. Material / Evidence：可诊断、可复现的共同根基

对于需要以后精确复核的内容，Material 引用至少有：

`materialRef`、`role`（如 model-visible-input/tool-result/predicate-diagnostic）、`mediaType`、`digestAlgorithm`、`digest`、`contentVersion`、`classification`、`availability`、`sourceOwner`。

**规范要求：**

1. 内容若声明已持久化且可重建，必须能按其**明确的字节/规范编码 Profile**重算 Digest；仅有 SHA 字符串、却没有可取回原文，不能通过 Replay。
2. Material 与 Trace Record 可以不同存储，但**必须可授权检索、可验证完整性**；离线归档可按相同引用闭包打包。需要保密时只公开摘要与状态，敏感材料在受控环境查看。
3. `NOT_CAPTURED`、`REDACTED`、`ACCESS_DENIED`、`LOST`、`NOT_VERIFIED`、`AVAILABLE` 必须可区分。不存在的内容不能用当前仓库的 Skill/Prompt 来补。
4. Predicate/Verification 必须能引用实际 expected、observed、reason、evidence source；Tool/Model 必须能下钻真实 request/result；历史无法恢复时如实报告。
5. 采集与查看须贯彻最小权限和数据使用许可，不捕获不可见的隐藏思维链，也不默认把敏感 Prompt/ToolResult 注入公开遥测或训练数据。

**完整性要比“文件能打开”更严格。** 每个 Execution/Run 的归档必须声明源范围、预期/实际记录数（已知时）、丢弃/采样/截断、缺失材料、检查算法及整体 `COMPLETE / PARTIAL / UNKNOWN`。没有充分依据时只能声称 `UNKNOWN`，不是 `COMPLETE`。

## 5. Agent Replay：必须采集的额外事实

### 5.1 L0 精确重建（第一阶段必需）

每次真正发给模型的交互，至少能够恢复：

- **dispatch-time 的有效输入**：system/user/assistant/tool 消息、真实顺序、注入的 Skill/Reference、裁剪/上下文选择后的最终可见面、当时 Tool Catalog/Schema，以及其**源 Material 与摘要**；
- Provider/model 标识和可获得的 revision/fingerprint、请求参数、默认值的来源与缺失说明；不能假定模型服务端不公开的模型权重版本；
- 原生响应、Model Tool Call 的 identity/arguments、每次 attempt、失败/中断和最终结果；
- Tool 的请求、返回、结果是否实际交付 Host、**是否进入下一轮模型的有效输入**，必须分别有事实及精确 ref；
- 与执行相关的运行时环境与观察快照/版本，以及不可恢复或无法重新创建的外部依赖。

**L0 PASS 的意思是源材料可按声明的编码/摘要验证并重建真实模型可见请求，不意味着可以再次生成相同模型输出。**

### 5.2 其他 Replay 级别（不得混淆）

| 层级 | 定义 | v0.1 第一版准入 |
|---|---|---|
| **L0** | 历史决策输入/输出/交付/来源的离线可信重建 | 必需，并给出 PASS/PARTIAL/UNAVAILABLE |
| **L1** | 相同冻结输入下重新调用模型，并记录差异与模型版本偏差 | 后续隔离试验；无字节级确定性保证 |
| **L2** | 预录制 Model/Tool/Observation 或模拟环境下的 Agent/Runtime 控制流重演 | 后续隔离试验，禁止真实 mutation |
| **L3** | 再次调用真实外部系统 | 是新执行，不是无副作用 Replay；本规范不自动触发 |

**真实世界的 ToolResult 不可凭当前重跑恢复成历史数据；任何 Replay 工具都不得悄悄复发真实 5GC/Provider 副作用。**

## 6. 学习/评测：只有合格样本，不能“Trace 成功 = 训练成功”

Trace 是**候选样本来源**，训练样本通过独立的 Evaluation/Oracle/人工审阅获得资格。候选记录至少需要：

- 指向源 Execution/Model Interaction/Tool 的精确 refs 和材料 Digest；
- 冻结的模型可见输入、真实输出、工具实际反馈和配置；
- 独立的质量判定/Oracle 来源（不能只靠模型自己说“成功”）；
- 明确的同意/许可/敏感筛查、保留策略以及评测与训练数据隔离；
- 完整性状态 `ELIGIBLE / PARTIAL / REJECTED` 的判定理由。

失败/UNKNOWN 也可以有价值，但不得自动标记为正样本。受保护的隐藏推理、私有身份、密钥和未经授权数据不得进入训练集。**第一版只要求不破坏后续使用的数据条件，不实现自动训练或自修改 Skill。**

## 7. 最小一致性要求与反例

同一套规范将来验收所有 Producer、Exporter、Importer 和 Viewer。**以信息保真和用户可回答性为准，不以可展示多少行/Span 为准。**

| Gate | 场景 | PASS 所需证据 |
|---|---|---|
| **C01** | 真实确定性流程 | Procedure/Predicate/Verification/Call Result 的原始原因、期望/实际值、证据引用、恢复路径可复核；无虚假 Model |
| **C02** | Agent Model→Tool→Model | 最终模型输入及 Tool Catalog 可按 Material 摘要恢复；ToolResult 精确关联并确实被下一轮消费 |
| **C03** | 跨 Owner 与不一致结果 | 同一个 Execution 可关联多个 Run/trace；Host/Runtime/External 相互矛盾的状态都保留 |
| **C04** | retry/并发/乱序/UNKNOWN | 不按时间排序猜因果，不重用旧执行身份来覆盖新的 Attempt；Reconcile 有明确目标 |
| **C05** | 篡改/丢失/截断 | 修改内容后 Digest 失败；丢记录/材料与采样被报告 PARTIAL/UNKNOWN；无静默“完整” |
| **C06** | 安全和回放 | 私有材料未泄露，权限不足明确报告；L0 能按原输入重建或解释差距，不能擅自执行外部 Tool |
| **C07** | 训练候选资格 | 无独立质量标签、许可或完整 ModelInput 时 REJECT/PARTIAL；Runtime SUCCEEDED 不会自动提升为训练正样本 |
| **C08** | 在线/离线一致性 | 同一 Record identity、因果关系、Materials、状态及缺失说明在在线消费、导出和重新打开后不漂移 |

**禁止的错误实现**：以 JSONL 行号冒充原生序号；把观测时间冒充发生时间；按相邻响应配对 Tool；把 Result 生成当成 Host/Model 已消费；在缺 Material 时只凭 Digest 声称可复现；以 Span completed 推导业务 mutation 成功；用当前 Skill 内容代替历史 Skill；把用户私有 Prompt 或 `reasoning_content` 直接发布为公开 fixture。

## 8. 示例：一条合成事实记录（仅说明语义）

以下为**候选逻辑表达**，并非已冻结 JSON Wire Schema；全部 ID/材料都是虚构的，不代表真实记录。

```json
{
  "specVersion": "0.1-draft",
  "recordRef": "trace://synthetic/agent/fact/tool-result-delivered-2",
  "recordKind": "fact",
  "name": "agent.tool.result.delivered",
  "executionRef": "execution://synthetic/goal-1",
  "runRef": "run://synthetic/agent-run-1",
  "attemptRef": "attempt://synthetic/2",
  "producer": {"component": "synthetic-agent-host", "version": "demo"},
  "source": {
    "owner": "synthetic-agent-host",
    "sourceRef": "owner://synthetic/result-delivery-2",
    "sourceSchema": "synthetic/example-v1"
  },
  "occurredAt": "2026-11-05T01:00:05Z",
  "ownerSequence": 7,
  "relations": [
    {"kind": "resultOf", "targetRef": "trace://synthetic/agent/fact/tool-call-1"},
    {"kind": "deliveredTo", "targetRef": "trace://synthetic/agent/activity/model-input-2"}
  ],
  "materials": [
    {
      "role": "tool-result",
      "materialRef": "material://synthetic/result-2",
      "digestAlgorithm": "sha256",
      "digest": "SYNTHETIC_PLACEHOLDER_NOT_A_REAL_DIGEST",
      "availability": "NOT_VERIFIED"
    }
  ],
  "attributes": {"deliveryOutcome": "DELIVERED"}
}
```

**注意**：`deliveredTo` 是 Host 确认投递事实；后续模型是否**真的消费**仍需该模型请求的 `consumes` 关系和有效输入 Material 证明。示例故意没有冒充一个有效 SHA。

## 9. 与 OTel / OTLP / Phoenix 的关系：后决定

这里只冻结**语义要求的候选边界**，暂不规定使用什么 SDK、语言或文件编码：

- OTel 的 Activity/Span、结构化 LogRecord、Trace context/links 可作为映射候选；Material 可以用独立受控存储。OTLP 是数据交换候选，而**不是 Replay 数据完整性的自动保证**。
- OTel `Timestamp` 可缺失，`ObservedTimestamp` 属于观察时间；两者不可混用。参见 [官方 Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)。
- 不能先假设 Phoenix 能完整取回结构化 Runtime 诊断、完整有效模型输入、受限材料和跨多个 TraceId 的 Execution 关联。必须先通过 **C01–C08** 中最小保真试验。
- 技术方案应解释上述每个字段/关系/材料如何**无损映射、保存与取回**。无法满足时，给出精确缺口并提出最小扩展，而不是增加一份平行的通用 JSONL 合同。

## 10. 冻结 v1 前须评审的四项决策

1. **唯一机器交换编码**：OTLP Traces+Logs 是否足够，还是需要一个有明确闭包语义的离线容器？不许先实现两套长期并列的交换规范。
2. **Execution / Run / Attempt 的 Ref 命名与生命周期**：新 Producer 如何发放跨 Owner 引用、暂停/重试/恢复时如何稳定关联？
3. **Material/完整性最小基线**：内容规范编码、摘要算法、私有读取授权、丢数据声明与离线闭包；先做简单 Demo 级实现。
4. **类型和状态的最小 Registry**：哪些是标准 Agent/Runtime Fact 类型、哪些维度是 Owner 专属；仅保留必要扩展，不将 CreatedSession/Fabric 等示例业务名写入基础规范。

这些是**明确待决定的问题**，不是允许 Producer 自行发明多个相互不兼容的语义。决策通过后再输出可机器校验的 Schema / SemConv Profile / 最小 Conformance Fixtures。

## 11. 未来实施边界（本轮不执行）

**现在**：仅评审本规范、用已掌握的 Agent 与 Runtime 归档挑战 C01–C08 的信息需求，确定上述四项决策。

**以后**：按统一规范一次性适配各 Demo Producer → Export/Store → Console/Viewer；逐渐替换旧 `TraceStore v2` / `REVIEW_DIAGNOSTIC` 多格式过渡层。**不要求兼容旧 Demo 一切内部细节**，但迁移时应保留能被证明的真实来源、材料与证据。

本规范**不隐含对 DSH、Agent Demo、Runtime、Console 任何代码的修改授权**；跨仓实现属于后续独立工作包。
