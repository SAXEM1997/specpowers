---
name: specpowers
description: >
  Use when starting any non-trivial development task (4+ files, multi-step, team project)
  that requires both requirements alignment AND engineering discipline.
  Use when the user mentions: "start new feature", "SDD+TDD workflow",
  "apply OpenSpec tasks", "/specpowers",
  "engineering development with specs",
  "OpenSpec and Superpowers together",
  "resume specpowers task", "continue previous workflow".
  Do NOT use for: single-file bugfixes without existing OpenSpec specs,
  typo corrections, one-off scripts, pure configuration changes.
---

# specpowers: SDD+TDD 工程化开发方法论

> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers")`；`Skill({skill: "specpowers"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。

## 概述

specpowers 融合 OpenSpec（规范驱动开发）+ Superpowers（测试驱动纪律）+ Checklist/Hooks（自动化检查）：

- **OpenSpec** 防止需求偏离（做了不需要的东西）
- **Superpowers** 防止实现缺陷（需要的东西做错了）
- **specpowers** 防止三者脱节，以状态机驱动 Phase 流转：通过衔接指令集（bridge）将 OpenSpec 产物转换为 Superpowers 输入

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
| **specpowers-review** | 审查（横切，不绑定特定 Phase） | 两级路由（按轮数×规模：关键/完整审查） |
| **specpowers-archive** | Phase 4 | 验证+归档阶段 |

## 启动协议

> **脚本路径解析（全技能组通用）**：本技能组可能从项目内（`skills/specpowers/`）或 plugins cache（插件缓存目录）加载。定义占位符 **`<SKILL_BASE>` = 技能基目录（加载本技能时显示的 Base directory；项目内安装即 `skills/specpowers/`，plugins cache 即插件缓存路径，如 `~/.claude/plugins/cache/<marketplace>/<plugin>/<hash>/skills/specpowers/`）**。下文所有 `node <SKILL_BASE>/scripts/...` 指令中的 `<SKILL_BASE>` 均须先替换再执行。脚本内部对 refs/ 技能资产按自身位置解析（不依赖 cwd）；`.superpowers/` 等项目状态路径仍相对应用项目根（cwd）。子技能（design/plan/apply/archive/review）被单独加载时，Base directory 显示的是子技能自身目录——`<SKILL_BASE>` 一律取**入口技能**基目录（即子技能目录的兄弟目录 `specpowers/`），不是当前加载技能的目录。

### Step 0：语义化意图检测（每次启动/恢复/压缩后执行）

1. **判定当前 Phase**：运行 `node <SKILL_BASE>/scripts/workflow-state.mjs status`。
   - 未初始化 → 进入 Step 1（首次启动）；但存在 name-keyed 产物/token（如 docs/superpowers/ 下 name-keyed 产物（clarifications/plans 下的 <name>.md 文件）、`.superpowers/.gate-passed-*`）→ 提示 `init --resume-artifacts`（不按全新任务处理）；**微小任务忽略此提示**（微小不 init state.json，缺失属预期，见 kernel-fusion 设计文档决策 3）
   - 已初始化 → 读 currentPhase + completedPhases + 持久化阻塞原因（对应脚本契约 status 输出的 BLOCKED_REASON 字段）
   - 脚本失败/缺失 → 回退到「Phase 自动检测（回退路径）」表，扫产物文件推断
2. **意图对齐**：从用户消息判定意图落点。意图超前 → 核对前序 Gate 文件，未过则回前序 Phase；意图回退 → `reset <phase>` 回退。
3. **文件证据最终裁决**：状态机先行判定，state.json 只是索引。最终裁判是 gate 文件（token）——`.superpowers/.gate-passed-<N>`（`name=` 行与当前 `<name>` 完全匹配才算数）；产物文件仅对回退路径与 phase4 有意义。

### Step 1：首次启动决策（只决策不 init）

