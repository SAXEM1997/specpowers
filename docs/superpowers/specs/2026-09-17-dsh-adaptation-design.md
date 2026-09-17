# specpowers DSH 适配改造 + 公开仓库优化 — 设计文档

## 概述

把 specpowers 技能组从「Claude Code 专用插件」改造为**单仓库双平台发布**：同一个 GitHub 仓库既是 DeepSeek Harness (DSH) 插件包，也是 Claude Code 插件，并为未来的 Codex 兼容留出承载位。

三件事：

1. **DSH 适配**：新增 `package.json` + `cordis.patch.yml` + `lib/index.js`，向 DSH `ctx.skills` 注册表的 host 层注册一个技能提供者，使 specpowers 可被 `dsh plugin add` 安装；`skills/` 成为双平台共用的**唯一技能真源**。
2. **技能调用契约改造**：全仓库技能调用从 `<plugin>:<skill>` 插件前缀形式改为 `<skill>` 裸名直接调用，并保留回退为插件前缀的调用方式（供 Claude Code 插件命名空间使用）。
3. **公开仓库优化**：README 中英双语重写、LICENSE 补齐、`.claude/` 与 `.superpowers/` 移出版本控制、内网地址清理、Comet 托管块移除、`AGENTS.md` 厂商中立化。

**非目标（明确不做）**：

- 不实现 Codex 适配本体（无 Codex 环境，无法验证）；只预留承载路径与语法位。
- 不改写 `docs/superpowers/**` 历史文档（改写等于伪造历史记录）。
- 不改动 `opsx:*` 斜杠命令语义（它们是 OpenSpec 生成物，不是本仓库技能）。
- 不重构 Gate 链、状态机、审查路由等业务语义——本次只做平台适配层。
- 不伪造安装成功截图。

## 背景

### 当前形态

specpowers 是 Claude Code 插件（`.claude-plugin/plugin.json` + `marketplace.json`），含 6 个技能（入口 + design/plan/apply/review/archive，合计 1,548 行）、8 个 `refs/` bundled resource、3 个零依赖 `.mjs` 脚本，另有 `commands/specpowers.md`。

### 现状实测数据（本次调查结论，作为设计依据）

**LIVE 作用域**定义：`skills/ commands/ .claude-plugin/ CLAUDE.md README.md` —— 即需要改造的活文件；`docs/` 为历史记录不计入。

| 项 | 数量 | 说明 |
|---|---|---|
| `specpowers:*` 前缀引用 | **31 处**（LIVE）／53 处（全仓库含 docs） | 站点主要在 `skills/*/SKILL.md`（22）、`refs/workflow-protocol.json`（5）、`scripts/workflow-state.mjs`（4） |
| `superpowers:*` 前缀引用 | **15 处**（LIVE）／29 处（含 docs） | `skills/*/SKILL.md`（13）、`refs/onboarding.md`（1）、`CLAUDE.md`（1） |
| 上游 superpowers 技能依赖 | **8 个**（硬依赖） | `brainstorming`、`writing-plans`、`subagent-driven-development`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`verification-before-completion`、`finishing-a-development-branch` |
| `opsx:*` 引用 | 20 处 | OpenSpec 斜杠命令，**非技能**（不在改造范围） |
| `LICENSE` 文件 | 0 个 | README 与 plugin.json 却声明 MIT —— 不一致 |
| 内网地址 | 3 处 | `README.md` ×2、`plugin.json` ×1（`<内网 GitLab 主机>`） |
| 提交进仓库的运行时产物 | 6 个 | `.superpowers/sdd/`（5 份 task 报告 + progress.md） |

> `executing-plans` 仅在 `docs/superpowers/plans/*.md` 的历史样板行中出现，活文件中无引用，**不计入依赖**。
> `writing-skills` 仅在 `skills/specpowers-review/refs/protocols.md:549` 作为**设计理由引用**出现（"Match the Form to the Failure" 原则），非调用，故列为软引用而非硬依赖。

### DSH 侧机制（实测自 profile 与包源码）

