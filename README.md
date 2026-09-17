<div align="center">

[English](README.en.md) | **简体中文**

</div>

<div align="center">

<img src="static/logo.png" alt="specpowers" width="880">

</div>

# specpowers

**SDD + TDD 工程化开发方法论** — DeepSeek Harness 插件 + Claude Code 技能组

specpowers 融合 [OpenSpec](https://github.com/Fission-AI/OpenSpec)（规范驱动开发）与 [Superpowers](https://github.com/obra/superpowers)（测试驱动纪律），通过衔接指令集把两者桥接成完整的 **Phase 0→4 开发工作流**。它防止需求偏离（做了不需要的东西）与实现缺陷（需要的东西做错了），并通过全流程逐层审查 Gate 防止上下文腐化与产物质量下降。

![架构](static/architecture.svg)

## 技能组架构

```
specpowers (入口 — 决策树 + 路由 + 状态机)
  ├── specpowers-design  Phase 0+1: 需求澄清 → OpenSpec 格式转换
  ├── specpowers-plan    Phase 2: OpenSpec → TDD plan 衔接
  ├── specpowers-apply   Phase 3: subagent-driven TDD 实现 + Gate 3 审查
  ├── specpowers-review  审查体系: 两级路由（关键/完整）/ 最终通读
  └── specpowers-archive Phase 4: 硬 Gate 链验证归档
```

| 技能 | Phase | 职责 |
|------|-------|------|
| **specpowers** | 全局 | 决策模式判定（微小/中等/复杂/大规模）+ 路由 + 状态机 |
| **specpowers-design** | 0+1 | brainstorming → OpenSpec 格式转换 + Gate 0/1 |
| **specpowers-plan** | 2 | writing-plans 衔接 + Gate 2 |
| **specpowers-apply** | 3 | subagent-driven TDD 逐 task 执行 + code-review + spec-compliance-check |
| **specpowers-review** | 横切 | 两级路由（按轮数×规模自动判定：关键/完整审查）/ 防退化机制 |
| **specpowers-archive** | 4 | 全量测试 → openspec validate → archive → 完整性验证 |

## 安装

### 前置依赖

| 工具 | 用途 | 安装验证 |
|------|------|---------|
| **DeepSeek Harness** 或 **Claude Code** | 运行环境 | `dsh --version` / `claude --version` |
| **superpowers-dsh**（DSH）或 **Superpowers**（Claude Code） | TDD 技能组（**硬依赖**） | 见下方依赖安装步骤 |
| **OpenSpec CLI** | SDD 规范管理（**硬依赖**） | `openspec --version` |
| **CodeGraph**（可选） | 代码知识图谱 | 仓库根 `.codegraph/` 目录 / MCP `codegraph_explore` |
| **Graphify**（可选） | 多模态知识图谱（架构理解） | `/graphify` 命令 |

### 在 DeepSeek Harness 中安装

最简单——在任意目录执行：

```sh
npx @deepseek-ai/dsh plugin --profile web add github:SAXEM1997/specpowers
```

装完后重启 profile（停掉后重新运行 `dsh web` / `npx @deepseek-ai/dsh web`），刷新浏览器即可。

也可以直接让 DeepSeek Harness 自己装——新建对话，把这句话发给它：

```
帮我安装这个链接里边的插件：https://github.com/SAXEM1997/specpowers
```

重启并验证层已组合：

```sh
dsh --profile web --dump-config     # 必须出现 specpowers 行
```

之后 6 个技能会出现在 agent 技能目录中（`specpowers` 是入口技能），可用 `skill` 工具加载。

卸载：

```sh
dsh plugin --profile web remove specpowers
# 卸载后同样需要重启 profile
```

> 必须用 `dsh plugin` 形式——直接 `npm install specpowers` 只会把包当普通库装到当前目录，**不会**注册进任何 profile，技能永远不会被加载。

### 在 Claude Code 中安装

**方式 1: Plugin Marketplace（推荐）**

```bash
/plugin marketplace add https://github.com/SAXEM1997/specpowers.git
/plugin install specpowers@specpowers-marketplace
```

**方式 2: 手动安装**

```bash
git clone https://github.com/SAXEM1997/specpowers.git
cp -r specpowers/skills/* ~/.claude/skills/
cp -r specpowers/commands/* ~/.claude/commands/
```

### 依赖安装步骤

specpowers 自身只提供工作流技能，两类依赖需要单独安装。`.claude/` 目录属于**用户本地内容**，不随仓库分发，必须由下面的步骤重建。

**1. OpenSpec CLI（必需）**

```bash
npm install -g @fission-ai/openspec
openspec init --tools claude     # Claude Code：生成 .claude/skills/openspec-*/ 与 .claude/commands/opsx/
openspec init --tools codex      # Codex：生成 .agents/skills/openspec-*/
```

`openspec init` 生成的 `openspec-*` 技能与 `/opsx:*` 命令由 OpenSpec 拥有，会被 `openspec update` 刷新——不要手改。

**2. Superpowers 技能组（必需）**

DSH 用户：

```sh
npx @deepseek-ai/dsh plugin --profile web add superpowers-dsh
```

Claude Code 用户：安装 `superpowers` 插件。

specpowers 硬依赖其中 **8 个**上游技能，缺失时对应 Phase 无法执行：

`brainstorming`、`writing-plans`、`subagent-driven-development`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`verification-before-completion`、`finishing-a-development-branch`

**3. CodeGraph / Graphify（可选）** — 仅影响架构理解能力，不影响工作流执行。

### 项目初始化

在目标项目中启用 specpowers：

```
□ 运行 openspec init（生成 openspec/ 目录与工具集成）
□ 安装 superpowers 技能组（见上）
□ 创建 docs/superpowers/ 目录结构
□ 配置 TEST_COMMAND（全量测试命令，可选）
```

项目模板详见 `skills/specpowers/refs/project-template.md`。

## 快速开始

用自然语言触发：

- "启动 specpowers 流程"
- "用 SDD+TDD 开发这个功能"
- "开始新功能的 specpowers 工作流"

Claude Code 用户另可用 `/specpowers` 斜杠命令。DSH 用户直接加载入口技能即可：`skill(name: "specpowers")`。

### 执行模式

入口技能按文件数 + 复杂度自动判定：

| 模式 | 文件数 | Phase 流程 | 审查 |
|------|--------|-----------|------|
| **微小** | 1-3 | 轻量探索 → 子代理执行 → 完成 | 两级路由自动判定 |
| **中等** | 4-19 | Phase 0→1→2→3→4 完整流程 | 两级路由自动判定 |
| **复杂** | 20-49 | Phase 2 启用 UltraPlan | 两级路由自动判定 |
| **大规模** | 50+ | Phase 2 启用 Workflow | 两级路由自动判定 |

## Phase 工作流

```
Phase 0: 需求澄清 + 方案设计 (brainstorming)
  ├── 探索项目上下文
  ├── 连环提问澄清需求
  ├── 方案探讨 + 设计呈现（逐段审批）
  ├── 写设计文档 + 自审
  └── 审批 Gate → Gate 0 审查
       ↓
Phase 1: OpenSpec 格式转换 + 对照验证
  ├── 设计 doc → OpenSpec 四件套（proposal/design/specs/tasks）
  ├── 强制对照验证（vs 原始需求）
  └── 人工审核 → Gate 1 审查
       ↓
Phase 2: 衔接阶段 (writing-plans)
  ├── OpenSpec 产物 → Superpowers TDD plan
  ├── 粒度转换 + 场景→测试映射
  └── Gate 2 审查
       ↓
Phase 3: subagent-driven TDD 实现
  ├── 每个 task 独立子 Agent 执行（新鲜上下文）
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

审查层级由 specpowers-review 内部两级路由矩阵自动判定（按评审轮数 × 待评审物规模 × 行数地板），用户可手动覆盖：

- **关键**：微小任务全程、中等任务第 2 轮+（对齐 + 监督 2-agent，~0.4x token）
- **完整**：首轮审查、复杂/大规模任务；代码类按 bucket 分叉子路径——加强审查（4-9 文件：code-review + 对齐单审）/ UltraReview（≥10 文件：6-agent 团队）；文档类为 3-agent 多模型渐进式

防退化机制全部保留并为 tier 路由补充防护。

### 多模型渐进式审查

三 Agent 并行独立审查，使用不同模型：**结构 Agent**（完整性/冗余/一致性，强推理模型）、**落地 Agent**（可执行性/兼容性/边界，快速模型）、**对齐 Agent**（对齐原始需求/错漏检测/歧义识别，与前两者不同模型）。

### UltraReview

6 Agent 团队审查（build/code/specs/docs/deps/对齐），含 Step A-F 逐条分析协议。

### 收敛判定

每个 Gate 审查完成后输出收敛判定（`[CONVERGENCE_CHECK]` 标记），基于本轮原始发现数 p*_raw 计算 5 个触发条件（任一满足默认继续下一轮）：① p0_raw > 1；② p1_raw > 5；③ P0+P1+P2 合计 > 10；④ 全级合计 > 20；⑤ 本轮 p1_raw 较上轮新增 > 3。全部不满足或用户显式终止时退出（action=exit）并执行最终通读。配套反偷懒：RAW_COUNT 结构化计数 + 合计比对 + p0_raw≥1 时严重度校准抽查。

## 平台适配

| 平台 | 技能调用形式 | 技能承载路径 | 状态 |
|---|---|---|---|
| **DeepSeek Harness** | `skill(name: "specpowers")` | 插件包 `skills/`，由 `lib/index.js` provider 注册进 host 技能注册表 | ✅ 已实现 |
| **Claude Code** | 裸名可用则 `Skill({skill: "specpowers"})`；技能注册表要求插件命名空间时回退 `Skill({skill: "specpowers:specpowers"})` | `.claude-plugin/plugin.json` 的 `skills: "./skills"` | ✅ 已实现 |
| **Codex CLI** | 技能名直呼（skills-only 工具） | `.agents/skills/<name>/SKILL.md` | 🔲 预留·**未验证** |

平台差异的完整映射（工具对照、hook 与斜杠命令缺失时的降级路径）见 `skills/specpowers/refs/platform-tools.md`。

## 目录结构

```
specpowers/
├── package.json                       # DSH 插件清单（dsh.bundle.patch）
├── cordis.patch.yml                   # DSH bundle 层补丁
├── lib/index.js                       # DSH 技能 provider（ctx.skills）
├── scripts/verify-dsh-provider.mjs    # 打包自检（零依赖）
├── .claude-plugin/                    # Claude Code 清单
│   ├── marketplace.json
│   └── plugin.json
├── skills/                            # ★ 双平台唯一技能真源
│   ├── specpowers/SKILL.md            # 入口技能
│   │   ├── refs/                      # 入门指南、项目模板、UltraPlan 提示词、平台适配
│   │   └── scripts/                   # 状态机 / 守卫 / hook 校验（零依赖）
│   ├── specpowers-design/SKILL.md     # Phase 0+1
│   ├── specpowers-plan/SKILL.md       # Phase 2
│   ├── specpowers-apply/SKILL.md      # Phase 3
│   ├── specpowers-review/SKILL.md     # 审查体系
│   └── specpowers-archive/SKILL.md    # Phase 4
├── commands/specpowers.md             # Claude Code /specpowers 命令
├── static/architecture.svg            # 架构图
├── docs/superpowers/{specs,plans}/    # 本项目的设计与计划（开发史）
├── AGENTS.md                          # 厂商中立项目指令（正本）
├── CLAUDE.md                          # Claude Code 入口（导入 AGENTS.md）
├── README.md / README.en.md
└── LICENSE
```

`.claude/`（OpenSpec 生成物）与 `.superpowers/`（运行时状态）属于用户本地内容，已在 `.gitignore` 中排除。

## 开发

技能文件是 Markdown + YAML frontmatter。修改后需确保 frontmatter 的 `name` 与 `description` 格式正确、技能间引用名与实际一致、必选子技能路径正确。

运行打包自检（零依赖，校验清单有效性 + provider `list()`/`get()` 契约 + 相对资源可达）：

```bash
node scripts/verify-dsh-provider.mjs
```

> **改 frontmatter 解析器时必读**：DSH 的 `description` 是技能路由的唯一依据。本仓库的 `lib/index.js` 解析器支持 4 种标量形态（单行、折叠块 `>`/`>-`、字面块 `|`/`|-`、多行 plain 续行）。若退化为只支持单行标量，`specpowers` 与 `specpowers-review` 的 `description` 会变成字面 `>`/`>-`，`specpowers-design` 与 `specpowers-plan` 的会被截断——技能会「看得见但选不中」。改完务必跑上面的自检。

技能评测套件位于 `skills/*/evals/`：声明式 YAML 用例 + 规则断言。运行器是开源项目 [skill-up](https://github.com/alibaba/skill-up)（Alibaba，Apache-2.0），本仓库的 `eval.yaml`（`schema_version: v1alpha1`）与 `cases/*.yaml` 即其评测格式。

```bash
curl -fsSL https://raw.githubusercontent.com/alibaba/skill-up/main/install.sh | bash
```

```bash
skill-up validate <path>
skill-up run <path>
```

`<path>` 为技能目录（技能的 `evals/` 与其 `SKILL.md` 同级）；`validate` 校验用例，`run` 执行评测，输出写到该目录下的 `<skill>-workspace/`（如 `iteration-1/result.json`），已被 `.gitignore` 排除。skill-up 内置 `claude_code` / `codex` / `qodercli` / `qwen_code` 四种 Agent Engine，并支持用 `engine.custom` 接入自定义引擎；**DeepSeek Harness 不是内置引擎**，本套件需在上述内置引擎之一或自定义引擎下运行。新增用例见[上游文档](https://alibaba.github.io/skill-up/zh/)。

详见 [AGENTS.md](AGENTS.md) 了解开发工作流与关键设计决策。

## 许可

MIT，见 [LICENSE](LICENSE)。上游技能内容改编自 [Superpowers](https://github.com/obra/superpowers)（MIT，© 2025 Jesse Vincent）与 [OpenSpec](https://github.com/Fission-AI/OpenSpec)（MIT，© 2024 OpenSpec Contributors）；完整上游版权声明见 LICENSE 的「上游归属」段。
