---
name: specpowers
description: >
  Use when starting any non-trivial development task (>5 files, multi-step, team project)
  that requires both requirements alignment AND engineering discipline.
  Use when the user mentions: "start new feature", "SDD+TDD workflow",
  "apply OpenSpec tasks", "/specpowers",
  "engineering development with specs",
  "OpenSpec and Superpowers together".
  Do NOT use for: single-file bugfixes without existing OpenSpec specs,
  typo corrections, one-off scripts, pure configuration changes.
---

# specpowers: SDD+TDD 工程化开发方法论

## 概述

specpowers 融合 OpenSpec（规范驱动开发）+ Superpowers（测试驱动纪律）+ Checklist/Hooks（自动化检查）：

- **OpenSpec** 防止需求偏离（做了不需要的东西）
- **Superpowers** 防止实现缺陷（需要的东西做错了）
- **specpowers** 防止两者脱节：通过衔接指令集（bridge）将 OpenSpec 产物转换为 Superpowers 输入

### 职责分工

| 维度 | OpenSpec | Superpowers | specpowers（衔接阶段） |
|------|----------|-------------|---------------------|
| 回答的问题 | 做什么、为什么做 | 怎么做、按什么标准 | 何时切换、如何衔接 |
| 核心产物 | proposal/design/specs/tasks | 代码/测试/审查报告 | checklist/hooks/bridge |

> 当前架构：1 入口 + 5 子技能（design/plan/apply/review/archive）。

## 技能组结构

specpowers 是一个 **1 入口 + 5 子技能（覆盖 Phase 0-4）**的技能组，按 Phase 按需加载：

| 技能 | Phase | 加载时机 |
|------|-------|---------|
| **specpowers**（本技能） | 全局 | 任务开始时触发，决策模式+路由 |
| **specpowers-design** | Phase 0+1 | brainstorming 前置+设计+propose 阶段 |
| **specpowers-plan** | Phase 2 | 衔接阶段 |
| **specpowers-apply** | Phase 3 | 实现阶段 |
| **specpowers-review** | 审查（横切，不绑定特定 Phase） | 三级路由（按轮数×规模：快速/关键/完整审查） |
| **specpowers-archive** | Phase 4 | 验证+归档阶段 |

## 启动协议

```
□ 流程设计: 根据下方决策树确定本次任务执行模式（微小/中等/复杂/大规模）
□ 持久化计划: 将执行模式写入会话上下文（如 Plan: <mode>），后续每阶段开始校验
□ 审查级别: 审查级别将在 Gate 执行时由 specpowers-review 根据实际 file_count/line_count/round 动态确定（无需预存）
□ 子代理上下文: 如需子代理，将对应阶段的 task + spec 填充到子代理独立上下文
□ 阶段校验: 每 Phase 完成后：输出是否完成？下阶段是否调整？是否偏离计划？复杂度是否超过初始判断（如需升级，更新 Plan: <mode>）？
□ 并发检查: 多 Agent 任务时，确认目标文件未被其他 Agent 修改后再写入
```

### 子 Agent 启动方式（全局硬约束）

**必须使用后台子 agent，禁止 teammate 方式。**

```
✅ Agent({run_in_background: true, prompt: "..."})  // 不指定 name，通过 task-notification 获取结果
❌ Agent({name: "xxx", ...}) + SendMessage           // mailbox 不可靠，agent 可能不返回报告
```

适用于所有子技能的子 Agent 启动。

## 执行模式选择

**specpowers 标准流程（SDD+TDD, Phase 0-4）是所有任务的骨干流程**。
已触发 specpowers 后按本决策树选择执行模式。微小任务为 specpowers 内部退化模式。
Description 层的 Do NOT use 为第一层过滤，本决策树为第二层路由。