1. 决策树判定模式（微小/中等/复杂/大规模）
2. `Plan: <mode>` 写入会话上下文。**首次启动只决策不 init**——init 延迟到 Phase 0 产出 name 后（Phase 0 Step 0.3 之后）执行：`node <SKILL_BASE>/scripts/workflow-state.mjs init --name <name> --mode <mode>` 初始化 state.json
3. 微小任务特判：状态机豁免规则见 kernel-fusion 设计文档（docs/superpowers/specs/2026-08-06-kernel-fusion-design.md）决策 3（不创建 state.json，不走状态机，直接子代理执行；区别于决策树的豁免线——那条是模式判定规则）。微小任务跨会话恢复仍按原版产物 + 会话上下文推断，不走状态机（state.json 不存在属预期）
4. 迁移分支：若产物已存在（如 clarifications/design.md）→ 提示 `init --resume-artifacts --mode <mode>` + `set-name <name>`（name 从产物目录推断或用户提供）（kernel 用户迁移：kernel 的 state.json 路径（`.comet/runs/specpowers-kernel/state.json`）与本脚本读取的 `.superpowers/state.json` 不同，需运行 `init --resume-artifacts` 重建；`.superpowers/.gate-passed-*` 通用，Gate 进度不丢失；已完成归档的 kernel 用户跳过 Phase 4 直接收尾，不重跑 /opsx:archive）
5. 微小→中等升级分支：微小任务中途升为中等（如变更范围扩大触发运行时升级）→ 补 Phase 0 流程（产生 name 与 design.md）后执行 `init --name <name> --mode medium`（**用 init 而非 --resume-artifacts**，以便 currentPhase=phase0 从头走 Gate 0/1/2 审查）；微小已写的 `.gate-passed-3` 保留——升级后 Phase 3 由既有 token 自动跳过（**前提：微小 token 的 name= 与新 Phase 0 产出 name 完全匹配；不匹配时 next 会回到 Phase 3 重新审查**），Phase 1/2 需追溯补做

### Step 2：推进纪律

- 节点流转：每完成一个 Phase，`node <SKILL_BASE>/scripts/workflow-state.mjs next` 返回 `NEXT: <auto|blocked|manual|done>` + `SKILL: <Skill 工具全名，带 provider 前缀>` + `PHASE: <id>` + `REASON: <文本>`（auto 时 SKILL=下阶段技能；manual 时 SKILL 保持当前待用户决策；blocked 时 SKILL=回退 phase 对应技能；done 时无 SKILL）
- 出口守卫：每个子技能 Gate 完成后调 `node <SKILL_BASE>/scripts/workflow-guard.mjs exit <phase> --apply`
- 决策停顿点：见 `refs/decision-points.md`（PP-01..PP-08），必须停顿等用户
- 恢复规则（移植 kernel Decision Core 的恢复类规则）：恢复时复用已持久化选择（方案选择/跳过决定/worktree 同意/逐条裁决），只呈现未决部分；已持久化选择存于 state.json evidence 字段（跨会话恢复依赖该文件）；换话题先确认继续还是新任务，不得混用 name

### 决策分类表

| 分类 | 情况 | 处理 |
|------|------|------|
| 自动处理 | NEXT: auto（当前应执行 phase 已确定——init 后 phase0 若 PP 未决会先输出 manual，PP 已决或后续 phase 无待决停顿点时输出 auto） | 直接进入该 phase 对应技能 |
| 自动处理 | Gate 0-3 审查收敛判定 | 默认继续制：通知继续，非询问 |
| 自动处理 | guard 失败（GUARD: fail，token 或产物缺失） | 停留当前 phase 补产物 |
| 自动处理 | next 输出 blocked（completedPhases 有记录但 token 缺失/name 不匹配） | 回到第一个缺有效 token 的 phase |
| 自动处理 | openspec CLI 不可用 | 自动走跳过路径 |
| 停止条件 | Phase 4 硬 Gate 链失败 | 报告失败步骤与恢复路径 |
| 停止条件 | implementer BLOCKED / 状态损坏 | 报告恢复条件 |
| 手动衔接 | NEXT: manual（下一步需用户决策 PP-01..PP-08 时输出 manual + SKILL 保持当前） | 交还控制权 |
| 用户决策 | PP-01..PP-08 | 停顿等用户 |
| 流程结束 | NEXT: done（所有 Phase 完成，archive 证据已记录） | 收尾：Post-Task Checklist + finishing |

