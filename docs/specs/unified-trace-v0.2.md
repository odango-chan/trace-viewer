# 统一 Trace 规范 v0.2（精简修订稿）

**状态：草案；4 项语义 P0 已补充可判定条款，仍待机器一致性验证与正式批准；不授权修改 Producer 或 Consumer。**  
**日期：2026-11-05。**  
本文件是当前唯一候选规范；[v0.1 架构审查](../reviews/unified-trace-v0.1-architecture-review.md)及[v0.2 最小化审查](../reviews/unified-trace-v0.2-minimality-review.md)仅作为评审依据。**最新复审：[中文精简稿语义冻结评审](../reviews/unified-trace-v0.2-semantic-freeze-review.md)——架构/减重基本通过，4 项 P0 待补。**

## 修订摘要与冻结门禁

相对 v0.1，本稿保留统一身份、事实、因果与材料语义，**删除强制统一存储/活动双记录/全部事件类型/无条件 Capture Manifest**，改为按行为与产品目标验收。此轮进一步明确身份触发、材料与能力覆盖、复合交互引用、类型结果、在线投影。以下 P0 **文本已补充，尚未完成机器一致性验证，不代表 CLOSED**：

| P0 | 影响能力 | 关闭判据 | 当前状态 |
|---|---|---|---|
| P0-1 产品责任 | CORE / DIAGNOSTIC / AGENT_L0 / DISTRIBUTED | §5 明确目标产品角色对应必需能力，组件可不适用，但产品不能以 N/A 掩盖缺口 | OPEN（文本已补） |
| P0-2 能力范围 | 全部能力 | §5 规定单记录/交互/Run/Execution 的覆盖证据与 PASS/未知规则 | OPEN（文本已补） |
| P0-3 复合交互 | AGENT_L0 / DIAGNOSTIC | §3 规定请求、结果、交付分阶段、可定位的材料和引用，含不匹配负例 | OPEN（文本已补） |
| P0-4 类型语义 | DIAGNOSTIC / AGENT_L0 / DISTRIBUTED | §4 规定少量基础类型的必需含义、UNKNOWN 与缺观察判定 | OPEN（文本已补） |

**其他冻结项**（机器 Schema、编码、权限政策、投影映射和黑盒测试）是上述语义定型后的**工程/互操作交付**，不是第五至第九项语义 P0。不得因表格出现 OPEN 而擅自启动各仓改造。

## 1. 目标与原则

统一 Trace 同时服务于：**可诊断**（还原事实、原因与证据）、**可复现**（恢复 Agent 当时实际提交的模型请求和执行反馈）、**可学习**（为经独立评估、授权的训练/评测候选样本提供来源）。

**一套语义，不等于一个数据库、一个状态机或一种文件格式。** 纯确定性、纯 LLM、混合执行必须遵循相同的身份、来源、因果与证据原则，但不必产生相同数量的事件。以下“必须”指**该行为确实发生、或组件宣称支持相关能力时**的要求，不表示所有 Demo 都要实现全部功能。

逻辑上只区分四项职责：**执行上下文、记录（Fact / Activity）、材料（Material）、可选的捕获范围声明**；它们不对应四个服务。

## 2. 公共最小契约

每条**新产生的源记录**必须能确定：稳定的记录 ID、类型与版本、实际事实 Owner 与采集方、已验证的执行归属（或明确未知）、源时间（或未知原因）、此类型必需的真实内容。Profile 与类型版本可以从可验证的批次上下文继承，不必每行复制。

| 条件身份 | 必须出现的可判定条件 | 未出现时如何处理 |
|---|---|---|
| Execution ID | 可信根创建任务，或后续组件收到经验证的执行上下文 | 未验证上游时标记 ORPHAN 并保留本地 locator；不能猜测 |
| Run ID | 同一执行出现**可独立启动/结束/恢复**的执行实例，且要跨记录关联 | 单一没有 Run 分层的执行可 N/A |
| Attempt ID | 同一请求存在**多个实际尝试**，或模型/工具协议的 attempt 身份要跨记录引用 | 单次无重试可 N/A；显式记录首次尝试也合法，不能制造虚假 retry |
| Activity ID | 活动跨多条事实、或有独立时间段与父子引用 | 单条无活动生命周期的 Fact 可 N/A |
| Request / Operation ID | 请求与响应分记录、发生重试/异步/副作用/交付，需要精确配对 | 自包含且可明确定位阶段的单条同步交互可由记录身份承担 |
| Owner sequence / Stream epoch | 来源本就提供有作用域的顺序，或**声明完整范围**依赖它 | 没有该来源特征时 N/A；不能用文件行号伪造 |
| OTel TraceId / SpanId | 真的存在 OTel 上下文时作遥测关联 | 无 OTel 时 N/A；不能由 TraceId 反推 Execution ID |

