# OpenTelemetry GenAI × ConnectionAgent 语义映射与缺口

**Status: D0.6 candidate mapping + D0.7 native source gap audit · 2026-11-05**
**Applies to: read-only exploration, NOT approved cross-repo machine contract**
**Companion experiment:** [Phoenix/OTLP synthetic PoC](../experiments/phoenix-otel-poc.md)

## 0. 先区分三个概念

- **OTel Trace data model** = trace/span/link/event + structured LogRecord，以及 native trace-id/span-id；Span 层级是**instrumentation 的因果/执行子结构**，不代表 Runtime 任意事件序列、业务 Evidence 或上游执行终态。
- **GenAI Semantic Conventions** = \`gen_ai.*\` 命名和 model/agent/tool/skills 的约定；规范仍有 Development 部分，需要 pin upstream 版本/具体字段。
- **OTLP** = 传输与编码；不能仅因发到 Phoenix 就推断保存了所有历史记录。
- **OpenInference** = Phoenix 更偏好的 AI Span 语义（如 \`openinference.span.kind\`、\`input.value\`、\`output.value\`）。**OpenInference ≠ OTel GenAI 官方规范**，不能把两者同名概念默认等价。

## 1. 字段级映射

说明：\`DIRECT\` 表示标准已提供接近语义，但仍需校验采集内容；\`EXTENSION\` 是候选 \`ca.*\` 字段（**仅设计，不是已发布的 CA Producer schema**）；\`NATIVE_REQUIRED\` 表示 OTLP/Span 本身并不能证明原始业务事实，需保留 owner-native source。

| CA / DSH 现有事实 | OTel/GenAI 推荐语义 | CA 扩展或 native ref | 判定 |
|---|---|---|---|
| Agent Host 调用边界 | \`invoke_agent\` span；\`gen_ai.agent.name\` | Host/AgentInstance、TaskRef 仍源自原 owner | DIRECT + EXTENSION |
| Turn / Step 原生顺序 | Span hierarchy / links | DSH \`sessionRef\`、owner-local \`seq\`、\`turn\`、\`step\`、revision/surfaceOp | NATIVE_REQUIRED |
| Model request 类型、模型 | inference span \`gen_ai.operation.name=chat\`、\`gen_ai.request.model\`、\`gen_ai.provider.name\` | 原生 model_call_id / requestRef 与 provider attempt | DIRECT + EXTENSION |
| **实际 model-visible 输入**（包含 system、上下文与 Tools） | \`gen_ai.system_instructions\`、\`gen_ai.input.messages\`、\`gen_ai.tool.definitions\` | exact request snapshot ref/digest、surface revision、redaction / access policy | DIRECT + NATIVE_REQUIRED |
| Model response / usage | \`gen_ai.output.messages\`、usage 属性 | responseRef/digest、generation/attempt、validity | DIRECT + EXTENSION |
| Tool 选择 / 调用 | \`execute_tool\` span、\`gen_ai.tool.name\`、\`gen_ai.tool.call.id\` | DSH \`selectedToolCallRequestRefs[]\`、ToolCall \`requestId\`、真实 Tool Schema digest | DIRECT + EXTENSION |
| ToolResult 可否被后续模型看到 | Tool result + next inference input | DSH \`toolResultSourceRequestRefs[]\`、delivery outcome、next requestRef | NATIVE_REQUIRED |
| Skill 文件/Reference 加载 | Agent Skills conventions、\`execute_tool\` refinements | Frozen Skill/source/content digests、实际 Loaded Resource refs | DIRECT + EXTENSION |
| Harness Admission / Assurance | 自定义 child span/event/log + links | authorization decision、policy/source refs、reason code、actual gate phase | EXTENSION + NATIVE_REQUIRED |
| Runtime Run identity/state | generic span attributes | RunRecord \`runId\`, \`controlState\`, \`runRevision\`, frozen artifact/variant refs | NATIVE_REQUIRED |
| Runtime RunEvent | Span Events / structured LogRecords | owner-native \`eventId\`, **per-run sequence (from 1)**, \`eventType\`, \`payload\`, evidenceRefs[] | NATIVE_REQUIRED |
| Procedure / Node / Retry | generic nested spans/events | owner invocation ID, attempt, node/occurrence identity, parent/transition edges | EXTENSION + NATIVE_REQUIRED |
| Predicate / Observation | span event / structured Log | observation status, producer provenance, observed_at, evidenceRefs | NATIVE_REQUIRED |
| Operation outcome | Status? **No** — OTel Span status only technical outcome | \`OUTCOME_UNKNOWN\` / \`COMMITTED\` / \`FAILED\` etc from Runtime owner | NATIVE_REQUIRED |
| Reconcile | child span/event | authoritative resolution source ref, claim epoch / evidence | NATIVE_REQUIRED |
| Fabric/World disposition | linked span/log if owner publishes | external owner-native message/ledger/status, independent terminal | NATIVE_REQUIRED |
| Evidence material / review closure | events/log attrs with opaque ref/digest | canonical material bytes/profile/digest, source authority, authenticity/completeness policy | NATIVE_REQUIRED |

基线：
- [CA Agent Trajectory](https://github.com/odango-chan/connectionagent/blob/main/docs/design/agent-trajectory.md)
- [CA Reviewability](https://github.com/odango-chan/connectionagent/blob/main/docs/design/reviewability.md)
- [CA Runtime RunEvent.v1](https://github.com/odango-chan/ca-runtime/blob/main/schemas/v1alpha1/run-event.schema.yaml)
- [CA Agent Demo TraceStore.v2](https://github.com/odango-chan/ca-agent-demo/blob/main/src/ca_agent_demo/demo/trace/store.py)
- [Official GenAI agent spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)
- [Official inference](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/client-inference.md)
- [Official GenAI attribute registry](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/registry/attributes/gen-ai.md)

## 2. 三种不同的“完整”

1. **Trace presentation completeness**：Phoenix 能展开哪些 Span、耗时与属性？这是 UI/可观测性能力，不能自动回答“为什么能安全执行”。
2. **Source record completeness**：上游是否真的保留每个 SessionEvent/RunEvent、原生顺序、原始 Model Input/ToolResult/Surface Replace，能否按版本验证？
3. **Review evidence completeness**：不可变材料是否可获取/校验，相关 Producer 的事实是否授权且新鲜，是否形成独立 closure？采样/collector 通常不能自动证明这些要求。

后两者不可通过 Span status / HTTP success 代替。OTLP 技术上可以承载所需字段/LogBody；是否**无损**取决于 instrumentor、sdk limits、sampling、collector、backend、redaction 与 schema。

## 3. 候选技术栈（逐层用最少的组件）

~~~text
CA native typed records: Agent/DSH, Runtime, Fabric, Evidence
                    |
         explicit read-only Adapter
                    |
       +------------+-------------+
       |                          |
OTel SDK / GenAI spans      Native Evidence/Record export
       |                          |
       v                          v
    OTLP/HTTP              pinned source, digest, closure
       |                          |
       v                          v
  Phoenix (Trace UI)      Trace Viewer (semantic Inspector)
~~~

- **Phoenix**：候选通用 Agent/Model/Tool span 浏览器，OTLP receiver + query API；合成 PoC 实测后才能标记 PASS。
- **OpenTelemetry SDK**：Go/Python 各自使用成熟 span/log pipeline；没有理由手写 OTLP 编解码器。
- **OpenInference**：仅在 Phoenix 的 UI 语义有明显收益时作为辅助 Instrumentor；**不要**同时启用两套自动插桩产生重复 Span。
- **Collector**：只有需要多路路由、过滤与自托管 collector 运维时再部署；单机 Demo 可直接打 Phoenix localhost。
- **Trace Viewer**：保留 DSH source-precise folding、Procedure、Evidence、历史 Source Schema 和异常下钻。如果 Phoenix 已满足某块，可以做 Deep Link 而非重建。

## 4. 当前阻断“直接统一 OTLP 为权威源”的问题

| P | 问题 | 如何证明能解决 |
|---|---|---|
| P0 | Trace ID/Span ID 不是 DSH owner sequence，不是 Runtime RunEvent identity | 同一业务 Run 的不同 owner ref 和导出/重开保持稳定，可恢复 exact native source |
| P0 | 采样、限制、截断、collector/backend 丢数据造成 silent partial | disabled sampling + tested limits + producer closure + export ack + dropped counts/audit |
| P0 | Model actual system/context/tool surface 默认可能不采集 | synthetic & authorized real fixture 对照有 requestDigest、sourceRefs、redaction |
| P0 | ToolResult 交付给下次模型的原生因果不能仅靠 parent Span 证明 | DSH request/result source refs 对照；歧义不连线 |
| P0 | Runtime terminal ≠ operation mutation outcome ≠ Fabric external disposition | 3 个 owner 状态并列保留且可核验 |
| P1 | Phoenix OpenInference 与官方 GenAI 的两套约定可能被不同解析 | 字段/Span kind 双向映射测试，记录所用版本 |
| P1 | Phoenix UI 的 cards 不一定支持 Procedure/Predicate/Evidence 所需 Inspector | 浏览器手动/自动化验收；不凭 API 读回宣布 UI parity |
| P1 | 演示/公共仓的敏感数据边界 | 明确 synthetic-only、脱敏/授权和浏览器展示策略 |

## 5. 已完成的最低可运行实验

- OTLP + Phoenix readback：**PASS**，2 synthetic roots、9 spans、5 个 `ca.*` 属性。
- Phoenix Chromium UI：**LIMITED PASS**，项目页面显示两条 root，点击 Agent root 后子层可见；[CI](https://github.com/odango-chan/trace-viewer/actions/runs/41948042278)。**不是完整 DSH/Inspection parity**。
- TraceStore.v2 结构审计：**8/8 synthetic PASS**，发现原生每事件时间戳本来不存在，不能伪造 OTel Span start/end；[对照与缺口](../experiments/native-otel-gap.md)。
- License gate：Phoenix **ELv2**，自托管基础能力可用于 PoC，商业嵌入/修改/托管用途须单独审核许可证。不能把它当作 MIT/Apache 通用组件直接复制进 Viewer。

## 6. 下一步决定标准前的门禁

- **PoC-1 PASS**：SDK → Phoenix OTLP → readback：两条 synthetic traces、9 个 spans、五个关键 `ca.*` 字段仍在。
- **PoC-2 PARTIAL**：浏览器列表与 Agent 子项 PASS；完整 Model/Tool Request/Result、异常、未关联证据、折叠 UI 仍待验收。
- **PoC-3**：原生真实材料经授权脱敏后的 **字段级无损对照**：Agent Demo TraceStore.v2、Runtime RunEvent.v1、Agent DSH SessionEvent，必须显示完整性差别。
- **PoC-4**：采样、超限、重启、断网、部分材料等负向验证。
- 只有 1–4 完成并经对应 owner 接受，才在 \`connectionagent\` 治理仓正式提议共享 Producer conformance。**本仓 D0.6 不以设计代替实现。**
