# specpowers

**SDD + TDD 工程化开发方法论** — Claude Code 技能组

specpowers 融合 OpenSpec（规范驱动开发）和 Superpowers（测试驱动纪律），通过衔接指令集将两者桥接，形成完整的 **Phase 0→4 开发工作流**。防止需求偏离（做了不需要的东西）和实现缺陷（需要的东西做错了），并通过全流程逐层审查 Gate 防止上下文腐化和产物质量下降。

## 技能组架构

```
specpowers (入口 — 决策树 + 路由)
  ├── specpowers-plan   Phase 0/1/2: 需求澄清 → 格式转换 → 衔接
  ├── specpowers-apply  Phase 3: TDD 实现 + Gate 3 审查
  ├── specpowers-review 审查体系: 多模型渐进式 / UltraReview / 最终通读
  └── specpowers-archive Phase 4: 硬 Gate 链验证归档
```

| 技能 | Phase | 职责 |
|------|-------|------|
| **specpowers** | 全局 | 决策模式判定（微小/中等/复杂/大规模）+ 路由 |
| **specpowers-plan** | 0+1+2 | brainstorming → OpenSpec 格式转换 → writing-plans 衔接 |
| **specpowers-apply** | 3 | TDD 逐 task 执行 + code-review + spec-compliance-check |
| **specpowers-review** | 横切 | 多模型渐进式（文档类）/ 加强审查（≤2 文件且 ≤200 行）/ UltraReview + 对齐审查（其他情况）/ 最终通读 |
| **specpowers-archive** | 4 | 全量测试 → openspec validate → archive → 完整性验证 |

## 快速开始

在 Claude Code 会话中触发 specpowers：

```
/specpowers
```

或自然语言触发：
- "启动 specpowers 流程"
- "用 SDD+TDD 开发这个功能"
- "开始新功能的 specpowers 工作流"

### 执行模式

入口技能按文件数+复杂度自动判定：

| 模式 | 文件数 | Phase 流程 | 审查 |
|------|--------|-----------|------|
| **微小** | 1-3 | 轻量探索 → 子代理执行 → 完成 | 内部审查协议 |
| **中等** | 4-19 | Phase 0→1→2→3→4 完整流程 | Gate 0→1→2→3→4 |
| **复杂** | 20-49 | Phase 2 启用 UltraPlan | UltraReview |
| **大规模** | 50+ | Phase 2 启用 Workflow | UltraReview |

## Phase 工作流

```
Phase 0: 需求澄清 + 方案设计 (brainstorming)
  ├── 探索项目上下文
  ├── 连环提问澄清需求
  ├── 方案探讨 + 设计呈现 (逐段审批)
  ├── 写设计文档 + 自审
  └── 审批 Gate → Gate 0 审查
       ↓
Phase 1: OpenSpec 格式转换 + 对照验证
  ├── 设计 doc → OpenSpec 四件套 (proposal/design/specs/tasks)
  ├── 强制对照验证 (vs 原始需求)
  └── 人工审核 → Gate 1 审查
       ↓
Phase 2: 衔接阶段 (writing-plans)
  ├── OpenSpec 产物 → Superpowers TDD plan
  ├── 粒度转换 + 场景→测试映射
  └── Gate 2 审查
       ↓
Phase 3: TDD 实现
  ├── RED-GREEN-REFACTOR-COMMIT 逐 task 执行
  ├── code-review + spec-compliance-check
  └── Gate 3 审查
       ↓
Phase 4: 验证 + 归档
  ├── 全量测试 Gate
  ├── openspec validate Gate
  ├── /opsx:archive Gate
  └── 完整性验证 Gate
```

## 审查体系

审查类型由 specpowers-review 内部决策树自动判定，用户可手动覆盖：

```
审查对象类型?
├── 文档类 (proposal/design/plan/spec/skill/...)
│   └── 多模型渐进式审查 (3 Agent 并行)
│       结构 Agent + 落地 Agent + 对齐 Agent
│
└── 代码类
    ├── 微小任务 → 内部审查协议
    ├── 其他情况 → UltraReview + 对齐审查（6 Agent 团队）
    └── 加强审查（≤2 文件且 ≤200 行, code-review + 对齐 Agent 单审）
```