- DSH 通过 pnpm 从 GitHub 安装插件：profile `package.json` 实记为 `"superpowers-dsh": "github:LayneChai/superpowers-dsh#<sha>"` —— 因此 **DSH 插件包必须位于仓库根**（子目录包无法被 `github:` spec 解析）。
- `dsh-skill` 定义提供者契约：`list()` 返回候选（`name`/`description`/`whenToUse`/`rank`/`locator`），`get()` 返回正文 + `resourceBase`；`BUNDLED_SKILL_RANK = 600` 为打包技能与本地的标准 rank 分界。
- `superpowers-dsh` 是已验证可用的同构实现，其结构为：`cordis.patch.yml` 插入一行 + `lib/index.js` 内联 `parseFrontmatter → parseSkillFile → discoverCandidates → apply`，零运行时依赖、rank 550、`source: 'custom'`、`resourceBase` 为目录。

### ⚠️ 关键缺陷：现有 frontmatter 会让朴素解析器失效

`superpowers-dsh` 的 `parseFrontmatter` **只支持单行标量**（正则 `^([A-Za-z][\w-]*):\s*(.*)$` 逐行匹配）。specpowers 6 个技能中 **4 个不是单行标量**：

| 技能 | frontmatter 形态 | 照抄 `superpowers-dsh` 解析器的结果 |
|---|---|---|
| `specpowers` | 折叠块 `>` | `description = ">"` ❌ 垃圾值 |
| `specpowers-review` | 折叠块 `>-` | `description = ">-"` ❌ 垃圾值 |
| `specpowers-design` | 多行 plain 续行 | 只剩首行，丢后半句 ⚠️ |
| `specpowers-plan` | 多行 plain 续行 | 只剩首行，丢后半句 ⚠️ |
| `specpowers-apply` | 单行 | 正确 |
| `specpowers-archive` | 单行 | 正确 |

`description` 是 DSH 路由技能的唯一依据（模型据此决定是否用 `skill` 工具加载）。4/6 退化 = 技能套件在 DSH 上「看得见但选不中」，适配等于白做。**这是本设计必须解决的头号技术风险。**

### OpenSpec 内容归属（已核实）

`.claude/skills/openspec-*/SKILL.md`（5 个）与 `.claude/commands/opsx/*.md`（5 个）的 frontmatter 含 `author: openspec`、`generatedBy: "1.4.1"`，官方 supported-tools 文档确认它们是 `openspec init` 的生成产物。因此**不应由本仓库拥有**，移出版本控制并由依赖安装步骤重建。

### Codex 侧机制（已核实）

- **Codex CLI 是 skills-only 工具**：不生成也不识别斜杠命令（`/openspec-*` 在 Codex 中不被识别），技能调用形式为 `$<skill>`。
- **Codex 读取 `.agents/skills/<name>/SKILL.md`** —— 这是 Codex、Zed Agent 与 OpenSpec `agents` 厂商中立目标共用的共享技能根。`.agents` ≠ `.agent`（后者属 Antigravity）。

## 设计决策

### 决策 1：单仓库双清单（DSH 包根 = Claude 插件根）

仓库根同时是 DSH 插件包根和 Claude Code 插件根：

```
specpowers/                          ← 仓库根 = DSH 包根 = Claude Code 插件根
├── package.json            [新增]   DSH 插件清单（dsh.bundle.patch）
├── cordis.patch.yml        [新增]   bundle 层：insert { id: specpowers, name: specpowers }
├── lib/index.js            [新增]   ctx.skills.registerProvider（内联解析器）
├── scripts/verify-dsh-provider.mjs  [新增] 提供者自检（可复现证据）
├── .claude-plugin/         [保留]   Claude Code 清单（repository 改 GitHub）
├── skills/                 [保留]   ★ 双平台唯一技能真源
├── commands/specpowers.md  [保留]   Claude Code /specpowers
├── .claude/                [移出版本控制] openspec init 生成物
├── .superpowers/           [移出版本控制] 运行时状态
├── docs/                   [保留]   开发史
├── AGENTS.md               [新增]   厂商中立指令文件（内容自 CLAUDE.md 迁移）
├── CLAUDE.md               [改为入口] 指针 + @AGENTS.md 导入
├── LICENSE                 [新增]   MIT
├── .gitignore              [更新]
└── README.md / README.en.md [重写]  中英双语
```

