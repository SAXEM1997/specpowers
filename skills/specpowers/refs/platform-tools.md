# 平台适配参考（DSH / Claude Code / Codex）

specpowers 的技能正文按**平台中立**书写：技能一律用裸名引用，不硬编码任何平台的工具名。
本文件是那个映射的正本——当技能正文提到某个在本平台不存在的工具、hook 或机制时，等价物写在这里。

## 技能调用形式

| 平台 | 调用形式 | 技能承载路径 | 状态 |
|---|---|---|---|
| **DSH**（DeepSeek Harness） | `skill(name: "<裸名>")` | 插件包 `skills/`，由 `lib/index.js` provider 注册进 host 技能注册表 | ✅ 已实现 |
| **Claude Code** | 裸名可用则 `Skill({skill: "<裸名>"})`；技能注册表要求插件命名空间时回退 `Skill({skill: "specpowers:<裸名>"})`（上游技能回退 `Skill({skill: "superpowers:<裸名>"})`） | `.claude-plugin/plugin.json` 的 `skills: "./skills"` | ✅ 已实现 |
| **Codex CLI** | 技能名直呼（Codex 是 skills-only 工具，官方文档记为 `$<skill>` 形式；`/openspec-*` 不被识别） | `.agents/skills/<name>/SKILL.md`（Codex 与 Zed Agent 共用的共享技能根） | 🔲 预留·**未验证** |

> **Codex 行为未经本仓库验证**——没有 Codex 环境就无法验证，因此标注为预留而非支持。
> 预留的价值：未来适配只需增加一个把 `skills/` 映射到 `.agents/skills/` 的打包层脚本，
> **不需要改任何技能正文**。注意 `.agents` ≠ `.agent`（后者属 Antigravity）。

## 核心工具映射（Claude Code → DSH）

| Claude Code | DSH 等价物 | 说明 |
| --- | --- | --- |
| `Skill({skill: ...})` | `skill(name: ...)` | DSH 的技能加载工具；裸名寻址，无插件前缀 |
| `Bash` | `pwsh`（Windows）/ `bash`（POSIX） | 按宿主平台选择 |
| `Read` / `Write` / `Edit` | `read` / `write` / `edit` | 语义相同；DSH 的 write/edit 带 `sandbox_permissions` 提权参数 |
| `Glob` / `Grep` | `glob` / `grep` | `glob` 只返回文件（不返回目录）；`grep` 用 ripgrep 语法 |
| `TodoWrite` | `todo_write` | 每次调用整表替换 |
| `Task`（子代理） | `subagent` / `subagent_fork` | 默认后台运行；`subagent_fork` 继承当前会话上下文 |
| `AskUserQuestion` | `ask_user_question` | 问题带稳定 id 并在回答中回显 |
| `WebSearch` | `web_search` | 返回摘要答案 + 来源 URL |
| `WebFetch` | `web_fetch` | 抓取指定 HTTP(S) URL 内容并解码为文本 |
| 目录列举 | `glob` + `read` | DSH 无独立的目录列举工具 |
| Plan mode | `exit_plan_mode` | 呈现计划，批准后离开 plan mode 并执行 |
| `Read`（图像文件） | `read_image` | 仅 PNG/JPEG/WebP/GIF |
| 后台任务 | 工具的 `run_in_background: true` | 用 `job_output` / `job_kill` / `job_list` 管理 |

## DSH 特有工具（值得 specpowers 利用）

- `goal` 工具族（`create_goal` / `get_goal` / `update_goal`）：跨自动续轮的同会话完成目标。
- `workflow`：把工作扇出到多个子代理，带 phase 与结构化结果——DSH 原生的规模化并行手段。
- `ralph`：全新 agent 的迭代循环（仅在人类显式要求时使用）。

## 降级路径（机制缺失时怎么办）

### hooks

DSH **没有 hook 系统**。specpowers 的 hooks 本就默认 off（模板在 `scripts/hooks-reference.yaml`，需显式注册到 `.claude/settings.json` 才生效），因此天然兼容：

- Gate 强制**不依赖 hooks**——主力是技能文本纪律 + `scripts/workflow-guard.mjs` 的显式调用（Gate 出口由子技能主动执行）。
- `scripts/hook-validate-token.mjs` 是 best-effort 的可选加固，DSH 上直接忽略，不影响任何 Gate 的裁定。
- 最终裁判始终是 `.superpowers/.gate-passed-<N>` 文件（token 内 `name=` 行与当前 `<name>` 匹配），与平台无关。

### 斜杠命令

DSH **没有插件斜杠命令**。`/opsx:*` 与 `/specpowers` 不可用：

- **`/opsx:*`**（OpenSpec 命令）：specpowers-archive Step 3 已有**载体降级链**——会话无该命令时改用 `openspec` CLI 或手工归档产物。降级的是执行载体，归档步骤本身不可跳过。
- **`/specpowers`**（本仓库 `commands/specpowers.md`，Claude Code 专用）：DSH 上改为**直接加载入口技能** `skill(name: "specpowers")`，或自然语言触发（"启动 specpowers 流程"）。入口技能的路由逻辑不依赖斜杠命令。

### 路径与脚本

- 技能正文用 `<SKILL_BASE>` 指代技能基目录。DSH 由 provider 的 `resourceBase`（指向 `skills/<name>/`）解析，Claude Code 由技能的 Base directory 解析——两者都成立。
- `scripts/*.mjs` 是零依赖 Node 脚本，通过 `import.meta.url` 自定位，cwd 无关，因此两个平台都能直接 `node <路径>` 执行。
- 本仓库不随附任何 `.sh` 辅助脚本——不存在 POSIX-only 的辅助脚本需要担心，Windows 缺 bash 不构成降级点。
