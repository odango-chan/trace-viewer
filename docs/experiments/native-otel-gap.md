# Native TraceStore v2 → OpenTelemetry: field-level loss audit

**Status: SYNTHETIC_STRUCTURAL_8/8_PASS · 2026-11-05**
**Proof: [Native v2 audit CI](https://github.com/odango-chan/trace-viewer/actions/runs/41948042263); true owner-generated fixture / full native validation / round-trip NOT_RUN.**

这不是另一个生产 TraceStore/validator，也不是已实现的 OTel native exporter。它是为了设计明确的 loss inventory：**原生记录有哪些字段无法仅用 Span 层级表达？**

Owner reference: [TraceStore / ca-agent-demo](https://github.com/odango-chan/ca-agent-demo/blob/main/src/ca_agent_demo/demo/trace/store.py), [TraceRecorder](https://github.com/odango-chan/ca-agent-demo/blob/main/src/ca_agent_demo/demo/trace/events.py), [canonical_json](https://github.com/odango-chan/ca-agent-demo/blob/main/src/ca_agent_demo/support/canonical.py).

本仓提供 [native_trace_audit.py](../../scripts/native_trace_audit.py) 和 [8 条单元测试](../../tests/test_native_trace_audit.py)。它们只用即时生成的**schema-shaped synthetic** 目录，不读取私有真实执行记录。

## 对照矩阵

| Agent Demo v2 field | 是否可直映 OTLP | 处理要求 |
|---|---|---|
| \`run_id\` | 属性可表达 | 保留 \`ca.source.run_id\`，不与 OTel trace_id 混同 |
| \`trace_format_version=2\` | 属性可表达 | 固定原生版本和 immutable schema/source pin |
| \`TraceEvent.sequence\` (从 0 连续) | 属性可表达 | 保存 source-local sequence，不能发明 GlobalSequence |
| \`TraceEvent.stage/kind/summary\` | 属性/LogRecord 可表达 | 原生 event kind 不一定对应一个 Span 操作 |
| \`TraceEvent.data\` (排序 pair-array) | LogRecord/JSON 可表达 | 原始类型与原始磁盘 bytes/digest 一并保留；不能静默对象化造成证据丢失 |
| \`TraceEvent.material_ref\` | 属性可表达 | 要能解析 owner native digest；OTLP 导出文件摘要与 native canonical digest 不同 |
| **每条 TraceEvent 的时间戳** | **源本来不提供** | **不可构造假的 Span start/end / Event timestamp**；只可表示 export/observed 时间，明确区别原始发生时间 |
| \`TraceSpan.started_at/ended_at/duration_ms\` | Span 对应结构 | 需要原生 parent/identity，monotonic duration 不应由 wall delta 推断 |
| Model \`model_stage/call_index/model_call_id\` | GenAI + \`ca.*\` | 仅使用精确源标识；请求/响应配对需校验 |
| Procedure \`attempt/invocation/occurrence\` | 泛用 Span + \`ca.*\` | 不得靠相邻事件推 child/parent 链接 |
| Run terminal \`RUN_SUCCEEDED\` 等 | 事件/状态属性 | 不等于 Runtime RunRecord controlState，更不是外部 Fabric status |
| Evidence/Material | OTel log/event 可携带引用 | 内容摘要必须按 owner canonical_json 规则校验；附独立 Review closure |
| record timestamp/digest or source shape incomplete | 无法自动修复 | 明确 \`UNAVAILABLE\` / \`NOT_REPORTED\`，不伪造业务证据 |

### 代码用途和边界

\`native_trace_audit.py\` 只读分析 \`run.json\` / \`trace.jsonl\` / \`materials\` 的结构、源序号、raw JSONL line SHA、材料 canonical SHA；返回 source locator 和明确的 \`eventTiming=UNAVAILABLE\`。输出只包含元数据，不包含 raw source material。本仓不能冒充上游 \`TraceStore.load_run\`：它不验证所有上游 Procedure/Model correlation、event/result 语义和 Frozen binding，**验收真实 Run 前必须在 owner 环境调用其 loader**。

### D1 验收未完成

- **8 条 synthetic tests 已在 CI PASS**（valid、零事件、Unicode/摘要、乱序、错误序号、缺失材料、额外 metadata、敏感键）。但不能等同 upstream Producer-generated golden fixture。
- 未捕获任何真实 \`.runs/<run_id>\`，未迁移修改其他仓。
- 未做字段级原生→OTLP→原生逆向重建；目前仅有原生 source 能力审查和导入安全边界。
- 设计结论：**OTel 优先做可观测层，不应代替没有 native timestamps 的完整事件流记录**。如未来 owner 增加独立 event time，必须由 owner schema/版本定义。 
