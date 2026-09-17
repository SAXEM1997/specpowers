---
name: specpowers-plan
description: Use when the user says "plan the implementation", "bridge OpenSpec to
  Superpowers", or when specpowers entry skill routes to Phase 2.
---

# specpowers-plan: 衔接阶段

> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-plan")`；`Skill({skill: "specpowers-plan"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-plan"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-plan"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。

> **前置检查（必须执行，不可跳过）**: 
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取决策树和全局规则（GitFlow/Checklist/Pitfalls）。等待加载完成后继续。
> 2. 确认 `docs/superpowers/specs/<name>-design.md` 和 `docs/superpowers/clarifications/<name>.md` 存在（由 specpowers-design 产出）。如不存在，输出 `[PRECHECK_FAILED] Phase 0/1 产物缺失，请先运行 specpowers-design`。
> 3. 如 `openspec/changes/<name>/` 不存在，OpenSpec 已跳过——以 design doc + clarifications 作为 Phase 2 writing-plans 唯一输入。
> 4. 检查 `docs/superpowers/plans/<name>.md` 是否已存在——若已存在，询问用户"plan 已存在，是否重新生成？（默认跳过，避免覆盖）"，用户确认跳过则直接进入后续（不重跑 writing-plans）。这是防御 Phase 自动检测行序错误的纵深保护。
> 5. **Gate 1 确认**：搜索会话上下文中 `[GATE_PASSED] gate=1` 标记，或检查 `.superpowers/.gate-passed-1` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 1 Gate 1 未执行，回 specpowers-design Phase 1 完成 Gate 1 后再进入 Phase 2。微小任务跳过此项。`.superpowers/.phase1-skipped` 存在时跳过此项（Phase 1 已跳过，Gate 1 未执行属预期行为）。

---

## Phase 2: 衔接阶段

> `<name>` 由 Phase 0 Step 0.3 定义，贯穿 Phase 0-4 全流程。Phase 2 中 OpenSpec change 目录名复用同一 `<name>`。

**REQUIRED SUB-SKILL:** Skill({skill: "writing-plans"})

### 核心原则

1. Phase 0 brainstorming + Phase 1 propose 已完成 → 跳过 Superpowers brainstorming
2. 跳过 OpenSpec apply → Superpowers TDD 更完整
3. 将 Phase 0 设计文档 + Phase 1 OpenSpec 产物全部加载为 Superpowers 上下文

### 衔接指令

```
读取以下文档，基于这些规范使用 Superpowers writing-plans 拆分实现计划：

1. docs/superpowers/specs/<name>-design.md → Phase 0 审批通过的设计
2. docs/superpowers/clarifications/<name>.md → 需求澄清真相源
3. openspec/changes/<name>/design.md → 技术方案
4. openspec/changes/<name>/specs/ → 测试依据
5. openspec/changes/<name>/tasks.md → 任务列表
6. openspec/changes/<name>/proposal.md → 审查边界

产物写入: docs/superpowers/plans/<name>.md
每个 task 拆为 TDD 步骤（4 阶段 6 子步）：
1. 写失败测试(RED) 2. 运行确认失败 3. 写最小实现(GREEN)
4. 运行确认通过 5. 重构(REFACTOR) 6. 提交(COMMIT)
```

### 粒度转换

| OpenSpec task | Superpowers plan task |
|--------------|----------------------|
| "实现 <feature> 核心函数" | 1 个 plan task, 6 个 TDD 步骤 |
| "添加依赖"+"定义结构" | 合并为 1 个（相邻小 task 可合并） |
| "实现 <multi-file-feature>"（多文件） | 拆为 2-3 个（粗粒度需拆分） |

### Plan 审查 Gate（Gate 2）

**衔接阶段完成后，强制执行 Gate 2 审查**：

`Skill({skill: "specpowers-review"})` — 对齐检查：plan vs Phase 1 OpenSpec specs + Phase 0 design。
Gate 2 返回后，执行 Gate 返回后验证协议（参数: Gate=2, Phase=2）。

验证链通过后（token 已写入 `.superpowers/.gate-passed-2`），执行节点出口守卫（中等+）：
node <SKILL_BASE>/scripts/workflow-guard.mjs exit phase2 --apply
（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）

**OpenSpec 跳过场景适配**: 如 openspec/changes/<name>/ 不存在（Phase 1 已跳过），Phase 2 writing-plans 衔接时使用以下简化输入集：
- docs/superpowers/specs/<name>-design.md
- docs/superpowers/clarifications/<name>.md

---

## Gate 验证协议

### Gate 返回后验证协议（Phase 2 Gate）

> 执行入口 `specpowers` SKILL.md「Gate 返回后验证协议（横切）」节（参数：Gate=2, Phase=2）。本 Gate 特化：Gate 2, Phase 2, tiny 跳过全部验证（验证 0 返回跳过）。

| Gate | Phase | 标记块检查方式 |
|------|-------|-------------|
| Gate 2 | Phase 2 | 按 `[TIER_ROUTING] expected_steps` 动态检查；无 TIER_ROUTING 回退 STEP1-5 |

> **注**: Gate 3 验证由 specpowers-apply 负责（见 specpowers-apply SKILL.md 的 "审查（Gate 3）" 节）。本表仅覆盖 specpowers-plan 管辖的 Phase 2 Gate。Phase 0/1 Gate 对应协议见 specpowers-design。

> **下一步**: 完成后，加载 `specpowers-apply` 进入 Phase 3（实现阶段）。
