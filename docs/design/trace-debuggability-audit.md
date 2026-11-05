# Unified Trace — 从排障可回答性出发的第二维审计

**Status: REQUIREMENTS REVIEW — 2026-11-05 · non-normative**
**Purpose: 按开发者/Reviewer 排查一次执行的实际任务重新评审；尚不冻结机器格式、OTel Profile 或 Producer 迁移。**

## 0. 重新定位

**统一 Trace 是一种可诊断的执行记录能力，不只是把多种 JSON 改成一种 JSON。**

第一版 Demo 的产品验收问题：

> 一个没有参与原始执行的人，打开一次执行后，能否定位最后一个确定步骤、理解发生什么、检查原因与证据、区分各 Owner 的结果认知，并明确指出哪些信息尚不可得？

Agent/Model/Tool 与 Runtime Procedure/Predicate/Verification/Graph Transition/Call Result 在这里**同等重要**。支持 deterministic-only、LLM-only 和混合执行，但**第一版不需要同时建设海量搜索、完整合规审计或高可用 Collector**。

这份文件评审 [R01–R13 需求盘点](trace-requirements-audit.md) 和 [统一架构候选](trace-unification-assessment.md)。前者是能力库存清单，后者是技术方案候选；本文件将其转换为**用户问题与产品验收**。

## 1. 六个核心用户问题

| 编号 | Reviewer 想知道什么 | 第一版必须呈现 | 不能用什么冒充 |
|---|---|---|---|
| Q1 | **这次执行经历了哪些步骤，现在停在哪里？** | 执行身份、主要活动/Procedure、最近已确认事实、当前步骤或未知结束位置 | 将最后一个可见日志当作执行已停止；缺失记录伪造为成功 |
| Q2 | **为什么某一步成功、失败或等待？** | 判定对象、输入条件、实际观察、期望条件、诊断原因、相关材料 | 只有 `PASS/FAILED`、一行 summary、无从检查的文本原因 |
| Q3 | **Tool/Operation 到底调用了什么，收到了什么？** | 真正的 request/operation、attempt、bindings、result、原始来源引用；模型调用还需要模型实际可见输入与 Tool catalog | 只看相邻事件推断 request↔result；把计划中的调用当作已提交副作用 |
| Q4 | **是哪个 Owner 确认了什么？结果有没有分歧？** | Host delivery/knowledge、Runtime terminal、operation outcome、reconcile、Fabric/World disposition 按 Owner 分开 | 将 Span status、HTTP 200 或 Runtime SUCCEEDED 自动传播为所有 Owner 成功 |
| Q5 | **能沿着证据找回实际来源吗？** | 每个关键判断能定位 source owner、ref、material/Evidence ref、授权读取状态以及是否已校验 | 把 `material_ref` 当作完整 Evidence closure，或把 UI 合并卡当作源记录 |
| Q6 | **哪些信息缺失或不可确定？下一步应该查哪里？** | 已知/未知/被隐藏/缺失/尚未验收区分，停在哪个系统/证据边界，下一条源线索 | 默认假定“显示了全部事件”；未授权或丢失内容被静默丢弃 |

这六个问题是**验收标准而不是新的六种事件**。核心 UI 形态只需要：Run 概览、按因果/时间浏览的执行视图、异常定位、Inspector 下钻，以及缺失证据提示。Console 的四种阅读密度属于实现选项，不是强制每个 Producer 的字段。

## 2. 对真实 P8-D4 的“能回答性”实证审计