本表为决策分类正本；`refs/decision-points.md` 引用本表（不重复定义分类原则，只列停顿点）。

### Red Flags

| Agent 想法 | 实际风险 |
|---|---|
| `.gate-passed-N` 文件存在，所以 Gate 通过了 | name 不匹配 = 未通过 |
| 用户提了需求，澄清过就算完成了 | 未经审批 = 未完成 |
| 产物文件都在，这个 Phase 算完成 | 无 gate token = 未通过 |
| state.json completedPhases 有它，直接走下一步 | state 可能过期；gate 文件缺失按未完成 |
| 状态机脚本失败，流程卡死 | 回退到 Phase 自动检测表 |
| 收敛判定问用户是否继续 | 默认继续制：通知不是询问 |
| 换话题继续记到当前 name 下 | 污染 Gate 链：先确认继续还是新任务 |
| 全量测试没过，手动 mv change 到 archive | 硬 Gate 链不可降级 |
| task 简单，内联做掉 | Phase 3 必须每 task 独立子代理 |
| 改动碰到配置字段、跨 2-3 文件，所以要升中等 | 豁免线优先：现成模式可复用+仅需增量修改仍判微小；但新增对外面（新增接口/新开配置面/跨模块契约变更）或 4+ 文件仍升级 |

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
微小判定顺序：先查豁免线（完整规则见下方决策树微小分支），再查规模与排除条件。
边界判定：向既有 API 加向后兼容可选参数＝既有面内加字段（判微小候选）；函数签名/语义破坏性变化＝契约变更（升中等）。
改既有配置键的取值语义（如类型变化）跨模块消费者可见＝契约变更；仅在既有键内加新键值条目＝既有面内。

```
├── 微小任务（1-3 文件，< 50 行变更，单模块，未新增对外面——无新增接口/无新开配置面/无跨模块契约变更）
│   ─ 豁免线（优先判定，先于排除条件）: 已有现成实现或现成模式可复用、仅需增量修改 → 判微小；
│     须指认具体既有同构实现（同文件/同模块的文件/符号/配置段），无法指认则不适用豁免线；
│     不放宽规模上限（4+ 文件）与新增对外面——命中任一仍升中等。
│     在既有面内加字段/加行不构成升级理由；「既有面」不含跨模块共享结构/协议——向共享结构加字段属跨模块契约变更，不享豁免线
│   ├── Phase 0: 轻量上下文探索（Read 目标文件确认功能状态）
│   ├── Phase 1: 跳过
│   ├── Phase 2: 跳过
│   ├── Phase 3: 子代理直接执行
│   ├── Phase 4: 跳过
│   ⚠ 4+ 文件或新增对外面（新增接口/新开配置面/跨模块契约变更）→ 升为中等任务（4 文件归中等，中等范围 4-19）
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
    ├── Phase 2: 同复杂任务 Phase 2
    ├── Phase 3: Workflow 编排子代理
    ├── Phase 4: 硬 Gate 链归档
    容错: Workflow 不可用 → 降级复杂任务
```

**运行时升级**: 每 Phase 完成时复查复杂度——实际文件数超出初始判断，或出现新增对外面（新增接口/新开配置面/跨模块契约变更）时，更新 `Plan: <mode>` 并重新路由到下阶段对应模式；仅在既有面内改配置/加字段不触发升级。

## 阶段路由

完成模式选择后，按当前 Phase 加载对应子技能。

### Phase 自动检测（跨会话恢复）

> **本节为回退路径**：当 `node <SKILL_BASE>/scripts/workflow-state.mjs status` 失败、脚本缺失或 state.json 损坏时使用。正常运行时由 Step 0 的状态机判定主导。两套机制判定的依据相同（产物文件 + Gate token），结论应一致——不一致时以文件证据为准（状态机先行判定，文件证据最终裁决）。

入口技能按以下产物状态自动判定当前 Phase。行按从上到下顺序求值，首次匹配即停止。`<name>` 由当前任务上下文获取。