**否决的替代方案**：

- *DSH 专用仓库，砍掉 Claude Code*：直接违背「保留回退为插件前缀的调用方式」，且丢弃现有 Claude 用户。
- *双仓库端口（字面照抄 superpowers-dsh）*：`superpowers-dsh` 之所以独立成仓，是因为它 port 的是**别人的**上游（obra/superpowers）；而 specpowers 的 `skills/` 是自有真源，拆两份必然漂移，且裸名/前缀双语法要维护两遍。
- *DSH 包放子目录*：`github:` spec 无法解析子目录包，安装不可行。

### 决策 2：provider 契约（零依赖内联，扩展解析器）

`lib/index.js` 照 `superpowers-dsh` 的结构实现（`parseFrontmatter → parseSkillFile → discoverCandidates → apply`），保持**零运行时依赖**（仅 Node 内置模块），但解析器**必须扩展**以支持 specpowers 实际用到的标量形态：

| 契约项 | 取值 | 理由 |
|---|---|---|
| `name` | `'specpowers'` | provider 标识 |
| `inject` | `['skills']` | 消费注入的 `ctx.skills` 服务 |
| `rank` | `550` | 低于 `BUNDLED_SKILL_RANK = 600`，使项目本地技能仍能覆盖打包技能；与 `superpowers-dsh` 一致 |
| `source` | `'custom'` | prompt 可见的来源分桶 |
| `invocation` | `{ modelInvocable: true, userInvocable: true }` | 模型与人都可调用 |
| `list()` | 扫 `<pkg>/skills/*/SKILL.md`，只读 frontmatter | 按需加载，不过早读正文 |
| `get()` | 按需读正文 | |
| `resourceBase` | `{ kind: 'directory', path: '<pkg>/skills/<name>' }` | 解析技能**自身** bundled resources（`refs/`、`scripts/`）在插件缓存路径下的相对引用；`<SKILL_BASE>` 按约定指**入口技能**基目录（定义见入口技能「脚本路径解析」节），并非此处的本技能目录 |
| `locator` | 技能目录绝对路径 | |
| `path` | `SKILL.md` 绝对路径 | |

**解析器必须支持的标量形态**（这是与 `superpowers-dsh` 的**唯一实质差异**，不可省略）：

1. 单行标量：`key: value`
2. 折叠块标量：`>` / `>-`（行间断行折叠为空格，`-` 剥离尾部换行）
3. 字面块标量：`|` / `|-`（保留换行；当前技能未用，但一并支持以防未来使用）
4. 多行 plain 续行标量：首行后有更深缩进的续行，与首行折叠为空格
5. 引号剥离（单/双引号）、`whenToUse` 可选字段、未知字段透传

**明确否决**：不引入 `yaml` 依赖。DSH 生态的 `dsh-skill-filesystem` 虽用 `yaml`，但 `superpowers-dsh` 已证明零依赖可行；本仓库技能用的标量形态是有限子集，自实现约 40 行且可被自检脚本穷尽验证。多一个运行时依赖就多一个 DSH profile 里安装失败的面。

### 决策 3：技能调用契约 = 裸名为主 + 前缀回退集中 6 处

保留 `Skill({skill: ...})` 外壳，**只把里面的 `"<plugin>:<skill>"` 换成 `"<skill>"`**；回退说明集中在每个 SKILL.md 头部的「平台适配」块，不在 35 个站点（22 + 13）重复。

每个 `skills/*/SKILL.md` 顶部新增（6 处）：

