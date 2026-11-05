# Trace 统一评估：基于现有 Agent / Runtime / Console / OTel

**状态：架构分析稿，非已冻结机器契约**
**日期：2026-11-05**
**目标：未来只有一种对外 Trace 契约，Agent、Harness、Runtime 诊断都能直接产出。**
**本轮不改 Producer、Viewer，也不新建另一套 JSON/JSONL 格式。**

> 这次纠正之前 D1/D1.1/D2 的分源规划：**它们只反映当前存量记录的读取来源，不应变成多套长期 Trace 规范。** Console 展示仍是投影，不能反向定义 Producer。

## 1. 实际现状，不以设计代替代码

| 来源 / 固定代码 | 现有事实 | 格式不统一处 / 可改进点 |
|---|---|---|
| [Agent Demo TraceRecorder / TraceStore](https://github.com/odango-chan/ca-agent-demo/blob/main/src/ca_agent_demo/demo/trace/events.py) | TraceRun, TraceEvent, TraceSpan, immutable material refs; \`run.json\`, \`trace.jsonl\`, \`materials/<sha>.json\`; per-run \`sequence=0..\` | Event 无自己的时间戳、eventId；\`data\` 以 pair-array 持久化；model/procedure 关联嵌在不同 kind 的数据字段里 |
| [真实 P8-D4 Runtime 诊断归档](https://github.com/odango-chan/ca-agent-demo/blob/main/artifacts/reviews/20261104-createdsession-p8d4-final-live-e2e/evidence/runtime-trace-attempt2.jsonl) | 2026-11-04 真实 E2E；106 行：21 个 timed span / 85 个诊断事件。事件包括 14 Call Result、18 Graph Transition、21 Predicate Evaluated、21 Verify Result、6 Procedure Terminal、5 Skill Result | **这是导出/诊断形态**，非 TraceStore v2。事件顶层 \`kind/data/diag/material/summary\` 没有原生 sequence、eventId、occurredAt；不能把 JSONL 行号伪装成 owner sequence |
| [ca-runtime RunEvent.v1](https://github.com/odango-chan/ca-runtime/blob/main/schemas/v1alpha1/run-event.schema.yaml) | 已有 \`eventId/runId/sequence>=1/eventType/occurredAt/producer/payload/correlation/evidenceRefs\`，是 Runtime authoritative fact | 单独表达 Runtime typed facts，不包含 Agent/Model/Tool 全部活动；不应因 Trace 统一删除 Runtime RunEvent 源事实 |
| [ca-runtime RunEvidenceMaterial](https://github.com/odango-chan/ca-runtime/blob/main/schemas/v1alpha1/run-evidence-material.schema.yaml) | \`run/events/firstSequence/lastSequence/eventCount/materialDigest/complete=true\` | 审计完整性/不可变 Evidence，不等同于普通 Span；Trace 可以引用它，而不是重建它 |
| [DSH Agent trajectory](https://github.com/odango-chan/connectionagent/blob/main/docs/design/agent-trajectory.md) | Session/Turn/Step、模型实际输入输出 Snapshot、Tool Call/Result、host-knowledge、显式请求/结果 refs，SessionEvent owner-local seq | Agent source fact 是 DSH 的责任；与 Runtime 通过确切 request/run refs 关联，不可用单一全局事件序号代替 |
| [CA Console trajectoryProjection](https://github.com/odango-chan/ca-console/blob/main/src/modules/runs/trajectoryProjection.ts) | 四泳道、Model/Tool folding、异常、Inspector；使用 Runtime RunEvent 与 Agent Material | **只是 UI read model**，不能当作新的 Trace wire/source |
| [Phoenix/OTLP synthetic PoC](../experiments/phoenix-otel-poc.md) | 2 traces / 9 spans / 5 个 \`ca.*\` 属性 Phoenix readback，Chromium 浏览器可浏览 | 只证实 Span 及属性路径；尚未验证 LogRecord、完整 Model Snapshot、真实诊断/Otel 无损转换、Evidence closure |

### 共同的数据元素

- **执行范围**：Run / Session / Task 身份（各自有 owner），具体调用/节点/attempt。
- **活动**：Model、Tool、Skill/Procedure、Operation、Observation、Verification、Reconcile、Harness Gate。
- **离散事实**：调用结果、判定、图转移、终态、Host delivery、异常。
- **因果**：span parent + 显式 operation/request/result/event/occurrence refs。**时间相邻 ≠ 因果。**
- **证据**：拥有者、schema/profile/version、原生事件身份和局部序号（若有）、material digest/ref、可用性。
- **状态**：Run terminal、Action/Mutation outcome、Host knowledge、Fabric/World disposition 是**不同维度**，不能合成一个 SUCCESS。

真正的差距集中在**生产时采集的字段**，不是缺少一个全新的 Runtime 专属 Trace 数据模型。

## 2. 统一目标：一个 Trace 契约，而非 N 种导出类型

**首选基底：OpenTelemetry 数据模型 + OTLP，GenAI Semantic Conventions 用于 Agent/Model/Tool，再补有限的 \`ca.*\` 业务语义。** 此为候选技术决策，需完成最小 LogRecord/evidence/no-loss 验收后才能冻结版本。

同一份 Trace 应按统一数据模型表达：

| 记录类型（**一套 OTel/OTLP 模型里的两类 Signal**） | 使用对象 | 含义 |
|---|---|---|
| **Span** | Agent invoke、Model invoke、Tool execute、Harness gate、Procedure invocation、Runtime Operation、Read/Wait、Reconcile 活动 | 有真实起止、parent/links 的活动边界。无起止时间的旧诊断事件不得虚构 Span |
| **LogRecord / Span Event** | Runtime RunEvent、Predicate/Verification、Graph Transition、CALL_RESULT、ToolResult delivered、terminal、其他离散事实 | 保存 event type、业务 payload 的**经授权字段或不可变 source ref**、owner identity、owner-local order（存在时）、显式 refs |
| **属性 / 关联 / 材料引用** | Trace/Span ID、Agent Session/Task ID、Runtime Run ID、sourceAuthority、owner eventRef、causalRefs、evidenceRefs、schema/profile/version | 不把 OTel traceId 当作业务 runId；不把 Span status 当作 domain mutation outcome |

这里的 **Span 与 LogRecord 不是“分别设计两套 Trace”**，而是复用 OTel 原有的统一数据模型与一个 OTLP 导出通道。无需额外发明 \`UnifiedTraceEvent\`、另一套 canonical JSONL 或 Runtime 专用封装。

### 对不同执行路径的表达

- **纯确定性**：Procedure/Operation/Verification/Observation 等活动与事实即可构成完整 Trace，**无需冒充 GenAI Agent，也无需制造 Model Span**。
- **纯 LLM**：按 GenAI 语义记录 Agent/Model/Tool/Skill 活动；保存真正模型可见的输入/工具目录的受控 material refs，保留实际 ToolResult 被下次模型消费的 source ref。
- **混合链路**：同一相关 Trace 以显式 refs/link 关联 Agent、Harness、Runtime、Fabric；**不要求所有 owner 都有共同递增序号**。
- **Runtime 诊断**：不再长期生产一套独立 \`kind/data/diag/material/summary\` 协议；新执行从记录点就输出标准化 Span 和结构化事实。旧文件只作为迁移期输入。

**关键边界**：统一的是 Trace 的生产、交换和查看契约，**不是把 Runtime RunEvent、DSH SessionEvent、Fabric 的业务权威事实改成由 Phoenix/Viewer 决定**。权威来源仍可各自保存并被 Trace 引用；Trace 的审计保真度需单独验证。

## 3. 现有缺口与最小整改

| 优先级 | 实际缺口 | 最小动作 |
|---|---|---|
| P0 | 现有 Runtime review JSONL 的 event 缺 \`occurredAt\`、原生 event ID / owner sequence | **在下次执行的 Producer 采集点记录**；历史 106 条保留 line locator，不回填假时间/序号 |
| P0 | Agent Demo TraceEvent 缺每事件时间/ID；Model/Tool/Procedure 因果散在 kind.data | 在源端统一采集源身份与显式 refs；能复用 Runtime/DSH 现有 ID 就复用，不能根据内容匹配 |
| P0 | OTel SDK/Collector 可以采样、丢弃或截断 | 若要全量可审阅，配置不采样与明确限额/丢失统计；不能仅用 OTLP 发送成功声称材料完整 |
| P0 | Model/System/Tool 可见内容与业务 evidence 可能含敏感资料 | 默认引用不可变材料而非把 raw payload 塞进 attributes/log；带权限、分类与 redaction |
| P0 | Outcome 语义不同 | 显式 \`ca.operation.outcome\`、\`ca.reconcile.resolution\`、\`ca.host.delivery\`、独立 external disposition；不从 OTel Span status 推定业务终态 |
| P1 | OTel GenAI 部分约定仍是 Development；Phoenix/OpenInference 与官方 \`gen_ai.*\` 不是一套词表 | 版本 pin，定义窄映射，**只选一个主自动插桩路径** |
| P1 | 当前 Phoenix PoC 只测过 spans，不是完整 OTLP log/material | 跑一次 **同一真实结构、受控脱敏**的 Span + LogRecord + ref roundtrip，验证字段/时间/关联/缺失提示 |
| P1 | Console UI 目前依赖多 Owner 读时投影 | Viewer/Console 逐步消费统一 OTLP Trace，但保留 source link 和 evidence Inspector；旧 Adapter 只负责过渡 |

## 4. 决策与非决策

### 建议确定的原则

1. **未来只保留一套对外 Trace 契约。** 全部 Demo Producer 可以适配，不为存量文件长期建设 N 套 schema。
2. **优先基于 OTLP/OTel/GenAI 而非自己发明二套 event envelope。** CA 私有语义只补已有标准不覆盖的内容。
3. **Runtime 诊断是核心一等公民**，不是 Agent Trace 的附件；纯确定性路径没有 Model 也必须完整可读。
4. EventId、时间、原生局部序号、明确因果引用、Evidence 引用由生产端负责。**不应靠 Viewer 推算。**
5. 业务审计 Truth 与 Trace presentation 不能混淆，独立 owner 终态和 Evidence closure 不得合并或抹平。

### 目前尚不能冻结的事项

- 是否直接将 OTLP protobuf 作为**唯一持久化离线 Capture 文件编码**，以及其完整性/版本化验证方式；需要无损试验而非套上 ZIP/NDJSON 再宣称统一。
- Trace/Span 与离散 LogRecord 的具体 \`ca.*\` 字段必选性、owner correlation ID 名称、时间缺失场景与 SDK limitation。
- Phoenix 对 LogRecord、材料引用、Procedure/Predicate Inspector 是否满足产品体验；当前只有 Span/UI 小规模 PoC。
- 是否需要在跨 Producer 的治理仓发布正式机器 conformance；现在先做**一页清单 + 一份 mapping test**，不要并行建设 N 个设计仓/适配器。

## 5. 建议下一步（仍是 Demo，尽量轻）

1. 选用**现有 P8-D4 106 条真实诊断结构**和已验证的 Agent Demo 两份 owner-generated synthetic Golden 作为输入清单；先不公开原文。
2. 在单个试验内验证标准 OTel Span + LogRecord 能否表达：21 个 Runtime span、85 个离散事件、Agent 模型请求/响应、精确 source refs、Evidence refs 和三类不同 outcome；旧事件缺时间的情况必须**显式缺失**，不得造假。
3. 若 POC 无损，冻结**一套** Trace Profile / SemConv 版本，然后一次性推动 Agent Demo、Runtime/Harness、DSH 生产端适配；Console/Viewer 共享这一套消费逻辑。旧导入格式作为迁移工具，完成迁移后删除。
4. 若 POC 证明 OTel/OTLP 的字段或查询端无法保留审阅必需字段，就明确记录精确缺口，再决定是否需要少量 CA 扩展；**不要先发明第二套 JSONL**。

参考： [OTLP spec](https://opentelemetry.io/docs/specs/otlp/) · [OTel tracing SDK](https://opentelemetry.io/docs/specs/otel/trace/sdk/) · [GenAI attribute registry](https://opentelemetry.io/docs/specs/semconv/registry/attributes/gen-ai/).

**这份评估只是现状与统一方向，不代表已完成 Producer 迁移或选定最终离线文件编码。**