缺少可信上游 Execution 的回调，保留本地身份并标记未关联；以后以独立关联事实和可核查依据补充，禁止凭时间邻近推断或悄悄改写旧记录。真正独立的新根任务才创建新 Execution。

**Fact 不可静默覆盖**。冲突判定以**同一记录 ID**为键：规范化后的类型、类型版本、内容均相同才是同一记录重发；任一不同即报 CONFLICT（**不能因 typeVersion 不同而绕过冲突**）。一个 Activity 可以有共享的 `activityRef`，但“开始 Fact”“结束 Fact”和最终 Activity 记录各有**不同 recordRef**，所以合法地共存，不会误判冲突。Activity 可以是一条完整记录，也可以由开始/结束事实表达；**不强制双重记录**。没有结束依据就标为未知，不臆测失败、取消或零耗时。活动技术完成不等于业务副作用成功。

## 3. 因果、交付与独立状态

只记录可确认的关系：父子、导致、请求与结果、消费的实际材料、重试、调和、执行关联。关系须指向稳定身份，有来源依据；目标暂缺可保留未解析，不根据相邻行、名称或跨机时间猜测。

**Tool 产生结果 ≠ Host 获得结果 ≠ 模型下一次请求实际包含结果。** 异步、结果丢失或 Host 未知时须保留独立事实；简单同步请求允许用一条有类型的交互记录无损呈现请求、结果及交付，无须机械拆成多条事件。

技术 Activity 状态、Runtime terminal、Operation 副作用确定性、Host knowledge、Reconcile 和外部世界状态属于**不同维度**。多个 Owner 声称的不同结果都必须保留，不能折叠成通用 SUCCESS。允许具有明确权限的 Owner **另记裁决/调和 Fact**，写明裁决者、所裁决的对象与作用范围、来源证据和采用的规则版本；Consumer 可以据此展示“当前有依据的结论”，但不能改写/隐藏原始分歧。没有授权裁决就显示多方结论与未知，不让 Viewer 猜。

**复合 Interaction 的最小可寻址规则：** 无论同步调用合并为一条记录，还是拆成多个 Facts，都必须能准确区分**请求、结果、交付**三个实际发生的阶段及各自的状态、接收者和材料角色。关系可以指向独立 recordRef，或指向复合记录内稳定、版本化的阶段/材料位置（不得只指向含糊的整条 Activity）。`consumes` 必须由当次实际外发模型请求的完整有效输入证明；ToolResult 已保存/已交付并不证明下一轮模型见过它。不存在某阶段时标记 N/A，不能补造交付事实。

## 4. 条件化语义族

这五项是语义分类，**不是五种强制记录或服务**：

| 语义族 | 行为发生时要保留的信息 |
|---|---|
| Activity / 生命周期 | 真实活动身份、起止边界、技术结果与异常 |
| Decision / Evaluation | 模型决策或 Predicate/Verification 的身份、verdict、expected/observed、reason、证据或缺失说明 |
| Interaction | Model、Tool、Operation 的真实请求、输入、响应/错误，以及准确请求结果关联 |
| State / Outcome | 哪个 Owner 在什么范围内确认了 terminal、UNKNOWN、effect 或 Reconcile |
| Capture / Provenance | 源身份、显式缺失、迟到关联；只在声明封口/损失时需完整性说明 |

具体名称可采用版本化类型，例如 `model.request.dispatched`、`runtime.predicate.evaluated`，但不以 CreatedSession、Fabric、DSH 等业务或内部名称作为公共类型。没有 Model 的 Runtime 不需要任何 Model 事件。

**少量基础类型语义（候选，名称/枚举的机器拼写尚未冻结）：**

| 类型/阶段 | 发生时的必需语义 | 明确不可混淆的情况 |
|---|---|---|
| Predicate / Verification evaluated | 评价对象、该次评价、判断规则或版本、`verdict`、expected/observed 或可验证的缺失原因、依据 | **FALSE / FAIL** 是获得有效观察后的否定；**UNKNOWN / UNAVAILABLE** 是无法有效判断，不能代填 FAIL |
| Model request / response / failure | 交互与实际 attempt 身份、实际有效外发请求/Provider 配置、响应或失败阶段、对应材料和请求结果关联 | Dispatch ≠ Provider 内部已处理；无响应 ≠ 模型返回空字符串 |
| Tool / Operation request / outcome / delivery | 精确请求/操作身份、实际 attempt、工具/操作种类、输出/异常、Owner 断言、交付接收者与结果认知（发生时） | 请求已发 ≠ 副作用已确认；结果产生 ≠ Host 收到；UNKNOWN 不升级成功 |
| Activity / Capture | 实际活动范围及可信时间/状态；只有声明范围封口时才有来源覆盖和损失依据 | 没有结束记录 ≠ FAILED；只读到文件末尾 ≠ 源端 COMPLETE |

