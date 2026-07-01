---
name: specpowers-plan
description: Use when the user says "plan the implementation", "bridge OpenSpec to
  Superpowers", or when specpowers entry skill routes to Phase 2.
---

# specpowers-plan: 衔接阶段

> **前置检查（必须执行，不可跳过）**: 
> 1. 确认 specpowers 入口 skill 的全局规则（GitFlow/Checklist/Pitfalls）已在当前会话上下文中可用。如未加载，先 `Skill({skill: "specpowers"})` 获取决策树和全局规则。等待加载完成后继续。
> 3. 确认 `docs/superpowers/specs/<name>-design.md` 和 `docs/superpowers/clarifications/<name>.md` 存在（由 specpowers-design 产出）。如不存在，输出 `[PRECHECK_FAILED] Phase 0/1 产物缺失，请先运行 specpowers-design`。
> 4. 如 `openspec/changes/<name>/` 不存在，OpenSpec 已跳过——以 design doc + clarifications 作为 Phase 2 writing-plans 唯一输入。

---

## Phase 2: 衔接阶段

> `<name>` 由 Phase 0 Step 0.3 定义，贯穿 Phase 0-4 全流程。Phase 2 中 OpenSpec change 目录名复用同一 `<name>`。

**REQUIRED SUB-SKILL:** Skill({skill: "superpowers:writing-plans"})

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
Gate 2 返回后，执行 Gate 返回后验证协议（参数: Gate=2, Phase=2, 标记块=STEP1-5）。

### 场景→测试转换

| 场景类型 | 测试 |
|---------|------|
| 正常路径 | Given 有效输入 When 执行 Then 期望输出 |
| 错误路径 | Given 异常输入 When 执行 Then 期望错误 |
| 边界值 | Given 边界条件 When 执行 Then 期望行为 |

**OpenSpec 跳过场景适配**: 如 openspec/changes/<name>/ 不存在（Phase 1 已跳过），Phase 2 writing-plans 衔接时使用以下简化输入集：
- docs/superpowers/specs/<name>-design.md
- docs/superpowers/clarifications/<name>.md

---

## Gate 验证协议

### Gate 返回后验证协议（Phase 0-2 Gate 通用）

对于 Gate <N>（对应 Phase <N>），specpowers-review 返回后执行以下验证：

**验证 0 — 执行模式检查**:
读取会话上下文中的 `Plan: <mode>`:
- mode === "tiny" → 跳过全部验证
- mode !== "tiny" 或 Plan mode 不存在 → 继续验证 1 + 验证 2
降级: 若 Plan mode 不存在，默认视为非 tiny，输出 `[WARNING] Plan mode 未设置` 后继续完整验证。

**验证 1 — 执行标记完整性检查**:
在 specpowers-review 返回的审查报告中搜索以 ```STEP<N>_EXECUTED 开头的 fenced code block。
缺失任一块 → `[VERIFY_FAIL] Gate <N> 审查执行不完整，阻塞 Phase <N>`。
搜索未命中任何标记块 → `[VERIFY_FAIL] Gate <N> 审查 Agent 未正常执行（无任何执行标记），阻塞 Phase <N>`。

**验证 2 — P0 硬阻止检查**:
搜索 `[GATE_BLOCKED] p0_count=N`:
- N > 0 → `[VERIFY_FAIL] Gate <N> 未通过（P0=N），阻塞 Phase <N>`
- N = 0 且验证 1 通过 → Gate <N> 通过

> **设计说明 — STEP_FINAL_READTHROUGH 不在此验证范围内**: 最终通读 Gate 是 specpowers-review 的内部横切 Gate（由 specpowers-review 主 Agent 在 Step 5 后自行启动），非 Phase 0-4 Gate 体系的组成部分。父技能（specpowers-plan / specpowers-apply）仅验证各 Gate 对应的 STEP1-STEP5 标记块，不跨边界验证 specpowers-review 的内部 Gate。specpowers-review 的独立调用自检中已包含 STEP_FINAL_READTHROUGH 的存在性检查（见 specpowers-review SKILL.md "独立调用场景自检" 节），确保其在独立调用场景下不被遗漏。

**各 Gate 特化参数**:

| Gate | Phase | 应存在标记块 |
|------|-------|-------------|
| Gate 2 | Phase 2 | STEP1, STEP2, STEP3, STEP4, STEP5 |

> **注**: Gate 3 验证由 specpowers-apply 负责（见 specpowers-apply SKILL.md 的 "审查（Gate 3）" 节）。本表仅覆盖 specpowers-plan 管辖的 Phase 0-2 Gate。Gate 4 由 specpowers-archive 内部 hard gate 链处理，不在本验证协议范围内。

> **下一步**: 完成后，加载 `specpowers-apply` 进入 Phase 3（实现阶段）。
