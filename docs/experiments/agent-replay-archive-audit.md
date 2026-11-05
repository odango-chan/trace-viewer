# D1.4 — Agent 实际可见输入与 ToolResult 的重建复核

**Status: PRODUCTTASK_REQUEST_SNAPSHOT_DIGEST_PASS · TOOL_SURFACE_DIGEST_PASS · RESULT_HANDOFF_PASS · L0 CONTENT PARTIAL · L2 OBSERVATION_STUB_ONLY**
**Date: 2026-11-05**
**Source: private [ca-console Owner archive](https://github.com/odango-chan/ca-console/tree/main/artifacts/acceptance/20261009-console-v1-trace-causal-folding)**
**Evidence: [private CI PASS — 6 tests + 2 genuine archived runs](https://github.com/odango-chan/ca-console/actions/runs/41979646464)**
**Verifier: [public read-only audit](../../scripts/audit_agent_replay_closure.mjs), [negative tests](../../tests/agent-replay-closure.test.mjs)**

## 1. 样本和验证范围

在不重发 Model 请求、不调用 Tool、不修改 Runtime 的前提下，审计了私有 `ca-console` 中 2026-10-09 原有的两条 Owner 记录：

- `attempts/03-live-lab-owner-run/material-detail.json`
- `attempts/04-native-owner-run/material-detail.json`

**每份归档：2 ModelInteraction + 1 ToolCall。** 归档的 `modelInteractions` 来自 `ca-agent` ProductTask 路线，并不是完整的 `ca-dsh` SessionEvent Log、Provider API 网络抓包，也不是当前 `ca-agent-demo` 的 CreatedSession Skill。

审计在私有 `ca-console` Actions 中执行；公开仓只包含无真实输入的脚本和测试。输出只有固定枚举、布尔值、计数；**不会输出 Model Prompt、模型响应、推理字段、Tool 参数、运行 ID、原始摘要或材料。**

## 2. 源码核实后的重要纠正

Producer 的真实路径：

- [`ca-agent/model.go` 的 `DecideProductTask`](https://github.com/odango-chan/ca-agent/blob/main/model.go) 将 `intent/tools/observation` 作为 JSON 嵌入 **user 消息的 `Input: {...}`**；`completeWithInteraction` 将实际序列化的请求体、响应体保存为 `RequestSnapshot/ResponseSnapshot`。
- [`ca-agent/internal/producttaskapi/canonical_executor.go`](https://github.com/odango-chan/ca-agent/blob/main/internal/producttaskapi/canonical_executor.go) 将 Owner 已允许的 `visible` Tool 元数据组成 surface，按 Go JSON 序列化计算 `ToolSurfaceDigest`，再保存 Model/Tool 交接 refs；`stampModelInteraction` 对原始请求/响应 JSON 字节计算 SHA-256。
- **Tool Catalog 不在请求顶层 `tools` 字段并不代表没送给模型。** 本条 ProductTask Route 使用文本内嵌的 Tool 目录；校验器根据这个 Producer 的实际模板解析，**不是所有 Provider 都可用的推断规则**。
- **Skill/Reference 对这条 ProductTask Decision 路线为 `NOT_APPLICABLE`。** 不能把没有 loaded Skill Context 认定为本条记录的丢失。要测 Skill-dependent Planner，应另选实际调用 `PlanWithInteraction` / DSH Skill Loading 的样本。

## 3. 私有原始归档复核结论

| 检查项 | 03 live-lab | 04 native-owner | 结论边界 |
|---|---|---|---|
| 请求消息、响应快照留存 | PASS | PASS | 真实归档内容可读取，不等于 Provider 服务端版本固定 |
| RequestDigest 与归档请求 JSON 重序列化 SHA-256 一致 | PASS | PASS | 针对这两份记录；不宣称覆盖所有 Go JSON 特性 |
| ResponseDigest 与归档响应 JSON 重序列化 SHA-256 一致 | PASS | PASS | 同上，不暴露响应正文或 reasoning |
| 从 user `Input: {...}` 提取实际 Tool Catalog | PASS | PASS | ProductTask Owner 特定序列化模板 |
| 由 Prompt 中 Tool Schema 重建 `ToolSurfaceDigest` | **PASS** | **PASS** | 证明这份归档内有完整可比对的当次模型可见 Tool Schema |
| Model 第一次 Tool 选择与 ToolCall requestRef | PASS | PASS | 不按时间相邻推断 |
| ToolResult 原样 JSON 在第二轮 Model Request 中出现 | PASS | PASS | 匹配实际存储的 JSON 序列化内容 |
| 第二轮 `toolResultSourceRequestRefs` 与 Tool requestRef | PASS | PASS | 同一请求身份 |
| **隔离 Observation Stub 对照** | PASS | PASS | 使用归档 ToolResult 作下一轮 `observation`，核对消息内 JSON；**未执行真实 Tool/Runtime/模型** |
| 完整 provider-wire Header/Session/模型权重版本、Skill 加载 | NOT_PROVEN / N/A | NOT_PROVEN / N/A | Header/Session 等重跑条件与 ProductTask 不适用 Skill 需分别处理 |
| 完整 L2 Agent/Runtime 控制流重演 | NOT_RUN | NOT_RUN | 当前只是 Observation Stub，并非执行 Engine |
| 训练/自学习样本资格 | NOT_QUALIFIED | NOT_QUALIFIED | 缺独立 Oracle/标签、授权和使用筛选 |

从 2026-11-05 private run [41979646464](https://github.com/odango-chan/ca-console/actions/runs/41979646464) 可核对：**合成单元测试 6/6 PASS，两个归档相同的源检查均 PASS**。旧 [2026-11-05 初次审计](https://github.com/odango-chan/ca-console/actions/runs/41978359553) 只检查字段存在和 Tool 交接。新一轮修正了“Tool Catalog 只剩 ref”和“ProductTask 没 Skill Context 就不完整”的误判。

## 4. 此刻什么级别的 Replay 被证明了？

- **产品任务这一条路径的模型请求内容**：两轮归档的模型可见消息及嵌入的 Tool Catalog 可独立读取，Request/Response 和 Tool Surface 的已存摘要与归档可比对内容相符。
- **一次 Tool → Next Model 的证据交接**：有明确的请求引用且 ToolResult 完整序列化出现在下一轮输入；这与 DSH Event 的 `tool/result` 独立交付证据**不是同一证明**。
- **L0：PARTIAL（但比之前进了一大步）**：本条 ProductTask 的模型可见请求内容+摘要基本可复核；完整可重现运行条件仍有 Producer Adapter headers/session、model revision、Tool/world 环境状态、owner 材料授权/保留等非内容闭包。
- **L2：OBSERVATION_STUB_ONLY**：只验证 ToolResult 作为 observation 返回模型的**输入重建一致性**，不启动 Agent Engine、不复发任何 mutation，也不能叫全控制流重演。
- **L1、Training：NOT_RUN / NOT_QUALIFIED**；响应中可能存在 `reasoning_content`，绝不默认导出或进入训练集。

## 5. 下一步，不扩建多套 Trace

1. 对 `ca-dsh` 既有 [ModelInputSnapshot Builder](https://github.com/odango-chan/ca-dsh/blob/main/src/trajectory.ts) 做 **Skill-dependent 路线**的 owner-generated Golden：实际 `ca_load_skill` ToolResult、有效 System Prompt/Tool Schema、Skill/Reference 内容、最终 ModelInput Snapshot 与 source refs/digests。该分支和纯 ProductTask 不应混用 N/A 判断。
2. 只在有安全边界的隔离环境做一次 **真正调用 Agent Engine + 预录制 Model 与 Tool stub** 的 L2 控制流验证；外部 Provider、真实 5GC/Runtime mutation 绝不触发。
3. 继续把 Replay 与 Diagnosability 的必需材料要求反馈给**唯一共享 Trace Profile**的评审；不要为训练新增一份相同事件的权威 `TrainingTrace`。

**本阶段未修改 `ca-agent`、`ca-dsh` 或 Runtime Producer。** 已明确证明现有 ProductTask Owner 归档有更多可复现信息，优先利用它们，不盲目补数据字段。