```markdown
> **平台适配（技能调用）**: 技能引用一律用**裸名**。
> - **DSH**: `skill(name: "specpowers-design")`（DSH 工具名为 `skill`，`Skill({skill:...})` 视为等价写法）
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-design"})`；
>   技能注册表要求插件命名空间时回退 `Skill({skill: "specpowers:specpowers-design"})`
>   （superpowers 技能回退 `superpowers:<skill>`）
> - **Codex**: 技能名直呼（见决策 5）
```

**为什么回退写 6 处而非逐站点重复**：DSH 允许**直接加载子技能**（不必先读入口技能），所以回退必须在每个技能内自足；但站点级重复 35 遍会噪声化并在后续编辑中漂移。6 个自足头部 + 站点纯裸名 = 覆盖完整且不漂移。

**改动清单**：

| 位置 | 数量 | 处理 |
|---|---|---|
| `skills/*/SKILL.md` 站点引用 | 22 `specpowers:*` + 13 `superpowers:*` | 前缀剥除为裸名 |
| `skills/*/SKILL.md` 头部 | 6 个文件 | 新增「平台适配」块 |
| `refs/workflow-protocol.json` | 5 个 `skill` 字段 | → 裸名 |
| `scripts/workflow-state.mjs` | 4 处硬编码兜底 | → 裸名（否则状态机输出与协议不一致） |
| `refs/onboarding.md` | 1 处 `superpowers:brainstorming` | → 裸名 |
| `CLAUDE.md` | 1 处 `superpowers:brainstorming` | → 裸名 |
| `opsx:*` | 20 处 | **不动**（斜杠命令，非技能；archive 已有载体降级链） |
| `docs/superpowers/**` | 13 份 | **不动**（历史记录） |

### 决策 4：`.claude/` 与 `.superpowers/` 移出版本控制

`.claude/`（OpenSpec 生成物）与 `.superpowers/`（状态机运行时状态）都是**用户本地内容**，不应进公开仓库。用 `git rm -r --cached` 取消追踪并**保留磁盘文件**，同时写入 `.gitignore`。

- `.gitignore` 新增：`/.superpowers/`、`/.claude/`、`/.agents/`、`/.codex/`
- 现有 7 行逐条列举的 `skills/*-workspace/` 简化为 `skills/*-workspace/`
- 注意 `.claude/` 与 `.claude-plugin/` 是**不同目录**：前者是生成物（忽略），后者是本仓库资产（保留）。`.gitignore` 用根锚定 `/.claude/` 避免误伤
- README 必须补「依赖安装步骤」承载 `.claude/` 的重建（决策 6）

### 决策 5：Codex 兼容预留（不实现本体）

**预留 1 — 平台适配块写成可扩展表**（3 行，Codex 行标注**未验证**）：

| 平台 | 技能调用形式 | 技能承载路径 | 状态 |
|---|---|---|---|
| DSH | `skill(name: "specpowers-design")` | 插件包 `skills/`（provider 注册） | ✅ 本次实现 |
| Claude Code | `Skill({skill: "specpowers-design"})`；命名空间要求时回退 `Skill({skill: "specpowers:specpowers-design"})` | `.claude-plugin` → `skills/` | ✅ 现有 |
| Codex CLI | 技能名直呼（官方文档记为 `$<skill>` 形式） | `.agents/skills/<name>/SKILL.md` | 🔲 预留·未验证 |

Codex 行必须标注未验证——没有 Codex 环境就不谎称支持。

**预留 2 — `AGENTS.md` 作为厂商中立指令文件**：`CLAUDE.md` 内容迁移为 `AGENTS.md`（Codex/Zed/DSH 都读 `AGENTS.md`；`superpowers-dsh` 的 `dsh-tools.md` 亦指出 DSH 不自动加载 `CLAUDE.md`）。`CLAUDE.md` 保留为入口：指针文字 + `@AGENTS.md` 导入（供支持 memory import 的 Claude Code 版本）。若导入不生效，指针文字仍能引导——双保险。

**预留 3 — 技能正文工具/路径中立化**：2 处「读取 CLAUDE.md（项目指令）」泛化为「读取项目指令文件（`CLAUDE.md` / `AGENTS.md`）」，使技能在 Codex 下零改写即可运行。工具映射集中到 `refs/platform-tools.md`，技能正文不硬编码平台工具名。

**预留 4 — 新建 `refs/platform-tools.md`（不沿用 `dsh-tools.md` 命名）**：三节——DSH（已实现）／Claude Code（已实现）／Codex（预留）。该文件目前**尚不存在**，直接以 `platform-tools.md` 为名创建；理由是加入 Codex 后 `dsh-tools` 名不副实，先正名可免后续改名。

**预留 5 — README 依赖步骤**：Claude 用 `openspec init --tools claude`；Codex 用 `openspec init --tools codex`（写入 `.agents/skills/`）。

**为什么不现在实现**：Codex 无 skill 注册表/插件机制，只能在 `.agents/skills/` 放文件；无环境则无法验证，写了就是未经验证的声称。预留的价值在于让未来适配**只是打包层增量**（加一个把 `skills/` 映射到 `.agents/skills/` 的同步脚本），而**不需改技能正文**。

### 决策 6：README 双语 + 依赖安装步骤

`README.md`（中文主）+ `README.en.md`（英文），顶部互链。结构：

```
标题 + 一句话定位（DSH 插件 + Claude Code 技能组）
技能组架构（ASCII 图 + 6 技能表）
安装
  ├── 前置依赖表
  ├── 在 DeepSeek Harness 中安装（一条命令 / 让 DSH 自己装 / 重启验证 / 卸载）
  ├── 在 Claude Code 中安装（marketplace / 手动 / 本地开发）
  └── 依赖安装步骤
快速开始（触发方式 + 执行模式表）
Phase 工作流 0→4
审查体系（两级路由 / UltraReview / 收敛判定）
平台适配（Claude Code ↔ DSH ↔ Codex 差异表）
目录结构
开发（含「evals 仅支持 Claude Code 引擎」的限制说明）
许可
```

**依赖安装步骤**（`.claude/` 移出 git 的配套，必须写准）：

1. **OpenSpec CLI** → `openspec init --tools claude` 生成 `.claude/skills/openspec-*/` 与 `.claude/commands/opsx/`；Codex 用户用 `--tools codex`（写入 `.agents/skills/`）
2. **Superpowers 技能组** — DSH 装 `superpowers-dsh`；Claude Code 装 `superpowers` 插件。specpowers 实际硬依赖 **8 个**上游技能：`brainstorming`、`writing-plans`、`subagent-driven-development`、`test-driven-development`、`systematic-debugging`、`requesting-code-review`、`verification-before-completion`、`finishing-a-development-branch`
3. **CodeGraph / Graphify**（可选）

**视觉素材**：不伪造安装截图；改用文字手写的 `static/architecture.svg` 架构图（可 diff、无虚构）。真实截图留给用户后续补。

### 决策 7：仓库清理与外部地址

| 文件 | 改动 |
|---|---|
| `LICENSE` | 新增 MIT（消除与 README/plugin.json 声明的矛盾） |
| `.claude-plugin/plugin.json` | `repository` → `https://github.com/SAXEM1997/specpowers.git` |
| `README.md` | 2 处内网 GitLab 地址 → GitHub |
| `AGENTS.md` | 新增，内容自 `CLAUDE.md` 迁移，并移除 `<comet-ambient-resume>` 托管块（94-109 行，第三方工具耦合） |
| `CLAUDE.md` | 改为入口（指针 + `@AGENTS.md`） |
| `skills/specpowers/scripts/hooks-reference.yaml` | 移除 comet-hook-router 互斥说明（第三方工具耦合） |
| `skills/specpowers/SKILL.md:65` | 移除 kernel 用户迁移路径中的 `.comet/` 引用 |
| `docs/specpowers-review-enhancement-v2.md`、`docs/superpowers/**` | **保留**（开发史，用户明确要求不删） |

