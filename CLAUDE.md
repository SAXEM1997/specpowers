# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

specpowers 是一个 **Claude Code 技能组（Skill Group）**开发项目。它定义了一套 SDD+TDD 工程化开发方法论，融合 OpenSpec（规范驱动开发）和 Superpowers（测试驱动纪律），通过衔接指令集将两者桥接。

产物为 Markdown 技能文件（YAML frontmatter + Markdown 正文），不是可执行代码。

## 技能组架构

```
specpowers (入口, 决策模式+路由)
  ├── specpowers-plan   (Phase 0+1+2: brainstorming → propose → 衔接)
  ├── specpowers-apply  (Phase 3: TDD 实现)
  ├── specpowers-review (UltraReview / 多模型渐进式审查)
  └── specpowers-archive(Phase 4: 验证+归档硬 Gate 链)
```

**路由逻辑**: 入口技能按文件数+复杂度判定执行模式（微小/中等/复杂/大规模），然后按 Phase 加载对应子技能。

## 目录结构

| 路径 | 用途 |
|------|------|
| `skills/specpowers/SKILL.md` | 入口技能 — 决策树、路由表、全局规则（GitFlow/Checklist/Pitfalls） |
| `skills/specpowers/refs/` | 入口技能 bundled resources（入门指南、项目模板、UltraPlan 提示词等） |
| `skills/specpowers-plan/SKILL.md` | Phase 0-2: brainstorming → 格式转换+对照验证 → writing-plans 衔接 |
| `skills/specpowers-apply/SKILL.md` | Phase 3: TDD 实现 + Gate 3 审查（code-review + spec-compliance-check） |
| `skills/specpowers-review/SKILL.md` | 审查决策树 + 多模型渐进式（文档类）/ UltraReview（代码≥10文件）/ 最终通读 Gate |
| `skills/specpowers-archive/SKILL.md` | Phase 4: 全量测试 → openspec validate → /opsx:archive → 完整性验证 → finishing |
| `.claude/skills/openspec-*/` | Claude Code 自动发现路径 — OpenSpec 五个子技能 |
| `.claude/commands/opsx/` | `/opsx:*` 斜杠命令定义（apply/archive/explore/propose/sync） |
| `openspec/` | OpenSpec 规范目录（被应用项目使用时才填充） |

## 关键设计决策

1. **技能拆分策略**: 原为单一庞大 SKILL.md（~2026-06-10 删除），现拆为 1 入口 + 4 子技能，按 Phase 按需加载以减少上下文消耗。
2. **Phase 0 独立于 OpenSpec**: Phase 0 使用 `superpowers:brainstorming` 完成需求澄清+方案设计，产物为 `docs/superpowers/specs/<name>-design.md`。Phase 1 仅做格式转换+强制对照验证，不重复做需求分析。
3. **Name 贯穿全流程**: `<name>` 由 Phase 0 定义（格式 `YYYY-MM-DD-<topic>`），贯穿 Phase 0-4，与 OpenSpec change 目录名同一标识符。
4. **审查类型由 specpowers-review 内部决策树自动判定**（文档类→多模型渐进式，代码类≥10文件→UltraReview，<10文件→加强审查），用户可手动覆盖。
5. **硬 Gate 链不可跳过**: Phase 4 的四步 Gate（全量测试 → validate → archive → 完整性验证）任一失败强制终止，不允许降级为手动操作。

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