| 产物状态 | Phase 判定 | 加载技能 |
|---------|-----------|---------|
| `docs/superpowers/clarifications/<name>.md` 存在，`docs/superpowers/specs/<name>-design.md` 不存在 | Phase 0 中途 | specpowers-design |
| `docs/superpowers/plans/<name>.md` 存在 | Phase 2 完成 | specpowers-apply (Phase 3) |
| `.superpowers/.phase1-skipped` 存在 | Phase 1 已跳过 | specpowers-plan (Phase 2) |
| `docs/superpowers/clarifications/<name>.md` + `docs/superpowers/specs/<name>-design.md` 存在，`openspec/changes/<name>/` 不存在 | Phase 0 完成 | specpowers-design |
| `openspec/changes/<name>/` 存在 | Phase 1 完成 | specpowers-plan (Phase 2) |

> **Gate 标记检查（产物依赖链最终执行点）**：Phase 自动检测在匹配产物状态后，额外检查对应 Gate 的 `.gate-passed-<N>` 文件（`name=<当前任务>` 匹配）。Gate 标记缺失 → 该 Phase 判定无效，回退到上一 Phase 执行 Gate。Gate 0→检查 `.gate-passed-0`（Phase 0 完成且 Gate 0 通过才能进入 Phase 1）；Gate 1→`.gate-passed-1`（Phase 1 完成且 Gate 1 通过才能进入 Phase 2，`.phase1-skipped` 存在时跳过此项）；以此类推。微小任务跳过 Gate 0/1/2（与验证 0 一致），Gate 3 仍检查。

**微小任务不加载子技能** — 直接在入口 skill 上下文中子代理执行。

> 注：微小任务不加载 design/plan/apply/archive 业务子技能，但 specpowers-review（审查横切）仍加载执行 Gate 3（见 specpowers-apply 前置检查）。

| 当前 Phase | 模式 | 加载 | 命令 |
|-----------|------|------|------|
| Phase 0 | 中等+ | specpowers-design | `Skill({skill: "specpowers-design"})` |
| Phase 1 | 中等+ | specpowers-design | `Skill({skill: "specpowers-design"})` |
| Phase 2 | 中等+ | specpowers-plan | `Skill({skill: "specpowers-plan"})` |
| Phase 3 | 中等+ | specpowers-apply | `Skill({skill: "specpowers-apply"})` |
| 审查 | 代码类（由 specpowers-review 内部两级路由自动判定：关键/完整审查）或 文档类 或 用户手动触发 | specpowers-review | `Skill({skill: "specpowers-review"})` |
| Phase 4 | 中等+ | specpowers-archive | `Skill({skill: "specpowers-archive"})` |
| — | 微小 | 不加载子技能（specpowers-review 除外，见上注） | 入口 skill 中直接子代理执行。执行完毕后主 Agent 确认产物并输出完成摘要 |

> 横切规则（Git Flow、Checklist、Pitfalls）保留在本入口技能中，各阶段均需遵守。

## 审查路由

需要审查时，加载 `Skill({skill: "specpowers-review"})`，由 specpowers-review 内部两级路由矩阵自动判定审查层级（按评审轮数×待评审物规模×行数地板路由到关键/完整审查），防退化机制全部保留并为 tier 路由补充防护；用户可手动覆盖（关键/完整审查）。

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
| **Superpowers** | TDD | `/skills` 含 `brainstorming`、`subagent-driven-development` 等上游技能（插件命名空间形式见本技能「平台适配」节） | ✅ |
| **CodeGraph** | 代码知识图谱 | 仓库根存在 `.codegraph/` 目录（MCP `codegraph_explore` / shell `codegraph explore`） | ⚠️ |
| **Graphify** | 多模态知识图谱（代码+文档，架构理解） | `/graphify` 命令可用 | ⚠️ |
| **TEST_COMMAND** | 全量测试 | 项目实际测试命令（见下方） | ⚠️ 需手动配置 |
| **Node.js** | 状态机脚本 | `node --version`（≥18） | ✅（脚本依赖；缺失时回退到 Phase 自动检测，状态机功能不可用） |

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
| **CodeGraph** | `codegraph_explore` 理解代码（符号源码+调用路径） | `codegraph_explore` 影响分析（含 blast radius 受影响调用方） | —（file watcher 自动同步图谱，无需手动命令） | `codegraph_explore` 复查关键符号依赖 |
| **Graphify** | `/graphify` 构建图谱 + `/graphify explain` 理解架构 | — | — | `/graphify` 重建/更新图谱（可提交团队共享） |