`AGENTS.md` 另需同步：目录结构表标注 `.claude/` 为生成物、外部依赖表增补 DSH/`superpowers-dsh`、新增「DSH 适配」节（双清单 + provider 契约）、关键设计决策 2 的 `superpowers:brainstorming` 改裸名。

## 文件级改动清单

**新增（9）**

```
package.json                          DSH 插件清单
cordis.patch.yml                      bundle 层插入行
lib/index.js                          provider（内联 frontmatter 解析器）
scripts/verify-dsh-provider.mjs       提供者自检
LICENSE                               MIT
AGENTS.md                             厂商中立指令（自 CLAUDE.md 迁移）
README.en.md                          英文 README
static/architecture.svg               手写架构图
skills/specpowers/refs/platform-tools.md   三平台工具映射 + 降级路径
```

**修改**

```
README.md                             重写（双语主档）
CLAUDE.md                             改为入口（指针 + @AGENTS.md）
.gitignore                            .superpowers/ .claude/ .agents/ .codex/ + 简化
.claude-plugin/plugin.json            repository → GitHub
skills/*/SKILL.md          ×6        前缀剥除 + 平台适配块
skills/specpowers/refs/workflow-protocol.json   5 个 skill 字段 → 裸名
skills/specpowers/scripts/workflow-state.mjs    4 处兜底 → 裸名
skills/specpowers/refs/onboarding.md            1 处 → 裸名
skills/specpowers/scripts/hooks-reference.yaml  移除 comet 互斥说明
skills/specpowers/SKILL.md                      移除 .comet/ 迁移引用
docs/superpowers/plans/**             （不改，仅登记为不改动项）
```

