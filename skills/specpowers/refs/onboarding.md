# 入门指南：从零起步与单框架迁移

## 从零起步（双框架都未使用）

如果 OpenSpec 和 Superpowers 都未使用过，建议分两步入门：

1. **第一个任务用完整 specpowers 标准流程**（中等任务模式），允许耗时 1.5x-2x，重点建立肌肉记忆
2. **每个 Phase 遇到问题时**，参考对应框架文档：OpenSpec 查 `/opsx:explore` 帮助，Superpowers 查 `/skills` 中的 skill 列表

> 不要跳过 Phase 0（需求澄清+方案设计）直接写代码——这是最常见的入门错误。

## 从单框架迁移到双框架

### 从 OpenSpec 起步（已有 SDD，补 TDD）

在下一个功能中加入 3 条 Superpowers 纪律：

（Superpowers 含 brainstorming/writing-plans/test-driven-development 等 skill，完整列表见 `/skills` 命令）

1. **没设计不写代码**: 将 design.md 注入 writing-plans 输入
2. **没测试不写代码**: 每个 task 遵循 RED-GREEN-REFACTOR
3. **没验证不说完成**: verify + 全量测试 + archive 三关

### 从 Superpowers 起步（已有 TDD，补 SDD）

在下一个复杂功能前引入 OpenSpec 规范对齐：

1. `brainstorming` — 需求澄清+方案设计
2. 手动生成 OpenSpec 四件套（design.md + specs + tasks + proposal.md，Phase 1 不使用 `/opsx:propose`）
3. 将 design.md 和 specs 加载为 Superpowers planning 上下文