## Pre-Flight Check

首次使用 specpowers 的项目需配置以下项：

```
□ TEST_COMMAND: 全量测试命令（见上方环境准备节，如未配置 archive 自动检测）
□ QTDIR: Qt 项目需设置（如有）
□ openspec --version: 确认 OpenSpec CLI 可用
□ node --version: 状态机脚本依赖（≥18）。缺失时状态机不可用，回退到 Phase 自动检测表（状态机功能降级但不阻塞流程）
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
  - 微小任务(tiny): 跳过 design/plan 的 Gate 验证（Gate 3 除外——apply 中 tiny 仍执行验证 1/2/3）
  - 非微小任务: 继续验证1

验证1: 标记块完整性
  - 按 [TIER_ROUTING] expected_steps 动态检查 STEP<N>_EXECUTED 标记
  - 无 TIER_ROUTING 标记时回退旧逻辑（按 Phase 定义检查关键产物）
  - 预期步骤全部标记 → 通过; 缺少步骤 → 失败（列出缺失项）

验证2: P0 硬阻止
  - [GATE_BLOCKED] p0_count>0 → 阻塞，禁止继续
  - p0_count=0 → 通过

验证3: 收敛判定完整性
  - 搜索最后一个 [CONVERGENCE_CHECK] 标记（多轮审查每轮都输出此标记，最后一个为最终判定）
  - 缺失 → 视为审查未完成（收敛判定被跳过），阻塞 Phase
  - 最后一个 action=exit 但 exit_reason 为空 → 阻塞（无理由终止）
  - 最后一个 action=continue → 异常状态（Gate 已返回但末标记非 exit，说明 review 中途中断或上下文压缩截断），视为审查未完成，阻塞并重跑 review
  - 最后一个 action=exit 且 exit_reason 非空 → 通过
```

> 各子技能引用示例: "按入口 Gate 返回后验证协议执行验证链（Gate=1, Phase=1）：验证0→验证1→验证2→验证3。"

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
| 跨会话中断 | 跨会话中断恢复：优先运行 `node <SKILL_BASE>/scripts/workflow-state.mjs status` 状态机判定当前 Phase；脚本不可用时按上述 Phase 自动检测表（回退路径）判定。 |
| refs/ 缺失 | UltraPlan → 降级中等任务 |

## 快速上手

| 步骤 | 命令 | 详见 |
|------|------|------|
| brainstorming | `Skill({skill: "specpowers-design"})`（Phase 0，需求澄清+方案设计） | specpowers-design |
| propose | `Skill({skill: "specpowers-design"})`（Phase 1，格式转换+强制对照） | specpowers-design |
| Plan 审查 | 执行 Gate 2 审查（强制执行，见 specpowers-plan） | specpowers-plan |
| 衔接 | "读取 openspec changes/, 用 writing-plans 拆 TDD 计划" | specpowers-plan |
| 实现 | `Skill({skill: "subagent-driven-development"})`（每个 task 一个独立子 Agent） | specpowers-apply |
| 审查 | `Skill({skill: "specpowers-review"})`（两级路由自动判定） | specpowers-review |
| 验证 | `openspec validate --change <name>` + test | specpowers-archive |
| 归档 | `/opsx:archive`（硬 Gate 链；命令不可用时走 specpowers-archive Step 3 载体降级链——降级的是执行载体，归档步骤本身不可跳过） | specpowers-archive |

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
| 协议正本 | `refs/workflow-protocol.json` |
| 停顿点正本 | `refs/decision-points.md` |
