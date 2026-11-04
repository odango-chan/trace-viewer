# Trace Viewer 里程碑

**Initial planning · 2026-11-04**

| 里程碑 | 目标 | 明确不做 |
|---|---|---|
| D0 Initialization | Repo governance、浅色单页骨架、显著 synthetic DSH Turn/Tool/Runtime 与确定性示例 | 不声称真实 Trace、没有 owner adapter |
| D1 Offline Agent Demo | 原生 `run.json` + `trace.jsonl` + `materials/` 浏览器导入、版本与 digest/lineage 校验、不可用提示 | 不变更 Agent Demo TraceStore |
| D2 Console / Runtime | 按 `runId`/owner 序号读取 typed records；correlation 只依据确切 refs；保留四泳道 | 不产生 `UnifiedTrajectoryEvent` 真源 |
| D3 Forensics | Model Input/Output、Tool Call/Result、Harness gates、Evidence、异常优先展开、UNKNOWN/reconcile、历史事件截断 | 不用 renderer 判定业务成功 |
| D4 Flow & comparison | 动态的 Procedure 节点路径 / retries、Run Diff、Source identity 深链到 Skill Studio | 不在 Viewer 编辑 Skill 或重执行 |
| D5 Integration | 可选只读 remote adapter / SSE、Console deep link、Pages 合规部署 | 不获得 runtime mutation authority |

**第一条独立纵切：** 真实 `ca-agent-demo` 一次确定性执行的持久化 Trace 可重开，展现 exactly matched Runtime node/predicate/evidence refs，再开展 Web D1 验收。

**第二条独立纵切：** DSH-inspired Model → Tool → Harness → Runtime → ToolResult → next Model Turn，包含异常恢复与显式因果。
