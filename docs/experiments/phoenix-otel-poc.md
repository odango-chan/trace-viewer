# Phoenix × OpenTelemetry GenAI — Synthetic PoC

**Status: SDK_SHAPE_PASS + OTLP_INGEST_PASS + NATIVE_ATTRIBUTE_READBACK_PASS + CHROMIUM_TRACE_LIST_PASS · 2026-11-05**
**Proof: [PoC run: 41814143545](https://github.com/odango-chan/trace-viewer/actions/runs/41814143545) · main commit [7622d70](https://github.com/odango-chan/trace-viewer/commit/7622d70cf3a7cde490e49e8ce75682f4f65de955)**

目的：判断开源 Phoenix 能否从 OpenTelemetry SDK/OTLP 接收并通过自己的查询 API 重新读出两条典型 Trace，同时评估 DSH Agent 轨迹和确定性 Procedure/Evidence 的展示能力。**真实业务和完整性不能由此 PoC 验收。**

## 执行方法

- GitHub workflow: [Phoenix OpenTelemetry synthetic PoC](../../.github/workflows/phoenix-otel-poc.yml)；仅在 GitHub Runner 内启动 localhost Phoenix，不向外部 Phoenix 服务传真实数据。
- Repro: Python 3.12；本轮实际安装 Phoenix **21.0.0**、Phoenix Client **3.6.0**、OpenTelemetry SDK/exporter **1.45.2**（当前 CI 也会安装 Phoenix OTel **0.17.2**，但脚本使用标准 OTel SDK 与两个明确处理器；生产集成前须 pin/lock）。
- 生成器：[scripts/phoenix_otel_poc.py](../../scripts/phoenix_otel_poc.py)，**全部合成数据**，不调用真实 DeepSeek、Provider、Fabric 或 5GC。
- 两条根 Trace：Agent/Model/Tool/Harness/Next Model；纯确定性 Procedure/Observation/OUTCOME_UNKNOWN/Reconcile。
- 测试路径：Python SDK **原生 Span 数据自检** → OTLP/HTTP → Phoenix 本地 collector → Phoenix Client `get_spans_dataframe` 读回。
- Workflow 上传只包含**合成 proof JSON**（span 数、根 trace 数、可查询名称与明示未测项），不上传源凭据、原始 Snapshot、生产 Evidence。
- 手动 UI/浏览器验收尚未安排；Phoenix API 中能查到 Span 并不代表 UI 可以完整解释 Evidence 或 DSH Turn/Step。

## 真实验收结果（合成数据）

| 验证项 | 结果 | 证据级别 |
|---|---|---|
| Phoenix 21.0.0 私有 localhost 启动 | **PASS** | Actions server readiness / HTTP 200 |
| SDK Span 完整性 | **PASS**：9 spans，2 个不同 Trace ID | SDK 内存 exporter 断言 |
| Span 父子关系 | **PASS**：Harness → Tool、Reconcile → Procedure | SDK 内存断言 |
| OTLP/HTTP 写入、Phoenix 查询读回 | **PASS**：Phoenix API 返回 9 spans | Phoenix Client get_spans_dataframe |
| 五个 CA 业务属性的服务端读回 | **PASS** | Phoenix 查询返回的 **`attributes.ca`** 嵌套结构 |
| Phoenix Chromium project → traces → Agent child | **PASS (limited)**：浏览器看见两条 Trace root；点击 Agent root 后有 Model/Tool 子项 | [UI CI](https://github.com/odango-chan/trace-viewer/actions/runs/41948042278)，[截图与诊断 artifact](https://github.com/odango-chan/trace-viewer/actions/runs/41948042278/artifacts/13379323341) |
| 完整 DSH Turn/Step / Evidence Inspector UI parity | **NOT_RUN** | 不从列表可见推完整交互等价 |
| Owner 原生 source / Evidence digest / 完整性 | **NOT_RUN** | 未采集生产记录 |

实际读回并断言的五个字段：`ca.operation.outcome=OUTCOME_UNKNOWN`、`ca.reconcile.resolution=COMMITTED`、`ca.external.disposition=UNAVAILABLE`、`ca.tool.result.source_ref=synthetic-tool-result-1`、`ca.evidence.ref=synthetic-evidence-1`。

**API 兼容性发现：** Phoenix Client 3.6.0 未把全部 `ca.*` 按叶子节点展开为 DataFrame 列，而是放在 **`attributes.ca` 的嵌套对象**里；Reader 需要支持该形态。第一轮 Phoenix 21.0.0 CLI 不接受文档示例的 `--host`，改为 `PHOENIX_HOST` / `PHOENIX_PORT` 后成功。第二轮实验暴露在 Phoenix `register()` 默认处理器上追加本地 processor 会覆盖默认 OTLP exporter，改为标准 OTel SDK 两个显式 processor 后成功。这些是本次 PoC 的具体集成经验，不代表通用 SDK 无法工作。

产物：`phoenix-otel-synthetic-proof`（GitHub Actions 合成 JSON，7 日保留）。不包含源凭据/用户记录。详见 [PoC run: 41814143545](https://github.com/odango-chan/trace-viewer/actions/runs/41814143545)。

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

1. **SDK_SHAPE_PASS（已证实）**：内存里 9 条 Span、2 个独立 Trace，父子关系与关键 `ca.*` 原生属性齐全。
2. **OTLP_INGEST_PASS（已证实，含 5 个 CA 属性）**：本机 Phoenix 接收，读回至少 9 个 Span 且关键命名可见。
3. **CHROMIUM_TRACE_LIST_PASS（已证实）**：进入项目、显示两根 Trace、Agent 子层展示；**FULL_UI_PARITY_NOT_RUN**：折叠 Turn/ToolResult、异常与材料下钻未验收。
4. **OWNER_NATIVE_NOT_RUN**：没有读任何真实 `ca-agent-demo`、`ca-runtime` 文件或运行。
5. **EVIDENCE_COMPLETENESS_NOT_RUN**：没有证明采样、Crash、Collector 数据丢失条件下的完整性。

**Browser observation (Phoenix 21.0.0):** `/projects?timeRangeKey=7d` 显示 `trace-viewer-synthetic-poc`；点击后进入项目 `/projects/<opaque-id>/spans?timeRangeKey=7d`，页面出现 Agent/Procedure 两条 root，点击 Agent root 后子项可见。无 console page errors；UI proof 是合成截图和 DOM 摘要。

**许可注意：** Phoenix 现行源代码的发行许可证为 **Elastic License 2.0 (ELv2)**，不等于 MIT/Apache；决定直接嵌入、修改或分发前应按官方 LICENSE 审核条款。独立本地服务的 PoC 不代表已批准产品化复用。

官方资料：[Phoenix quickstart](https://github.com/Arize-ai/phoenix#run-locally)、[Phoenix OTel 注册](https://github.com/Arize-ai/phoenix/blob/main/.agents/skills/phoenix-tracing/references/setup-python.md)、[OpenTelemetry GenAI Agent Spans](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md)、[Execute Tool](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md)。
