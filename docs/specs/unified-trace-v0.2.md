# 统一 Trace 规范 v0.2（精简修订稿）

**状态：草案；4 项 P0 已补充 Gate 对应的正负例，但一致性测试未执行，均保持 OPEN；不授权修改 Producer 或 Consumer。**  
**日期：2026-11-05。**  
本文件是当前唯一候选规范；[v0.1 架构审查](../reviews/unified-trace-v0.1-architecture-review.md)及[v0.2 最小化审查](../reviews/unified-trace-v0.2-minimality-review.md)仅作为评审依据。[语义冻结复审](../reviews/unified-trace-v0.2-semantic-freeze-review.md)提出的四项 P0 已有候选判定规则，**还没有通过实际机器验证**。

## 修订摘要与冻结门禁

相对 v0.1，本稿保留统一身份、事实、因果与材料语义，**删除强制统一存储/活动双记录/全部事件类型/无条件 Capture Manifest**，改为按行为与产品目标验收。此轮进一步明确身份触发、材料与能力覆盖、复合交互引用、类型结果、在线投影。以下 P0 **文本已补充，尚未完成机器一致性验证，不代表 CLOSED**：

**机器测试夹具的判定层（仅夹具约定，不冻结 Producer 的 JSON/OTLP wire schema）：** `gateStatus` 为 `PASS | FAIL | NOT_RUN | N_A | UNRESOLVED`；`coverage` 为 `COMPLETE | PARTIAL | UNKNOWN | N_A`；`productStatus` 为 `PASS | TARGET_GAP | NOT_RUN | N_A`。三者不得混用：`PARTIAL` 是覆盖状态，不是 Gate 的另一种 FAIL；`TARGET_GAP` 是预登记产品的聚合结论，不是单记录 verdict。负例的 `issueCodes` 是本轮夹具断言标签，尚不是跨仓错误码注册表。测试读取结构化输入并比较这些字段，不能只对比一句中文结论。最小八个可解析 JSON 判例见 [P0 一致性向量](fixtures/unified-trace-v0.2-p0.json)。

| P0 / 类型 | Gate（按实际行为） | 输入向量形态（正/负） | 期望结构化输出（正 / 负） | 当前状态 |
|---|---|---|---|---|
| **P0-1 产品责任／验收流程** | 产品声明 + C02/C06；其他 Gate 仅在对应能力被声明且行为发生时检查 | 已发布产品 Profile（要求范围 AGENT_L0）+ 范围覆盖证据 + 交互记录 + 产品 PASS 声称；负例仅有 CORE 记录 | `productStatus=PASS` / `productStatus=TARGET_GAP`，负例 `issueCodes=[REQUIRED_CAPABILITY_MISSING]` | **OPEN** |
| **P0-2 覆盖范围／验收流程** | C02/C06；**C08b 仅在另行声明 ARCHIVE 时** | 已验证来源范围列明 3 次模型交互，配 3/1 次实际请求与响应或错误及其材料、Execution L0 声称 | `gateStatus=PASS, coverage=COMPLETE` / `gateStatus=FAIL, coverage=PARTIAL, issueCodes=[UNSUPPORTED_SCOPE_PASS]` | **OPEN** |
| **P0-3 复合交互／语义规则** | C02/C06 | 一条复合 Tool Interaction，内有稳定的 request/result/delivery 材料定位；后续模型有效请求包含脱敏版/错误声称消费原版 | `gateStatus=PASS` / `gateStatus=FAIL, issueCodes=[MATERIAL_ROLE_MISMATCH]` | **OPEN** |
| **P0-4 类型语义／语义规则** | C01（Predicate）；C05a 通用身份规则另检，C07 只在 Outcome/裁决时检 | **同一 Observation 缺失条件**下的一对 Predicate Fact：`observedStatus=UNAVAILABLE`、有原因，分别令 `verdict=UNKNOWN` 与伪造 `verdict=FAIL, observedValue=FALSE` | `gateStatus=PASS` / `gateStatus=FAIL, issueCodes=[INVALID_PREDICATE_VERDICT]`；逐项检查 `type/typeVersion` 与必填缺失原因 | **OPEN** |

