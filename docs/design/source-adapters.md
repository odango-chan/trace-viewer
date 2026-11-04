# Source Adapters / View Projection

**Status: Proposed D1/D2, with D0 synthetic adapter · 2026-11-04**

**D0.5 输入格式与验收前置门禁见 [Trace 输入格式要求](../contracts/trace-inputs.md)。** 本文只讲 Adapter/Projection 架构，不复制 owner-native 字段表。

## 目标

不要建设第三个跨 owner 的 canonical Trace Schema。每个 Adapter 只验证所属真实 owner 的**原生契约**，以只读 `SourceRecord` + presentation fields 输出；保存 exact sourceAuthority、record family/type、version/profile digest、ref、owner sequence/revision、material digest、explicit causal refs 和 raw-locator。Presentation Card/Step/edge 不可回写 owner。

~~~text
source file / owner API
   -> exact contract validator and bounded reader
   -> owner-native record handles
   -> viewer-only grouping (Turn, Step, Tool, Procedure, Evidence)
   -> React display
~~~

## D1: Agent Demo

期望离线导入 `.runs/<run-id>/run.json`、`trace.jsonl`、`materials/<sha256>.json`：

- `trace_format_version=2`，按 upstream TraceStore 的规则校验 run identity、序号连续、material digest、procedure invocation、Span identity 等；未提供的材料必须显示 `UNAVAILABLE`。
- 不读取当前 Skill 文件来重构历史执行事实；使用历史 trace 里 frozen identity、artifact digest、source node/frozen node、attempt/occurrence。
- Runtime Trace 和 Fabric HELD disposition 是不同 truth owner；不因一个 terminal 替代另一个。
- Run 与材料可能包含敏感信息：导入应拒绝超限或危险内容、只做本地处理、默认折叠/raw 脱敏，不用第三方外链发送材料。

## D2: Console / Runtime

参考 `ca-console/src/modules/runs/api/runClient.ts`、`trajectoryProjection.ts`、`runtimeStageProjection.ts`。owner-native Run、RunEvents、Trajectory closure / evidence material 分开读；只按 exact `runId`、`eventId` + sequence 和 explicit ToolCall/Run linkage fold。

- 保留可解释的 `Agent/Model | Runtime | Service Fabric | World` 四泳道。
- Model Input Snapshot/Output Snapshot、Tool Call/Result、Runtime gate 对应 owner material，不以 Console card 为真源。
- 时序、异常场景和 Harness gate 边界参考 CA Console 的两份 prototype；它们是 UX 参照，不是实际 owner wire schema。

## Adapter 缺失时的处理

- 不接受结构看起来相似的未知 JSON 当作已验证 owner event。
- 不做基于相似文本、时间戳或展示序号的隐式 join。
- 明确标记 unsupported schema、missing material、identity mismatch、incomplete closure、redaction。
- Synthetic fixture 只表示 D0 交互示范，绝不转换为真实 source records。