证据来自**私有** [P8-D4 E2E 归档报告](https://github.com/odango-chan/ca-agent-demo/blob/main/artifacts/reviews/20261104-createdsession-p8d4-final-live-e2e/README.md) 和归档文件 [runtime-trace-attempt2.jsonl](https://github.com/odango-chan/ca-agent-demo/blob/main/artifacts/reviews/20261104-createdsession-p8d4-final-live-e2e/evidence/runtime-trace-attempt2.jsonl)。2026-11-04 的真实 E2E 包含 attempt 1 失败诊断与 attempt 2 成功；本次只读，不重新运行 5GC。

**源结构核对**：attempt 2 的诊断文件为 106 条 JSONL（21 个 timed span，85 个诊断事件）：

| 类别 | 数量 | 对排障有价值的现有字段 |
|---|---:|---|
| `CALL_RESULT` | 14 | operation, bindings, reported_outcome, outcome；**14/14 具 material**（含 bindings/output/owner_result） |
| `GRAPH_TRANSITION` | 18 | source_node_id, next_node, selected_edge, transition_id, invocation/attempt |
| `PREDICATE_EVALUATED` | 21 | predicate_identity, verdict, reason；**21/21 有非空 evidence_refs** |
| `VERIFY_RESULT` | 21 | scope, predicate, verdict, procedure invocation |
| `PROCEDURE_TERMINAL` | 6 | procedure/invocation, terminal |
| `SKILL_RESULT` | 5 | skill/procedure/outcome、子调用关联 |
| timed `span` | 21 | name, stage, startedAt, endedAt, durationMs, status；**无顶层 spanId/parentId** |

**关键事实**：源诊断并不是“只剩状态”。很多用于诊断的明细已经采集；但该导出**没有**独立的每事件 eventId/occurredAt/owner sequence，不能将 JSONL 行号当 owner sequence，亦不能从 Span 名称推父子关系。报告附有额外的运行身份、Skill 节点、await-calls、网络链路和 Evidence 索引；单份诊断 JSONL 不等于整个复核闭包。

| 问题 | 在现有归档里能回答吗？ | 当前 Viewer 能回答吗？ | 真正需要补什么 |
|---|---|---|---|
| Q1 执行流程/最后确定步骤 | **部分/跨文件可答**：诊断中有图转移和 terminal，报告有完整节点顺序 | **部分**：Viewer 展示诊断行，但没有从 refs 恢复执行拓扑 | 明确的 invocation/node/attempt 结构关系；跨文件执行范围定位 |
| Q2 为什么判断成立/失败 | **有大量线索**：21 predicate reason+evidence refs、21 verify result；具体源观察需查其他证据 | **不足**：当前 `review-diagnostic.mjs` 丢弃 `data/diag/material/summary`，只剩类型与有限状态 | 私有环境下可控诊断下钻：expected/observed/reason/material/source，缺失显式 |
| Q3 调用参数/结果 | **部分可答**：14 CALL_RESULT 的 material 保存了 bindings/output/owner_result | **不足**：Importer 明确丢弃上述 material | 对 request/result 的确切引用以及受控材料阅读；不要把报告字段当已验证的原生业务合同 |
| Q4 Owner 状态分歧 | **分散在不同证据**：Runtime terminal、Fabric/AMF/waiter 各在对应归档 | **不足**：单独的 Runtime 诊断文件无法代表 Host/Fabric 真值 | 跨 Owner exact source refs、分列显示状态 |
| Q5 Evidence/来源 | **部分**：21 Predicate 含 evidence_refs，归档还有证据文件索引 | **不足**：未在 Viewer 中可逆定位并核验所有材料 | 受控 locator、material digest/schema 和 material availability；区分 ref 可见与 closure 完整 |
| Q6 哪些不能确定 | **可以从人工审阅推断部分缺口**，但没有统一 capture completeness 声明 | **只提示了 source 类型限制**，没有按执行问题定位缺失 | 确切的 capture/report completeness、missing/hidden/unverified 类型及用户可行动作 |

**真实失败故事是更好的反例**：P8-D4 attempt 1 中，AMF/N1N2 已确认接受，但等待 RAN 结果的节点很快耗尽观察预算。归档报告与单独的 `attempt1-diagnosis.json` 说明根因是等待器缺少 attempt-local selector，而不是真实网络没有成功。随后 attempt 2 修复后通过。这段“**网络已成功，等待器却报告 UNKNOWN；修复绑定后完成**”必须能通过 Trace 的证据关联解释，而不能只显示一个 `UNRESOLVED`。目前 attempt 2 JSONL **不能单独重建 attempt 1 故障**，这是跨执行/跨来源复核缺口。

## 3. 第二维审计发现：真正该优先修的地方

| 优先级 | 问题 | 归属 | 最小整改方向 |
|---|---|---|---|
| **P0** | 将诊断材料永久省略会让 Trace 看不出原因 | Viewer / Material reader / capture policy | Demo 在私有本地环境引入**按需可查看、默认隐藏**的诊断明细（限定允许字段），而不是全量公开或永远丢弃 |
| **P0** | 事件身份/因果图和业务执行边界不统一 | 各 Producer | 捕获时生成明确 request/result、invocation/attempt、owner source refs；保留原生 ID，不靠时间猜 |
| **P0** | 同一操作的 Host、Runtime、Fabric 真值分散 | Producer 关联 + Consumer 展示 | 允许一个业务执行范围关联多条 trace/span/owner records；保留独立结论 |
| **P0** | 缺失、隐藏、未验证容易混为一谈 | Producer/Export/Viewer | 只做轻量 completeness/availability 标记；未采集、未提供、未授权、完整性未验证分开 |
| **P1** | 现有 Span/Log 可视化缺 Procedure/Predicate 的问题导向阅读 | Viewer/Console | Run Overview → abnormal step → diagnostics → Evidence Inspector，复用 Console 交互 |
| **P1** | 过早冻结 OTel/OTLP，可能只覆盖 Span 而吞诊断日志 | Contract 评估 | 先做一次 Span+LogRecord+material ref 对照，证明确实能保留 Q1–Q6 所需内容 |
| **暂缓** | 海量查询、历史对比、合规级稽核、Collector 集群、复杂跨端版本兼容 | 平台化工作 | 不进入第一版 Demo 的交付门槛 |

**可直接推翻的一条旧假设**：一个 `traceId` 并不天然等于完整业务执行。暂停、异步 callback、重试、不同 Owner 的事实可能分属不同 Trace；Viewer 必须支持明确 Run/Task/Invocation 关联后的**执行集合视图**，但无须制造全球递增 sequence。

## 4. MVP：只验收三个执行故事

**S1 真实确定性故障/成功对照（P8-D4）**
- 可以找到 attempt 1 第一处失去确定性的节点；明确 AMF 已接受、RAN await 仍 UNKNOWN，为什么等待器不能归属观察结果。
- attempt 2 可以沿 Procedure/Predicate/Verify/Call Result 到 SUCCEEDED，并下钻源证据。
- 不能用 attempt 2 诊断文件冒充 attempt 1 全量 Trace；缺源处必须明确 unavailable。

**S2 纯 LLM Tool 调用**
- 对一对 Model request/response、Tool call/result 和下一次模型输入显示**真实 source refs**。
- 看见实际 model-visible 输入与工具目录的受控快照；不存在的 reference 不自动补齐。
- 不需要实际接通所有 LLM Provider，也不需要重建 Agent 系统。

**S3 结果未知/恢复**
- 清晰区分 Host `RESULT_UNKNOWN`、Runtime `OUTCOME_UNKNOWN`、后来 Reconcile 的确定结果。
- 重试/恢复/并行 ToolResult 用 explicit ref 配对，不能因为时序相邻就折叠。
- 缺失 Evidence 时不把 Outcome 推断成成功。

三条故事每条要求 Reviewer 能回答 Q1–Q6，**不以总 Span 数、Event 数或漂亮的泳道数量作为通过标准**。

## 5. 与上一版需求 R01–R13 的关系

- **不丢需求**：原 [R01–R13](trace-requirements-audit.md) 保留为覆盖清单，避免忘记离线、权限、开放标准、跨模式等非 UI 约束。
- **改变验收主轴**：Q1–Q6 + S1–S3 是第一版 Demo 的**主验收**；详细 Schema/字段属于实现方案，不能反向决定用户问题。
- **提升诊断细节的优先级**：R06 和 Inspector 的最小下钻能力不可留到第二阶段；R10 的所有美化/视图切换不要求一次做完。
- **降低平台化投入**：R11 的海量搜索、历史趋势、合规级稽核及 R12 完整技术标准冻结不要求第一版完成；本地离线读取仍然重要。
- **一套将来契约**：共享的数据语义要覆盖 Agent 和 Runtime，历史多输入 Adapter 只是迁移过渡，不让 `TraceStore/v2`、`review-diagnostic`、Console Projection 变为三套长期 Producer 合同。

## 6. 下一阶段只做一件实证事情

选择 **S1 P8-D4 的 1 个 Predicate + 1 个 CALL_RESULT + 1 个异常转移**，用真实归档在**私有环境**做一个最小可审核的 Inspector：

- 默认只呈现无敏感摘要、事件身份和状态；
- 授权/本地查看时呈现实际诊断字段和相关 material，所有字段保留原生 source locator，不复制到公共 Repo；
- Evidence 缺失/来源不完整时明确标记，不猜测；
- 人工按 Q1–Q6 提问验收，记录每题 PASS/PARTIAL/NOT_AVAILABLE。

**暂不修改 Agent、Runtime、Fabric Producer，也暂不冻结 OTLP 的离线持久化格式。** 只有 S1 的真实诊断路径证明“看得懂、看得深、可复核”后，再用 S2、S3 验证通用语义并制定唯一 Trace Profile。
