---
name: specpowers-apply
description: Use when entering the implementation phase of a specpowers workflow. Triggered after specpowers-plan completes, or when user says "implement the plan" or "execute TDD tasks".
---

# specpowers-apply: 实现阶段

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取全局规则。等待加载完成后继续。
> 2. 确认 `docs/superpowers/plans/<name>.md` 存在。如不存在，回 specpowers-plan 生成 plan。
> 3. 确认 Plan 审查 Gate 已通过（询问已执行，见 specpowers-plan Phase 2 "Plan 审查 Gate"）。如未询问，回 specpowers-plan 完成 Gate 后再进入。
> 4. 如当前模式为微小任务，跳过 specpowers-review Gate 体系。代码审查由本技能内部的审查协议（spec-compliance-check）直接执行（不触发 specpowers-review），TDD 纪律按需简化。不加载 specpowers-review。

**REQUIRED SUB-SKILL:** Skill({skill: "superpowers:executing-plans"})
**REQUIRED BACKGROUND:** Skill({skill: "superpowers:test-driven-development"})

---

## TDD 纪律

> 以下 4 阶段对应 specpowers-plan 中的 6 子步: RED=子步1-2, GREEN=子步3-4, REFACTOR=子步5, COMMIT=子步6。

```
RED    -> 写失败测试 -> 运行确认失败
GREEN  -> 写最小实现 -> 运行确认通过
REFACTOR -> 重构 -> 运行确认仍通过
COMMIT -> git commit
```

**规则: 测试未通过前不得编写实现代码；测试通过后方可提交。**
**产出隔离**: 测试和验证阶段的产出保存到任务指定的输出目录。如任务为设计+测试而未要求实现，只写测试和设计文档，不修改项目源文件。

**测试用例数指引**: 单文件 ≤ 5 用例（正常+边界+错误路径）；复杂功能每 scenario ≤ 2 用例。

---

## 审查（Gate 3）

实现完成后，执行 Gate 3 审查：

`Skill({skill: "specpowers-review"})` — 对齐检查：代码 vs Phase 2 plan + Phase 1 specs + Phase 0 design。

审查类型由 specpowers-review 内部决策树自动判定：
- 微小任务：不触发 specpowers-review，由本技能内部审查协议（spec-compliance-check）执行
- 中等及以上 + 代码 < 10 文件：加强审查（code-review 由本技能执行 + 对齐检查由 specpowers-review 对齐 Agent 单 Agent 执行）
- 中等及以上 + 代码 ≥ 10 文件：完整 Gate 3 UltraReview（specpowers-review 的 5-agent 团队审查）

Gate 3 通过后进入 Phase 4。

---

### code-review（加强审查路径）

加强审查路径（代码 <10 文件）中，code-review 由本技能执行：
1. 使用 `Skill({skill: "superpowers:requesting-code-review"})` 加载代码质量审查
2. 审查维度：命名、结构、错误处理、代码风格
3. 通过标准：无 P0 问题
4. code-review 和 spec-compliance-check（对齐检查）两者均通过方可进入 Phase 4

---

## spec-compliance-check（手动对照协议）

```
规则: 实现代码必须与 openspec/specs/ 中的规范一致。任何偏差视为 bug。

步骤：
1. 读取 openspec/specs/ 主规范
2. 读取 openspec/changes/<name>/specs/ delta 规范
3. 逐条检查每个"假设/当/则"场景是否有对应实现
4. 检查 design.md 架构决策是否被遵守
5. 检查 proposal.md 排除范围是否被违反

输出格式（逐条输出，不可省略）：
[COVERED/MISSING/DRIFT] Requirement: <title> — <evidence>

> 注：本协议的核心检查逻辑已注入为 specpowers-review 对齐审查 Agent 的 prompt 模板。
> 在 Gate 3 加强审查路径中由对齐 Agent 自动执行，不再由本技能手动执行。
> 微小任务模式下，本协议仍由本技能手动执行。
```

**横切提醒**: 提交前核对 specpowers entry skill 中的 Checklist（Post-Task）+ GitLab Flow 分支策略。

> **下一步**: Gate 3 通过后加载 `specpowers-archive`（Phase 4 硬 Gate 链归档）。
