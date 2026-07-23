---
name: specpowers-apply
description: Use when entering the implementation phase of a specpowers workflow. Triggered after specpowers-plan completes, or when user says "implement the plan" or "execute TDD tasks".
---

# specpowers-apply: 实现阶段

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers:specpowers"})` 加载入口 skill，获取全局规则。等待加载完成后继续。
> 2. 确认 Plan 模式：若 Plan: tiny → 跳过 plan 存在检查（微小任务无 plan，直接审查变更文件）；否则 → 确认 `docs/superpowers/plans/<name>.md` 存在。如不存在，回 specpowers-plan 生成 plan。
> 3. 确认 Plan 审查 Gate 已通过（非 tiny 模式，询问已执行，见 specpowers-plan Phase 2 "Plan 审查 Gate"）。如未询问，回 specpowers-plan 完成 Gate 后再进入。
> 4. 如当前模式为微小任务，仍须加载 specpowers-review 执行 Gate 3 审查（走 specpowers-review 内部级联判定路径）。

**REQUIRED SUB-SKILL:** Skill({skill: "superpowers:subagent-driven-development"})
**REQUIRED BACKGROUND:** Skill({skill: "superpowers:test-driven-development"})

---

## 执行模式硬约束

> **主 Agent 不得内联串行执行 task。** 必须按 `subagent-driven-development` 流程：每个 task 分发独立子 Agent 执行，子 Agent 拥有新鲜上下文。

| Plan mode | 执行方式 |
|-----------|---------|
| 微小 | 单个子 Agent 直接执行，跳过逐 task 审查 |
| 中等 / 复杂 | subagent-driven-development 完整流程 |
| 大规模 | Workflow 编排，每个 task 仍为独立子 Agent |

**长上下文下的内联诱惑**: 主 Agent 在开始实现前自检以下合理化——

| 如果你在想… | 实际后果 |
|------------|---------|
| "上下文已加载，直接做更快" | 50+ 轮后的主 Agent 更容易遗漏 TDD 步骤、跳过边界测试 |
| "子 Agent 浪费 token" | 串行执行 10 个 task 的累积 token 消耗 > 10 个独立子 Agent 的总和 |
| "我自己来更省事" | 第 8-10 个 task 因上下文过载，质量断崖下降 |

**违规检测**: 发现自己在内联执行（非子 Agent 方式）→ 立即停止，将已写代码移入子 Agent 重新开始。

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

**Step 0 — 计算变更规模**:
执行以下命令获取文件数和修改总行数：
```bash
BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|origin/||'); BASE=${BASE:-master}; git diff --shortstat $(git merge-base $BASE HEAD)..HEAD
```
输出格式为 `N files changed, A insertions(+), D deletions(-)`。
> **降级声明**: 若无 git 历史可用（如新项目/新 clone 未 fetch），回退为手动估算文件行数（与 review 独立调用同款降级策略）。
计算修改总行数 = additions + deletions：
```bash
BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|origin/||'); BASE=${BASE:-master}; git diff --shortstat $(git merge-base $BASE HEAD)..HEAD | awk '{print $4+$6}'
```
将文件数和修改总行数传入 specpowers-review Skill 调用。

审查 tier 由 specpowers-review 内部三级路由矩阵自动判定（轮数×规模×行数地板→快速/关键/完整），apply 传入 file_count + line_count，review 返回 `[TIER_ROUTING] expected_steps=[...]`。

### code-review（Gate 3 代码类路径）

代码类所有 tier（完整/关键/快速）均由本技能执行 code-review。code-review 执行结果由 specpowers-review 在 STEP1 中作为对齐 Agent 输入上下文；其他 STEP（STEP3-5）由 review 内部 tier recipe 路由决定。代码类关键层 = 3 独立视角（code-review + 对齐 + 监督）、快速层 = code-review（轻量）。
1. 使用 `Skill({skill: "superpowers:requesting-code-review"})` 加载代码质量审查
2. 审查维度：命名、结构、错误处理、代码风格
3. 通过标准：无 P0 问题
4. code-review 和 spec-compliance-check（对齐检查）两者均通过方可进入 Phase 4

**Step 1 — 执行审查**:
`Skill({skill: "specpowers:specpowers-review", args: "Gate 3, file_count=<N>, line_count=<N>, code-review 结果见上下文"})` — 对齐检查：代码 vs Phase 2 plan + Phase 1 specs + Phase 0 design。将 file_count、line_count、code-review 结果作为上下文注入 review 的对齐 Agent prompt。

**Gate 3 返回后，执行以下验证（不可跳过）**:

> 执行入口 `specpowers:specpowers` SKILL.md「Gate 返回后验证协议（横切）」节（参数：Gate=3, Phase=3）。本 Gate 特化：Gate 3, Phase 3, **tiny 不跳过——仍跑 Gate 3 验证**（验证 0 所有模式均继续，与 design/plan 的 tiny 跳过策略不同）。

> **设计说明 — STEP_FINAL_READTHROUGH 不在此验证范围内**: 最终通读 Gate 是 specpowers-review 的内部横切 Gate，非 Phase 0-4 Gate 体系的组成部分。父技能仅验证 TIER_ROUTING.expected_steps 声明的 STEP 集，不跨边界验证 specpowers-review 的内部 Gate。（设计说明见本节——STEP_FINAL_READTHROUGH 是 review 内部横切 Gate，父技能不跨边界验证）

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
> 在 Gate 3 代码类路径中由对齐 Agent 自动执行，不再由本技能手动执行。
> 微小任务模式下，本协议仍由本技能手动执行。
```

**横切提醒**: 提交前核对 specpowers entry skill 中的 Checklist（Post-Task）+ GitLab Flow 分支策略。

> **下一步**: Gate 3 通过后加载 `specpowers-archive`（Phase 4 硬 Gate 链归档）。