**语义族 × 能力最小适用矩阵：** “基础”表示只要产出该记录就必须符合 CORE；“条件”表示该行为确实存在、或宣称相应能力时才验收；“—”表示不由此族单独要求。不是生产五类事件的配额。

| 语义族 | CORE | DIAGNOSTIC | AGENT_L0 | DISTRIBUTED | ARCHIVE | LEARNING_CANDIDATE |
|---|---|---|---|---|---|---|
| Activity / 生命周期 | 基础 | 条件（异常/时段诊断） | 条件（模型/工具交互阶段） | 条件（跨 Owner） | 条件（纳入归档范围） | — |
| Decision / Evaluation | 基础 | 条件（评价实际发生） | 条件（模型有效请求） | 条件（跨 Owner 评价关联） | 条件（纳入范围） | 条件（独立评价来源） |
| Interaction | 基础 | 条件（请求排障） | 条件（实际模型调用、ToolResult） | 条件（跨组件请求） | 条件（纳入范围） | 条件（候选样本） |
| State / Outcome | 基础 | 条件（Owner 状态/分歧） | 条件（进入模型输入的观察） | 条件（跨 Owner） | 条件（纳入范围） | — |
| Capture / Provenance | 基础（存在时） | 条件（缺失诊断） | 条件（L0 证据） | 条件（关联） | 条件（声明 COMPLETE） | 条件（权利/来源审查） |

## 5. Material 与能力声明

Material 可内嵌在受控文件，也可通过受控引用读取；**不要求独立材料服务**。凡声称内容可重建，必须说明内容原始字节或无损编码、版本、摘要及其计算范围、Owner、访问/保留限制。脱敏内容必须有自己的来源和摘要，不能冒充原文。

有需要时分别报告**采集状态**（已采/未采/丢失/未知）、**完整性校验**（通过/不匹配/未验）和**访问状态**（可读/无权限/脱敏/过期）。没有材料需求的 Fact 不必生成空 Material 状态。

**Material 最小义务表：** 仅要求真实发生的内容；没有 Tool/Reference 不应生成空假材料。内容可内嵌于记录的有类型位置，但必须能够独立准确定位。

| 声明能力 | 需要可恢复或明确声明缺失的材料 |
|---|---|
| DIAGNOSTIC | 实际评价依据：expected、observed、reason、证据来源；不采集或权限受限必须区分 |
| AGENT_L0 | **当次外发有效模型请求完整内容**（消息顺序、工具定义/Schema、实际注入的 Skill/Reference、有效配置与 attempt），真实响应/错误；发生 ToolResult 时记录原始/交付版本及下一次请求是否确实包含它 |
| ARCHIVE | **所声明来源范围内**的记录、所要求的材料描述符/正文或缺失状态、范围与损失/封口证明 |
| LEARNING_CANDIDATE | 精确来源与摘要、独立质量/Oracle 评判依据、使用许可和脱敏/留存信息；不能只凭 Producer 的 SUCCESS |

以下能力**独立声明、按需验收**，不构成从低到高的单一等级：

| 能力 | 通过条件 |
|---|---|
| CORE | 身份、来源、类型、真实时间/未知、不可静默改写及基本关联 |
| DIAGNOSTIC | 发生判断或异常时，能恢复必要原因、实际观察、证据及缺失 |
| AGENT_L0 | 可校验地恢复**实际外发模型请求**、响应/尝试、工具定义、真正注入的 Skill/Reference 及 ToolResult 交接；未发生项为 N/A |
| DISTRIBUTED | 发生跨 Owner 行为时，能证明关联、区分重试/迟到/异步与 UNKNOWN |
| ARCHIVE | 对**有限且已声明的来源范围**证明记录与材料覆盖、丢失/截断及读回保真 |
| LEARNING_CANDIDATE | 独立的质量判定、许可、来源/版本、敏感筛查、训练/评测集隔离 |

