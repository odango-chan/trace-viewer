# Unified Trace v0.2 — 独立反例与最小化评审

**日期：2026-11-05**  
**评审对象：** [Unified Trace Specification v0.2](../specs/unified-trace-v0.2.md)  
**结论：** **目标与核心语义接受；轻量化 / 可实施性未通过；暂缓冻结**  
**范围：** 仅规范审查，不改变 Producer、Viewer、OTLP 选型或持久化实现。

本文件是**评审报告**，不是第二套 Trace 规范。v0.2 是唯一当前候选正文，本报告指出下一版应修改什么，不能被弱模型当成实施合同。

## 1. 主结论：不是语义太少，而是「MUST」过多

v0.2 对上次六项 P0 的定义已有改善，但**把复杂分布式故障的完整要求作为任何 Producer 的默认要求**，会迫使一个只执行单步的 Demo 也设计七类 ID、Activity+多个 Fact、材料状态/权限、Owner stream epoch、完整性闭包。它可能在纸面上统一，却在各仓重新实现时变成**多套轻重不同、又无兼容边界的实现**。

**应采用「公共最小契约 + 条件化能力 + 完整性等级」，而不是「所有 Producer 必须生成所有事件/ID」。** 能力可以不同，**同一类型/语义/证据规则不能不同**。

## 2. 四个恶意/简化场景

| 场景 | 当前 v0.2 可能导致的问题 | 应允许的最小合规表达 | 不得放松的边界 |
|---|---|---|---|
| **S-A：一个进程的确定性 Predicate 检查** | 为单个判断创建 Execution/Run/Attempt/Activity/Owner stream/Manifest 并产生 start/end/verification 额外事件 | 一个有稳定 ID 的 `runtime.predicate.evaluated` Fact，带本地执行范围、verdict、expected/observed/reason 和真实证据；Activity/Attempt/Manifest 非默认强制 | 不能只留 PASS；时序/观察缺失不伪造 |
| **S-B：单轮 LLM，无 Tool，无重试** | 要求 Tool/Delivery/Skill/Attempt 一整套语义；为无数据的字段造空对象 | 一次 `model.request.dispatched` + `model.response.observed` 及完整有效请求/响应材料；仅发生 Tool/Skill/retry 时才要求相关 ID、事实和引用 | 请求内容可按声明的编码/Digest 验证，权限缺失时不能称 L0 PASS |
| **S-C：异步 Operation 成功，Host 仍 UNKNOWN** | 将来可能为了表达每个接收阶段强制每一跳生成事件或附加完整捕获 Manifest | 原请求/Operation ref + Runtime outcome + Host knowledge（可作为独立 Owner Facts）+ 可选 reconcile；每条保留 Owner 来源 | 不能以 Runtime SUCCEEDED 覆盖 Host 的 RESULT_UNKNOWN；callback 不靠 timestamp 绑定 |
| **S-D：从旧 JSONL/OTel 导入只含部分事件** | 要求补齐 Owner 原生 recordRef/sequence/timestamp/Manifest，无法导入；或把 importer 分配的 ID 冒充源 ID | **独立 import/projection 合规等级**：稳定生成 `importRef`、记录真实 source locator 和 `SYNTHESIZED`，原生 ID/时间缺失则声明未知；不声称 source-native/capture-complete | 不凭 JSONL 行号生成假的 Owner sequence；不把截断样本宣称完整归档 |

### 四个检查共同指向一个问题

同一种**语义约束**可以强制，但事件**数量与组件拓扑**不能强制。最小例子没有 Tool，就没有 Tool Delivery；没有 Attempt，就不必生成 Attempt ID；如果没有声明完整性，不能装作 Manifest 已封口。

## 3. 本轮识别的冻结阻塞项

### P0-A 无条件身份要求需收紧

§3.1 列出七类身份，但 §4.1/§6 没有提供**什么时候必须生成**的准入表。

