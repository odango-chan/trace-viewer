# Trace Viewer · Agent 工作规则

## 责任与范围

本仓的**既有运行代码**只拥有只读 Web Viewer、源格式 Adapter、展示投影、合成 Fixtures、浏览器交互与本仓测试。当前新增的跨仓 [Unified Trace v0.2 草案](docs/specs/unified-trace-v0.2.md) 是**候选规范设计工作**，不意味着本仓拥有 Runtime/Agent 的业务真值或已获授权改造其他仓。它**不拥有** Agent/Model 的真实输入输出、Runtime terminal、Tool 权限、Harness 决策、Fabric/Provider/5GC 状态或 Evidence 认证结果。

保留 CA Console 中受 DeepSeek-style Harness / DSH Agent Session Trajectory 启发的阅读体验：Turn → Model Interaction → Tool Interaction → Runtime Gates/Execution/Outcome/Evidence/Reconcile/Delivery，正常折叠、异常优先展开。确定性 Procedure Flow 是**并列下钻**，不得取代 Agent 轨迹。

## 开发前阅读顺序

1. `README.md`、`docs/specs/unified-trace-v0.2.md`（**当前唯一候选规范**，先设计后实现；v0.1 为历史草案）、`docs/README.md`
2. `docs/WORK.md`（当前状态）、`docs/TRACEABILITY.md`（实现→测试→证据）
3. `docs/architecture/ownership.md`
4. `docs/contracts/trace-inputs.md`（D1/D2 输入格式与验证前置要求）
5. `docs/design/trace-debuggability-audit.md`（诊断使用者主验收）和 `docs/design/console-prototype-parity.md`（Console Demo 的展示语义基线，不是 owner 机器契约）、`docs/design/otel-genai-mapping.md`、`docs/experiments/phoenix-otel-poc.md`（候选规范与合成实测，不是新的 Source authority）
6. `docs/design/trajectory-viewer.md`、`docs/design/source-adapters.md`
7. 变更页面前读现有 `site/` 和 `tests/`

上游基线：
- CA Console: https://github.com/odango-chan/ca-console/blob/main/docs/design/tasks-and-runs.md
- CA Console prototype: https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-prototype.html
- Exception prototype: https://github.com/odango-chan/ca-console/blob/main/docs/examples/trajectory-anomaly-prototype.html
- Agent Demo: https://github.com/odango-chan/ca-agent-demo/blob/main/docs/design/run-trace.md
- Skill Studio: https://github.com/odango-chan/ca-skill-studio-demo

## 本阶段工作边界（2026-11-05）

- **先评审统一规范，再实现**。当前只编辑 `docs/specs/unified-trace-v0.2.md` 及索引/决策说明；不得因为规范讨论自动推进 DSH、Agent Demo、Runtime、Console Producer、Replay Engine 或新的多格式 Adapter。
- 旧 D1/D2 计划和 ADR-0001 适用于**已实现 Viewer**；它们不是未来统一 Trace 机器格式的既定约束。现有业务事实的真实性、安全性不得因重设计而牺牲。
- 未经明确评审，不冻结 OTLP / Phoenix、存储文件格式、机器 Schema、跨 Owner 的唯一权威数据模型。

## 不可违背

- Owner-native records / exact ids、revision、local sequence、material digest、explicit causal refs 永远保留；Viewer 的 card/step/fold/order 是派生 UI，不是新的 canonical event。
- 禁止根据 timestamp、相邻顺序、相似 payload 推断跨 owner 因果；缺证据显示 `UNAVAILABLE` / `UNRESOLVED`，不猜。
- 三态、operation outcome、mutation certainty、Runtime terminal、外部 disposition 各自保留，不折叠为一个 SUCCESS。
- 不能显示 hidden chain-of-thought；敏感模型输入、标识符、token、raw NF payload 不得进 public fixtures / GitHub Pages。UI 接受本地文件时只在浏览器处理，不上传、不发请求，严格限制尺寸/格式和危险内容。
- 任何 Mock/Synthetic 都必须显著标注，测试通过不等于 live network E2E。
- 不新增 CreatedSession/SSC/Fabric 专有的公共展示规则；仅 Adapter 识别现有 owner contract。
- Viewer 只读：不触发 Model/Tool/Skill、Runtime mutation 或 5GC 网络请求；不提供假控制按钮。
- 不改其他仓、不自动合并跨仓变更；没有用户授权不调用真实执行环境。

## 技术与测试

使用 Node.js 24。默认浅色、紧凑现代 UI。前端初始技术栈参考 Skill Studio 的 React/TypeScript/esbuild；后续大图可引入 React Flow + ELK，不凭空创造流程 Node。

本地：
~~~bash
npm install
npm test
npm run typecheck
npm run build
git diff --check
~~~

测试实际未执行时必须写 NOT_RUN；CI、Browser、Pages、Live 各自区别记录。浏览器验收只证明 UI，不代表 Runtime 真值。

## 文档与 Issues

README 只做入口；`docs/WORK.md` 唯一当前状态；`docs/TRACEABILITY.md` 将规范映射到代码/测试/验收；一个主题一个 canonical 设计正文。可执行缺陷优先 Issue，附 owner、observed locator、expected、acceptance。禁用平行的 latest/final/v2 文档副本。缓存和临时文件放 `.agent-tmp/`，不清理其他用户资源。
