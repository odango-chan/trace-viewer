# Unified Trace Specification v0.1 — Architecture Review

**Date:** 2026-11-05  
**Review target:** [Unified Trace Specification v0.1](../specs/unified-trace-v0.1.md)  
**Decision:** **DIRECTION_ACCEPTED / SPEC_FREEZE_BLOCKED**  
**Review scope:** 独立语义与跨 Demo 重实现可执行性；**仅文档评审，不改 Producer/Viewer，不冻结 OTLP**。

## 1. 总评

**支持：** 可诊断、可复现、可学习三重目标；确定性与 LLM 平等；Activity vs Fact vs Material 区分；Owner 分维度状态；显式因果；缺失与内容受控；不凭现有 Demo 决定未来规范。

**不能冻结的原因：** 规范虽有公共字段，却尚缺 **Execution 上下文的创建/传播、事件生命周期与幂等、Relation 的方向/目标类型、最小类型 Registry、可复现材料闭包和在线/离线保真边界**。不同弱模型按当前 v0.1 实现，很可能得到三个“字段同名、语义不同”的系统。

此评审是**对草案的审查意见**，不是第二套机器规范，不自动修订 v0.1，也不授权跨仓实现。

## 2. 六项 P0 / 冻结阻塞

### P0-1 Execution/Run/Attempt 的身份分配与传播缺操作规则

