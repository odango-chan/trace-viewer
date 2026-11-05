# CA Console 轨迹 Demo → Trace Viewer 复用对照

**Status: CONSOLE_SYNTHETIC_UI_SMOKE_PASS · 2026-11-05**
**Evidence: [Viewer Chromium UI PASS](https://github.com/odango-chan/trace-viewer/actions/runs/41956396421) · [Screenshot + diagnostic artifact](https://github.com/odango-chan/trace-viewer/actions/runs/41956396421/artifacts/13383166824) · [CI 10 Node / 8 Python tests](https://github.com/odango-chan/trace-viewer/actions/runs/41956588953)**
**Scope: Viewer UI/presentation only; not a new owner-native event contract**

## 参考基线

- [CA Console Trajectory prototype](https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-prototype.html)：DSH Turn / Step、Model Interaction、Tool Interaction、Runtime/Fabric/World 四泳道、Source Inspector。
- [CA Console anomaly scenarios](https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-anomaly-prototype.html)：Host RESULT_UNKNOWN 与 Runtime OUTCOME_UNKNOWN、Provider result-loss、ToolResults 乱序、Authorization/Assurance 的不同拒绝边界等。
- [CA Console current design](https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md#1032-run-trace-%E9%A1%B5%E9%9D%A2)：Run-first、owner-native identity、六 Runtime stage 映射。
- [CA Console current projection code](https://github.com/odango-chan/ca-console/blob/main/src/modules/runs/trajectoryProjection.ts) 与 [Runtime stages](https://github.com/odango-chan/ca-console/blob/main/src/modules/runs/runtimeStageProjection.ts)。

**这些是私有 Console 原型/设计的阅读参考，并不是 Trace Viewer 可以复制的生产记录。** 本仓只使用重新编写、明确标注的合成 Fixture；未复制私有业务源码、真实 Model Snapshot 或 5GC 记录。

## 实现矩阵

| Console 能力 | 本仓落点 | 状态 | 不可越过的边界 |
|---|---|---|---|
| Readable / Model only / All owners / Raw records | `site/app.tsx`、`site/console-parity.mjs` | IMPLEMENTED (synthetic) | UI view 不能改变底层 source; raw 只列 fixture 字段不是 production bytes |
| Model Request + Response → Model Interaction | `projectSectionRows`，`MODEL_RESPONSE.causalRefs` 指向同 owner request | IMPLEMENTED (synthetic) | 无确切关联不折叠；歧义不按邻接补齐 |
| Tool Call + ToolResult → Tool Interaction | `projectSectionRows`，显式 `TOOL_RESULT.causalRefs` 指向 request | IMPLEMENTED (synthetic) | 只合并唯一命中；跨 Section 两边仍保持自己的来源位置 |
| Runtime / Fabric / World 四泳道 | `projectLanes` + CSS | IMPLEMENTED (synthetic) | 四泳道是展示分类，不能暗示这些 owner 已发布某个事实 |
| Inspector Summary / Source / Lineage | `site/app.tsx` | IMPLEMENTED (synthetic) | 仅显示安全合成字段，不能视为真实 Evidence/raw owner material |
| Focus unknown / anomalies expanded | `findPrimaryUnknown`、`defaultOpenSections` | IMPLEMENTED (synthetic) | **Host RESULT_UNKNOWN ≠ Runtime OUTCOME_UNKNOWN** |
| Host result-loss / Runtime success case | `synthetic-host-delivery-gap` | IMPLEMENTED (synthetic) | Host knowledge 缺口不能改写 Runtime SUCCEEDED |
| Out-of-order ToolResult | `synthetic-parallel-tool-results` | IMPLEMENTED (synthetic) | callId/ref 精确匹配，而非顺序 |
| 六个 Runtime stage + lifecycle/decision overlay | 尚未接入 `RunEvent.v1` Adapter | NOT_STARTED | 不从自己发明的 event kind 推业务状态 |
| 完整 DSH actual System/Context/Tools/Response + attempts | 尚无 owner material/detail | NOT_STARTED | 不展示模型未实际看到的上下文 |
| Fabric 与 World 原生 fact、Evidence closure | 尚无 source adapter | NOT_STARTED | 缺证据时 UNAVAILABLE |
| Native Agent Demo TraceStore v2 importer | `scripts/native_trace_audit.py` 仅线下结构检查 | NOT_STARTED (browser) | audit 不等于源 Loader、Material 阅读及真正导入 |
| Phoenix 嵌入/深链 | Phoenix PoC 独立运行 | NOT_STARTED | 不能把 Phoenix 项目 UI 当 CA 事实数据库 |

## 产品交互守则

1. 首页采用浅色三栏，左侧运行示例、中央可折叠 Turn/Step、右侧 Inspector。默认 Readable；异常所在 Section 默认展开。
2. 四种模式切换只改变**读取密度**；跨 owner 没有共同 Sequence；标签序号是 source 的 `ownerSequence`。
3. Inspector 的 Folded Interaction 包含实际两个源的 ref/status/ownerSequence，点击进入 Source，不能因为一张合并卡片丢掉原始出处。
4. `RESULT_UNKNOWN` 表示 Host 未收到结果；`OUTCOME_UNKNOWN` 表示 Runtime 对可能已经执行的副作用尚无确定结论，两者需分别提供案例与测试。
5. 所有例子显著 `SYNTHETIC DATA`；无需复杂 Provider/CreatedSession 业务定制，先让通用结构可以解释 DSH 和确定性两种路线。
6. Console 已有的“结果先行、细节下沉”可以保留，但不应直接复制大体量原型 HTML 成为本仓第二套 UI。

## 可复现验收

- [5 个基础 Projection 测试](../../tests/projection.test.mjs)：源身份、owner-local 序号、Source Links、状态分离。
- [5 个 Console-parity 测试](../../tests/console-parity.test.mjs)：四模式、精确 Model/Tool folding、歧义拒绝、Host/Runtime 状态独立、四泳道。
- [Chromium UI smoke](../../tests/viewer_ui_smoke.py)：实际点击四模式、Inspector Source、Focus unknown、乱序 ToolResult、无 LLM 确定性案例。
- 对应 [GitHub Workflow](../../.github/workflows/viewer-ui.yml)，截图与 JSON 仅包含合成数据。

实际 Chromium 测试包含 8 个交互断言：显著 synthetic 标签、Model folding、四泳道、Raw/Inspector、Host RESULT_UNKNOWN 与 Runtime SUCCEEDED 的区分、ToolResult 乱序精确配对、无 LLM Model-only 空状态和无 JS 错误。**不等于 Console 全部 UI parity**：System/Context/Tools/Response 详情、真实 Runtime stages、Evidence 无损仍未验收。

下一阶段必须从 **owner-generated golden source** 开始，不能从 Console HTML demo 或本仓 handcrafted fixture 反推新的 Producer schema。需要优先在 `ca-agent-demo` 私有环境调用现有 `TraceStore.persist` / `load_run` 生成并验收合成 golden Run，再经审查提取无敏感字段的可公开测试材料。之后才做真实离线 Adapter。