**建议**：
- 对新根 Producer，只有 `executionRef`（或有验证的 ORPHAN 原因）、`recordRef`、`source/emitter`、`type` 和真实时间/未知声明为公共基础。
- `runRef` 仅有单独 Run 语义时需要，`attemptRef` 仅实际尝试/重试时需要，`activityRef` 仅记录 Activity 时需要，`operationRef/requestRef` 仅请求/副作用跨记录关联时需要。
- `sourceStreamRef/epoch/sequence` 仅在 Owner 确有顺序/闭包声明时要求；不得为每条简单 Fact 新开 epoch。
- `profileVersion/typeVersion` 可在 **batch/package 的声明层**出现，不必在每条嵌套记录中重复；若分离存储，必须仍可毫无歧义地确定其值。
- 不把任何固定 URI 格式写进基础语义。

### P0-B Activity 最终 Summary 规则太具体

§4.2 规定一条最终 Summary Record 再加可选 started/observed Fact，是**一种合理实现**，但不必成为所有 Producer 的唯一生命周期表现。

**建议**：规范只规定一个 Activity 的唯一 identity、可信时间边界、可解释 outcome、重复/崩溃的真实语义。**允许**一个已结束 Span/Activity Record、或开始/结束 Fact 汇聚为 Activity，两者都必须可逆地呈现相同语义。若采集器只有 end summary，不得伪造未捕获的 started Fact。与同一 Activity 相关的 Facts 不自动产生额外业务身份。

### P0-C Core Event Registry 实际上还偏宽，且语义层级混杂

§6 目前把日志/运行时判断/模型消息、Result delivery、Capture 完整性、Correlation 都列成通用基础事件，并对内容可用性提出大量 MUST。**不要要求每种 Producer 实现全部类型。**

**建议只保留 5 个语义族**（不是 5 个强制事件）：
1. **Activity / lifecycle**：时段、技术边界与异常；
2. **Decision / Evaluation**：Predicate/Verification/Model decision，带依据；
3. **Interaction**：Model/Tool/Operation request、response、delivery 及确认的消费；
4. **State / Outcome**：独立 Owner 的状态与 reconcile；
5. **Capture / Provenance**：来源、缺失、闭包、late link（按需）。

`model.request.dispatched` 等具体名称仍可属于小的**条件化类型表**，但不得要求不使用模型的 Producer 发模型事件，不产生异步 Tool delivery 的 Producer 额外模拟一条 delivery。关键关系真实存在时，仍必须保留。

### P0-D 资料完整与可复现资格应分等级

§7 的 Source capture、integrity、retrieval 是正确区分，但目前对于小 Demo，容易理解为要实现 3 个状态机加独立 Manifest Store。

**建议**：
- 用**按需能力分级**明确 `TRACE_MINIMAL`（真实事实与因果，无完整归档声明）、`DIAGNOSTIC`（足量诊断证据）、`RECONSTRUCTIBLE_L0`（精确输入材料闭包）、`EVALUATION_READY`（受权、独立评测候选）。
- 等级不是单向枚举、不是运行状态，也不是“越高自动包含全部低等级”：应该视为**相互独立的 capability assertions**。一个 Runtime 诊断 Trace 不应因没有 Model Input 被标记“不合格”。
- `COMPLETE` 仅用于已知的**有限来源范围**；没有封口信息则 `UNKNOWN`。**不要强制所有 live Demo 产生 capture.manifest**。
- Material 可先用同一私有目录/文件内嵌；摘要由既有可信存储生成，不要求专门的 Material Server。
- 授权能否读取、源是否采集、源有没有丢失、摘要是否验证应分别报告；若一项不适用不应创造空状态实体。

### P0-E Model-visible 与 Tool 消费证据别过度承诺

§5 `consumes` 若未明确 ToolResult 在实际 Provider 请求中的身份/字节位置，可能沦为普通关联边；另一方面“完整 Tool Catalog”不一定是 Provider 顶层的 `tools` 字段。

**建议**：把 L0 证据标准定成**effective outbound Model Request 的真实编码 bytes/无损规范形式**及其来源，Agent 实际注入 Skill/Reference/Tool 目录的内容、Provider/配置/attempt；请求内没有某项即标记 N/A，而不是缺失。提交到 Provider 不证明模型内部一定消费。需要显式区分“ToolResult 已返回 Host”和“在本次请求中确实出现”。

### P0-F Capture/Transport 反而要求过强的双通道等价

§8 说 Online、Durable、Offline MUST 保留全部 required common subset；但下一行又说 **Online may be sampled/limited**。如果一个在线信号因采样丢记录，它不可能“完整保留”所有 facts。