**按类型关闭 P0：** P0-1/P0-2 属验收流程类：产品声明/范围输入、覆盖证明、聚合规则、结构化预期与实际输出已经确定且可独立运行；P0-3/P0-4 属语义规则类：版本化类型、阶段定位与 Predicate 字段/枚举的机器判定规则已确定，含合法/非法成对向量。**每项均须正负例独立一致性执行、断言完全匹配并通过版本审查**，方可分别 CLOSED；不互相等待无关 Schema，也不把文档 lint/工程 CI 视为一致性 PASS。当前全部 **NOT_RUN / OPEN**。

**其他冻结项**（机器 Schema、编码、权限政策、投影映射和黑盒测试）是上述语义定型后的**工程/互操作交付**，不是第五至第九项语义 P0。不得因表格出现 OPEN 而擅自启动各仓改造。

## 适用范围（先读）

本版仅约束**未来按本 Profile 建设的新组件**，或**明确选择升级到此 Profile 的现有组件**。存量 DSH、Agent Demo、Runtime、Viewer 不因本草案自动取得或失去合规资格。是否达成“统一 Trace 产品目标”，以**产品自身预先登记的能力声明和验收范围**判断；未登记目标产品时，不能凭本规范替某组件生成 TARGET_GAP。旧实现的历史验收不自动替代本 Profile 的 Gate。

## 1. 目标与原则

统一 Trace 同时服务于：**可诊断**（还原事实、原因与证据）、**可复现**（恢复 Agent 当时实际提交的模型请求和执行反馈）、**可学习**（为经独立评估、授权的训练/评测候选样本提供来源）。

**一套语义，不等于一个数据库、一个状态机或一种文件格式。** 纯确定性、纯 LLM、混合执行必须遵循相同的身份、来源、因果与证据原则，但不必产生相同数量的事件。以下“必须”是本 DRAFT 的**候选规范性用语**，供独立机器验证提取断言：仅在**该行为确实发生、或组件宣称支持相关能力时**适用，不表示所有 Demo 都要实现全部功能；在版本正式批准前不构成现有实现的合规承诺。

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

缺少可信上游 Execution 的回调，保留本地身份并标记未关联；以后以独立关联 Fact 和可核查依据补充，禁止凭时间邻近推断或悄悄改写旧记录。**ORPHAN 是记录产生时“尚无可信执行归属”的不可变来源断言**；后续确认的关联不回写 ORPHAN 记录，视图可依据新链接 Fact 展示“原为 ORPHAN，现已关联到 Execution E”，原断言仍可追溯。真正独立的新根任务才创建新 Execution。

**Fact 不可静默覆盖；recordRef 与 typeVersion 是不同维度**：recordRef 是**一次已发布源事实**的身份，其身份不依赖 typeVersion 字符串，发布后所关联的类型与版本也**不可原地升级**。同一发布身份（已含 Owner 命名空间的 `recordRef`，或 `Owner 命名空间 + 本地 recordRef`）作为对比键；不同 Owner 的同形本地 ID 不能直接互判冲突。**最小实质差异集**：规范类型、`typeVersion`、权威 Owner、源时间的原始精度/未知及原因、类型定义的必需内容（含该类型必需的关系目标）、所有声称属于原文的材料摘要描述符（算法、规范字节/编码范围、摘要值）。上述任一已确定字段不同 → **IDENTITY_CONFLICT**；完全等价 → 幂等重发；导入时间、展示排序、读取 locator、采集批次等非权威元数据变化只记 `METADATA_DRIFT` 告警，不改写源 Fact。比较须使用类型版本指定的无损规范化规则，保留原始时间精度及 `missing`/ `unknown` 区别；**没有已批准的规范化规则或材料不能核对时，结论是 `IDENTITY_UNVERIFIABLE`，不得自认相等或冲突**。后续新增摘要只能标为派生，不能冒充已发布的源摘要。

