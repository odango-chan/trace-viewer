# 统一 Trace：需求与现状审计（讨论基线）

**状态：需求审计 / 待评审，不是已批准机器契约**
**审计日期：2026-11-05**
**范围：Agent / DSH、Harness、Runtime、诊断、Console / Trace Viewer；兼容确定性、纯 LLM、混合执行**
**本轮不修改 Producer、不冻结 OTLP Profile，也不另建多种 Trace Schema。**

> **一句话目标：一个可采集、存储、关联、搜索、离线查看的执行轨迹体系；正常轨迹可读，异常诊断足够深，全部事实可追溯。** Runtime 诊断与 Agent Model/Tool 轨迹同等重要。现阶段都是 Demo，允许调整 Producer，而不是靠 Viewer 长期维护不同格式。

## A. 需求基线（先于格式选择）

| ID | 优先级 | 必须达到的行为 | 典型场景 / 反例 |
|---|---|---|---|
| R01 | P0 | **一套共享对外 Trace 约定**。Agent、Harness、Runtime 原生生成兼容的活动与事件，Console/Viewer 使用同一消费语义；存量导入仅作过渡 | 不继续各自定义长期 TraceStore v2 / review JSONL / Viewer DTO 作为并列外部标准 |
| R02 | P0 | **所有执行模式覆盖**：纯确定性（Procedure、Observation、Verification、Action、Reconcile），纯 LLM（Model/Tool/Context/Skill），混合执行（Agent→Tool→Harness→Runtime→结果交付） | 零 Model 的确定性路径不可伪造 Model Span；Runtime 诊断必须完整可见 |
| R03 | P0 | **记录活动与离散事实**：活动需真实耗时/parent；事实需 type、来源、实际时间（新 Producer 能记录时）、状态/输入输出摘要、明确 refs | Graph Transition、Predicate Evaluated、CALL_RESULT、Host ToolResult delivery 都是重要诊断事实，而不只是 span 名称 |
| R04 | P0 | **身份/关联准确**：跨系统 correlation 的 Task/Session/Run、request/toolCall、procedureInvocation、attempt/occurrence/parent、source refs；不要求全系统单一递增 sequence | 异步、并行、乱序结果、重复投递不能按时间相邻错误配对 |
| R05 | P0 | **状态各归其主**：Agent Host knowledge、Runtime run terminal、operation mutation outcome、reconcile、Fabric/World disposition、Material closure 独立显示 | Runtime SUCCEEDED 但 Host RESULT_UNKNOWN；OUTCOME_UNKNOWN 后 Reconcile COMMITTED；禁止揉成一个 success |
| R06 | P0 | **诊断深度**：安全授权范围内能下钻到真实 Model request/response（含实际 model-visible context/tools）、Tool arguments/result、Runtime 检查明细、Predicate/Verification、错误与恢复路径 | 当前 `review-diagnostic.mjs` 丢弃 `data/diag/material/summary` 是当前安全 Demo 的限制，**不能当未来完整产品需求** |
| R07 | P0 | **敏感数据安全且不丢诊断能力**：采集侧有敏感级别/授权/脱敏策略；公开默认安全摘要，私有环境可经权限读取原生材料；不采集隐藏推理链 | 不把原始 5GC 标识、用户凭据、系统提示词全文直接推到公共 Repo 或遥测后端 |
| R08 | P0 | **可靠性与缺失显式化**：记录计数、导出/落盘确认、丢弃/采样/截断/不完整状态；崩溃或部分记录不能伪装完整 | 诊断审计要求 loss awareness；普通 sampled tracing 的“看见部分 span”不能证明事实闭包 |
| R09 | P0 | **原生业务事实与 Trace 区分**：Runtime RunEvent/RunEvidenceMaterial、DSH SessionEvent 等仍是各自权威；共享 Trace 按精确 ref 指向它们 | 不让 Phoenix、Viewer 或共享 telemetry 成为改变 Runtime 业务终态的第二真源 |
| R10 | P1 | **统一查看体验**：一次执行有清晰 overview、时间/结构视图、异常优先、四泳道、Readable/Model only/All owners/Raw、Inspector 与 source locator | 复用 ca-console Demo 的交互，但不把 Console 卡片当作 wire schema |
| R11 | P1 | **存档/恢复与查询**：单次运行可离线导出并重开；支持按 Run/Task、失败原因、Model/Tool/Procedure、时间查询；保留版本与原生 source ref | 不接受只能连接运行中的 Phoenix 才能追溯历史；保留敏感材料需受控 |
| R12 | P1 | **尽量复用开源组件**：优先评估 OTel SDK + GenAI SemConv + OTLP，Phoenix 作为 viewer/backend 候选；不重复造传输/树形查看 | 不因 Phoenix 能显示 9 spans，就认为 Trace Logs/证据全量入库/取回成功 |
| R13 | P1 | **渐进式适配 Demo**：先改采集/契约最小闭环，再统一现有 Producer 和 Viewer；保留有限过渡导入工具，避免长期双轨 | 不要求 TLS、分布式生产级运维、海量遥测策略或重新搭建 Agent 平台 |