**建议**：将“无损共同子集”仅施加给**宣称无损的导出或读取路径**。Online best-effort 只需**不篡改已保留记录语义，并如实声明覆盖/采样/截断限制**。不能据此否决合法的 OTel metric/trace visualization；也不能因此认证其为 Replay Archive。原生 durable → offline 的“无损”可以是针对**所选定的封口来源范围**，而非虚构全世界源数据。

## 4. 简化后最小公共字段（提议，不是新规范）

对**新 Producer 的一条普通 Fact**，推荐逻辑基线（字段可由外层 batch 提供，名称待定）：

| 无条件语义 | 条件出现 |
|---|---|
| Record identity、type/schema identity、Owner/emitter provenance | Execution/run/attempt/operation/request/activity 语义上下文 |
| 真实时间或无从确认的说明 | Confirmed parent/causal refs |
| 事件特有的**必要判定内容** | Material descriptor 与可授权材料正文 |
| 信息来源和实际捕获局限 | Owner sequence、source stream epoch、capture seal/manifest |

不能偷换成只有 `timestamp + eventName + status`。不要求每条 event 反复携带本可无损由 envelope/batch scope 确定的 metadata。

## 5. 现有 C01–C10 如何改为可落地验收

**Conformance 是根据所宣称的能力测试，而不是“一个 Producer 要过 10 题才能开机”。**

| 合规目标 | 需要的测试 |
|---|---|
| **CORE**：来源、身份、类型、时间真实/未知、不会因重复导出漂移 | C04/C05 中的幂等/不造假子集、基本跨记录关联 |
| **DIAGNOSTIC**：业务判断为什么成立、Owner 不一致可解释 | C01、C07；仅产生该类事实的 Producer 才需要 |
| **AGENT_RECONSTRUCT**：模型实际有效输入、响应、ToolResult/下一轮、版本材料闭包 | C02、C06 的内容/权限、C09 的安全准入；无模型的 Producer 为 N/A |
| **DISTRIBUTED**：跨 Owner 延迟回调、重试和关联 | C03、C04；单进程源为 N/A |
| **ARCHIVE**：明确范围内的完整归档、离线重开、丢失声明 | C05/C06/C08；只做在线 telemetry 的 Producer 为 N/A |
| **LEARNING_CANDIDATE**：派生样本的独立评价、使用权限、审计/训练隔离 | C10；Recorder 不需要训练能力 |

对于工具调用 **只在真正涉及交付/未知语义时**要求单独 Delivery/Knowledge 事实；纯同步且完整可确认的事务可以由同一 Interaction/Activity 关联足够的字段，避免机械地产生三条事件。

## 6. 不应该削弱的原则

- Tool、Runtime 和 Host **各自事实不能相互覆盖**；技术 Span 状态不能等于业务 mutation。
- 只对**经过证明**的关系给 confirmed 因果边。
- 任何离线 L0 PASS 必须可取回精确有效输入并验证源材料。敏感内容无法授权读取时，应标不可验证，而不是用当前 Prompt/Skill 文件补足。
- 不用一个 Actor 的 wall-clock 近似另一 Actor 的因果。
- 受保护的隐藏推理不可采集；资料保留/撤权直接影响 Replay 资格。
- 不为 CreatedSession/Fabric/DSH 设计特殊公共类型。

## 7. 结论与后续（规范阶段）

| 项目 | 结论 |
|---|---|
| v0.2 的三目标及身份/因果/材料分层 | **ACCEPT AS DIRECTION** |
| v0.2 的无条件 MUST、统一 Activity final summary、全类型 Registry、双通道 lossless 要求 | **REVISION REQUIRED** |
| 最小化与条件化 Conformance | **P0，修订正文后复审** |
| 当前 v0.2 规范冻结 | **BLOCKED** |
| 机器 Schema / test fixtures | **NOT_STARTED** |
| 各 Demo Producer / Viewer 实现 | **PAUSED / NOT_AUTHORIZED** |

**建议下一步只做一轮 v0.2 精简修订**：把 §3/§4/§6/§7/§8 中的无条件要求改成上述条件化条款，用 S-A～S-D 回归，再做一次设计审查。不要新建一份 DSH Replay 规范、训练事件类型或强制要求额外微服务。