**目标产品责任不是 Producer 自由选择：** 新 Producer 只要产出记录就须满足 CORE；有 Predicate/Verification 等实际判断的 Owner 须满足该记录的 DIAGNOSTIC；真正调用模型的 Agent/Adapter 须对**当次交互**提供 AGENT_L0；跨 Owner 请求边界须满足适用的 DISTRIBUTED；产品声称某一有限执行范围能完整离线复核时，须满足该范围的 ARCHIVE；独立的数据评测/准备环节负责 LEARNING_CANDIDATE，普通 Recorder 不替样本打正标签。组件可如实声明缺失，但**目标产品必须报告 TARGET_GAP，不能通过全部自选 CORE 来宣称已达成诊断和复现目标**。

**能力 PASS 必须带判定单位与覆盖依据**：至少区分单记录、单次交互、Run、Execution、有限来源段。内容完整性与来源捕获覆盖是两项独立判断。一个 Model Interaction 的 L0 PASS **不推导**整个 Run/Execution L0 PASS；一个 Predicate 可诊断 **不证明**整个 Run 没漏事件。范围覆盖未知则范围级 `UNKNOWN/PARTIAL`，不能因现存记录都通过就判完整；不适用为 N/A，未执行测试为 NOT_RUN，应发生却没采集为缺口而非 N/A。

**AGENT_L0 仅保证历史模型外发输入可重建**，不保证模型服务端未公开的内部变换、模型重跑逐字一致。Tool Catalog 可能位于请求正文，不一定在顶层工具字段；当次未注入的 Skill/Reference 属于不适用而非缺失。L1 模型重跑、L2 隔离控制流重演属于后续独立实验，不允许重发真实 5GC/Tool 副作用。成功的 Runtime 结果不会自动使样本成为训练正例。

敏感 Prompt、Tool 输入/结果、标识符和模型可见推理输出均须按权限及用途限制；不能收集模型未输出的隐藏内部推理。

## 6. 在线与离线的保真边界

**在线遥测**可以采样、裁剪或丢失，但保留的事实不能改变身份与语义，且须如实披露已知的覆盖限制；它不能仅凭可浏览就声称完整归档或 Replay。

**宣称无损的持久化、导出和重新导入**必须对选定来源范围保留全部必要的身份、类型、因果、时间/未知情况、材料引用及摘要。只有宣称一个有限 Owner 来源范围 `COMPLETE` 时，才必须提供可检查的来源边界、记录覆盖、损失/截断、材料完整性和封口依据。**不强制每个实时 Demo 建立 Capture Manifest**。无法证明范围完整时报告 UNKNOWN；跨 Owner 全局完整性不能从局部完整性自动推出。

OTLP、JSONL、Protobuf、归档容器和 Phoenix 都是**待评估的承载方案**。一套语义可以有在线有损投影与离线完整归档两种编码，不代表两套机器事实标准。

## 7. 四个最小反例（文本推演，并非已运行测试）

| 场景 | 最小合规表示 | 不需要 |
|---|---|---|
| 单进程 Predicate | 一条含 verdict、expected/observed、原因与证据的 Fact | Attempt、Activity、Tool、Manifest |
| 单轮模型调用、无 Tool | 请求/响应两条关联事实，或一条完整交互 Activity；保留实际请求、响应及材料校验 | ToolResult、Skill、跨 Owner 关联、额外重试 |
| Runtime 成功、Host 未知 | 同一 Operation 引用下的 Runtime outcome 和 Host knowledge；有调和时另记事实 | 强行统一成 SUCCESS、每跳一条事件 |
| 旧 JSONL/OTLP 部分导入 | 原来源 locator、显式合成的导入 ID、未知与截断声明 | 假冒原生 Sequence、时间或完整性 |

## 8. 一致性要求与冻结条件

未来所有实现共用一致性测试语义，但**按其宣称的能力**执行，不适用记 N/A，未验证记 NOT_RUN：

- **C01/C07**：判断依据完整，Owner 结果不互相覆盖（DIAGNOSTIC）。
- **C02/C09**：精确模型输入/交接可恢复，Replay 不触发真实副作用（AGENT_L0，后续 L2）。
- **C03/C04**：执行身份传播、迟到、重试、乱序和可信关联（DISTRIBUTED；CORE 只验稳定身份）。
- **C05**：重复投递去重，冲突不覆盖，未知终态不冒充失败（CORE）。
- **C06/C08**：材料校验、访问和缺失分离；声明无损的归档读回保真（ARCHIVE/AGENT_L0）。
- **C10**：无独立质量依据、权限或来源闭包则不能称训练合格样本（LEARNING_CANDIDATE）。

**尚未冻结的决策**：机器字段/类型 Registry、ID 格式与批次继承、材料规范编码及默认安全政策、在线/离线具体映射、黑盒正负向一致性用例。此阶段仅修订规范；不修改 DSH、Agent Demo、Runtime、Fabric、Console 或 Viewer 运行代码。
