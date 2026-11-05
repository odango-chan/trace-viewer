# ADR-0001: Owner-native, read-only Trace Viewer

**Date: 2026-11-04 · Status: Accepted for initial architecture**

## Context

CA Console 已有 DSH-inspired Agent Trajectory、Model/Tool fold、Runtime stage 和异常恢复原型；Agent Demo 已有 TraceRun v2、frozen Procedure lineage、TraceStore/Inspector。创建独立 Viewer 时，不能把两者粗暴压成另一个拥有 outcome 语义的数据库，更不能以 CreatedSession 流程图取代原有 Model/Tool/Harness 轨迹。

## Decision

1. Viewer 是静态只读 consumer；owner-native typed records 和 exact refs 为真源。
2. Presentation Model 只保存 UI grouping/selection，不能作为外部 API 的执行事实。
3. 第一个 D0 用明显的 synthetic data 检验 Turn/Tool/Runtime 的阅读体验。
4. 后续按真实 owner 的原始 envelope 分别实现 Adapter，不构造单一可逆的 `UnifiedTrajectoryEvent` contract。
5. DSH style normal-fold/anomaly-expand 保留为默认；确定性 Procedure 是并列视图。
6. 逐步接入 Agent Demo 和 Console，不要求两个 owner 先迁移到同一个 Trace Schema。

## 2026-11-05 范围说明（不是自动废止）

本 ADR 的 Accepted 决策仍描述 **D0–D1 已实现 Viewer 的历史架构**。其中第 4、6 项（长期按各原生格式增加 Adapter、不要求 Producer 统一）与现在的 [Unified Trace v0.2 候选设计](../specs/unified-trace-v0.2.md) **存在方向冲突**。**不能悄悄把 Accepted ADR 当作新规范的永久约束，也不能在 v0.1 尚未批准时宣布 ADR 已被取代。**

统一规范评审通过后应专门作出决策：保留只读 Viewer/权威事实来源边界，重新评估第 4、6 项；明确是否以一套统一 Trace Profile 替换长期多输入 Adapter 路线。当前仅记录冲突，不修改 Producer 或既有 Viewer。

## Consequences

+ 能独立进化 UI，减少两个旧仓的展示耦合。
+ 任何 View 都可以追到确切 owner/material identity，异常和证据缺失如实显示。
- 一些跨 owner 因果边只有 owner 补齐 correlation 才能显示；Viewer 不猜。
- D0 的合成样本不具验收资格，D1/D2 仍需专门的 adapter/test。