### 多模型渐进式审查

三 Agent 并行独立审查，使用不同模型：
- **结构 Agent**：完整性/冗余/一致性（强推理模型）
- **落地 Agent**：可执行性/兼容性/边界（快速模型）
- **对齐 Agent**：对齐原始需求/错漏检测/歧义识别（与前两者不同模型）

### UltraReview

5 Agent 团队审查（build/code/specs/docs/deps），含 Step A-F 逐条分析协议。

### 收敛提醒

每个 Gate 审查完成后输出收敛提醒，包含 P0/P1/P2 计数、上轮对比、趋势判断。提醒用户必要时启动下一轮审查，直至问题收敛。

## 安装

### 前置依赖

| 工具 | 用途 | 安装验证 |
|------|------|---------|
| **Claude Code** | 运行环境 | `claude --version` |
| **OpenSpec CLI** | SDD 规范管理 | `openspec --version` |
| **Superpowers** | TDD 技能组 | `/skills` 包含 `superpowers:*` |
| **GitNexus** (可选) | 代码知识图谱 | MCP `gitnexus_query` |
| **Understand-Anything** (可选) | 架构分析 | `/understand` 命令 |

### 安装 specpowers

**方式 1: Plugin Marketplace（推荐）**

```bash
# 添加 marketplace
/plugin marketplace add http://<internal-host>:<port>/ai/specpowers.git

# 安装插件
/plugin install specpowers@specpowers-marketplace
```

**方式 2: 手动安装**

```bash
git clone http://<internal-host>:<port>/ai/specpowers.git
cp -r specpowers/skills/* ~/.claude/skills/
cp -r specpowers/commands/* ~/.claude/commands/
```

### 斜杠命令

| 命令 | 用途 |
|------|------|
| `/specpowers` | 启动 specpowers SDD+TDD 完整工作流 |
| `/opsx:propose <name>` | 创建 OpenSpec 变更提案 |
| `/opsx:apply` | 应用当前变更 |
| `/opsx:archive` | 归档变更 + 合并规范 |
| `/opsx:explore` | 探索代码库上下文 |
| `/opsx:sync` | 同步规范 |

### 项目初始化

在目标项目中启用 specpowers：

```
□ 创建 docs/superpowers/ 目录结构
□ 初始化 openspec (openspec init)
□ 配置 TEST_COMMAND（全量测试命令，可选）
□ 确认 Superpowers 技能组可用
```

项目模板详见 `skills/specpowers/refs/project-template.md`。

## 目录结构

```
specpowers/
├── .claude-plugin/
│   ├── marketplace.json               # Marketplace 注册中心
│   └── plugin.json                    # 插件清单
├── skills/
│   ├── specpowers/SKILL.md            # 入口技能
│   │   └── refs/                      # 入门指南、项目模板、UltraPlan 提示词
│   ├── specpowers-plan/SKILL.md       # Phase 0-2
│   ├── specpowers-apply/SKILL.md      # Phase 3
│   ├── specpowers-review/SKILL.md     # 审查体系
│   └── specpowers-archive/SKILL.md    # Phase 4
├── commands/
│   └── specpowers.md                  # /specpowers 入口命令
├── .claude/
│   ├── skills/openspec-*/             # OpenSpec 技能 (Claude Code 可发现)
│   └── commands/opsx/                 # /opsx:* 斜杠命令 (openspec init)
├── docs/superpowers/
│   ├── specs/                         # 设计文档
│   └── plans/                         # 实施计划
├── openspec/                          # OpenSpec 规范目录
├── README.md
└── CLAUDE.md
```

## 开发

本项目是 specpowers 技能组的开发仓库。技能文件是 Markdown + YAML frontmatter。修改后直接生效（`.claude/skills/` 是 Claude Code 自动发现路径）。

详见 [CLAUDE.md](CLAUDE.md) 了解开发工作流和关键设计决策。

## 许可

MIT
