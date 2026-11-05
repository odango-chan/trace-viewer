# D1.5 — DSH Skill / Reference 可见性与 Replay Snapshot Golden

**结果：SOURCE-ONLY OWNER SNAPSHOT GOLDEN PASS；FULL DSH AGENT LOOP NOT_RUN；L0 PARTIAL。**
**日期：2026-11-05**
**Owner：私有 \`odango-chan/ca-dsh\`，不触发真实模型、Tool/Runtime mutation 或 5GC**
**证据：[ca-dsh synthetic owner-builder CI PASS](https://github.com/odango-chan/ca-dsh/actions/runs/41983666046)**
**源：[src/trajectory.ts](https://github.com/odango-chan/ca-dsh/blob/main/src/trajectory.ts) / [owner test](https://github.com/odango-chan/ca-dsh/blob/main/tests/trajectory-skill-golden.ts) / [full Agent Loop focused test](https://github.com/odango-chan/ca-dsh/blob/main/tests/agent-loop.spec.ts)**

## 1. 为什么换路径

此前 [ProductTask 两份真实 Model→Tool→Model](agent-replay-archive-audit.md) 归档已独立证明：模型两次请求/响应快照摘要、内嵌在 user Prompt 的当次 Tool Catalog/Owner Surface 摘要、ToolResult/下一轮 Model 的 exact ref+body 均匹配；在这条 ProductTask 路线上 Skill/Reference 并非 Model 决策的必需输入（N/A）。

**不能把 ProductTask 的 N/A 等同于 Skill-dependent Agent 也能 Replay。** DSH 有独立的 DSH Session Event 源与 \`ModelInputSnapshot\` Builder；该模式需要严格证明加载结果确实在模型可见 Surface，且 Reference 内容不能凭读取请求存在而宣称被模型看到。

## 2. 本轮执行过的范围

保持 \`ca-dsh/src/trajectory.ts\` **不变**，只补测试。Owner 代码已经实现：

- 从 native DSH Session Event 中找 \`request/header\` 和 dispatch boundary；
- 按 \`session.surface.nodes\` 选择当时模型可见消息；取源 \`seq\`、\`toolCatalogDigest\`、\`surfaceDigest\` 和 \`contentDigest\`；
- 对 \`EXECUTION\`，按 \`callId\` 将 \`ca_load_skill\` 的 Tool Call/Result 连接；**仅当结果在模型可见 Surface 内**时，生成 \`skillLoadRequestRef\` / \`skillLoadResultRef\`；
- 普通 \`ca_read_reference\` ToolResult 不形成第二份 Replay 契约：它作为实际可见的 \`tool/result\` 进入 \`visibleMessageRefs/sourceEventSeqs/surfaceDigest\`；失去可见性时不再作为输入证据。

### 独立 CI 检验：PASS（合成原生事件结构，真实 Owner Builder）

\`tests/trajectory-skill-golden.ts\` 使用可读、完全合成的 DSH-shaped 事件驱动真实 \`src/trajectory.ts\` 函数，并通过另一份 SHA-256 计算独立核对：

| 验证目标 | 结果 |
|---|---|
| Provider/Model ID、native Session/source event refs | PASS |
| 模型 Tool Catalog 摘要与 \`request/header\` 一致 | PASS |
| \`ca_load_skill\` Call/Result 精确匹配 | PASS |
| 已加载的 Skill Result 必须在 effective visible Surface | PASS |
| \`ca_read_reference\` 结果的真实可见性与 surface digest | PASS |
| 不可见的 Reference 不被保留为模型可见输入 | PASS |
| 关联错的 Skill Result 不能声明注入 | PASS |
| ModelInput/ModelOutput \`contentDigest\` 独立复核 | PASS |

[本轮 CI](https://github.com/odango-chan/ca-dsh/actions/runs/41983666046) 实际输出 \`DSH_OWNER_BUILDER_SYNTHETIC_GOLDEN_PASS\`。运行脚本留在 Owner checkout，可直接用 \`npx --yes tsx@4.20.6 tests/trajectory-skill-golden.ts\`，不依赖私有 MCP SDK。

### 完整 DSH Agent Loop 测试：代码已补强，**本轮 NOT_RUN**

另在 \`ca-dsh/tests/agent-loop.spec.ts\` 既有真实 Agent Loop / \`SessionStore\` / Mock Model / Context API / MCP 测试中追加了：

- 原生 DSH \`tool/call\` 与 \`tool/result\` 的 \`callId\` 精确关联检查；
- Native Result 内容与 scripted Model 发送的第二轮真实可见输入一致性检查；
- request/header 工具目录与 \`ModelInputSnapshot.toolCatalogDigest\` 校验；
- 两类 Snapshot 自己的 \`contentDigest\` 独立重算；
- 从 Model-visible Surface 删除 Skill Result 后，不得再报告 Skill 已注入的 fail-closed 检查。

这部分依赖完整 DSH 及 linked \`../tool-mcp-gw\` SDK，不属于 source-only CI 所执行的内容。请使用 Owner repo 已有的 \`pnpm test\` / \`bash scripts/verify-local.sh --suite common\` 做正式验收。**不把另一个轻量 GitHub job 的 PASS 提升成整套 DSH Owner / cross-Host PASS。**

## 3. 对 L0/L1/L2 和可学习要求的实质影响

| 能力 | 验证结果 | 剩余缺口 |
|---|---|---|
| **L0 Owner 的 dispatch-time Snapshot 生成规则** | **Builder 级 PASS**（synthetic input） | 真实 DSH Session 全套集成未在本轮验收、持久化后重开未证明 |
| **Skill 是否注入模型可见消息** | **source-only Builder PASS**；完整 Owner Loop 断言已补，**NOT_RUN** | Skill Content 及 Context Owner 内容摘要是否能从权威来源独立验真 |
| **Reference 能否追到模型实际可见消息** | **source-only PASS**（普通 \`tool/result\`） | Reference 原始材料版本/内容摘要、Owner 结果/授权、DSH 持久化重开 |
| **L1 模型再执行** | NOT_RUN | 冻结模型/provider revision、配置/adapter defaults 与授权输入 |
| **L2 完整 Agent/Tool Stub 控制流重演** | NOT_RUN | 本次只做 Snapshot Builder 及否定验收，没有重跑 Engine |
| **用于训练/自学习** | NOT_QUALIFIED | 需要 L0 owner-native 材料闭包 + 使用权限 + 独立 Oracle/评估/质量标签 |

**不要因为 snapshot \`contentDigest\` 正确，就声称所有被引用的 Skill/Reference 内容和 Provider 网络请求已经落盘。** Snapshot hash 覆盖 Snapshot 元数据，具体文本内容必须经由原生 SessionEvent/受控 Owner Material 可以复原，且持久化重开后能重新比对。用户可见最终请求与真正的 provider-wire payload也可能不同。

## 4. 下一步唯一推荐闭环

**在正式 DSH Owner 环境里执行既有 \`agent-loop.spec.ts\`（已增强），然后做一次 Session 持久化 → 重新打开 → 再构建 ModelInputSnapshot 的内容/摘要/Source-ref 对照。** 若复开成功且 Skill/Reference 结果确实包含在有效输入，再进行安全的 L2 Tool stub 控制流重演。

这不是新 Trace Contract，也不应在 Viewer 做额外的伪装 Provider/DSH 的输入拼装。共享 Trace Profile 最终只需要引用准确的 ModelInputSnapshot、native Source refs 及经授权的 Material。