P0 是“不能删掉的需求”，P1 是“最小产品价值与后续实现”。权限控制/完整性在 Demo 里可以做轻量版本，但不能把所需能力从设计中删掉。

## B. 审计发现（代码/归档可证实的事实）

| 项 | 已有基础 | 明确缺口/风险 | 优先处理 |
|---|---|---|---|
| Agent Demo 原生 Trace | [events.py](https://github.com/odango-chan/ca-agent-demo/blob/main/src/ca_agent_demo/demo/trace/events.py)：TraceRun / TraceEvent / TraceSpan；[store.py](https://github.com/odango-chan/ca-agent-demo/blob/main/src/ca_agent_demo/demo/trace/store.py) 的材料 digest | 事件以 Run 内 sequence（0 起）排序但无每事件 occurredAt/eventId；Model/Procedure refs 散在 kind-specific data | P0 |
| Runtime 真实诊断导出 | [P8-D4 真实 JSONL](https://github.com/odango-chan/ca-agent-demo/blob/main/artifacts/reviews/20261104-createdsession-p8d4-final-live-e2e/evidence/runtime-trace-attempt2.jsonl)，106 行（21 span +85 event） | 导出事件无顶层 owner sequence/event ID/occurredAt；不能从报告行号倒填“原生序号” | P0 |
| Runtime 业务源 | [RunEvent.v1](https://github.com/odango-chan/ca-runtime/blob/main/schemas/v1alpha1/run-event.schema.yaml)：eventId/runId/sequence/occurredAt/producer/correlation/evidenceRefs；[Evidence material](https://github.com/odango-chan/ca-runtime/blob/main/schemas/v1alpha1/run-evidence-material.schema.yaml) | 它是 Runtime 事实 schema，不是所有 Agent/Model/Tool 事件的通用格式；不能无脑替代 | P0 |
| Agent/DSH | [Agent trajectory](https://github.com/odango-chan/connectionagent/blob/main/docs/design/agent-trajectory.md)：Session/Turn/Step、精确 request/result refs、快照、source-local sequence（设计基线） | 全面落地与跨 Runtime 实测覆盖尚未证明；关联/内容完整性要依实际 Producer 复核 | P0 |
| Console | [trajectoryProjection.ts](https://github.com/odango-chan/ca-console/blob/main/src/modules/runs/trajectoryProjection.ts)：四泳道、Model/Tool folding、Source Inspector | 这是阅读投影，不是采集 schema；部分 tool-visible 视图存在基于文本解析的 fallback，不足以证明真正模型可见内容 | P1 |
| Viewer 的 real diagnostic importer | [review-diagnostic.mjs](https://github.com/odango-chan/trace-viewer/blob/main/site/review-diagnostic.mjs) 明确 drop 所有 `data/diag/material/summary` | 已通过“106 行能读”的验收，却**没有达到诊断深度 R06**。应未来通过受控 material 引用/权限恢复详细事实，而非默认公开原文 | P0 |
| OTel / Phoenix PoC | [Phoenix synthetic report](../experiments/phoenix-otel-poc.md)：2 trace/9 spans/5 attributes + UI | **只有 Span & attributes PoC**；没有 Logs/GenAI 完整快照、真实 Runtime 离线 roundtrip、丢数/截断、材料权限/完整性验收 | P0 选型门禁 |
| 存量文档 | [trace-inputs](../contracts/trace-inputs.md) 旧版本按 D1/D2 多来源消费；[统一评估](trace-unification-assessment.md) 最近提出单契约 | 存量 Adapter 是迁移工具，不能持续作为长期外部格式路线；此前“禁止上游统一”已由 2026-11-05 的目标替代 | P1 |

## C. 关键设计边界，不能被“统一”抹平

1. **统一 Trace 协议 ≠ 单一业务事实 Owner。** 业务事件可采集成统一遥测，但其原生权威 ID/内容/证据归属不变；不能让 `traceId` 取代 `runId` / `taskRef`。
2. **活动（Span）≠ 离散事实（Event / LogRecord）。** 一种逻辑 Trace Profile 可以组合标准 OTel Traces 和 Logs；标准组件有多个 signal 端点并不意味着我们再发明两套业务契约。
3. **运行过程的诊断深度 ≠ 默认全量公开。** 压缩摘要、敏感明细、不可变材料索引应该分开；丢弃原始细节会使 Debug 不完整，公开原文会带来泄漏风险。
4. **统一阅读顺序 ≠ 跨 Owner 全局 sequence。** 保留各 Owner 自身顺序，跨系统基于明确 refs / trace-context / span-links；无链接时显示未关联。
5. **历史数据缺事件时间**：可以保留 `Timestamp` 缺失，并记录真实的 `ObservedTimestamp`，但**采集/导入时刻绝不伪装成源事件发生时刻**。参见 [OpenTelemetry Log Data Model](https://opentelemetry.io/docs/specs/otel/logs/data-model/)。
6. **OTel 不天然保证审计完整**：SDK sampling、span/event/attribute 限额、后端保留与导出重试均需配置与验收；参见 [Tracing SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/)。
7. **GenAI 只覆盖它擅长的范围。** 模型/Agent/Tool 优先复用官方 GenAI SemConv；Predicate、Procedure、Reconcile 等不应乱用 `gen_ai.*` 伪装为模型执行。

## D. 最小验收矩阵（冻结 Schema 前先跑一轮）

| 场景 | 输入 | 验收标准 |
|---|---|---|
| T1 真实确定性 | 私有 P8-D4 106 行真实诊断 + 所能拿到的原生材料索引 | 21 个真实 Span 与 85 个真实事实类型不丢；源时间缺失保持缺失；身份/refs 不造假；敏感材料不上公共后端 |
| T2 纯 LLM | 原生 Writer/Loader Golden + 一次受控实际 model/tool capture | 模型实际可见输入/Tool catalog、响应、ToolResult 来源、Next Model 消费关联可定位 |
| T3 混合 | Agent → Tool → Harness → Runtime → ToolResult | 跨域精确 request/run/operation 关联，Host/Runtime 状态独立 |
| T4 异常 | 并发乱序、重复投递、超时、RESULT_UNKNOWN 与 OUTCOME_UNKNOWN / Reconcile | 不靠到达时间配对，不伪造最终成功，不吞失败和恢复细节 |
| T5 完整性 | 故意截断、遗漏材料、丢 LogRecord、采样/SDK 限额、无事件时间 | 各类 partial/unknown 明示，不产生假完整 Trace |
| T6 查看 | Phoenix / Console Demo 风格的 Viewer | Overview、四阅读模式、诊断 detail、Evidence/source link、离线重开；引用相同业务事实 |

**T1 注意：** 当前已归档的 P8-D4 文件是诊断导出而非完整 owner-native v2，因此只能验证导出范围内数据的保留，不能证明不存在的原生 ID/时间/完整闭包。

## E. 优先级与执行边界

**现在做（需求定型阶段）：**
- 把 R01–R13 作为统一能力基线，校核 T1–T6 对应的现有字段是否可采集/恢复，记录“已有 / 可补 / 需要 source ref / 不可恢复”。
- 基于已存在的 OTel + Phoenix PoC，增加唯一一个**Logs + Spans + exact refs + material completeness** 试验；由试验决定是否正式采用 OTLP Profile。
- 如果标准足够，则用**一份最小统一字段表**规定必选 ID / time / relation / outcome / evidenceRef，且只为 CA 独有语义加最少扩展。

**现在不做：**
- 不再为 Runtime 诊断、Agent TraceStore、Console 展示分别定义新的 wire schema。
- 不先建设大平台、统一业务状态机、独立全局 sequence、复杂 Collector 集群、长生命周期兼容层。
- 不用 UI 演示 PASS、Phoenix Span PASS 替代证据保真或真正 Owner Loader PASS。

**尚未决策：** OTel/OTLP 是否满足全部 R01–R13；离线文件编码；敏感材料的最低受控访问实现；最终 Field/Profile 版本。以上需以 T1–T6 证据决定。

> **审计结论：先定“记录什么、如何证明没丢、怎样准确关联、谁能看明细”，再定“用 OTLP 还是补充什么”。** 若 OTel 满足，所有 Demo Producer 直接适配同一 Profile；旧导入器作为过渡，不再扩大架构。
