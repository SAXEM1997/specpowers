# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

specpowers 是一个 **Claude Code 技能组（Skill Group）**开发项目。它定义了一套 SDD+TDD 工程化开发方法论，融合 OpenSpec（规范驱动开发）和 Superpowers（测试驱动纪律），通过衔接指令集将两者桥接。

产物以 Markdown 技能文件（YAML frontmatter + Markdown 正文）为主，另含零依赖 Node.js 脚本（状态机/守卫/hook）与 JSON 协议文件。

## 技能组架构

```
specpowers (入口, 决策模式+路由+状态机)
  ├── specpowers-design (Phase 0+1)
  ├── specpowers-plan   (Phase 2)
  ├── specpowers-apply  (Phase 3: TDD 实现)
  ├── specpowers-review (两级路由：关键/完整)
  └── specpowers-archive(Phase 4: 验证+归档硬 Gate 链)
```

**路由逻辑**: 入口技能按文件数+复杂度判定执行模式（微小/中等/复杂/大规模），然后按 Phase 加载对应子技能。

## 目录结构

| 路径 | 用途 |
|------|------|
| `skills/specpowers/SKILL.md` | 入口技能 — 决策树、路由表、全局规则（GitFlow/Checklist/Pitfalls）+ Decision Core（状态机 Step 0-2/决策分类表/Red Flags） |
| `skills/specpowers/scripts/` | 轻量状态机脚本（workflow-state/guard/hook-validate-token，零依赖）+ hooks 模板（默认不注册） |
| `skills/specpowers/refs/` | 入口技能 bundled resources（入门指南、项目模板、UltraPlan 提示词、workflow-protocol.json、decision-points.md 等） |
| `skills/specpowers-design/SKILL.md` | Phase 0+1: brainstorming + propose + Gate 0/1 |
| `skills/specpowers-plan/SKILL.md` | Phase 2: writing-plans 衔接 + Gate 2 |
| `skills/specpowers-apply/SKILL.md` | Phase 3: subagent-driven TDD 实现 + Gate 3 审查（code-review + spec-compliance-check） |
| `skills/specpowers-review/SKILL.md` | 审查体系：两级路由（按轮数×规模路由到关键/完整审查）/ 收敛判定默认继续制（CONVERGENCE_CHECK 强制标记）+ Gate Token 产物依赖链 / 审查纪律自检 + 防偷懒协议 / 最终通读 Gate |
| `skills/specpowers-archive/SKILL.md` | Phase 4: 全量测试 → openspec validate → /opsx:archive → 完整性验证 → finishing |
| `.claude/skills/openspec-*/` | Claude Code 自动发现路径 — OpenSpec 五个子技能 |
| `.claude/commands/opsx/` | `/opsx:*` 斜杠命令定义（apply/archive/explore/propose/sync） |
| `openspec/` | OpenSpec 规范目录（被应用项目使用时才填充） |

## 关键设计决策

1. **技能拆分策略**: 原为单一庞大 SKILL.md（~2026-06-10 删除），现拆为 1 入口 + 5 子技能，按 Phase 按需加载以减少上下文消耗。
2. **Phase 0 独立于 OpenSpec**: Phase 0 使用 `superpowers:brainstorming` 完成需求澄清+方案设计，产物为 `docs/superpowers/specs/<name>-design.md`。Phase 1 仅做格式转换+强制对照验证，不重复做需求分析。
3. **Name 贯穿全流程**: `<name>` 由 Phase 0 定义（格式 `YYYY-MM-DD-<topic>`），贯穿 Phase 0-4，与 OpenSpec change 目录名同一标识符。
4. **审查层级由 specpowers-review 内部两级路由矩阵自动判定**（按评审轮数×待评审物规模×行数地板路由到关键/完整，用户可手动覆盖），防退化机制全部保留并为 tier 路由补充防护。默认全量修复 P0-P3。UltraReview 阈值 ≥10 文件（中等 bucket 内部按 file_count 分叉：4-9=加强审查，10-19=UltraReview）。
5. **硬 Gate 链不可跳过**: Phase 4 的四步 Gate（全量测试 → validate → archive → 完整性验证）任一失败强制终止，不允许降级为手动操作。Phase 0-3 各 Gate 通过 Gate Token 产物依赖链强制——`[GATE_PASSED]` 标记 + `.gate-passed-<N>` 文件（含 name 绑定）+ 入口验证 3（收敛判定完整性）+ 4 子技能前置检查 + Phase 自动检测 Gate 维度。
6. **执行模式硬约束**: Phase 3 必须使用 `subagent-driven-development`（每个 task 独立子 Agent），禁止主 Agent 内联串行执行。specpowers-apply 内置执行模式路由表 + 合理化表 + 违规检测机制对抗长上下文下的内联退化。
7. **审查防退化机制**: specpowers-review 内置三层防退化防御——审查纪律自检（合理化表 + Red Flags）、多轮审查防偷懒协议（主 Agent 自检）、审查层级边界（两层边界原则——分析不受限，评论受限制）。收敛判定从 advisory 升级为默认继续制（`[CONVERGENCE_CHECK]` 强制标记 + review 内部循环 + 用户干预窗口）。修复阶段默认全量修复 P0-P3（子Agent逐条分析），同文件不并发硬约束防止编辑冲突。
8. **状态机主导 + hooks 默认 off**: 入口启动协议融合 Decision Core——`node skills/specpowers/scripts/workflow-state.mjs status` 状态机先行判定 Phase，`.gate-passed-<N>` 文件（name 绑定）最终裁决，Phase 自动检测降级为回退路径；4 个子技能（design/plan/apply/archive）Gate 出口调 `workflow-guard.mjs exit <phase> --apply`（token 先写、guard 后调，子技能为唯一责任方）；hooks 默认不注册（模板在 scripts/，启用需显式复制到 .claude/settings.json，与 comet-hook-router 互斥）。微小任务豁免（不 init 状态机，保留轻量行为）。