**合法版本演进分两种**：① 新发生的事实采用新 typeVersion，使用自己的新 recordRef；② 对历史事实的编码或查看投影升级，原始 source recordRef、source typeVersion 和原文保持不变，投影独立标注 `projectionVersion`；若权威 Owner 确实发布替代/更正事实，必须新建 recordRef，并用明确的 `supersedes` 关联旧 recordRef、保留两者。不得借换版重写旧身份。一个 Activity 可以有共享的 `activityRef`，但“开始 Fact”“结束 Fact”和最终 Activity 记录各有**不同 recordRef**，所以合法地共存，不会误判冲突。Activity 可以是一条完整记录，也可以由开始/结束事实表达；**不强制双重记录**。没有结束依据就标为未知，不臆测失败、取消或零耗时。活动技术完成不等于业务副作用成功。

## 3. 因果、交付与独立状态

只记录可确认的关系：父子、导致、请求与结果、消费的实际材料、重试、调和、执行关联；**仅在确实发生源记录更正/替代时**允许明确的 `supersedes` 关联。关系须指向稳定身份，有来源依据；目标暂缺可保留未解析，不根据相邻行、名称或跨机时间猜测。

**Tool 产生结果 ≠ Host 获得结果 ≠ 模型下一次请求实际包含结果。** 异步、结果丢失或 Host 未知时须保留独立事实；简单同步请求允许用一条有类型的交互记录无损呈现请求、结果及交付，无须机械拆成多条事件。

技术 Activity 状态、Runtime terminal、Operation 副作用确定性、Host knowledge、Reconcile 和外部世界状态属于**不同维度**。多个 Owner 声称的不同结果都必须保留，不能折叠成通用 SUCCESS。允许具有明确权限的 Owner **另记裁决/调和 Fact**，写明裁决者、所裁决的对象与作用范围、来源证据和采用的规则版本；Consumer 可以据此展示“当前有依据的结论”，但不能改写/隐藏原始分歧。**不同裁决 Fact 使用不同 recordRef**：两名有权 Owner 的裁决相反，是合法的**跨事实分歧**，而非同 ID 内容冲突。只有可查证的**事前规则记录**能够证明某裁决优先时，视图才可显示相应结论并保留其他裁决。规则记录以独立且不可覆写的 `recordRef` 发布，至少载明发布者/授权来源、`ruleVersion`、适用 Owner/事实类型/范围、优先级或决策顺序、`publishedAt` 与生效区间；可存于可审计的配置或记录仓，**不要求独立规则服务**。裁决 Fact 必须引用具体规则 `recordRef` 及其版本，并提供适用于被裁决对象的来源证据；规则须能够证明在**首次受其约束的相关裁决发布前**已经存在且生效（可靠发布记录/版本顺序均可，不能只信本机时钟）。规则变更以新 `recordRef` 发布，必要时用 `supersedes` 连接，不能事后覆写旧规则。无引用、无权限/范围匹配、无法证明事先发布、或者两条有效规则仍不能唯一裁定时，显示 **DISPUTED / UNRESOLVED** 和来源，不自行排序或改写为一个成功状态。没有授权裁决就显示多方结论与未知，不让 Viewer 猜。

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

**少量基础类型语义（候选，Producer wire 名称/枚举尚未冻结）：** Predicate 的**候选判别不变量**为：`observedStatus=UNAVAILABLE` 时必须提供不可用原因，`observedValue=FALSE` 不得作为实际观察值出现，`verdict=UNKNOWN`；有真实可用且为 FALSE 的观察才允许在相应判断规则下给出 `verdict=FAIL`。若“无法观察”导致流程失败，须另有独立的策略评价 Fact，不得偷换原 Predicate verdict。此处 `observedStatus/observedValue/verdict` 为测试的语义槽位，最终 wire 表达待 Registry 确定。

| 类型/阶段 | 发生时的必需语义 | 明确不可混淆的情况 |
|---|---|---|
| Predicate / Verification evaluated | 评价对象、该次评价、判断规则或版本、`verdict`、expected/observed 或可验证的缺失原因、依据 | **FALSE / FAIL** 是获得有效观察后的否定；**UNKNOWN / UNAVAILABLE** 是无法有效判断，不能代填 FAIL |
| Model request / response / failure | 交互与实际 attempt 身份、实际有效外发请求/Provider 配置、响应或失败阶段、对应材料和请求结果关联 | Dispatch ≠ Provider 内部已处理；无响应 ≠ 模型返回空字符串 |
| Tool / Operation request / outcome / delivery | 精确请求/操作身份、实际 attempt、工具/操作种类、输出/异常、Owner 断言、交付接收者与结果认知（发生时） | 请求已发 ≠ 副作用已确认；结果产生 ≠ Host 收到；UNKNOWN 不升级成功 |
| Activity / Capture | 实际活动范围及可信时间/状态；只有声明范围封口时才有来源覆盖和损失依据 | 没有结束记录 ≠ FAILED；只读到文件末尾 ≠ 源端 COMPLETE |

