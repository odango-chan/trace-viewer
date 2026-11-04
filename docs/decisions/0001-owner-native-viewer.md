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

## Consequences

+ 能独立进化 UI，减少两个旧仓的展示耦合。
+ 任何 View 都可以追到确切 owner/material identity，异常和证据缺失如实显示。
- 一些跨 owner 因果边只有 owner 补齐 correlation 才能显示；Viewer 不猜。
- D0 的合成样本不具验收资格，D1/D2 仍需专门的 adapter/test。