## 开发工作流

### 修改技能文件

技能文件是 Markdown + YAML frontmatter。修改后需要确保：

- YAML frontmatter 的 `name` 和 `description` 字段格式正确
- 技能内容引用的其他技能名称与实际一致
- 必选子技能（REQUIRED SUB-SKILL）路径正确
- 跨技能引用（如入口技能的审查级别表被 review 技能引用）保持一致

### 同步到 .claude/skills/

`.claude/skills/` 是 Claude Code 自动发现路径。如果在该目录下开发，修改会直接生效。如果 `skills/` 和 `.claude/skills/` 需要同步，使用 `cp -r` 或符号链接。

### 测试技能

技能的测试方式是直接在 Claude Code 会话中通过 `Skill` 工具调用。验证要点：

- 技能能否被正确加载
- 路由逻辑是否正确（入口技能决策树）
- 子技能间的前置检查是否正确拦截
- Gate 逻辑是否强制执行

### 斜杠命令

`.claude/commands/opsx/*.md` 定义了 `/opsx:propose`、`/opsx:apply` 等命令。这些命令的内容与 `.claude/skills/openspec-*/SKILL.md` 对应，修改时需保持同步。

## 外部依赖

| 工具 | 用途 | 安装验证 |
|------|------|---------|
| **OpenSpec CLI** | SDD 规范管理 | `openspec --version` |
| **Superpowers** | TDD 技能组 | `/skills` 列表中包含 `superpowers:*` |
| **GitNexus** (MCP) | 代码知识图谱 | MCP `gitnexus_query` 可用 |
| **Understand-Anything** | 架构分析 | `/understand` 命令可用 |

## 注意事项

- skills 目录下的 `pkg-xmake-template.md` 是 xmake 构建系统的 C/C++ 项目模板，仅在 specpowers 应用于此类项目时作为参考，不是本项目的构建系统。
- `refs/` 下的文件是技能的 bundled resources，通过 `Skill` 工具加载技能时一并可用。
- 入口技能的 "7 个常见 Pitfalls" 和 "故障排查" 表是跨所有子技能的共享知识，修改时需评估对子技能的影响。

<comet-ambient-resume>
<!-- Managed by Comet. Edits inside this block may be replaced by comet init/update. -->
<!-- Contract: comet.resume_probe.v2 -->

## Comet Ambient Resume

在这个仓库中，开始处理需要改动或调查的任务前，如果可能存在活跃 Comet workflow，把当前用户请求传入只读探针：`comet resume-probe . --stdin --json`。

- 如果用户通过宿主明确调用任意 Comet Skill（例如 `@comet`、`/comet`、`@comet-native` 或 `/comet-hotfix`），显式调用优先于本恢复协议；不要运行 resume probe，直接进入被调用的 Skill。
- 只信任返回的 `workflow`、`skill` 和 `entrySource`；它们只由项目配置或无配置兼容回退决定。不得扫描或切换另一套 workflow。
- 如果 probe 返回 `auto_resume`，简短说明选中的 active change，并进入 `nextCommand` 指向的永久入口。不要把状态命令当作恢复入口直接推进。
- 如果 probe 返回 `ask_user`，只问一个简短问题并等待用户回复。
- 如果当前请求未明确调用 Comet Skill，且 probe 返回 `out_of_scope` 或 `none`，不要进入 Comet workflow。
- 如果配置或状态无效且没有 `nextCommand`，停止并报告原因；不要猜测另一个 workflow。
- 不能只因为存在 active change 就把无关任务挂到该 change。Native 的未提交改动由 Native 入口检查，不由探针自动归因。
</comet-ambient-resume>
