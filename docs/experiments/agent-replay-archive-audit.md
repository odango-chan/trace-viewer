# D1.3 — 真实归档 Agent Model → Tool → Model 的 Replay 闭包审计

**验收状态：\`PARTIAL_REPLAY_CLOSURE_PROVEN\`，不是完整 L0 Replay PASS。**
**日期：2026-11-05**
**源：私有 [ca-console/20261009-console-v1-trace-causal-folding](https://github.com/odango-chan/ca-console/tree/main/artifacts/acceptance/20261009-console-v1-trace-causal-folding)**
**本轮运行证据：[ca-console 私有 Actions PASS](https://github.com/odango-chan/ca-console/actions/runs/41978359553)**
**审计代码：[只输出布尔/计数的脚本](../../scripts/audit_agent_replay_closure.mjs)、[合成负向测试](../../tests/agent-replay-closure.test.mjs)**

## 1. 选用什么真实记录

审计的是 **2026-10-09 CA Console / ca-agent owner 联调归档**中两份已经存在的 \`material-detail.json\`：

1. \`attempts/03-live-lab-owner-run/material-detail.json\`（真实 Owner 联调归档）
2. \`attempts/04-native-owner-run/material-detail.json\`（另一次原生 Owner 路径归档）

二者都来自私有 \`ca-console\` 仓。我们不是拿 DSH 手写示例、手动模拟的 Model/Tool 事件，也没有重新发送 Tool 请求或触发 5GC。归档 \`modelInteractions\` 和 \`toolCalls\` 是 **ca-agent owner material**，不是完整 DSH SessionEvent log；两者不能偷换概念。

旧 [C7M model-snapshot 归档](https://github.com/odango-chan/ca-console/tree/main/artifacts/acceptance/20260915-180700-c7m-model-snapshot-mcp) 保存了两轮请求/响应的 **引用与摘要**，但未提交完整源快照 body，且场景为模拟模型与影子 Runtime，不能用它充当完整 Agent Replay。它仍可作为另一份对照。

## 2. 逐项检查（两个独立归档结果一致）

| 需要确认的事实 | 观测结果 | 结论 |
|---|---|---|
| Model 交互数量与请求/响应快照 | 每份均有 **2 个 ModelInteraction**，每个都有 \`requestSnapshot\`、\`responseSnapshot\`、source refs 与 \`sha256:\` digest refs | **PRESENT**；digest 算法与源字节仍未由 Owner 独立重新校验 |
| 当次 Model 的消息表面 | 每份两次请求均包含 \`system\` 和 \`user\` 消息的内容；包含 model/temperature 字段 | **PRESENT**；这不是已认证的完整 provider-wire request |
| 第一次 Model 对 Tool 的选择 | 选择 ref 可与归档 Tool 请求 identity 精确匹配 | **EXACT REF** |
| Tool 执行入参与结果 | 一个 Tool 调用，有结构化 arguments/result、requestId/runId | **PRESENT**；arguments 归档是对象，不能声称保留模型原样输出的 raw JSON 字符串 |
| 第二轮引用前次结果 | \`toolResultSourceRequestRefs\` 精确指向第一次的 Tool request identity | **EXACT REF** |
| **第二轮真正的 Model 请求内容** | 第二次输入的实际消息文本中包含前次 **完整 ToolResult JSON 的一致序列化文本**（不仅是一段说明） | **EXACT SNAPSHOT BODY**；不是另一次独立 DSH \`tool/result\` event receipt 证明 |
| Tool Catalog | 有 \`toolSurfaceRef\` 与 \`toolSurfaceDigest\`，但没有在 \`requestSnapshot.tools/functions\` 中保存完整目录 body | **REF ONLY / BODY NOT RETAINED IN THESE ARCHIVES** |
| Skill/Reference 可见版本 | 顶层 material 中没有可解析的 loaded Skill Context/Reference frozen body；Runtime bundle digest 不能替代 Agent 实际可见 Context | **NOT PROVEN** |
| Provider 与可重复条件 | 有 model ID、temperature、usage 等局部参数；未证明固定模型 revision/seed/adapter defaults 与 provider-wire 的完整值 | **PARTIAL** |
| Model 输出隐私 | 响应快照中存在非空 \`reasoning_content\` 字段 | **RESTRICTED**：审计不会输出/导出其正文，后续也不得把它自动纳入训练集 |
| 独立质量判定 | Runtime 成功与 Model 行为正确性不能划等号；本归档未提供可核查的独立学习标签/使用授权 | **TRAINING NOT_QUALIFIED** |

**限定解释：** 这一轮确认的是 *归档内第一轮 Tool request → 已保存 Tool Result → 第二轮 Model request 的明确对应和内容出现*。它既不能证明所有 DSH Event 已完整留存，也不能证明完整 Skill/Tool 构建、模型服务端版本、工具原始消息到达时间或真实世界状态可复演。

## 3. 私有 CI 和保密措施

[私有 ca-console Workflow](https://github.com/odango-chan/ca-console/blob/main/.github/workflows/agent-replay-archive-audit.yml) 固定 checkout 公开 Viewer 的审计脚本，不导出私有 Material。实际运行：

- 脚本合成单元测试：**4/4 PASS**（含错配 ref、丢失 ToolResult、敏感内容不出报告）。
- 03 live-lab：**\`PARTIAL_REPLAY_CLOSURE_PROVEN\`**。
- 04 native-owner：**\`PARTIAL_REPLAY_CLOSURE_PROVEN\`**。
- 审计报告**只包含计数、布尔检查、常量资格状态**；不输出 Prompt、model output、reasoning、Tool args、Tool Result、runIds/refs、digest bytes。
- 未上传私有归档到公开 GitHub、CI artifact 或其他 telemetry backend，未触发外部 Tool/真实 5GC 操作。

[本轮私有验收 PASS](https://github.com/odango-chan/ca-console/actions/runs/41978359553)；[公开脚本工程门禁 PASS](https://github.com/odango-chan/trace-viewer/actions/runs/41978296286)。

## 4. Q7–Q9 / L0–L2 真正的状态

| 用户问题/能力 | 证据状态 | 具体缺口 |
|---|---|---|
| **Q7：当时模型看到了什么？** | **PARTIAL** | 本次消息体和 ToolResult Handoff 的 body/ref 可复核；完整 Tool Catalog、Skill Context/Reference 与源摘要校验没有闭合 |
| **L0：忠实离线重建** | **PARTIAL** | 可读取两次请求消息、响应与 Result JSON；**未认证**完整有效请求及模型可见版本 |
| **Q8 / L1：模型重跑** | **NOT_RUN** | 需要完整有效请求、模型 revision/配置和受控测试，不保证字节相等 |
| **Q8 / L2：隔离 Tool/Runtime 重演** | **NOT_RUN** | 需要 Tool fixture/Env/Observation 冻结及显式 no-side-effect fence |
| **Q9：训练/评估候选** | **NOT_QUALIFIED** | 缺完整输入闭包、独立 Oracle/人工质量标签、使用权/敏感筛选门禁；成功 Run 不能直接标成优质样本 |

## 5. 下一步（仍保持 Demo 轻量）

**只有一个优先修复目标：把一轮 Model 请求的“当时有效输入”闭包真正冻结并可独立校验。**

1. 先在 **ca-agent / ca-dsh Owner** 里核实 \`toolSurfaceRef\` 能否解析到不可变 Tool Catalog body、当前有效 Tool Schemas，以及实际注入的 Skill/Reference 与其内容摘要；如果源码有但归档缺，补**保留**而不是新建新的 Training Trace 合同。
2. 明确原 \`requestDigest\` / \`responseDigest\` 的计算 Profile，交给 Owner 校验原始材料内容与摘要（现有脚本仅检查格式，不谎称 hash 验证）。
3. 按已经 [Accepted 的 DSH snapshot 语义](https://github.com/odango-chan/connectionagent/blob/main/docs/design/agent-trajectory.md) 建一个 **私有合成 Model → Tool → Model Golden**：有效 System/Context、Tool Catalog、Skill 加载、ToolResult 交付、Next Model 的精确快照。未来能够独立 reopen 与验证 L0。
4. L0 经过真实闭包校验以后，再做 **一次 L2 Tool stub 无副作用隔离重演**；模型 L1 重跑可排后面。实际 5GC mutation 不重放，外部世界状态不伪造。
5. Q9 只输出只读资格报告，需 Benchmark/人工独立评估及数据权限；**不自动训练、不自动更新 Skill/Prompt**。

**不要**将新的 \`agent-replay-archive-audit\` 作为全系统的新机器契约。它只是一个保护隐私的取证验收器，未来原生材料闭包成熟后可以替换/删除。