**删除（仅取消 git 追踪，保留磁盘文件）**

```
.claude/**                             openspec init 生成物
.superpowers/**                        运行时状态
```

## 实施约束

这些是设计不变量，实施顺序若违反会直接造成破坏：

1. **`.gitignore` 必须先于 `git rm --cached`**：先写入 `/.claude/`、`/.superpowers/`、`/.agents/`、`/.codex/`，再执行取消追踪；顺序反了后续 `git add -A` 会把它们重新加回。
2. **必须用 `git rm -r --cached`**：绝不能省 `--cached`，否则本地 `.claude/` 被物理删除，Claude Code 自动发现路径失效。
3. **解析器须对「未修改的 frontmatter」独立验证**：技能改造只新增平台适配块、不改 frontmatter，因此验证 #1 应在技能编辑**之前**即可跑通——解析器要解决的是既有的 4 个非标量 `description`，与本次编辑无关。这也让解析器缺陷与编辑缺陷可分离定位。
4. **站点剥除不得触及 6 个平台适配块内的回退示例**：回退示例必然包含 `specpowers:specpowers-design`、`superpowers:<skill>` 字样，它们是指南内容而非调用站点。建议**先剥站点、后加平台适配块**，可天然避免自伤。另：剥除指令必须用 `s/specpowers:specpowers/specpowers/g`（**无尾随连字符**），否则入口技能的 8 个 `specpowers:specpowers` 站点漏改（实测）。
5. **`workflow-protocol.json` 与 `workflow-state.mjs` 必须同步改**：两者是同一契约的生产者与消费者；只改一处会导致状态机输出与协议不匹配（验证 #4 拦截）。
6. **`.claude-plugin/` 不可被误伤**：用根锚定 `/.claude/`，并在验证 #5 中校验两个清单文件仍被 git 追踪。
7. **`.claude/` 移出后本仓库自身仍可用**：磁盘文件保留，本地 Claude Code 会话的自动发现不受影响；仅是不再随仓库分发。

## 验证（可执行证据）