**核心类型最小负向判定式**（针对相关类型发生的记录，而非强制所有组件生产该类型）：

- **评价 C01**：`observed=NOT_AVAILABLE` 或实际不可读取，却声称已观察到明确的 FALSE 并给出 `verdict=FAIL` → FAIL；明确 `verdict=UNKNOWN`、记录缺失原因 → 可通过。真实业务规则可将“无法观察”判为流程失败，但那属于**独立规则/步骤的失败事实**，不能伪称原 Predicate 实际观察为假。
- **模型 C02**：声称模型请求已外发，却缺少本次有效请求材料或可核对的来源，仍将**该交互**标为 `AGENT_L0 PASS` → FAIL；仅调用模型 API 成功不等于模型内部处理已被证明。
- **Tool / Operation C07**（副作用声明证据；若同时宣称模型可复现，还需 C02/C06）：声称 `effect=CONFIRMED` 却无任何可辨认的**有权限 Owner 的确认断言或来源证据**（可以是同一 Fact 的有类型证据，不强制额外记录）→ FAIL；只有请求发出/HTTP 接收不能证明业务副作用已提交。
- **交付 C02/C07**：声称 `delivery=DELIVERED` 却无法确认接收者及其交付来源 → FAIL；Host 结果未知时必须保留 UNKNOWN，不伪造交付。
- **Activity / Capture C05/C08b**：仅因缺失结束记录就断言 FAILED，或没有源范围/封口依据却声明 `COMPLETE` → FAIL。

**语义族 × 能力最小适用矩阵：** “基础”**仅**表示产出该类型记录时须遵守 **§2 的公共最小契约 + C04a 稳定身份 + C05a 记录级去重/冲突**；不额外要求此族全部专业字段、其他能力或专用服务。“条件”表示该行为确实存在、或宣称相应能力时才验收；“—”表示不由此族单独要求。不是生产五类事件的配额。

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

**目标产品责任不是 Producer 自由选择，但由谁评估必须明确：** 目标产品的责任主体（例如应用集成方/验收负责人）必须在验收前登记**产品 Profile 声明**，至少写明产品标识、版本、目标范围（Run、Execution 或有限来源段）、参与 Producer/消费者及其角色、要求的能力、评价者和测试配置/版本。**TARGET_GAP 是该声明的范围级聚合验收结果**，由产品验收者计算/发布，不是某单一 Producer 的运行事实；没有产品声明时不得凭“你应该属于某产品”默认赋予 TARGET_GAP。新 Producer 只要产出记录就须满足 CORE；有 Predicate/Verification 等实际判断的 Owner 须满足该记录的 DIAGNOSTIC；真正调用模型的 Agent/Adapter 须对**当次交互**提供 AGENT_L0；跨 Owner 请求边界须满足适用的 DISTRIBUTED；产品声称某一有限执行范围能完整离线复核时，须满足该范围的 ARCHIVE；独立的数据评测/准备环节负责 LEARNING_CANDIDATE，普通 Recorder 不替样本打正标签。组件可如实声明缺失，但**目标产品必须报告 TARGET_GAP，不能通过全部自选 CORE 来宣称已达成诊断和复现目标**。

**产品 Profile 声明的可追溯发布：** 声明本身是产品责任 Owner 发布的**不可静默覆盖的治理 Fact**，遵守 §2 的发布身份/冲突规则，不要求它虚构运行时 Execution。必须有声明的 `recordRef`、`profileVersion`、产品/责任 Owner、`publishedAt`、适用范围、要求能力、参与角色、评价者与测试配置版本；聚合报告精确引用所用声明 `recordRef` 与版本。修订必须新建记录并以 `supersedes` 关联、保留旧声明；修改后的规则仅影响它明确适用的后续验收，不得追溯漂白旧 `TARGET_GAP`。没有可验证的事前声明，产品级判定为 `N_A`，而不是凭空产生 `TARGET_GAP`。

