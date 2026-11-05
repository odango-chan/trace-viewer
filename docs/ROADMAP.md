# Trace Viewer 里程碑

**Initial planning · 2026-11-04**

| 里程碑 | 目标 | 明确不做 |
|---|---|---|
| D0 Initialization | Repo governance、浅色单页骨架、显著 synthetic DSH Turn/Tool/Runtime 与确定性示例 | 不声称真实 Trace、没有 owner adapter |
| D0.5 Trace input contracts | 以当前 owner implementation 为准，盘点 v2 TraceStore 文件、Console Runtime/Agent API、验证/缺失/脱敏要求，冻结 D1/D2 前置门禁 | 不自建统一 wire schema、不偷改 producer |
| D0.6 Phoenix / OpenTelemetry selection spike | 2 个合成根 Trace；OTLP→Phoenix→API readback；Owner-native ↔ GenAI 字段映射与缺失报告 | 不将合成 PoC 称为真实 Owner/Evidence 验收，UI parity 需另测 |
| D0.7 Native source loss audit | TraceStore.v2 结构/序号/material digest / no-fabricated-event-time 8 synthetic tests | 不宣称真实 owner golden fixture、完整 Procedure/Model lineage 或 OTLP round-trip |
| D0.8 Console parity in Viewer | 基于两个 Console Prototype 的四阅读模式、Inspector、明确 ref folding、Host/Runtime 异常语义，使用新合成 fixture 与 Chromium UI 复测 | 不复制私有源码/假定 Demo 是生产证据 |
| D1 Offline Agent Demo | 原生 `run.json` + `trace.jsonl` + `materials/` 浏览器导入、版本与 digest/lineage 校验、不可用提示 | 不变更 Agent Demo TraceStore |
| D2 Console / Runtime | 按 `runId`/owner 序号读取 typed records；correlation 只依据确切 refs；保留四泳道 | 不产生 `UnifiedTrajectoryEvent` 真源 |
| D3 Forensics | Model Input/Output、Tool Call/Result、Harness gates、Evidence、异常优先展开、UNKNOWN/reconcile、历史事件截断 | 不用 renderer 判定业务成功 |
| D4 Flow & comparison | 动态的 Procedure 节点路径 / retries、Run Diff、Source identity 深链到 Skill Studio | 不在 Viewer 编辑 Skill 或重执行 |
| D5 Integration | 可选只读 remote adapter / SSE、Console deep link、Pages 合规部署 | 不获得 runtime mutation authority |

前置要求：[D0.5 Trace 输入格式清单](contracts/trace-inputs.md)；只有取得上游 Python 生成的真实结构、可公开脱敏 golden fixture 并通过格式/安全负向测试，才能宣布 D1 adapter 验收。

**第一条独立纵切：** 真实 `ca-agent-demo` 一次确定性执行的持久化 Trace 可重开，展现 exactly matched Runtime node/predicate/evidence refs，再开展 Web D1 验收。

**第二条独立纵切：** DSH-inspired Model → Tool → Harness → Runtime → ToolResult → next Model Turn，包含异常恢复与显式因果。