**原文：** §2、§3.1、§10.2。规定 \`executionRef\` 强制且在未知时由采集端生成，但没有约束**谁**创建、如何跨进程/重试传播、失联后怎样恢复关联、一个外部消息可关联多个 Execution 时怎么处理。

**反例：** Agent 发出异步 Tool 调用；Runtime 先收到请求并自行生成 executionRef；Fabric 回调稍后到 Host。三方都“满足必填”却生成三个互不相关的 Execution，Viewer 无法无猜测地还原过程。

**建议 v0.2：**
- 区分 **execution identity**（业务目标/追踪集合）、**record identity**、**activity identity**、**operation/invocation identity**；为每种 ID 指定创建方、唯一作用域、寿命、传播与重试规则。
- 可关联请求必须传原 \`executionRef\` 和发起方稳定请求/操作 ref；首次根入口负责创建，续程继承，跨安全域有明确映射/链接规则。
- 外部/孤立源尚不知道 Execution 时**允许 orphan + explicit late association**，禁止临时生成无从关联的新“同一执行”ID；关联可以由后续有来源的 Fact 建立，不要原地篡改旧事实。
- \`ownerSequence\` 应明确 scope（producer stream+epoch/restart），否则 1、2、3 不能跨重启安全引用。

### P0-2 Activity 生命周期、不可变性与重复投递语义不闭合

**原文：** §3.1–3.2 的稳定 \`recordRef\`、Activity start/end、OPEN/UNKNOWN，以及 §7 C08。

**反例：** Tool 开始时产生 Activity，网络断开后 Collector 收到两次“完成”；原始 Span 可能只在结束时导出。规范没说是**同一记录更新**、还是 start/end 两个 Fact、还是两个 Activity。Producer A 选择 upsert，Producer B 选择 append，Consumer 只能猜。

**建议 v0.2：**
- 规定**事实记录 append-only / immutable**；用稳定 ID 做重复投递去重，不丢真实重复调用。
- Activity 有唯一标识和确定的开始/结束**记录生命周期**：源端可在结束时输出完整 Activity，运行中可输出开放状态/生命周期 Fact；结束与中断不能相互覆盖。明确定义迟到、重复、崩溃和恢复行为。
- 把 **同一记录的重发** 与 **同一操作的多次执行尝试**严格区分；Attempt 不复用 Activity ID/Operation ID。
- \`OPEN\`、\`UNKNOWN\`、\`CANCELLED\` 不能由“没有收到结束记录”自动判断为业务失败。

### P0-3 Relation 方向和语义仍有歧义

**原文：** §3.3、§8 示例。 \`resultOf\`、\`consumes\`、\`deliveredTo\`、\`evidenceFor\` 混用了事件、活动、执行主体和材料引用。

**反例：** 示例用 \`deliveredTo → model-input Activity\` 表示 ToolResult 交付，却没有明确接收者是 Host、Model Adapter 还是模型请求。另一个团队将它直接视为 Model 已消费；反而造成假 Replay 证明。 \`evidenceFor\` 可能由 Material 指向 Fact，但目前只有 Activity/Fact 声明可承载 relations。

**建议 v0.2：**
- 先定关系允许的**源/目标对象类型**、方向、时间约束和必要证明，再定字段名。可以只保留 \`parent/causedBy/resultOf/consumes/retryOf/reconciles/evidenceFor\` 等少数语义；交付应独立由 **delivery Fact + receiver identity** 表述。
- 将 **Tool executed、Result persisted、Host received、Model input constructed、Request dispatched、Model actually received（若可证）** 分开。只有有效 dispatch-time Material 与引用能证明模型“输入包含该内容”；不要由一次 \`deliveredTo\` 边推断模型已消费。
- 允许**未来目标/迟到关联**：导出时未解析的引用保持 unresolved，后续用独立 link/correlation Fact 补全而不是静默改旧事件；跨 Owner 推断不得冒充 confirmed。
- 关联关系的信任级别和目标不存在时的状态（missing/unauthorized/not-yet-observed）必须明确。

### P0-4 只有 \`name\` Registry，不足以跨 Demo 实现同样语义

**原文：** §3.1 的 \`name\`+自由 \`attributes\`，§3.2 “版本化类型及字段扩展”，§10.4 待定 Registry。

**反例：** 两个 Runtime 都产出 \`runtime.predicate.evaluated\`，一个写 \`verdict: pass\`，另一个写 \`status: true\` 并省略 expected/observed 和证据；从通用 envelope 看两者都“合规”，但诊断效果完全不同。

**建议 v0.2：** 定义**少量必备的类型语义 Profile**，每类具不可省的身份、状态/结果、Material 角色及因果引用；至少覆盖：
- **Model request dispatched / response received / attempt failed**：有效输入、模型配置、response、attempt 与 dispatch ID；
- **Tool invocation / outcome / result delivered**：requestId、arguments/result、接收者与 Host knowledge；
- **Runtime procedure transition/terminal、predicate evaluation、verification**：procedure/predicate identity、observed/expected、reason、evidence refs、verdict；
- **Operation outcome / unknown / reconcile**：operation ID、mutation certainty、reconcile target；
- **Capture/completeness record**：参见 P0-5。
扩展类型可存在，但**同名基础类型必须有相同判定条件**，不能全部自由 \`attributes\`。不用为 CreatedSession、SSC、Fabric 定义新的基础事件类。

### P0-5 Material + Replay + Completeness 需要一个可验证的“闭包协议”

**原文：** §4、§5、§6 与 §7 C02/C05/C06/C08。

**反例：** 完整 Prompt 和 Tool Catalog 各有 SHA，但原始数据一个月后被清理；另一个系统对通过脱敏的 JSON 重新算 SHA；两个团队都标记 \`COMPLETE\`。一个是数据不可重建，另一个是内容已改变，L0 都不成立。

**建议 v0.2：**
- 明确 Material 的 **identity、原始 bytes 或规范编码、digest domain/algorithm、源版本/URI、角色、保留/权限政策**；**raw request、provider-normalized request、model-visible surface** 明确区分，禁止混写。
- 设计一个**最小 Execution/Run capture manifest（闭包/封口事实）**：来源范围、Owner/stream、起止/检查点、预期与实得计数或可用依据、材料索引+摘要、捕获/采样/截断声明及计算出的 COMPLETE/PARTIAL/UNKNOWN。它可以是 Manifest Material 或 closure Fact，不必新增一种强制事件 Envelope。
- **记录保真、归档保真、查看可访问、Replay L0 完整性必须分开判定**；\`ACCESS_DENIED\` 是访问结果，不是材料在源端未保存；\`NOT_CAPTURED\` 与丢失也不同。
- 对真正的 Agent replay 以**当次实际 dispatch 的完整有效输入**和交付记录为准。区分消息组织、Tool Catalog、Skill/Reference 实际注入、Provider 配置/默认值/attempt、流式失败。材料有 SHA 但没有可取回原文不能 \`L0 PASS\`。
- 捕获完整上下文会带来敏感信息风险：定义私有受控材料捕获模式、默认限制、数据保留/删除/授权；不能以“为训练准备”为理由无条件保存所有原文。训练标签仍由外部 Evaluator/Oracle/人工归因。

### P0-6 “只允许一个交换编码”容易把传输与归档强行绑定

**原文：** §10.1 “唯一机器交换编码”、§9 OTel 候选及 §4 离线闭包。

**反例：** 使用 OTLP Spans + LogRecords 实时查看，但是 Collector 的采样/SDK Limits 丢掉了 Predicate 或 Prompt Material。另一团队把整个离线闭包做成 OTLP events，却难以表达 Material 读取、Content Digest、闭包确认。结果要么诊断丢数，要么又造出第二套未登记的格式。

**建议 v0.2：**
- 真正的“一套”应是**一套规范性的语义 Profile 和跨实现一致性规则**，不强求在线传输、运行事件持久化、离线材料包必须逐字相同的 wire。
- 标准 OTLP 可承载在线 Traces/Logs；一个离线 Material+Manifest 包可重用同一身份与类型 Profile。**编码可以不同，语义必须等价**，必要时定义无损映射和反向校验。
- 把 **lossless capture / recoverable archive** 与 **best-effort telemetry** 两个服务等级写清；采样 Trace 只能作可观测展示，不能独立声称完整可诊断/可复现/可训练。
- 选型后才能冻结具体映射；不要为兼容 Phoenix 或现有 DSH EventStore 反向删字段。

官方依据（用于技术选型，不替代本规范）：
- [OpenTelemetry Traces/Links 模型](https://opentelemetry.io/docs/specs/otel/overview/)
- [OpenTelemetry Logs Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)
- [OTel Common Limits](https://opentelemetry.io/docs/specs/otel/common/)
- [GenAI Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/)

## 3. P1 — 建议随后一并澄清

| 问题 | 风险 | 最小补充 |
|---|---|---|
| 时间字段不够精确 | 机器时钟漂移、跨 Host duration 不可直接相减 | 声明时间单位/精度、source clock quality；Activity duration 优先本地 monotonic clock，不能用跨机绝对时刻计算 |
| \`producer\` 与 \`source\` 责任混合 | 代理采集可能把 collector 当权威 Owner | 分开 \`emitter/capture agent\`、\`authority/source owner\` 与使用的原生 schema |
| 规范版本与事件类型版本混用 | 不能独立演进 \`runtime.predicate.evaluated\` | Profile version + 语义 type version + Material encoding version 明确区分 |
| Fact 与 Snapshot 之间的证明不足 | Snapshot 自己 hash 成功不证明来源事件完整 | 明确 Snapshot 需要可解析 Source refs + 完整材料 + dispatch boundary，不能用当前 Skill 文件重组历史输入 |
| 完整性目标写得过于绝对 | 同一个多 Owner Execution 不一定能知道全世界有多少事件 | **按 Owner/stream 声明闭包**；Execution 聚合状态仅由已确认的来源集合推导，未知 Owner 不自动视为 COMPLETE |
| 生命周期中的删除/撤权 | 训练与 Replay 保留政策冲突 | 引用仍可显示 \`REDACTED/EXPIRED/ACCESS_DENIED\`，Replay eligibility 随之下降；不谎称永久可复现 |
| Conformance Gate 只描述故事 | 弱模型可能选择单个漂亮案例掩盖不兼容 | 为每个 Gate 指定正例、错配 ref、乱序、缺材料、状态冲突、双编码保真等**黑盒测试向量**，并明确禁用以 snapshot PASS 冒充完整 Agent E2E |

## 4. 最小语义校正示意（不是要立刻增建新 Schema）

把 \`executionRef\` 的实际生成/传播规则作为单一跨组件关联机制；

把 \`activity\` 和 \`fact\` 的写入/重发/关闭语义明确为**可重建、可去重、不可悄悄覆盖历史事实**；

把 Model request、Tool Call、Tool Result delivery 和 Runtime verification 各自的**必要语义字段**约定成一张小表；

把 Material 的 digest/读取/保密、单 Owner 数据闭包及在线/离线一致性明确；

再检查 OTLP/JSONL/离线包能否**无损表达同一套逻辑记录**。这一顺序比先选 Phoenix 或先改 DSH 更安全。

## 5. 冻结与实施决策

| 事项 | 决策 |
|---|---|
| v0.1 方向 | **接受作为需求/概念基线** |
| v0.1 正式冻结 | **BLOCKED：P0-1～P0-6 未闭合** |
| 各 Demo 依据 v0.1 修改 Producer | **NOT_AUTHORIZED / NOT_STARTED** |
| OTel/OTLP 最终采用 | **PENDING** |
| v0.2 建议目标 | **澄清 6 个 P0，精简一份规范，不新增并列 Replay/Training Trace 合同** |
| 何时交给弱模型实施 | **通过概念冻结 + 机器 Schema + 黑盒正负向 Conformance Fixtures 后** |

**结论：** 一套语义和一组一致性门禁是对的；必须补齐身份传递、事件生命周期、因果证明、类型 Profile、Material 闭包和传输/归档分层，之后才能真正要求各 Demo “按规范重写一次”。