**能力 PASS 必须带判定单位与覆盖依据**：至少区分单记录、单次交互、Run、Execution、有限来源段。内容完整性与来源捕获覆盖是两项独立判断。一个 Model Interaction 的 L0 PASS **不推导**整个 Run/Execution L0 PASS；一个 Predicate 可诊断 **不证明**整个 Run 没漏事件。范围覆盖未知则范围级 `UNKNOWN/PARTIAL`，不能因现存记录都通过就判完整；不适用为 N/A，未执行测试为 NOT_RUN，应发生却没采集为缺口而非 N/A。

**AGENT_L0 仅保证历史模型外发输入可重建**，不保证模型服务端未公开的内部变换、模型重跑逐字一致。Tool Catalog 可能位于请求正文，不一定在顶层工具字段；当次未注入的 Skill/Reference 属于不适用而非缺失。L1 模型重跑、L2 隔离控制流重演属于后续独立实验，不允许重发真实 5GC/Tool 副作用。成功的 Runtime 结果不会自动使样本成为训练正例。

敏感 Prompt、Tool 输入/结果、标识符和模型可见推理输出均须按权限及用途限制；不能收集模型未输出的隐藏内部推理。

## 6. 在线与离线的保真边界

**在线遥测**可以采样、裁剪或丢失，但保留的事实不能改变身份与语义，且须如实披露已知的覆盖限制；它不能仅凭可浏览就声称完整归档或 Replay。

**有损投影的最低不变量（C08a，判定单位：每条源记录→每条投影的断言；不是能力等级）：** 凡声称“这是源记录 R 的投影”，不得改写已保留的 `recordRef`、类型/版本、Owner/来源、源时间精度及其未知标记、已保留关系的目标引用；不许用新语义冒充源数据。对每个源材料摘要描述符（算法、输入字节/规范编码范围、摘要值），投影必须标明以下**互斥状态**：

| `sourceDigestState` | 可验证条件 | C08a 判定 |
|---|---|---|
| `PRESERVED` | 当前投影确实保留原摘要描述符全部内容，逐字段可核对 | 不因该项违反不变量 |
| `REDACTED_BY_POLICY` | 底层权威副本仍保留完整原描述符；当前读者无权看，视图有可核验的保留/脱敏策略及受限标记 | 不视为篡改；若无法验证底层保留，只能 `UNRESOLVED`，**不能宣称无损 PASS** |
| `OMITTED` | 投影未保留原描述符、也不能证明安全受限保留 | 必须标 `LOSSY`，列入已知字段缺失；只允许作为**如实披露的有损投影**，不得声称源摘要无损保留 |

投影可为派生/转码内容**追加新摘要**，须另给算法、计算范围、转换来源和派生内容标识，不得替换源摘要。故意省略并已申明 `LOSSY` 不等同于篡改，但未申明、伪装成保留、或原值被改写均使 C08a FAIL。其余非必需字段的省略也须披露**已知的**采样/裁剪/缺失范围；无法知道漏了多少，标为覆盖 `UNKNOWN`，**不得为了满足格式凭空生成每条不可观测丢失的缺失 Fact**。单记录投影保真与整段执行覆盖是两个不同断言。

**旧资料导入**：如果缺少 Owner 原生 Record ID，可使用稳定的导入合成标识 `importRef`，须带原始来源 locator、合成标记及导入 Profile/映射版本；不可将它标记为原生 `recordRef`。同一来源再次导入时应依明确的原始 locator/版本与导入规则重复生成同一投影身份，不以浏览顺序派生。旧 OTLP 的 TraceId/SpanId 仅用于遥测相关性，**不能直接反推 Execution ID**；若有可信关联，由单独且带证据的链接 Fact 表达，保留旧记录原文。