| # | 验证项 | 方法 | 通过判据 |
|---|---|---|---|
| 1 | frontmatter 解析 | `node scripts/verify-dsh-provider.mjs`，以 stub `ctx` 注册 provider 后调 `list()` | 6 技能解析出正确裸名；`description` 非空、首字符非 `>`/`\|`、无内部换行、且含各自**末句锚点**：`specpowers`→`Do NOT use for: single-file bugfixes`；`specpowers-review`→`before proceeding to next phase`；`specpowers-design`→`routes to Phase 0 or Phase 1`；`specpowers-plan`→`routes to Phase 2`；`specpowers-apply`→`execute TDD tasks`；`specpowers-archive`→`finish this change` |
| 2 | 前缀残留 | grep `specpowers:specpowers` 与 `superpowers:`，作用域 `skills/ lib/ commands/ .claude-plugin/ CLAUDE.md AGENTS.md README*.md` | **白名单外**残留 = 0。注意模式必须写作 `specpowers:specpowers`（**无尾随连字符**）——入口技能引用是 `specpowers:specpowers`，带连字符的模式会漏掉 8 个站点（实测）。白名单（这些位置**应当**保留前缀字样，因为它们是回退指南而非调用站点）：① 6 个 `skills/*/SKILL.md` 的「平台适配」块；② `skills/specpowers/refs/platform-tools.md`；③ `README.md`、`README.en.md` 的平台适配表。逐块/逐文件校验而非整文件豁免——`docs/` 历史不计入 |
| 3 | provider 契约 | 自检脚本调 `get()` | `content` 非空；`resourceBase.kind === 'directory'` 且指向 `skills/<name>/`；`refs/`、`scripts/` 真实可达 |
| 4 | 协议/状态机一致 | 解析 `workflow-protocol.json` + 跑 `workflow-state.mjs status` | 5 个 `skill` 字段全裸名；状态机输出的 `SKILL:` 值全裸名 |
| 5 | 清单有效性 | 解析三个清单文件 | `package.json` JSON 合法且 `dsh.bundle.patch` 指向存在的文件；`cordis.patch.yml` 能解析出 `id: specpowers` 的 insert 行；`.claude-plugin/*.json` 合法 |
| 6 | 技能文件无损坏 | 6 个 SKILL.md 重解析 + 行数对比 | 除调用语法与新增平台适配块外无意外改动；Gate/前置检查/路由表结构完整 |
| 7 | 无内网地址残留 | 全仓库 grep `<内网 GitLab 主机>\|<internal-domain>` | 0 命中 |
| 8 | 无 Comet 残留 | grep `comet`，作用域同 #2、**排除 `docs/`** | 0 命中（本设计文档自身提及 Comet，属 `docs/` 历史，按定义排除） |

**已知限制（诚实声明）**：完整的 `dsh plugin --profile web add` 端到端安装需写 `/dsh-home/profiles/web/`，位于工作区之外，`workspace-write` 沙箱会拒绝。因此 #1–#8 全部在工作区内完成，验证的是**同一份 provider 代码的真实执行**，而非声称「已装好」。若要真实安装验证，需另起 `--profile` 测试 profile 并申请一次沙箱提权——由用户决定是否执行。

## 风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| frontmatter 解析器覆盖不全 | 技能描述退化 → DSH 上选不中技能 | #1 用末句锚点断言穷尽 6 个技能；解析器实现 4 种标量形态 |
| 站点级前缀剥除漏改 | Claude Code 下技能调用失败 | #2 grep 判据 + 6 个平台适配块自足回退 |
| 白名单误放行真实调用站点 | 漏改的前缀调用逃过验证 | 白名单按**块/文件**粒度逐项校验，不做整文件豁免；`refs/platform-tools.md` 与两份 README 是仅有的三个非 SKILL.md 白名单项 |
| `docs/` 历史含前缀字符串 | 朴素 grep 判据误报 | #2 明确限定作用域并排除 `docs/` |
| `.gitignore` 误伤 `.claude-plugin/` | Claude Code 清单丢失 | 用根锚定 `/.claude/`；#5 校验清单存在 |
| rank 550 与本地技能冲突 | 打包技能被覆盖 | 设计如此（本地优先）；README 说明 |
| Codex 预留被误读为已支持 | 用户预期落空 | 平台表 Codex 行显式标注「预留·未验证」；README 同步标注 |
| `@AGENTS.md` import 不受支持 | Claude Code 读不到指令 | `CLAUDE.md` 同时保留指针文字，双保险 |

## 兼容性影响

- **Claude Code 用户**：技能调用语法变裸名。若其技能注册表要求插件命名空间，6 个技能头部的平台适配块给出 `specpowers:<skill>` 回退，行为不中断。
- **DSH 用户**：新增能力，此前无法安装。
- **OpenSpec 工作流**：`/opsx:*` 语义不变；`openspec init` 仍是 `.claude/` 的唯一来源。
- **状态机产物**：`.superpowers/state.json` 与 `.gate-passed-*` 格式不变，仅 `SKILL:` 输出值由带前缀改为裸名。已 init 的项目升级后，状态文件不需迁移。
- **技能正文业务语义**：Gate 链、审查路由、收敛判定、决策树全部不变。
