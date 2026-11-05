# Trace 输入格式要求与兼容性清单

**Status: D0.5 — Accepted for Viewer consumption; owner-native implementations are the authority**
**Reviewed: 2026-11-04 · historical source inventory; prospective one-contract direction updated 2026-11-05**

本页是 `trace-viewer` D0.5 阶段的**存量来源消费清单**，不是新的 Trace wire protocol。**2026-11-05 的统一目标已变更**：未来让各 Demo Producer 适配**一套统一 Trace 交换契约**，详见 [统一评估](../design/trace-unification-assessment.md)。此前的“不要让上游统一”只适用于保护现有 Owner 事实不被 Viewer 改写，**不再视为禁止 Producer 做 Trace 格式统一**。原生 RunEvent、DSH SessionEvent 和 Evidence 的独立权威仍要保留。本页历史格式样例并非新契约。

## 0. 固定审阅基线与区别

| 来源 | 固定 main 基线 | 实际形态 | Viewer 阶段 |
|---|---|---|---|
| [ca-agent-demo](https://github.com/odango-chan/ca-agent-demo/tree/60aba22463aa3d286607091756667a41d9593bc0) | `60aba224` | `TraceStore` 的本地不可变目录（metadata + JSONL + materials） | **D1 离线导入** |
| [ca-console](https://github.com/odango-chan/ca-console/tree/59958c8ac4a5e8233191652763a6a31fb7d2f93c) | `59958c8` | 多个真正 owner 的**只读 API 记录**与 Console 端投影；不是一种 `trace.jsonl` 文件 | **D2 owner API Adapter** |
| [trace-viewer](https://github.com/odango-chan/trace-viewer) | D0 | `site/fixtures.mjs` 人造 `SYNTHETIC` 演示数据，**非** owner envelope | D0 仅 UI 演示 |

所有格式判断按固定来源的 machine code / producer contract；文档不得把 Console `TraceCard`、`TraceStep`、画布 Node 当成可导入的权威记录。

## 1. Source A：Agent Demo / TraceStore v2

上游原文：[events.py](https://github.com/odango-chan/ca-agent-demo/blob/60aba22463aa3d286607091756667a41d9593bc0/src/ca_agent_demo/demo/trace/events.py)、[store.py](https://github.com/odango-chan/ca-agent-demo/blob/60aba22463aa3d286607091756667a41d9593bc0/src/ca_agent_demo/demo/trace/store.py)、[canonical.py](https://github.com/odango-chan/ca-agent-demo/blob/60aba22463aa3d286607091756667a41d9593bc0/src/ca_agent_demo/support/canonical.py)。

### 1.1 原生目录组织（不是 Viewer 发明的 ZIP Schema）

~~~text
.runs/
  <run_id>/
    run.json
    trace.jsonl
    materials/
      <lowercase-sha256>.json
      ...
~~~

- 一次导入只对应一个 `<run_id>`；它必须与 `run.json.run_id` 相同。
- 原始 `run_id` 为 `[A-Za-z0-9][A-Za-z0-9._-]{0,127}`；路径不能跳出导入根目录。
- `run.json`、`trace.jsonl`、`materials/` 在完整、可重开的 TraceStore run 中必需；`materials/` 可以没有材料文件，但**不能省略目录**。
- `trace.jsonl` 可有零行；事件不能引用不存在的材料。不得凭当前 Skill 源码重建历史 evidence。
- 对缺少 `run.json`、截断 JSONL、缺失目录的“正在运行的片段”返回 `INCOMPLETE_BUNDLE`；**D1 不声称它是完整可重放的 Run**。将来若支持 live streaming，另立增量契约。

### 1.2 `run.json`：严格的 10 字段、v2 envelope

以下字段来自 `TraceStore.persist` / `load_run` 的**精确键集合**，不是 Viewer 猜测：

| 字段 | 当前格式与约束 |
|---|---|
| `trace_format_version` | integer，**等于 2**；不支持未知版本回退猜测 |
| `run_id` | string，精确匹配目录名 |
| `intentInterpretationLlmCalls` | 非负 integer |
| `skillRoutingLlmCalls` | 非负 integer |
| `planningLlmCalls` | 非负 integer |
| `totalLlmCalls` | 非负 integer，必须等于前三项之和 |
| `started_at`, `ended_at` | ISO-8601 timestamp string（UTC 生成时通常为 `Z`） |
| `duration_ms` | 非负 number，生产端用 monotonic clock 算出的耗时；**不能**从 wall clock 差值推断 |
| `spans` | array，参见下一节 |

注意：**没有** `status`、`success`、`modelTrace`、`procedure` 或 `externalDisposition` 这样的顶层字段。运行终态只能读取 owner 已记录的 terminal event；事件没有足够证据就显示 `INCOMPLETE/UNAVAILABLE`，不得推测。

每个 `spans[]` 具有以下**精确键集合**：

~~~text
span_id, name, stage, status, started_at, ended_at,
duration_ms, parent_id, attributes
~~~

`span_id` 在 Run 内唯一；`parent_id` 可空，非空则先出现且存在；`status` 可为 `RUNNING|COMPLETED|FAILED`；运行中的 `ended_at` 为 null、结束的为 timestamp；`duration_ms` 非负；`attributes` 为对象。Span 是 timing 事实，不可替代 Procedure/event identity。

### 1.3 `trace.jsonl`：一行一个事件，原生 `data` 为 pair-array

每一行**原生 JSON** 具有**精确六个**字段：

~~~json
{
  "sequence": 0,
  "stage": "RUNTIME",
  "kind": "EXECUTION_STARTED",
  "summary": "Illustrative event summary",
  "data": [["attempt", 1]],
  "material_ref": null
}
~~~

| 字段 | 当前格式与约束 |
|---|---|
| `sequence` | 从 0 开始、连续、严格按文件顺序，无重复 |
| `stage` | string，当前 TraceStage writer 产生枚举值，Loader 只检查字符串类型（当前可见：HOST, INTENT, SKILL_ROUTING, CONTEXT, PREDEFINED, FORMAL, LLM_PLANNING, LINKER, ADMISSION, RUNTIME, REPLAN）；遇未来新增值不得错当成本地业务阶段 |
| `kind` | 非空 string；事件语义归 owner，不是 Viewer 自定义 status enum |
| `summary` | string（writer 要求非空），展示时只能当诊断文本 |
| `data` | **磁盘原生：按 key 排序、键唯一的 `[[string, JSON value], ...]`**。当前 Python `load_events` 在读取时归一化为 `{key: value}`；D1 parser 必须兼容**磁盘形态**，验证后归一化再绘图，绝不能误以为生产端必定写了 object |
| `material_ref` | `null` 或 64 位小写 hex SHA-256 引用；非空必须匹配当前 Run 的材料文件 |

`trace.jsonl` 的 `sequence` 是**Agent Demo 此 Run 内局部序号**；不是 `ca-runtime` 的 owner event sequence，也不是跨仓全局序列。Event **没有**强制的 `eventId`、`occurredAt`、`correlation`；不能偷偷借用 Console 的字段。

D1 parser 必须支持合法的原始 pair-array；任何“可接受 `data` 普通 object”的行为要标记为源 Loader 兼容路径（`load_events` 读取 object），**不能当作 Writer v2 的 canonical 磁盘输出**。

### 1.4 `materials/<digest>.json`：内容寻址

- 文件名是 64 位小写 SHA-256，不带 `sha256:` 前缀，扩展名 `.json`。
- 检查值为 `SHA256(UTF-8(canonical_json(parsed JSON value)))`，**不等同于直接哈希原始文件 bytes**。Owner 的 `canonical_json`：递归排序对象 key；JSON 无多余空白；保留 Unicode（`ensure_ascii=False`）；拒绝 NaN/Infinity；原始 tuple 归一为 JSON array。
- **浏览器 JS 的 `JSON.stringify` 不保证与 Python canonicalization 等价**，特别是数字格式；D1 要用 Python owner golden vectors 验证跨语言一致性，不能声称一个随手拼的 digest 比较符合现有 contract。
- 文件不得为 symlink / path traversal / 非普通材料路径；浏览器导入时只能在选定虚拟根目录内解析；同一 material_ref 不可指向不同内容。
- Owner 的 `TraceStore` 在保存和读取时拒绝 credential-like values、secret-bearing keys 与 hidden reasoning / thinking 相关材料；Viewer 导入仍要独立做输入大小上限、渲染安全与默认脱敏，**不能因为上游已扫描就直接公开 raw**。

### 1.5 现有事件的身份语义

**Procedure / Runtime：** 仅在 owner 提供时用真实 `data.attempt`、`procedure_invocation_id`、`owner_kind` (`ROOT|CHILD`)、`skill`、`procedure`、`parent_procedure_invocation_id`、`occurrence` 分组。上游 Loader 的 `_validate_procedure_lineage` 对 `PROCEDURE_ENTER`、`PROCEDURE_NODE_ENTER`、`PROCEDURE_TERMINAL`、`CHILD_INVOCATION`、`CALL_RESULT`、`RECONCILE_RESULT`、`RETRY_EDGE`、`GRAPH_TRANSITION`、`SKILL_RESULT` 和部分 `VERIFY_RESULT` 有定向校验；不代表每种 VERIFY 都自带完整调用身份。缺少精确链接时放在 Unlinked/Raw，不能猜 child occurrence。

**Model Calls：** `INTENT_MODEL_REQUEST/RESPONSE`、`SKILL-ROUTING_MODEL_REQUEST/RESPONSE`、`PLANNING_MODEL_REQUEST/RESPONSE` 与 Validation，按 owner `model_stage` + `call_index` + `model_call_id` 关联。请求先于响应，计数与 metadata 一致；对应 timed span 用显式 `model_stage`、`call_index`。注意连字符 `SKILL-ROUTING_MODEL_...` 是当前 writer/loader 的字面名称，别自动改成下划线。

**Outcome：** `RUN_SUCCEEDED` 等 trace event 只代表 Demo/Runtime 的相应事实；Fabric/Provider/SMF waiter 的独立 disposition 不存在于 `run.json` 的通用字段里，未附带则显示 `UNAVAILABLE`。

### 1.6 只读导入资格（D1 Gate）

| 类别 | 必须支持 / 阻断条件 |
|---|---|
| 格式选择 | 只按选定 source kind 与精确 `trace_format_version=2` 验证，不靠 filename 猜 owner |
| 完整性 | `run.json` 精确键集合/版本/ID/counters；JSONL 精确 shape/序号；材料引用闭合、digest；spans parent/状态；owner 现有 model & procedure lineage 检查 |
| 安全 | 浏览器内解析、有限文件数/体积/递归深度、路径安全、JSON 无 HTML 注入、严禁本地内容上传或写入 Pages |
| 错误类型 | `UNSUPPORTED_VERSION` / `INVALID_SHAPE` / `INCOMPLETE_BUNDLE` / `DIGEST_MISMATCH` / `IDENTITY_MISMATCH` / `UNSAFE_CONTENT` / `UNLINKED`，具体原因和 source locator |
| 可见性 | **Run 合法 ≠ 内容具备所有可视化关联**；根节点、Model、Evidence、外部 owner 的缺口必须可见 |
| 不扩权限 | Reader 绝不调用 Runtime 重执行、Mutation 或 Tool；不把 Console 的 Task/Run 判定塞进 TraceStore v2 |

**本轮只冻结要求，未编写/运行 D1 importer。** 是否接受 ZIP/目录上传、大小限制的具体数值与读流性能须在 D1 实现时测试后敲定；不能在 D0.5 声称已支持。

## 2. Source B：CA Console 消费的 Run / Event / Agent 材料

**核心区别：这里没有一个已经存在的“Console Trace 文件格式”。** Console 读取多个 owner 的 HTTP JSON。上游原文：[runDecoder.ts](https://github.com/odango-chan/ca-console/blob/59958c8ac4a5e8233191652763a6a31fb7d2f93c/src/modules/runs/api/runDecoder.ts)、[runClient.ts](https://github.com/odango-chan/ca-console/blob/59958c8ac4a5e8233191652763a6a31fb7d2f93c/src/modules/runs/api/runClient.ts)、[taskDecoder.ts](https://github.com/odango-chan/ca-console/blob/59958c8ac4a5e8233191652763a6a31fb7d2f93c/src/modules/tasks/api/taskDecoder.ts)、[Trajectory design §10](https://github.com/odango-chan/ca-console/blob/59958c8ac4a5e8233191652763a6a31fb7d2f93c/docs/design/tasks-and-runs.md)。

### 2.1 运行时 Run-first（必需）

| Owner/API | 核心消费字段 / 版本 |
|---|---|
| `GET /runtime-api/api/host/v1/runs/{runId}` | `RunView`: `runId`, `runRevision`, `hostState`, `firstEventSequence`, `lastEventSequence`, `createdAt`, `updatedAt`；还有 artifactDigest/variantDigest/parentTaskRef/environmentRef 等显式可选 refs |
| `GET .../runs/{runId}/events` | `RunEvents.events[]`: `eventId`, `runId`, `sequence`, `eventType`, `occurredAt`, `producer`, 可选 `correlation`, `evidenceRefs`, `payload` |
| `GET .../runs/{runId}/trajectory/closure` | `runtime.trajectory-closure/v1`: `runId`, `firstSequence`, `lastSequence`, `eventCount`, `trajectoryDigest`, `digestProfile`, `complete` |
| `GET .../runs/{runId}/evidence/material` | `runtime.run-evidence-material/v1`: 内嵌 `run` / `events`, `firstSequence`, `lastSequence`, `eventCount`, `materialDigest`, `complete` |

`RunView.hostState` 的当前合法值：`RUNNING|NEEDS_DECISION|SUCCEEDED|FAILED|SAFE_STOPPED`。它**不是** Agent Demo `trace.jsonl.kind`。独立解析、独立版本校验，不能混用 `trace_format_version=2`。

`RunEvent.correlation` 当前可含 `hostTurnId`, `hostCallId`, `hostRootCallId`, `hostRequestId`, `runId`, `turnId`, `stepId`, `invocationId`, `toolCallId`, `procedureNodeId`, `procedureOccurrenceId`, `actionOccurrenceId`, `dispatchAttemptId`, `parentOccurrenceId`, `originOccurrenceId` 等显式 refs；字段不在事件中时绝不能从时间戳恢复。

按 Console 现实现，`/events` 缺失的 owner correlation/evidence 只能在**同一 Run** 的 evidence material 存在且 `eventId + runId + sequence` 三者全相等时补足，绝不能宽松 merge。

### 2.2 Agent / Model / Tool（可选，不阻塞 Runtime-only Trace）

| Owner/API | 核心消费字段 / 版本 |
|---|---|
| `ProductTask` | `connectionagent.product-task/v2`: `taskRef`, `revision`, `lifecycleState`, `relatedRunRefs[]` 等 |
| `GET /agent-api/api/v2/tasks/{taskRef}/material/detail` | `ca-agent.product-task.material-detail/v1|v2`，`sourceAuthority=ca-agent`；`taskRef`, `materialRef`, `materialDigest`, `material.modelInteractions[]`, `material.toolCalls[]` |

Agent `modelInteractions[]` 可含 `requestRef/responseRef`、`requestSnapshot/responseSnapshot`、`requestDigest/responseDigest`、`selectedToolCallRequestRefs[]`、`toolResultSourceRequestRefs[]`、`role`、最终回复来源等。ToolCall 的 `requestId` 和 `runId` 是明确绑定 Runtime 的身份；`selectedToolCallRequestRefs[]`、`toolResultSourceRequestRefs[]` 必须能唯一命中对应 ToolCall，不能按数组相邻或时间推测。

**D2 跨 owner join:** `ProductTask.relatedRunRefs` 明确包含 Run；`AgentToolCall.runId == RuntimeRun.runId`，且 Tool 请求与响应通过 owner refs 精确配对。Runtime `eventId/runId/sequence` 精确匹配才补原生 evidence。多对一存在歧义时不链接。Context/Model Input/Tools 要基于确切 snapshots，不展示猜出来的 System prompt。Console UI 的四泳道只是阅读分组。

### 2.3 独立 outcome / terminal

分别显示 `ProductTask.lifecycleState`、`RuntimeRun.hostState`、`RunEvent.payload` 里的 owner 状态、ToolResult delivery、Evidence closure 与外部 owner disposition。它们可以不一致；**不允许合并成一个单值 SUCCESS/FAILED**。Fabric/World owner source 未接入时标 `OWNER_PROJECTION_UNAVAILABLE`。

## 3. Viewer 统一的只是阅读模型，不是导出文件协议

~~~text
Verified owner-native Input
    ├── Agent Demo file adapter (D1)
    └── CA Console / Runtime + Agent API adapters (D2)
               ↓
Read-only presentation records with source locators and exact refs
               ↓
Turn / Model Interaction / Tool Interaction / Harness stages / Procedure
               ↓
Timeline / Execution / Evidence / Inspector
~~~

每个可点击展示项至少能恢复 `sourceKind`、`sourceAuthority`、`sourceLocator`、`nativeIdentity`、`nativeSequenceOrRevision`（如该 owner 提供）、`version`（如该 owner 提供）和 `explicitRefs[]`。这些是**Viewer 内部的 provenance 目标**，不是要求源文件都具有同一字段集。

- 没有 LLM：允许 `0` Model Call，显示完整确定性 Procedure。
- 只有 Model：允许 Runtime/Tool / Evidence 为 `UNAVAILABLE`，不得填造。
- 部分 Run：明确标记 `INCOMPLETE`；没有终态时不推理成功。
- 旧/新版本：按来源独立适配；不 silent auto-upgrade、不“弱解析”未知结构。
- 只给导出文件（D1）或只给 Runtime API（D2）的情况，都可以只显示**已有事实**。

## 4. D1 验收用例（实施前必定）

| ID | 期望 |
|---|---|
| F1 | 合法 trace v2 / 零 LLM / 空材料合法导入 |
| F2 | 合法 TraceRun v2 / 多 Span / 有 model request + response + validation / digest 有效 |
| F3 | 正常 `data` pair-array 归一化正确；乱序、重复键、错误 sequence 拒绝 |
| F4 | Version != 2、runId 不一致、额外/缺失 metadata key 拒绝 |
| F5 | Material 缺失、文件名错、内容 digest 错、非 canonical JSON 数值边界拒绝或明确不支持 |
| F6 | Span parent 缺失/顺序错、状态与 ended_at 不符、model call index/counters 错拒绝 |
| F7 | 同一次尝试里 child Procedure invocation/occurrence 关联正确；歧义保留 unlinked |
| F8 | 未知事件 kind 不会伪造新业务类型或崩溃；已知安全字段只读显示 |
| F9 | 上传目录不触网、不写敏感内容到 DOM/console、超限/危险文件明确拒绝 |
| F10 | Resident 未落盘/缺失终态、独立 Fabric disposition 缺失展示为 unavailable，不写假 PASS |

测试必须至少有一组**由 pin 住的上游 `TraceStore.persist` 实际生成并脱敏的 fixture**及 malformed siblings；D0 `site/fixtures.mjs` 的手工 synthetic demo **不可**当作 owner schema 验收。需要真实 Resident Run 的 artifact 时，由 owner 提供经过审查的可公开脱敏样本；否则记 `BLOCKED`。

## 5. 开发入口

- **D0.5**：本文件固定当前实际格式和消费约束（documentation only）。
- **D1**：按 §1 实现 Agent Demo v2 的 read-only importer、Python canonical golden tests、Inspector；优先支持完整静态目录导入，ZIP 与实时追踪另行验收。
- **D2**：按 §2 实现 ca-runtime/ca-agent API 原生 adapter、DSH-style folding；复用 CA Console 逻辑但不共享其卡片作为 wire truth。
- 若发现 Producer 格式字段/事件证据缺陷，记录到**owner 仓 Issue**，不得在 Viewer 里补写虚假事实。
