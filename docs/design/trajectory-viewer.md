# Trajectory Viewer UX

**Status: D0 baseline · 2026-11-04**

## 保留的 DSH-inspired Agent 轨迹阅读模型

参考 [CA Console §10.4](https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md) 和 [完整 Trajectory 原型](https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-prototype.html)。不得用确定性 Procedure Flow 取代 Agent 轨迹：

~~~text
Request Boundary
  └─ TURN #N
      ├─ Model Request + Response  (foldable Model Interaction)
      │    ├─ actually model-visible System / Context / Skill / Tools
      │    ├─ structured output, usage, validation, role
      │    └─ zero or many selected Tool Calls
      ├─ TOOL INTERACTION (Tool Call + exact ToolResult)
      │    └─ Runtime Gates → Dispatch → Outcome → Evidence → Reconcile → Delivery
      └─ next Model Interaction (only when owner evidence exists)
~~~

正常路径折叠；UNKNOWN、错误、恢复和重试优先展开；单一 Step 的局部 ①②③ 是展示编号，不是全局事件序列。跨 owner 的时间线不得据时间戳假造全序。并行 ToolCall/ToolResult 必须按 exact callId 关联，不能按位置顺序配对。

## 六个阅读入口

1. Overview — Execution identity、mode、owner、terminal / external disposition distinct facts。
2. Trajectory — 默认 Turn/Step 折叠、Harness stages、Model/Tool 子节点与 Inspector。
3. Timeline — 各 owner local sequence 的流内序列；跨 owner 只表示显式因果；可过滤。
4. Execution — Frozen Procedure / Phase / Node / Attempt 与精确 lineage，兼容无 LLM 的确定性运行。
5. Evidence — Predicate/Observation refs、source provenance、freshness、uncertainty、artifact/script identity。
6. Raw — Read-only canonical material refs、JSON、digest、unavailable reason；绝不默认公开 secret。

D0 初始页面只实现合成的 Trajectory/Execution 阅读骨架及 Inspector。后续视图 **不得假装已实现**。

## 交互约束

- 默认 light theme；左侧 Runs/Steps、中央可折叠轨迹、右侧 Inspector；窄屏堆叠。
- 切换不同 Run 时清空旧选中项；Inspector 内容严格对应用户选择的来源记录。
- 时间轴、Flow、四泳道是**同一批** owner records 的多种阅读视图，不派生第二份业务状态。
- 原始记录不知道的具体 LLM context、ToolResult 或 external evidence 标记 unavailable。
- 有异常时默认展开并显示具体 uncertainty class，不把 `OUTCOME_UNKNOWN` 变成 FAILED。
- Model/Tool 请求与响应分别保留 sourceRef，同时允许在 UI 折叠为一个交互。
- 一个 Model request 不能仅因为时间相近就显示成某 ToolCall 的 parent。
- 紧凑默认标题与 detail/raw 能互相跳转；不做按钮山、不刷屏渲染所有低层事件。