```
├── 微小任务（1-3 文件，< 50 行变更，单模块，不涉及接口/配置/跨文件）
│   ─ 或: 功能已有现有实现、仅需增量修改
│   ├── Phase 0: 轻量上下文探索（Read 目标文件确认功能状态）
│   ├── Phase 1: 跳过
│   ├── Phase 2: 跳过
│   ├── Phase 3: 子代理直接执行
│   ├── Phase 4: 跳过
│   ⚠ 4+ 文件或跨模块 → 升为中等任务（4 文件归中等，中等范围 4-19）
│
├── 中等任务（4-19 文件）← specpowers 默认
│   ├── Phase 0: brainstorming 完整流程（需求澄清+方案设计+审批 Gate）
│   ├── Phase 1: propose 格式转换+强制对照验证
│   ├── Phase 2: writing-plans 衔接 + Plan 审查 Gate
│   ├── Phase 3: TDD 逐 task 执行
│   ├── Phase 4: 硬 Gate 链归档
│
├── 复杂任务（20+ 文件，跨模块）
│   ├── Phase 0: brainstorming 完整流程
│   ├── Phase 1: propose 格式转换+强制对照验证
│   ├── Phase 2: 中等模式用 writing-plans；复杂/大规模可由用户手动触发 UltraPlan（用户可手动加载 refs/ultraplan-*.md）/ Workflow，plan skill 本身仅覆盖中等模式
│   ├── Phase 3: TDD + 子代理
│   ├── Phase 4: 硬 Gate 链归档
│   容错: UltraPlan 不可用 → 降级中等任务
│
└── 大规模任务（50+ 文件）
    ├── Phase 0: brainstorming 完整流程
    ├── Phase 1: propose 格式转换+强制对照验证
    ├── Phase 2: 中等模式用 writing-plans；复杂/大规模可由用户手动触发 UltraPlan（用户可手动加载 refs/ultraplan-*.md）/ Workflow，plan skill 本身仅覆盖中等模式
    ├── Phase 3: Workflow 编排子代理
    ├── Phase 4: 硬 Gate 链归档
    容错: Workflow 不可用 → 降级复杂任务
```

**运行时升级**: 每 Phase 完成时复查复杂度——如实际文件数/跨模块范围超出初始判断，更新 `Plan: <mode>` 并重新路由到下阶段对应模式。

## 阶段路由

完成模式选择后，按当前 Phase 加载对应子技能。

### Phase 自动检测（跨会话恢复）

入口技能按以下产物状态自动判定当前 Phase。行按从上到下顺序求值，首次匹配即停止。`<name>` 由当前任务上下文获取。

| 产物状态 | Phase 判定 | 加载技能 |
|---------|-----------|---------|
| `docs/superpowers/clarifications/<name>.md` 存在，`docs/superpowers/specs/<name>-design.md` 不存在 | Phase 0 中途 | specpowers-design |
| `docs/superpowers/plans/<name>.md` 存在 | Phase 2 完成 | specpowers-apply (Phase 3) |
| `.superpowers/.phase1-skipped` 存在 | Phase 1 已跳过 | specpowers-plan (Phase 2) |
| `docs/superpowers/clarifications/<name>.md` + `docs/superpowers/specs/<name>-design.md` 存在，`openspec/changes/<name>/` 不存在 | Phase 0 完成 | specpowers-design |
| `openspec/changes/<name>/` 存在 | Phase 1 完成 | specpowers-plan (Phase 2) |

**微小任务不加载子技能** — 直接在入口 skill 上下文中子代理执行。

> 注：微小任务不加载 design/plan/apply/archive 业务子技能，但 specpowers-review（审查横切）仍加载执行 Gate 3（见 specpowers-apply 前置检查）。

| 当前 Phase | 模式 | 加载 | 命令 |
|-----------|------|------|------|
| Phase 0 | 中等+ | specpowers-design | `Skill({skill: "specpowers:specpowers-design"})` |
| Phase 1 | 中等+ | specpowers-design | `Skill({skill: "specpowers:specpowers-design"})` |
| Phase 2 | 中等+ | specpowers-plan | `Skill({skill: "specpowers:specpowers-plan"})` |
| Phase 3 | 中等+ | specpowers-apply | `Skill({skill: "specpowers:specpowers-apply"})` |
| 审查 | 代码类（由 specpowers-review 内部三级路由自动判定：快速/关键/完整审查）或 文档类 或 用户手动触发 | specpowers-review | `Skill({skill: "specpowers:specpowers-review"})` |
| Phase 4 | 中等+ | specpowers-archive | `Skill({skill: "specpowers:specpowers-archive"})` |
| — | 微小 | 不加载子技能 | 入口 skill 中直接子代理执行。执行完毕后主 Agent 确认产物并输出完成摘要 |

> 横切规则（Git Flow、Checklist、Pitfalls）保留在本入口技能中，各阶段均需遵守。

## 审查路由

需要审查时，加载 `Skill({skill: "specpowers:specpowers-review"})`，由 specpowers-review 内部三级路由矩阵自动判定审查层级（按评审轮数×待评审物规模×行数地板路由到快速/关键/完整审查），防退化机制全部保留并为 tier 路由补充防护；用户可手动覆盖（快速/关键/完整审查）。

