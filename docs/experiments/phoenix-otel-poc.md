# Phoenix × OpenTelemetry GenAI — Synthetic PoC

**Status: TEST_PENDING · 2026-11-04**

目的：判断开源 Phoenix 能否从 OpenTelemetry SDK/OTLP 接收并通过自己的查询 API 重新读出两条典型 Trace，同时评估 DSH Agent 轨迹和确定性 Procedure/Evidence 的展示能力。**真实业务和完整性不能由此 PoC 验收。**

## 执行方法

- GitHub workflow: [Phoenix OpenTelemetry synthetic PoC](../../.github/workflows/phoenix-otel-poc.yml)；仅在 GitHub Runner 内启动 localhost Phoenix，不向外部 Phoenix 服务传真实数据。
- Repro: Python 3.12；依赖 `arize-phoenix`、`arize-phoenix-otel`、`arize-phoenix-client`（原型阶段从 PyPI 安装并在 CI 日志输出实际解析版本，**生产接入前必须 pin/lock**）。
- 生成器：[scripts/phoenix_otel_poc.py](../../scripts/phoenix_otel_poc.py)，**全部合成数据**，不调用真实 DeepSeek、Provider、Fabric 或 5GC。
- 两条根 Trace：Agent/Model/Tool/Harness/Next Model；纯确定性 Procedure/Observation/OUTCOME_UNKNOWN/Reconcile。
- 测试路径：Python SDK **原生 Span 数据自检** → OTLP/HTTP → Phoenix 本地 collector → Phoenix Client `get_spans_dataframe` 读回。
- Workflow 上传只包含**合成 proof JSON**（span 数、根 trace 数、可查询名称与明示未测项），不上传源凭据、原始 Snapshot、生产 Evidence。
- 手动 UI/浏览器验收尚未安排；Phoenix API 中能查到 Span 并不代表 UI 可以完整解释 Evidence 或 DSH Turn/Step。

## 字段映射实验（不是已批准的生产语义规范）

| Native requirement | OTel/Phoenix | PoC 携带方式 | 不应声称的能力 |
|---|---|---|---|
| Agent/Model/Tool 调用层级 | GenAI `invoke_agent`/`chat`/`execute_tool` | root/child Spans + `gen_ai.operation.name`，OpenInference span.kind | 无标准化 Turn/Step 完整语义保证 |
| 模型选择工具 | Model Response Ref → Tool Request Ref | `ca.model.response.ref` + `ca.tool.selected_request_ref` | 时间相邻并非因果 |
| ToolResult 进入下个模型输入 | explicit sourceRef | `ca.tool.result.source_ref` | 模型实际完整上下文未证明 |
| Harness gate | Admit/deny | 子 Span `ca.stage=ADMISSION`, `ca.decision=ALLOW` | 不能用 Span status 推导 Harness 授权 |
| 纯确定性 Procedure | OTel 泛用 Span | `ca.execution.kind=DETERMINISTIC`, `ca.procedure.invocation_id` | 不应冒充 GenAI invoke_agent |
| Mutation uncertainty | operation result | `ca.operation.outcome=OUTCOME_UNKNOWN` | Span.error 不等于业务失败 |
| Reconcile | reconciliation source fact | `ca.reconcile.resolution=COMMITTED` + evidence ref | Evidence 内容/鲜度/闭包尚未验证 |
| 外部 owner outcome | independent authority | `ca.external.disposition=UNAVAILABLE` | 不从 Runtime terminal 填充 Fabric 真值 |

**决策暂不冻结：** 能用 Phoenix 显示 Span 树，并不意味着可以删除 Agent Demo TraceStore、Runtime RunEvent 或原生 Evidence；还需要 DSH 真实 source 对照、OpenTelemetry GenAI 规范版本 pin、Phoenix 原始属性/事件可读性及掉数实验。

## 验收分级

1. **SDK_SHAPE_PASS**：内存里 9 条 Span、2 个独立 Trace，父子关系与关键 `ca.*` 原生属性齐全。
2. **OTLP_INGEST_PASS**：本机 Phoenix 接收，读回至少 9 个 Span 且关键命名可见。
3. **UI_PARITY_NOT_RUN**：浏览器未核验折叠 Turn/ToolResult、异常、材料下钻。
4. **OWNER_NATIVE_NOT_RUN**：没有读任何真实 `ca-agent-demo`、`ca-runtime` 文件或运行。
5. **EVIDENCE_COMPLETENESS_NOT_RUN**：没有证明采样、Crash、Collector 数据丢失条件下的完整性。

官方资料：[Phoenix quickstart](https://github.com/Arize-ai/phoenix#run-locally)、[Phoenix OTel 注册](https://github.com/Arize-ai/phoenix/blob/main/.agents/skills/phoenix-tracing/references/setup-python.md)、[OpenTelemetry GenAI Agent Spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)、[Execute Tool](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)。