**宣称无损的持久化、导出和重新导入**必须对选定来源范围保留全部必要的身份、类型、因果、时间/未知情况、材料引用及摘要。只有宣称一个有限 Owner 来源范围 `COMPLETE` 时，才必须提供可检查的来源边界、记录覆盖、损失/截断、材料完整性和封口依据。**不强制每个实时 Demo 建立 Capture Manifest**。无法证明范围完整时报告 UNKNOWN；跨 Owner 全局完整性不能从局部完整性自动推出。

OTLP、JSONL、Protobuf、归档容器和 Phoenix 都是**待评估的承载方案**。一套语义可以有在线有损投影与离线完整归档两种编码，不代表两套机器事实标准。

## 7. 最小合规场景与负向反例（文本推演，未运行机器测试）

| 场景 | 最小合规表示 | 不需要 | 负例：会违反什么 |
|---|---|---|---|
| 单进程 Predicate | 一条含 verdict、expected/observed、原因与证据的 Fact | Attempt、Activity、Tool、Manifest | 只写 PASS 不留评价依据违反 **C01**；**额外真实 Attempt 不违规**，伪造重试才违反 **C04** |
| 单轮模型调用、无 Tool | 请求/响应两条关联事实，或一条完整交互 Activity；保留实际请求、响应及材料校验 | ToolResult、Skill、跨 Owner 关联、额外重试 | 只保存 SHA、没有可读取原文却宣称 AGENT_L0 PASS 违反 **C02/C06** |
| Runtime 成功、Host 未知 | 同一 Operation 引用下的 Runtime outcome 和 Host knowledge；有调和时另记事实 | 每跳一条事件或全局 Manifest | 把 Host UNKNOWN 覆盖为 SUCCESS，或无授权裁决就只显示一方结果违反 **C07** |
| 旧 JSONL/OTLP 部分导入 | 原来源 locator、显式合成的导入 ID、未知与截断声明 | 原生 Sequence、时间或完整性若原文没有则不要求 | 用 JSONL 行号冒充 Owner sequence 违反 **C08a**（若同时冒充稳定原生记录身份才违反 **C04a**）；把采样 Trace 声称完整归档违反 **C08b** |

**额外负例 M1（C02/C08b，覆盖范围）**：3 次 Model 调用只留第 3 次。可以宣称“交互 3：L0 PASS”，但“整个 Execution：L0 PASS”违规，必须报告前两次缺口/范围未知。

**额外负例 M2（C02/C06，交互阶段）**：同一个 Tool Interaction 保存原始敏感结果和脱敏结果，而下一次模型请求只包含脱敏版。若 `consumes` 只指向整条 Activity，进而声称原始敏感结果被模型看见，违反 §3 的材料阶段定位及 AGENT_L0。

## 8. 一致性要求与冻结条件

未来所有实现共用一致性测试语义，**按角色、实际行为及所声明能力**执行。N/A 仅限确实不适用，NOT_RUN 表示尚未验收；**目标产品本应提供却未采集的能力是 TARGET_GAP/FAIL，不可填写 N/A**。