### 各模式映射

| 执行模式 | Phase 0 | Phase 1 | Phase 2 | Phase 3 | Phase 4 | 审查 |
|---------|---------|---------|---------|---------|---------|------|
| **微小** | 轻量上下文探索 | 跳过 | 跳过 | 子代理直接执行 | 跳过 | → specpowers-review 内部判定 |
| **中等** | brainstorming | 格式转换+对照 | 衔接+Plan Gate | TDD 逐 task | 硬 Gate 链 | → specpowers-review 内部判定 |
| **复杂** | brainstorming | 格式转换+对照 | UltraPlan | TDD+子代理 | 硬 Gate 链 | → specpowers-review 内部判定 |
| **大规模** | brainstorming | 格式转换+对照 | Workflow | Workflow+子代理 | 硬 Gate 链 | → specpowers-review 内部判定 |

## 适用场景

### 必须使用 specpowers
- 团队协作项目 / 长期维护项目 / 复杂功能开发
- 已有代码库的增量开发 / 跨会话的多步骤任务

### 只用 OpenSpec（不用 specpowers）
- 改按钮颜色、修 typo 等小改动 / 需求很明确

### 只用 Superpowers（不用 specpowers）
- 一次性脚本 / 需求明确但不需要长期规范的小功能

**判断标准**: 代码生命周期 × 协作人数。生命周期 < 1 天且单人 → 无需。生命周期 > 1 月且多人 → 完整 specpowers。

## 环境准备

| 工具 | 用途 | 检查命令 | 必选 |
|------|------|---------|------|
| **OpenSpec** | SDD | `openspec --version` | ✅ |
| **Superpowers** | TDD | `/skills` 含 `superpowers:*` | ✅ |
| **GitNexus** | AI 代码图谱 | MCP `mcp__gitnexus__query` | ⚠️ |
| **Understand-Anything** | 架构图 | `/understand` | ⚠️ |
| **TEST_COMMAND** | 全量测试 | 项目实际测试命令（见下方） | ⚠️ 需手动配置 |

> **TEST_COMMAND**: 在项目初始化时配置。specpowers-archive 全量测试门使用此命令。
> 如未配置，archive 会自动检测：`xmake build` → `make test` → `npm test`。

## Git Flow + Code Intelligence

### GitLab Flow（横切 — 所有 Phase 遵守）

```
master (main) ← 始终可部署
  └── feature/* ← 功能分支，MR/PR 合并
```

| 场景 | 分支策略 |
|------|---------|
| 新功能/Bug修复 | `feature/<name>` or `fix/<desc>` → MR |
| 仓库初始化 | 可在 main 直接操作 |

```json
// .claude/settings.json Stop Hook
{"hooks": {"Stop": [{"hooks": [{"type": "command",
  "command": "BRANCH=$(git branch --show-current); if [ \"$BRANCH\" = \"main\" ] || [ \"$BRANCH\" = \"master\" ]; then echo '[GIT-FLOW] 大型变更请切 feature 分支'; fi",
  "comment": "// Windows: 需 Git Bash 或改写 PowerShell"}]}]}}
```

### Code Intelligence

| 工具 | Phase 1 | Phase 3 修改前 | Phase 3 commit 前 | Phase 4 |
|------|---------|-------------|------------------|---------|
| **GitNexus** | `query` 理解代码 | `impact` 影响分析 | `detect_changes` 验证 | `detect_changes` 确认 |
| **Understand-Anything** | `/understand` 架构图 | — | — | 更新图谱 |

## Pre-Flight Check

首次使用 specpowers 的项目需配置以下项：

```
□ TEST_COMMAND: 全量测试命令（见上方环境准备节，如未配置 archive 自动检测）
□ QTDIR: Qt 项目需设置（如有）
□ openspec --version: 确认 OpenSpec CLI 可用
```

> 配置方式：在入口 skill 上下文或会话中手动定义。TEST_COMMAND 由 specpowers-archive Step 1 读取。

## Checklist + Hooks

### Pre-Task
```
□ 阅读 CLAUDE.md → openspec changes/ → 待办清单 → known-issues → 领域 SKILL → 主规范 → 基线测试
```

### Post-Task
```
□ known-issues / next-steps / memory / session-summary / CLAUDE+SKILL.md
□ git commit + push origin <current-branch>（遵循 GitLab Flow）
□ openspec validate + archive（如用 OpenSpec）（如 .superpowers/.phase1-skipped 存在则跳过 OpenSpec validate + archive）
```

## Gate 返回后验证协议（横切）

各子技能（design/plan/apply）在 Gate 返回后执行以下验证链。本协议为权威定义，子技能引用本协议并给出本 Gate 特化参数（Gate=N, Phase=N）。

```
验证链（按顺序执行，任一失败阻止后续）:

验证0: 执行模式检查
  - 微小任务(tiny): 跳过 design/plan 的 Gate 验证（Gate 3 除外——apply 中 tiny 仍执行验证 1/2）
  - 非微小任务: 继续验证1

验证1: 标记块完整性
  - 按 [TIER_ROUTING] expected_steps 动态检查 STEP<N>_EXECUTED 标记
  - 无 TIER_ROUTING 标记时回退旧逻辑（按 Phase 定义检查关键产物）
  - 预期步骤全部标记 → 通过; 缺少步骤 → 失败（列出缺失项）

验证2: P0 硬阻止
  - [GATE_BLOCKED] p0_count>0 → 阻塞，禁止继续
  - p0_count=0 → 通过
```

> 各子技能引用示例: "按入口 Gate 返回后验证协议执行验证链（Gate=1, Phase=1）：验证0→验证1→验证2。"

## 7 个常见 Pitfalls

| # | Pitfall | specpowers 解法 |
|---|---------|----------------|
| 1 | 跳过需求澄清 | 强制 Phase 0 brainstorming → Phase 1 propose 顺序 |
| 2 | 排除范围不全 | proposal 必须写排除范围 |
| 3 | 粒度不匹配 | 衔接阶段自动转换粒度 |
| 4 | 实现偏离设计 | design.md 注入 planning 输入 |
| 5 | 审查不管规范 | 双重审查（代码+规范） |
| 6 | verify 和审查二选一 | 强制两者都做 |
| 7 | archive 前不测试 | archive 前强制全量测试 |

## 故障排查

| 问题 | 处理 |
|------|------|
| verify 不通过 | 回 task + systematic-debugging |
| spec-compliance 不合规 | 代码错→修代码，规范过时→改 design.md |
| design.md 决策不合理 | 回 Phase 1 Step 3 人工审核 |
| 实现中需修改规范 | 暂停 Superpowers，回 OpenSpec 修改 |
| 多变更并行 | 独立 git worktree |
| UltraPlan 中途溢出 | `/clear` + 重新加载 openspec 产物 |
| 跨 session 中断 | > 跨会话中断恢复：按上述 Phase 自动检测表判定当前 Phase 和应加载技能。 |
| refs/ 缺失 | UltraPlan → 降级中等任务 |

## 快速上手

| 步骤 | 命令 | 详见 |
|------|------|------|
| brainstorming | `Skill({skill: "specpowers:specpowers-design"})`（Phase 0，需求澄清+方案设计） | specpowers-design |
| propose | `Skill({skill: "specpowers:specpowers-design"})`（Phase 1，格式转换+强制对照） | specpowers-design |
| Plan 审查 | 询问用户是否审查 plan（Phase 2 Gate） | specpowers-plan |
| 衔接 | "读取 openspec changes/, 用 writing-plans 拆 TDD 计划" | specpowers-plan |
| 实现 | `Skill({skill: "superpowers:subagent-driven-development"})`（每个 task 一个独立子 Agent） | specpowers-apply |
| 审查 | Skill({skill: "specpowers:specpowers-review"})（三级路由自动判定） | specpowers-review |
| 验证 | `openspec validate --change <name>` + test | specpowers-archive |
| 归档 | `/opsx:archive`（硬 Gate 链，禁止手动绕过） | specpowers-archive |

> 小改动无需 specpowers 全流程："帮我修复 xxx.cpp 的编译错误" → 直接子代理执行。

## 参考资源

| 资源 | 路径 |
|------|------|
| 入门指南 | `refs/onboarding.md`（本 skill 的 bundled resource） |
| 项目模板 | `refs/project-template.md`（本 skill 的 bundled resource） |
| UltraPlan 总览 | `refs/ultraplan-overview.md` |
| UltraPlan 代码专家 | `refs/ultraplan-code-expert.md` |
| UltraPlan 调研专家 | `refs/ultraplan-research-expert.md` |
| C/C++ 项目模板 | `refs/pkg-xmake-template.md`（仅 xmake 项目参考） |