| Gate | 条件与应验收行为 |
|---|---|
| **C01** | DIAGNOSTIC：发生 Predicate/Verification 判断时保留有效 verdict/UNKNOWN、依据与材料 |
| **C02** | AGENT_L0：实际 Model 交互精确可重建；有 Tool 才检验返回、交付和下一次请求消费；交互级 PASS 不升级成 Execution PASS |
| **C03** | DISTRIBUTED：确实跨 Owner 时验证 Execution 传播、异步和可信迟到关联；纯本地 N/A |
| **C04a** | CORE；**单源记录/身份断言**：身份稳定、Owner 命名空间解析和同身份同内容重发；不要求跨 Owner retry |
| **C04b** | DISTRIBUTED；**跨 Attempt/事件关系断言**：真实 retry、乱序、异步时保留不同 Attempt 身份与明确因果，无该行为 N/A |
| **C05a** | CORE；**单身份记录集断言**：所有新源记录的幂等重发、`IDENTITY_CONFLICT`、不可核对判定均适用 |
| **C05b** | 含 terminal 语义的记录；**终态断言**：未收到结束事实不得冒充 FAILED，且终态与副作用/Host knowledge 不折叠；仅输出普通 Decision 的 CORE Producer 不需实现 State 系统 |
| **C06** | AGENT_L0 / ARCHIVE：所要求材料的编码、摘要、原文可取回性、权限与缺失分别检验；无关记录 N/A |
| **C07** | DIAGNOSTIC / DISTRIBUTED；**单条 effect 声明及跨 Owner 裁决断言**：`effect=CONFIRMED` 要有授权 Owner 的确认依据；Owner Outcome/Host Knowledge 分歧必须并存，规则引用与事先授权可验证才可优选，不得合并 SUCCESS |
| **C08a（投影）** | 所有声称源记录投影的组件；**逐投影断言级检查**（非 CORE/ARCHIVE 能力）：真实身份/来源/时间/关系不得改写，摘要处置三态须如实标记，缺失须 `LOSSY`，不能伪造完整性 |
| **C08b（归档）** | ARCHIVE；**有限来源范围级能力 Gate**：宣称无损导出、重开、读回，逐项对比原始身份、类型、材料摘要及可信封口/覆盖；只做在线投影者 N/A |
| **C09** | **L0：只读重建**，不得触发真实 Tool/5GC；**L2（未来另验）：隔离控制流重演**，须禁用真实副作用。**不能以 C09 要求 L0 实现 L2 Engine** |
| **C10** | LEARNING_CANDIDATE：独立评估/Oracle、授权、完整来源和数据集隔离；普通 Producer N/A |

**适用范围详见文首**；本节 Gate 仅针对对应产品声明、组件角色及已发生行为执行，不能对存量实现追溯授权。

**术语状态表：** 表内“必须”均为**待机器验证的候选规范断言**，并非已获版本批准的合规承诺。整份 v0.2 仍为 DRAFT，**没有任何概念被正式冻结**；后两列专门区别仍需讨论的语义与纯机器表达问题，避免把“缺枚举/缺裁决规则”错说成只需决定 JSON 字段名。

| 术语 | 已明确的候选语义（未正式冻结） | 尚待确定的语义规则 | 尚待确定的机器表达 |
|---|---|---|---|
| Execution / Run / Attempt | 业务目标 / 实际运行实例 / 真实尝试，按行为分层 | 跨信任域执行边界、复杂恢复是否创建新 Run | ID 编码、传播头/受信映射 |
| Fact / recordRef | Owner 命名空间内唯一的已发布源身份、最小实质差异集和不可静默覆盖；更正新建记录 | 更正授权的跨信任域证明 | 类型 Registry、逐类型规范化/冲突比较、投影版本字段 |
| Activity / activityRef | 时段活动可一条记录或多条事实表示；活动 ID 不等于记录 ID | 特殊暂停/恢复边界 | Span/Log 对应、阶段引用编码 |
| Request / Operation | 请求、尝试、结果与副作用的准确关联 | 跨系统接收确认与超时边界 | 交互阶段定位、跨域身份绑定 |
| Owner / Host knowledge | 事实权威来源 / Host 当时对结果的真实认知；裁决必须引用事前发布的可寻址规则 Fact | 具体业务授权者的优先序和信任证明 | `ruleRef` 编码、权限证明与类型枚举 |
| terminal / effect / Reconcile | 终态、副作用确定性、后续调和分维度；C05b/C07 按实际语义触发 | 具体业务 outcome 转换与相冲突规则的优先序 | 版本化类型和值编码 |
| Material | 有来源的实际请求、响应或诊断证据，受权限控制 | 具体分类、保留、原文/脱敏后用途政策 | 字节域、摘要算法、编码及材料引用 |
| ORPHAN / importRef | 当时无可信关联的不可变断言 / 导入器合成身份 | 跨域关联可信证据要求 | 原始 locator、导入映射版本 |
| Capture / Projection | 有证明的来源范围封口 / 可有损在线表示；C08a 的摘要保留、受限保留、已知省略分开 | 目标产品的完整性断言范围 | 投影三态、Manifest 与 C08b 传输格式 |

**尚未冻结的决策**：机器字段/类型 Registry、ID 格式与批次继承、材料规范编码及默认安全政策、在线/离线具体映射、黑盒正负向一致性用例。此阶段仅修订规范；不修改 DSH、Agent Demo、Runtime、Fabric、Console 或 Viewer 运行代码。
