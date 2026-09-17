# specpowers DSH 适配改造 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 specpowers 技能组可在 DeepSeek Harness 上作为插件安装使用，同时保持 Claude Code 可用，并把技能调用语法从 `<plugin>:<skill>` 前缀改为 `<skill>` 裸名（保留前缀回退），最后完成公开仓库优化。

**Architecture:** 单仓库双清单——仓库根同时是 DSH 插件包根（`package.json` + `cordis.patch.yml` + `lib/index.js` provider）与 Claude Code 插件根（`.claude-plugin/`）；`skills/` 是双平台唯一技能真源。provider 照 `superpowers-dsh` 的零依赖内联结构实现，但 frontmatter 解析器必须扩展以支持 specpowers 实际使用的折叠块标量与多行 plain 续行标量。

**Tech Stack:** Node.js ≥ 20（仅标准库，零运行时依赖）；Cordis 插件接口（`ctx.skills.registerProvider`）；GNU sed 用于批量文本替换；无测试框架——验证用零依赖 Node 脚本 + grep 断言。

**Spec:** `docs/superpowers/specs/2026-09-17-dsh-adaptation-design.md`

## Global Constraints

- GitHub 仓库地址统一为 `https://github.com/SAXEM1997/specpowers`（`.git` 后缀形式用于 clone：`https://github.com/SAXEM1997/specpowers.git`）。
- DSH 包 `name` = `specpowers`，`version` = `1.0.0`，`type` = `"module"`，`main` = `lib/index.js`；`dsh.bundle.patch` = `./cordis.patch.yml`。
- **零运行时依赖**：`lib/` 与 `scripts/` 只允许 `node:*` 内置模块。禁止引入 `yaml`、`js-yaml` 等任何第三方包。
- provider `rank` = **550**（低于 `BUNDLED_SKILL_RANK = 600`）；`source` = `'custom'`；`invocation` = `{ modelInvocable: true, userInvocable: true }`。
- 技能调用一律裸名。前缀剥除的 sed 模式**必须**是 `s/specpowers:specpowers/specpowers/g`（**无尾随连字符**——入口技能引用是 `specpowers:specpowers`，带连字符的模式会漏改 8 个站点）。
- 回退示例中保留的前缀写法：`specpowers:<skill>`、`superpowers:<skill>`。
- `docs/superpowers/**` 历史文档**一律不改**。
- `opsx:*` 斜杠命令**一律不改**（是 OpenSpec 生成物，不是技能）。
- 已追踪文件中不得出现内网主机名字面量（`<内网 GitLab 主机>` 或 `<internal-domain>`）。**本计划与 spec 自身也受此约束**：文档里记录验证命令时以 `<内网 GitLab 主机>` 占位、命令中用 `INTERNAL_HOST='<实际主机名>'` 变量，绝不写字面量——否则「清理内网地址」的文档本身就成了泄露源。git 历史提交信息中的 1 处残留无法在不重写历史的前提下消除，须在推送前向用户报告由其决定。
- 活文件（`skills/ lib/ commands/ .claude-plugin/ CLAUDE.md AGENTS.md README*.md`）不得出现 `comet` 字样。
- `.claude/` 与 `.superpowers/` 只取消 git 追踪，**必须保留磁盘文件**：只能用 `git rm -r --cached`，绝不能省 `--cached`。
- 中文为主文档语言；`README.md` 中文、`README.en.md` 英文。
- 环境为 Linux + GNU sed；`node` v22。

---

## File Structure

**新增**

| 文件 | 职责 |
|---|---|
| `package.json` | DSH 插件包清单（`dsh.bundle.patch` 指向 bundle 层补丁） |
| `cordis.patch.yml` | bundle 层：向 dsh-base 之上 insert 一行 specpowers provider |
| `lib/index.js` | Cordis 插件：`ctx.skills.registerProvider`；内含零依赖 frontmatter 解析器 |
| `scripts/verify-dsh-provider.mjs` | 打包自检：清单有效性 + `list()` 契约 + `get()` 契约 + 相对资源可达 |
| `skills/specpowers/refs/platform-tools.md` | 三平台（DSH/Claude Code/Codex）工具映射 + 降级路径 |
| `AGENTS.md` | 厂商中立项目指令（内容自 `CLAUDE.md` 迁移） |
| `README.en.md` | 英文 README |
| `LICENSE` | MIT |
| `static/architecture.svg` | 手写架构图 |

**修改**

| 文件 | 改动 |
|---|---|
| `skills/*/SKILL.md` ×6 | 站点前缀剥除 + 头部新增「平台适配」块 |
| `skills/specpowers/SKILL.md` | 另：`带 provider 前缀` 描述改裸名；移除 `.comet/` 引用（均按内容定位，插入平台块后行号会偏移） |
| `skills/specpowers/refs/workflow-protocol.json` | 5 个 `skill` 字段 → 裸名 |
| `skills/specpowers/scripts/workflow-state.mjs` | 4 处硬编码兜底 → 裸名 |
| `skills/specpowers/refs/onboarding.md` | 1 处 `superpowers:brainstorming` → 裸名 |
| `skills/specpowers/scripts/hooks-reference.yaml` | 移除 comet-hook-router 互斥说明 |
| `CLAUDE.md` | 改为入口（指针 + `@AGENTS.md`） |
| `.gitignore` | 新增 4 个忽略目录 + 简化 workspace 行 |
| `.claude-plugin/plugin.json` | `repository` → GitHub |
| `README.md` | 重写（双语主档） |

**取消 git 追踪（保留磁盘文件）**：`.claude/**`、`.superpowers/**`

---

## Task 1: DSH 包骨架与清单自检

**Files:**
- Create: `package.json`
- Create: `cordis.patch.yml`
- Create: `scripts/verify-dsh-provider.mjs`（本任务只写清单段）

**Interfaces:**
- Consumes: 无
- Produces: `package.json` 的 `dsh.bundle.patch` 字段（Task 11 校验）；`cordis.patch.yml` 的 insert 行 `id: specpowers`；`scripts/verify-dsh-provider.mjs`（Task 2、3 继续追加断言）

- [ ] **Step 1: 写清单自检（先写测试）**

创建 `scripts/verify-dsh-provider.mjs`：

```js
#!/usr/bin/env node
// specpowers DSH 打包自检：清单有效性 + provider list()/get() 契约。
// 零依赖（纯 Node.js 标准库）。用法：node scripts/verify-dsh-provider.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

// ---- 清单有效性 ----
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
assert.equal(pkg.name, 'specpowers', 'package.json name 必须为 specpowers')
assert.equal(pkg.type, 'module', 'package.json type 必须为 module')
assert.equal(pkg.main, 'lib/index.js', 'package.json main 必须为 lib/index.js')
assert.equal(pkg.license, 'MIT', 'package.json license 必须为 MIT')
assert.deepEqual(
  pkg.dsh?.bundle?.patch,
  './cordis.patch.yml',
  'package.json dsh.bundle.patch 必须为 ./cordis.patch.yml'
)
assert.ok(
  existsSync(join(root, pkg.dsh.bundle.patch)),
  `dsh.bundle.patch 指向的文件不存在：${pkg.dsh.bundle.patch}`
)

const patchLines = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line !== '' && !line.startsWith('#'))
assert.deepEqual(
  patchLines,
  ['- insert:', "- id: specpowers", "name: 'specpowers'"],
  'cordis.patch.yml 必须只含一行 insert，插入 id/name 均为 specpowers'
)
console.log('PASS manifests: package.json + cordis.patch.yml')
```

- [ ] **Step 2: 运行自检，确认失败**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: FAIL —— `ENOENT: no such file or directory, open '.../package.json'`

- [ ] **Step 3: 创建 package.json**

创建 `package.json`：

```json
{
  "name": "specpowers",
  "description": "SpecPowers for the DeepSeek Harness and Claude Code: a spec-driven + test-driven engineering skill group fusing OpenSpec and Superpowers",
  "version": "1.0.0",
  "private": false,
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./package.json": "./package.json"
  },
  "files": [
    "lib",
    "scripts",
    "skills",
    "commands",
    "static",
    ".claude-plugin",
    "cordis.patch.yml",
    "AGENTS.md",
    "README.md",
    "README.en.md",
    "LICENSE"
  ],
  "license": "MIT",
  "keywords": [
    "dsh",
    "deepseek-harness",
    "plugin",
    "skills",
    "specpowers",
    "openspec",
    "superpowers",
    "sdd",
    "tdd"
  ],
  "dsh": {
    "bundle": {
      "patch": "./cordis.patch.yml"
    }
  }
}
```

- [ ] **Step 4: 创建 cordis.patch.yml**

创建 `cordis.patch.yml`（末尾保留一个换行）：

```yaml
# specpowers bundle patch: mount the specpowers skill provider into the host
# skill registry (its rows are host-plane, so every agent preset's scope chain
# merges the skills it registers).
#
# This patch is applied over the dsh-base layer; later layers (the profile's own
# cordis.patch.yml and --patch overlays) can still address this row by id.
- insert:
    - id: specpowers
      name: 'specpowers'
```

- [ ] **Step 5: 运行自检，确认通过**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: `PASS manifests: package.json + cordis.patch.yml`

- [ ] **Step 6: Commit**

```bash
git add package.json cordis.patch.yml scripts/verify-dsh-provider.mjs
git commit -m "feat(dsh): DSH 插件包骨架——package.json 清单 + bundle 层补丁 + 自检脚本"
```

---

## Task 2: provider frontmatter 解析器与 list()

**Files:**
- Create: `lib/index.js`
- Modify: `scripts/verify-dsh-provider.mjs`（追加 `list()` 断言段）

**Interfaces:**
- Consumes: Task 1 的 `scripts/verify-dsh-provider.mjs`
- Produces: `lib/index.js` 导出 `apply(ctx)`、`name`、`inject`；`apply` 通过 `ctx.skills.registerProvider(factory)` 注册工厂，工厂返回 `{ name, list(options), get(candidate, options) }`（`get` 在 Task 3 实现）。候选对象含 `name`、`description`、`whenToUse?`、`invocation`、`source`、`provider`、`rank`、`locator`、`path`、`metadata?`

> **背景（必读）**：`superpowers-dsh` 的 `parseFrontmatter` 只支持单行标量。specpowers 6 个技能中 4 个不是单行标量——`specpowers` 与 `specpowers-review` 用折叠块 `>` / `>-`，`specpowers-design` 与 `specpowers-plan` 用多行 plain 续行。照抄朴素解析器会得到字面 `">"`、`">-"` 或被截断的 `description`，而 `description` 是 DSH 路由技能的唯一依据——结果是技能看得见但选不中。本任务的解析器因此**必须**支持 4 种标量形态。

- [ ] **Step 1: 追加 list() 断言（先写测试）**

在 `scripts/verify-dsh-provider.mjs` 末尾追加：

```js
// ---- provider list() 契约 ----
const mod = await import(join(root, 'lib', 'index.js'))
assert.equal(mod.name, 'specpowers', 'provider 名必须为 specpowers')
assert.deepEqual(mod.inject, ['skills'], 'provider 必须注入 skills 服务')

let factory
mod.apply({ skills: { registerProvider(fn) { factory = fn } } })
assert.equal(typeof factory, 'function', 'apply() 必须通过 ctx.skills.registerProvider 注册工厂')

const provider = factory({ invalidate() {} })
assert.equal(provider.name, 'specpowers', 'provider.name 必须为 specpowers')

const candidates = await provider.list({})
assert.equal(candidates.length, 6, `skills/ 下应有 6 个技能，实测 ${candidates.length}`)

// 锚点取各自 description 的末句——折叠块未展开或续行被截断时必然缺失
const EXPECTED = [
  ['specpowers', 'Do NOT use for: single-file bugfixes'],
  ['specpowers-design', 'routes to Phase 0 or Phase 1'],
  ['specpowers-plan', 'routes to Phase 2'],
  ['specpowers-apply', 'execute TDD tasks'],
  ['specpowers-review', 'before proceeding to next phase'],
  ['specpowers-archive', 'finish this change']
]

for (const [skillName, anchor] of EXPECTED) {
  const candidate = candidates.find((entry) => entry.name === skillName)
  assert.ok(candidate, `缺少技能 ${skillName}`)
  assert.equal(candidate.rank, 550, `${skillName} rank 应为 550`)
  assert.equal(candidate.source, 'custom', `${skillName} source 应为 custom`)
  assert.equal(candidate.invocation.modelInvocable, true, `${skillName} 应可被模型调用`)
  assert.equal(candidate.invocation.userInvocable, true, `${skillName} 应可被人调用`)
  const description = candidate.description
  assert.ok(
    description.length > 40,
    `${skillName} description 过短（${description.length}）：${JSON.stringify(description)}`
  )
  assert.ok(
    !description.startsWith('>') && !description.startsWith('|'),
    `${skillName} description 未展开块标量：${JSON.stringify(description)}`
  )
  assert.ok(
    !description.includes('\n'),
    `${skillName} description 含内部换行：${JSON.stringify(description)}`
  )
  assert.ok(
    description.includes(anchor),
    `${skillName} description 缺末句锚点 ${JSON.stringify(anchor)}：${JSON.stringify(description)}`
  )
}
console.log(`PASS list(): ${EXPECTED.length} 技能，裸名与 description 锚点全部正确`)
```

- [ ] **Step 2: 运行自检，确认失败**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: 先打印 `PASS manifests: ...`，随后 FAIL —— `Cannot find module '.../lib/index.js'`

- [ ] **Step 3: 创建 lib/index.js**

创建 `lib/index.js`：

```js
// specpowers: SpecPowers skills for the DeepSeek Harness.
//
// A Cordis plugin that registers one skill provider into the HOST layer of the
// `ctx.skills` registry, so every agent preset's scope chain merges these
// skills. Skill bodies live in `../skills/<name>/SKILL.md` inside this
// package; the provider locates them from `import.meta.url` (an assembly fact
// of this package, never user config) and loads bodies on demand.
//
// The provider protocol mirrors @deepseek-ai/dsh-skill-filesystem:
//   - list()  discovers directory-bundle candidates (name/description from
//     YAML frontmatter, body left unread until requested)
//   - get()   parses the winning candidate's SKILL.md and returns the full
//     definition with a directory resource base for relative references
//
// @module specpowers
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const name = 'specpowers'
const inject = ['skills']

/** Registry precedence for packaged skill providers: ranks below the local bundled root (600). */
const PACKAGED_SKILL_RANK = 550

/** The source bucket these skills advertise under (prompt-visible metadata). */
const SOURCE = 'custom'

/** A top-level `key:` line. Indented lines belong to a block scalar or nested mapping. */
const KEY_RE = /^([A-Za-z][\w-]*):(.*)$/

/**
 * Strip one layer of matching single or double quotes.
 * @param value - the raw scalar text.
 * @returns the unquoted text.
 */
function unquote(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * Fold the lines of a YAML folded block scalar: single line breaks become
 * spaces, blank lines become newlines.
 * @param lines - block scalar lines with base indentation already removed.
 * @returns the folded text.
 */
function foldLines(lines) {
  const paragraphs = []
  let buffer = []
  for (const line of lines) {
    if (line === '') {
      paragraphs.push(buffer.join(' '))
      buffer = []
    } else {
      buffer.push(line)
    }
  }
  paragraphs.push(buffer.join(' '))
  return paragraphs.join('\n')
}

/**
 * Parse the YAML frontmatter block of a SKILL.md into metadata plus body.
 *
 * Unlike a naive line-by-line scalar reader, this handles every scalar form the
 * specpowers skills actually use: single-line scalars, folded block scalars
 * (`>` / `>-`), literal block scalars (`|` / `|-`), and multi-line plain
 * scalars whose continuation lines are indented. `description` is the only
 * routing signal DSH has, so silently degrading it to `>` or truncating it
 * would make skills discoverable but unselectable.
 *
 * @param text - the raw skill file contents.
 * @returns parsed metadata object and the markdown body after the block, or
 *   null when the file has no frontmatter block at all.
 */
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const block = text.slice(3, end)
  const body = text.slice(end + 4).replace(/^\n+/, '')
  const metadata = {}
  const lines = block.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Top-level keys only: skip blanks, comments, and already-claimed indented lines.
    if (/^\s*$/.test(line) || /^\s*#/.test(line) || /^\s/.test(line)) {
      i++
      continue
    }
    const match = KEY_RE.exec(line)
    if (match === null) {
      i++
      continue
    }
    const key = match[1]
    const rest = match[2].trim()
    if (rest === '') {
      // Nested mapping (e.g. `metadata:`): consume its indented block verbatim.
      const nested = []
      i++
      while (i < lines.length && (/^\s/.test(lines[i]) || /^\s*$/.test(lines[i]))) {
        nested.push(lines[i])
        i++
      }
      metadata[key] = nested.join('\n')
      continue
    }
    if (rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
      const folded = rest[0] === '>'
      const collected = []
      let baseIndent = -1
      i++
      while (i < lines.length) {
        const current = lines[i]
        if (/^\s*$/.test(current)) {
          collected.push('')
          i++
          continue
        }
        const indent = current.length - current.trimStart().length
        if (baseIndent === -1) baseIndent = indent
        else if (indent < baseIndent) break
        collected.push(current.slice(baseIndent))
        i++
      }
      while (collected.length > 0 && collected[collected.length - 1] === '') collected.pop()
      // `>` clips and `>-` strips a trailing newline; both are normalized away
      // because DSH consumes a description as single-line routing text.
      metadata[key] = folded ? foldLines(collected) : collected.join('\n')
      continue
    }
    // Plain scalar, possibly continued on more-indented following lines.
    const parts = [rest]
    i++
    while (i < lines.length && /^\s+\S/.test(lines[i])) {
      parts.push(lines[i].trim())
      i++
    }
    metadata[key] = unquote(parts.join(' '))
  }
  return { metadata, body }
}

/**
 * Read and parse one skill directory's SKILL.md.
 * @param skillFile - absolute path to the SKILL.md file.
 * @param signal - optional cancellation; aborts the read.
 * @returns the parsed skill record, or undefined when the file vanished.
 */
async function parseSkillFile(skillFile, signal) {
  let text
  try {
    text = await readFile(skillFile, 'utf8')
  } catch {
    return undefined
  }
  if (signal?.aborted) return undefined
  const parsed = parseFrontmatter(text)
  if (parsed === null) return undefined
  return {
    name: parsed.metadata.name ?? '',
    description: parsed.metadata.description ?? '',
    whenToUse: parsed.metadata.whenToUse,
    metadata: parsed.metadata,
    content: parsed.body
  }
}

/**
 * Discover packaged skill candidates by scanning the package's `skills/`
 * directory: one subdirectory per skill, each carrying a SKILL.md.
 * @param skillsRoot - absolute path to this package's skills directory.
 * @param signal - optional cancellation.
 * @returns the candidate list.
 */
async function discoverCandidates(skillsRoot, signal) {
  let entries
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const candidates = []
  for (const entry of entries) {
    if (signal?.aborted) break
    if (!entry.isDirectory()) continue
    const skillDir = join(skillsRoot, entry.name)
    const skillFile = join(skillDir, 'SKILL.md')
    const parsed = await parseSkillFile(skillFile, signal)
    if (parsed === undefined) continue
    candidates.push({
      name: parsed.name,
      description: parsed.description,
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
      invocation: { modelInvocable: true, userInvocable: true },
      source: SOURCE,
      provider: name,
      rank: PACKAGED_SKILL_RANK,
      locator: skillDir,
      path: skillFile,
      ...(Object.keys(parsed.metadata).length > 0 ? { metadata: parsed.metadata } : {})
    })
  }
  return candidates
}

/** Register the packaged specpowers provider on `ctx.skills`. */
function apply(ctx) {
  const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
  ctx.skills.registerProvider(() => ({
    name,
    async list(options) {
      return discoverCandidates(skillsRoot, options.signal)
    }
  }))
}

export { apply, name, inject }
export default { apply, name, inject }
```

- [ ] **Step 4: 运行自检，确认 list() 通过**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: 打印 `PASS manifests: ...` 与 `PASS list(): 6 技能，裸名与 description 锚点全部正确`

若某个技能报「缺末句锚点」或「未展开块标量」，说明解析器对该标量形态处理有误——对照 Step 3 的 4 种分支检查，不要靠改测试锚点绕过。

- [ ] **Step 6: Commit**

```bash
git add lib/index.js scripts/verify-dsh-provider.mjs
git commit -m "feat(dsh): provider list() 契约 + 支持折叠块与多行续行的 frontmatter 解析器

superpowers-dsh 的朴素单行标量解析器会把这 4 个技能的 description 解析成
字面 \">\" / \">-\" 或被截断（specpowers 与 review 用折叠块，design 与 plan
用多行 plain 续行）。description 是 DSH 路由技能的唯一依据，退化即等于技能
看得见但选不中，故解析器扩展为支持 4 种标量形态。"
```

---

## Task 3: provider get() 与 resourceBase

**Files:**
- Modify: `lib/index.js`（在 `apply` 的工厂返回值中增加 `get`）
- Modify: `scripts/verify-dsh-provider.mjs`（追加 `get()` 断言段）

**Interfaces:**
- Consumes: Task 2 的 `parseSkillFile`、`discoverCandidates`、`apply`
- Produces: 工厂返回对象新增 `async get(candidate, options)`，返回 `{ name, description, whenToUse?, invocation, source, provider, resourceBase: { kind: 'directory', path }, path, metadata?, content }`

- [ ] **Step 1: 追加 get() 断言（先写测试）**

在 `scripts/verify-dsh-provider.mjs` 末尾追加：

```js
// ---- provider get() 契约 ----
for (const [skillName] of EXPECTED) {
  const candidate = candidates.find((entry) => entry.name === skillName)
  const full = await provider.get(candidate, {})
  assert.ok(full, `${skillName} get() 应返回技能定义`)
  assert.equal(full.name, skillName, `${skillName} get() 返回的 name 不符`)
  assert.ok(full.content.length > 100, `${skillName} content 过短（${full.content.length}）`)
  assert.equal(
    full.resourceBase?.kind,
    'directory',
    `${skillName} resourceBase.kind 必须为 directory`
  )
  assert.equal(
    full.resourceBase.path,
    join(root, 'skills', skillName),
    `${skillName} resourceBase.path 指向错误`
  )
}
console.log(`PASS get(): ${EXPECTED.length} 技能正文与 resourceBase 全部正确`)

// ---- 相对资源可达性 ----
// 技能正文用 <SKILL_BASE> 引用 refs/ 与 scripts/；插件从缓存路径加载时，
// 这些相对引用必须能通过 resourceBase 解析。
const entryName = 'specpowers'
const entryFull = await provider.get(
  candidates.find((entry) => entry.name === entryName),
  {}
)
for (const relative of [
  'refs/workflow-protocol.json',
  'refs/platform-tools.md',
  'scripts/workflow-state.mjs',
  'scripts/workflow-guard.mjs'
]) {
  assert.ok(
    existsSync(join(entryFull.resourceBase.path, relative)),
    `resourceBase 下缺相对资源：${relative}`
  )
}
console.log('PASS resourceBase: refs/ 与 scripts/ 相对资源可达')

console.log('ALL PASS')
```

> 注意：本步骤同时断言 `refs/platform-tools.md` 存在——该文件由 Task 5 创建。若在 Task 5 之前运行本脚本，此断言会失败，属预期；Task 3 的 Step 3 只跑至 `PASS get()` 即可，`ALL PASS` 在 Task 5 之后达成。

- [ ] **Step 2: 运行自检，确认 get() 失败**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: 打印 `PASS manifests` 与 `PASS list()`，随后 FAIL —— `TypeError: provider.get is not a function`

- [ ] **Step 3: 实现 get()**

将 `lib/index.js` 中 `apply` 函数整体替换为：

```js
/** Register the packaged specpowers provider on `ctx.skills`. */
function apply(ctx) {
  const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
  ctx.skills.registerProvider(() => ({
    name,
    async list(options) {
      return discoverCandidates(skillsRoot, options.signal)
    },
    async get(candidate, options) {
      const parsed = await parseSkillFile(candidate.path, options.signal)
      if (parsed === undefined) return undefined
      return {
        name: parsed.name,
        description: parsed.description,
        ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
        invocation: { modelInvocable: true, userInvocable: true },
        source: SOURCE,
        provider: name,
        resourceBase: { kind: 'directory', path: candidate.locator },
        path: candidate.path,
        ...(Object.keys(parsed.metadata).length > 0 ? { metadata: parsed.metadata } : {}),
        content: parsed.content
      }
    }
  }))
}
```

- [ ] **Step 4: 运行自检，确认 get() 通过**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: 打印 `PASS manifests`、`PASS list()`、`PASS get(): 6 技能正文与 resourceBase 全部正确`；随后在相对资源断言处 FAIL（`refs/platform-tools.md` 尚未创建）——这是预期的中间态。

- [ ] **Step 6: Commit**

```bash
git add lib/index.js scripts/verify-dsh-provider.mjs
git commit -m "feat(dsh): provider get() 契约 + resourceBase 目录资源基

resourceBase 指向 skills/<name>/，使技能正文中的 <SKILL_BASE> 相对引用
（refs/、scripts/）在插件缓存路径下依然可解析。"
```

---

## Task 4: 技能站点前缀剥除

**Files:**
- Modify: `skills/specpowers/SKILL.md`
- Modify: `skills/specpowers-design/SKILL.md`
- Modify: `skills/specpowers-plan/SKILL.md`
- Modify: `skills/specpowers-apply/SKILL.md`
- Modify: `skills/specpowers-review/SKILL.md`
- Modify: `skills/specpowers-archive/SKILL.md`

**Interfaces:**
- Consumes: 无
- Produces: 6 个 SKILL.md 中所有技能调用为裸名；Task 6 在此基础上前置「平台适配」块

> **顺序约束**：必须先完成本任务再做 Task 6。反过来会把平台适配块里的回退示例一并剥除，自伤指南内容。

- [ ] **Step 1: 记录剥除前基线**

Run:
```bash
grep -roE 'specpowers:specpowers' skills/*/SKILL.md | wc -l
grep -roE 'superpowers:' skills/*/SKILL.md | wc -l
```
Expected: `22` 与 **`14`**

> **为什么是 14 而不是 13**：13 个是**技能调用站点**（`superpowers:<skill>`）。第 14 个是 `skills/specpowers/SKILL.md` 依赖检查表里的**通配符** `` `superpowers:*` ``，它不是调用站点，但 `superpowers:` 模式同样命中它。计数与「站点数」是两个口径，别把 13 当成断言值。
>
> **这个通配符会被 `sed` 破坏**：`s/superpowers://g` 会把 `` `superpowers:*` `` 变成 `` `*` ``，该行语义随即失效（Step 3b 修复）。这是先剥除后修复的已知代价，不是可以忽略的噪音。

- [ ] **Step 2: 执行剥除**

Run:
```bash
sed -i 's/specpowers:specpowers/specpowers/g' skills/*/SKILL.md
sed -i 's/superpowers://g' skills/*/SKILL.md
```

> 第一条 sed **必须**写作无尾随连字符的形式：入口技能引用是 `specpowers:specpowers`（无 `-`），带连字符的模式会漏改 8 个站点。

- [ ] **Step 3: 修复被 sed 破坏的通配符行**

Step 2 的 `s/superpowers://g` 会把依赖检查表里的通配符一起改掉，把语义改成无意义的 `` `*` ``。这是先剥除后修复的已知代价，必须在本步骤修回。

把 `skills/specpowers/SKILL.md` 依赖检查表中被破坏的那一行（`/skills` 含 `` `*` ``）：

```
| **Superpowers** | TDD | `/skills` 含 `*` | ✅ |
```

改为：

```
| **Superpowers** | TDD | `/skills` 含 `brainstorming`、`subagent-driven-development` 等上游技能（插件命名空间形式见本技能「平台适配」节） | ✅ |
```

**改写要求**：替换后的行**不得包含 `superpowers:` 字面量**。裸名是跨平台可用的形式；命名空间形式由本技能头部的「平台适配」块统一说明（Task 6 写入）。若在此处写回 `superpowers:*`，Task 11 判据 2 的白名单计数会失败（该判据要求每个 SKILL.md 恰好 2 处前缀命中，且同处一行、该行含「回退」）。

- [ ] **Step 4: 验证零残留**

Run:
```bash
grep -roE 'specpowers:specpowers' skills/*/SKILL.md | wc -l
grep -roE 'superpowers:' skills/*/SKILL.md | wc -l
```
Expected: `0` 与 `0`

- [ ] **Step 5: 验证调用形态正确**

Run:
```bash
grep -rhoE 'Skill\(\{skill: "[^"]+"' skills/*/SKILL.md | sort | uniq -c | sort -rn
grep -rhn 'REQUIRED SUB-SKILL\|REQUIRED BACKGROUND' skills/*/SKILL.md
```
Expected（计数精确匹配）：
```
      7 Skill({skill: "specpowers-review"
      5 Skill({skill: "specpowers"
      4 Skill({skill: "specpowers-design"
      2 Skill({skill: "subagent-driven-development"
      1 Skill({skill: "writing-plans"
      1 Skill({skill: "verification-before-completion"
      1 Skill({skill: "test-driven-development"
      1 Skill({skill: "specpowers-plan"
      1 Skill({skill: "specpowers-archive"
      1 Skill({skill: "specpowers-apply"
      1 Skill({skill: "requesting-code-review"
      1 Skill({skill: "finishing-a-development-branch"
      1 Skill({skill: "brainstorming"
```
且 `REQUIRED SUB-SKILL` / `REQUIRED BACKGROUND` 6 行全部为裸名（`subagent-driven-development`、`test-driven-development`、`verification-before-completion`、`finishing-a-development-branch`、`brainstorming`、`writing-plans`）。

- [ ] **Step 6: 确认业务语义未受损**

Run: `git diff --stat skills/`
Expected: 这 6 个技能文件均有改动，改动行数与「35 个站点 + Step 3 的一行改写」量级一致（不应出现整段重写）

**不要用「diff 中不含前缀字样的行」当判据**——该判据按构造不可能为空：剥除后每个 `+` 行本身已不含 `superpowers:`（那正是剥除的目的），`-` 行才含。原写法会把全部 `+` 行报出来，误判为「混入了非前缀改动」。

正确的验证是**重放等价性**：对每个文件，用 `git show <BASE>:<file>` 取出剥除前内容，在临时文件上跑一遍同样的两条 `sed`，与工作区当前内容逐字节比较。一致即证明本次改动恰好等于「只做前缀替换」，一个字符不多。

Run:
```bash
BASE=21876f4   # Task 4 的 BASE（见 ledger / git log）
for f in skills/*/SKILL.md; do
  tmp=$(mktemp)
  git show "$BASE:$f" > "$tmp"
  sed -i 's/specpowers:specpowers/specpowers/g' "$tmp"
  sed -i 's/superpowers://g' "$tmp"
  if cmp -s "$tmp" "$f"; then echo "OK   $f"; else echo "DIFF $f"; fi
  rm -f "$tmp"
done
```
Expected: 6 行全部为 `OK`。

> 注意：`skills/specpowers/SKILL.md` 在 Step 3 被额外修改过一行，因此它的重放比较**必然**报 `DIFF`——这是**预期**的，且必须仅由那一行造成。用 `diff <(git show "$BASE:$f" | sed -e 's/specpowers:specpowers/specpowers/g' -e 's/superpowers://g') "$f"` 查看差异：应恰好只显示 Step 3 改写的那一行（旧 `` `*` `` → 新裸名列表行）。其余 5 个文件必须逐字节 `OK`。

- [ ] **Step 7: Commit**

```bash
git add skills/
git commit -m "refactor(skills): 技能调用前缀剥除为裸名（35 站点）+ 修复依赖检查表通配符

Skill({skill: \"specpowers:specpowers-X\"}) → Skill({skill: \"specpowers-X\"})，
superpowers:<skill> → <skill>。为 DSH 裸名寻址做准备；Claude Code 的插件
命名空间回退由各技能头部的平台适配块承担（下一个提交）。"
```

---

## Task 5: refs/platform-tools.md（三平台映射与降级路径）

**Files:**
- Create: `skills/specpowers/refs/platform-tools.md`

**Interfaces:**
- Consumes: 无
- Produces: `skills/specpowers/refs/platform-tools.md` —— 被 Task 6 的 6 个平台适配块引用，被 Task 3 的 `verify-dsh-provider.mjs` 相对资源断言校验

- [ ] **Step 1: 创建文件**

创建 `skills/specpowers/refs/platform-tools.md`：

````markdown
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
| `LS` | `glob` + `read` | DSH 无独立的目录列举工具 |
| Plan mode | `exit_plan_mode` | 呈现计划，批准后离开 plan mode 并执行 |
| `ReadImage` | `read_image` | 仅 PNG/JPEG/WebP/GIF |
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
- Windows 上 `scripts/start-server.sh` 一类的 bash 辅助脚本不可用；`scripts/server.cjs` 等 Node 脚本全平台可跑。
````

- [ ] **Step 2: 验证文件结构与相对资源断言**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: `PASS manifests`、`PASS list()`、`PASS get()`、`PASS resourceBase: refs/ 与 scripts/ 相对资源可达`、`ALL PASS`

- [ ] **Step 3: 验证未硬编码任何内网地址**

Run: `grep -nE "${INTERNAL_HOST}|<internal-domain>" skills/specpowers/refs/platform-tools.md`
Expected: 空输出

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers/refs/platform-tools.md
git commit -m "docs(refs): 新增 platform-tools.md——三平台技能调用映射 + 工具对照 + 降级路径

Codex 行显式标注「预留·未验证」：无 Codex 环境则无法验证，不谎称支持。
降级路径覆盖 DSH 缺 hook 系统与缺插件斜杠命令两种情况。"
```

---

## Task 6: 6 个技能头部「平台适配」块

**Files:**
- Modify: `skills/specpowers/SKILL.md`
- Modify: `skills/specpowers-design/SKILL.md`
- Modify: `skills/specpowers-plan/SKILL.md`
- Modify: `skills/specpowers-apply/SKILL.md`
- Modify: `skills/specpowers-review/SKILL.md`
- Modify: `skills/specpowers-archive/SKILL.md`

**Interfaces:**
- Consumes: Task 4（裸名已就位）、Task 5（`refs/platform-tools.md` 已存在）
- Produces: 每个 SKILL.md 在 H1 之后含一个「平台适配」块，内含该技能自身的裸名与插件前缀回退示例

- [ ] **Step 1: 逐个插入平台适配块**

在下列每个文件的 **H1 行之后**（H1 与紧随其后的第一个非空行之间）插入对应块。`<SKILL>` 处填入该文件自身的技能名。

各文件 H1 行文本：

| 文件 | H1 行 |
|---|---|
| `skills/specpowers/SKILL.md` | `# specpowers: SDD+TDD 工程化开发方法论` |
| `skills/specpowers-design/SKILL.md` | `# specpowers-design: 设计+propose 阶段` |
| `skills/specpowers-plan/SKILL.md` | `# specpowers-plan: 衔接阶段` |
| `skills/specpowers-apply/SKILL.md` | `# specpowers-apply: 实现阶段` |
| `skills/specpowers-review/SKILL.md` | `# specpowers-review: 审查阶段` |
| `skills/specpowers-archive/SKILL.md` | `# specpowers-archive: 验证+归档阶段` |

`skills/specpowers/SKILL.md` 插入（`<SKILL>` = `specpowers`）：

```markdown
> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers")`；`Skill({skill: "specpowers"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。
```

`skills/specpowers-design/SKILL.md` 插入（`<SKILL>` = `specpowers-design`）：

```markdown
> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-design")`；`Skill({skill: "specpowers-design"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-design"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-design"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。
```

`skills/specpowers-plan/SKILL.md` 插入（`<SKILL>` = `specpowers-plan`）：

```markdown
> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-plan")`；`Skill({skill: "specpowers-plan"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-plan"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-plan"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。
```

`skills/specpowers-apply/SKILL.md` 插入（`<SKILL>` = `specpowers-apply`）：

```markdown
> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-apply")`；`Skill({skill: "specpowers-apply"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-apply"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-apply"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。
```

`skills/specpowers-review/SKILL.md` 插入（`<SKILL>` = `specpowers-review`）：

```markdown
> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-review")`；`Skill({skill: "specpowers-review"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-review"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-review"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。
```

`skills/specpowers-archive/SKILL.md` 插入（`<SKILL>` = `specpowers-archive`）：

```markdown
> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-archive")`；`Skill({skill: "specpowers-archive"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-archive"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-archive"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。
```

- [ ] **Step 2: 验证 6 个块全部就位**

Run: `grep -c '平台适配（技能调用）' skills/*/SKILL.md`
Expected: 6 个文件各返回 `1`

- [ ] **Step 3: 验证每个块含自身技能名的回退示例**

Run:
```bash
for f in skills/*/SKILL.md; do
  n=$(basename "$(dirname "$f")")
  printf '%-28s %s\n' "$n" "$(grep -c "specpowers:$n" "$f")"
done
```
Expected: 6 行全部为 `1`（即 `specpowers`、`specpowers-design`、`specpowers-plan`、`specpowers-apply`、`specpowers-review`、`specpowers-archive` 各 1 处回退示例）

- [ ] **Step 4: 验证指针从任一技能都可解析**

六块里的「完整三平台映射」指针若写成相对路径 `refs/platform-tools.md`，**只有入口技能能解析**——五个子技能中 design/plan/apply/archive 根本没有 `refs/` 目录，review 的 `refs/` 只有 `protocols.md`。子技能被单独加载时按自身目录解析，必然悬空；而这六块存在的全部理由就是让子技能自足。

因此指针必须用仓库既有的 `<SKILL_BASE>` 约定（定义见入口技能「脚本路径解析」节：**`<SKILL_BASE>` 一律取入口技能基目录**，即使加载的是子技能）。

Run:
```bash
grep -c 'SKILL_BASE>/refs/platform-tools.md' skills/*/SKILL.md
```
Expected: 6 个文件各 `1`。

Run（反证：不得存在裸相对路径写法）:
```bash
grep -n '见 `refs/platform-tools.md`' skills/*/SKILL.md
```
Expected: 空输出。

Run（确认该约定本身存在，且子技能确实在用它）:
```bash
grep -c 'SKILL_BASE' skills/specpowers/SKILL.md
grep -c 'SKILL_BASE' skills/specpowers-design/SKILL.md
```
Expected: 入口技能 >0（定义节）、design >0（既有用法，证明该约定在子技能中成立）。

- [ ] **Step 5: 验证 provider 解析未被破坏**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: `ALL PASS`（平台适配块在 H1 之后的正文里，不影响 frontmatter）

- [ ] **Step 6: Commit**

```bash
git add skills/
git commit -m "docs(skills): 6 个技能头部新增平台适配块——裸名为主 + 插件前缀回退

回退写在 6 个技能头部而非逐站点重复：DSH 允许直接加载子技能（不必先读入口），
回退必须在每个技能内自足；站点级重复 35 遍会噪声化并漂移。"
```

---

## Task 7: 协议与状态机裸名一致

**Files:**
- Modify: `skills/specpowers/refs/workflow-protocol.json`
- Modify: `skills/specpowers/scripts/workflow-state.mjs`
- Modify: `skills/specpowers/refs/onboarding.md`
- Modify: `skills/specpowers/SKILL.md`（`带 provider 前缀` 描述，按内容定位）

**Interfaces:**
- Consumes: Task 4 建立的裸名约定
- Produces: `workflow-protocol.json` 的 5 个 `skill` 字段为裸名；`workflow-state.mjs` 的 `SKILL:` 输出为裸名（Task 11 校验）

> **为什么必须同步改**：`workflow-protocol.json` 与 `workflow-state.mjs` 是同一契约的生产者与消费者。只改一处会让状态机输出与协议不一致——子技能按 `SKILL:` 值去加载技能时会找不到。

- [ ] **Step 1: 改 workflow-protocol.json**

Run:
```bash
sed -i 's/specpowers:specpowers/specpowers/g' skills/specpowers/refs/workflow-protocol.json
```

- [ ] **Step 2: 改 workflow-state.mjs 的 4 处硬编码兜底**

Run:
```bash
sed -i 's/specpowers:specpowers/specpowers/g' skills/specpowers/scripts/workflow-state.mjs
```

- [ ] **Step 3: 改 onboarding.md 与 SKILL.md 的文档表述**

Run:
```bash
sed -i 's/superpowers://g' skills/specpowers/refs/onboarding.md
```

然后修改 `skills/specpowers/SKILL.md` 中的描述。**按内容定位，不要用行号**——Task 6 已在文件顶部插入 7 行平台适配块，原行号已整体偏移。把：

```
`SKILL: <Skill 工具全名，带 provider 前缀>`
```

改为：

```
`SKILL: <技能裸名，如 specpowers-design>`
```

- [ ] **Step 4: 验证零残留**

Run:
```bash
grep -rnoE 'specpowers:specpowers|superpowers:' skills/specpowers/refs/workflow-protocol.json skills/specpowers/scripts/workflow-state.mjs skills/specpowers/refs/onboarding.md
grep -c '带 provider 前缀' skills/*/SKILL.md
```
Expected: 第一段**空输出**（协议、状态机、入门指南三处已全部改净）；第二段 6 个文件全部 `0`。

`skills/specpowers/SKILL.md` 的 `specpowers:specpowers` 命中数应为 `1`——那是 Task 6 写入的**合法回退示例**，不是残留：

Run: `grep -c 'specpowers:specpowers' skills/specpowers/SKILL.md`
Expected: `1`

- [ ] **Step 5: 验证协议 JSON 合法且 5 个 skill 字段为裸名**

Run:
```bash
node --input-type=module <<'EOF'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const protocol = JSON.parse(readFileSync('skills/specpowers/refs/workflow-protocol.json', 'utf8'))
assert.equal(protocol.nodes.length, 5, '协议应有 5 个节点')
for (const node of protocol.nodes) {
  assert.ok(!node.skill.includes(':'), `节点 ${node.id} 的 skill 仍带前缀：${node.skill}`)
}
console.log('PASS protocol:', protocol.nodes.map((n) => `${n.id}=${n.skill}`).join(' '))
EOF
```
Expected: `PASS protocol: phase0=specpowers-design phase1=specpowers-design phase2=specpowers-plan phase3=specpowers-apply phase4=specpowers-archive`

- [ ] **Step 6: 验证状态机输出裸名**

Run:
```bash
TMP=$(mktemp -d)
mkdir -p "$TMP/.superpowers"
printf '%s\n' '{"name":"demo-feature","currentPhase":"phase0","completedPhases":[],"mode":"medium","blockedReason":null,"evidence":{}}' > "$TMP/.superpowers/state.json"
(cd "$TMP" && node /workspace/specpowers/skills/specpowers/scripts/workflow-state.mjs next)
rm -rf "$TMP"
```
Expected:
```
NEXT: manual
SKILL: specpowers-design
PHASE: phase0
REASON: 停顿点 PP-01/PP-02 未持久化于 evidence（见 refs/decision-points.md）
```
关键断言：`SKILL: specpowers-design` 不含 `specpowers:` 前缀。

- [ ] **Step 7: Commit**

```bash
git add skills/
git commit -m "refactor(state): 协议与状态机 skill 字段统一裸名

workflow-protocol.json 与 workflow-state.mjs 是同一契约的生产者与消费者，
必须同步改——只改一处会让状态机输出与协议不一致，子技能按 SKILL: 值加载会失败。
另修正 SKILL.md 中「带 provider 前缀」的陈旧描述。"
```

---

## Task 8: AGENTS.md 迁移、CLAUDE.md 入口化与 Comet 移除

**Files:**
- Create: `AGENTS.md`
- Modify: `CLAUDE.md`
- Modify: `skills/specpowers/scripts/hooks-reference.yaml`
- Modify: `skills/specpowers/SKILL.md`

**Interfaces:**
- Consumes: Task 4、6、7 对 `skills/` 的既有改动
- Produces: `AGENTS.md` 为厂商中立项目指令正本；`CLAUDE.md` 为其入口；活文件中 `comet` 字样为 0（Task 11 校验）

- [ ] **Step 1: 生成 AGENTS.md（自 CLAUDE.md 迁移）**

Run:
```bash
git mv CLAUDE.md AGENTS.md
```

- [ ] **Step 2: 改 AGENTS.md 标题与导语**

把 `AGENTS.md` 开头的：

```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
```

替换为：

```markdown
# AGENTS.md

本文件是本仓库的开发指令正本，供所有 AI 编码工具读取（Codex、Zed、DeepSeek Harness、Claude Code 等遵循 `AGENTS.md` 约定的工具）。Claude Code 通过 `CLAUDE.md` 导入本文件。
```

- [ ] **Step 3: 删除 Comet 托管块**

删除 `AGENTS.md` 中从 `<comet-ambient-resume>` 到 `</comet-ambient-resume>` 的整段（含两行 HTML 注释与 `## Comet Ambient Resume` 小节）。

Run（删除前先确认边界）：
```bash
sed -n '/<comet-ambient-resume>/,/<\/comet-ambient-resume>/p' AGENTS.md | head -3
```
Expected: 第一行为 `<comet-ambient-resume>`

删除后验证：
```bash
grep -c 'comet' AGENTS.md
```
Expected: `0`

- [ ] **Step 4: 更新 AGENTS.md 的目录结构与依赖表**

在 `## 目录结构` 表格中，把 `.claude/skills/openspec-*/` 与 `.claude/commands/opsx/` 两行的用途改为标注生成物：

```markdown
| `.claude/skills/openspec-*/` | **生成物**（`openspec init --tools claude`）——不随仓库分发，见 README 依赖安装步骤 |
| `.claude/commands/opsx/` | **生成物**（`openspec init --tools claude`）——不随仓库分发 |
```

在 `## 外部依赖` 表格前新增一行运行环境，并在表后补充 DSH 说明：

```markdown
| 工具 | 用途 | 安装验证 |
|------|------|---------|
| **DeepSeek Harness** (或 Claude Code) | 运行环境 | `dsh --version` / `claude --version` |
| **superpowers-dsh**（DSH）/ **Superpowers**（Claude Code） | TDD 技能组 | DSH：`dsh --profile web --dump-config` 含 `superpowers-dsh` 行 |
```

把原表首行 `| **Superpowers** | TDD 技能组 | \`/skills\` 列表中包含 \`superpowers:*\` |` 整行删除（已被上一行取代）。

- [ ] **Step 5: 新增 DSH 适配节，并修正决策 2 的裸名**

在 `## 关键设计决策` 节之后新增：

```markdown
## DSH 适配

同一仓库双清单：仓库根既是 DSH 插件包根，也是 Claude Code 插件根，`skills/` 是双平台唯一技能真源。

- **DSH 面**：`package.json`（`dsh.bundle.patch` → `./cordis.patch.yml`）+ `cordis.patch.yml`（向 dsh-base 之上 insert 一行）+ `lib/index.js`（`ctx.skills.registerProvider`）。
- **provider 契约**：rank 550（低于 `BUNDLED_SKILL_RANK = 600`，使项目本地技能可覆盖打包技能）、`source: 'custom'`、`resourceBase` 指向 `skills/<name>/`、零运行时依赖。
- **frontmatter 解析器必须支持 4 种标量形态**（单行、折叠块 `>`/`>-`、字面块 `|`/`|-`、多行 plain 续行）。`superpowers-dsh` 的朴素单行解析器会把 `specpowers` 与 `specpowers-review` 的 `description` 解析成字面 `">"`/`">-"`，把 `specpowers-design` 与 `specpowers-plan` 的截断——而 `description` 是 DSH 路由技能的唯一依据，退化即等于技能看得见但选不中。**改解析器时必须跑 `node scripts/verify-dsh-provider.mjs`。**
- **平台适配**：技能调用一律裸名；Claude Code 的插件命名空间回退写在每个技能头部的「平台适配」块；三平台映射与降级路径见 `skills/specpowers/refs/platform-tools.md`（Codex 为预留·未验证）。
```

把 `## 关键设计决策` 决策 2 中的 `superpowers:brainstorming` 改为 `brainstorming`。

- [ ] **Step 6: 把 CLAUDE.md 改为入口**

创建新的 `CLAUDE.md`：

```markdown
# CLAUDE.md

本仓库的开发指令正本在 [AGENTS.md](AGENTS.md)（厂商中立，供所有 AI 编码工具读取）。

@AGENTS.md
```

- [ ] **Step 7: 技能正文项目指令文件中立化**

specpowers 的技能正文把「项目指令文件」硬编码为 `CLAUDE.md`。Codex 读 `AGENTS.md`，因此这 3 处必须泛化，技能才能在其他平台零改写运行。

把 `skills/specpowers/SKILL.md` 中：

```
□ 阅读 CLAUDE.md → openspec changes/ → 待办清单 → known-issues → 领域 SKILL → 主规范 → 基线测试
```

改为：

```
□ 阅读项目指令文件（CLAUDE.md / AGENTS.md）→ openspec changes/ → 待办清单 → known-issues → 领域 SKILL → 主规范 → 基线测试
```

把 `skills/specpowers-design/SKILL.md` 中：

```
□ 读取 CLAUDE.md（项目指令+架构）
```

改为：

```
□ 读取项目指令文件（CLAUDE.md / AGENTS.md）（项目指令+架构）
```

把 `skills/specpowers/refs/project-template.md` 中：

```
│   ├── skills/specpowers/   # 本 skill（目标项目目录约定；specpowers 仓库自身布局见仓库 CLAUDE.md）
```

改为：

```
│   ├── skills/specpowers/   # 本 skill（目标项目目录约定；specpowers 仓库自身布局见仓库 AGENTS.md）
```

- [ ] **Step 8: 移除 hooks-reference.yaml 与 SKILL.md 的 comet 引用**

在 `skills/specpowers/scripts/hooks-reference.yaml` 中，把含 `comet-hook-router` 的互斥说明整段删除（**按内容定位**，该文件未被前面任务改动，行号可用但优先按内容匹配更稳）。删除前查看原文：

Run: `sed -n '1,10p' skills/specpowers/scripts/hooks-reference.yaml`

把其中含 `comet-hook-router` 的注释行（单行或连续多行说明）整段移除，保留同位置的「启用后先手动跑一次验证」与「复制时与既有 settings.json 合并」两条有效说明。

在 `skills/specpowers/SKILL.md` 中（**按内容定位，不要用行号**——Task 6 已在顶部插入 7 行），把括号内的 kernel 迁移说明中的 `.comet/` 路径引用改为不含第三方工具名的等价表述。把：

```
（kernel 用户迁移：kernel 的 state.json 路径（`.comet/runs/specpowers-kernel/state.json`）与本脚本读取的 `.superpowers/state.json` 不同，需运行 `init --resume-artifacts` 重建；`.superpowers/.gate-passed-*` 通用，Gate 进度不丢失；已完成归档的 kernel 用户跳过 Phase 4 直接收尾，不重跑 /opsx:archive）
```

改为：

```
（历史 kernel 用户迁移：旧 kernel 的 state.json 路径与本脚本读取的 `.superpowers/state.json` 不同，需运行 `init --resume-artifacts` 重建；`.superpowers/.gate-passed-*` 通用，Gate 进度不丢失；已完成归档的用户跳过 Phase 4 直接收尾，不重跑 /opsx:archive）
```

- [ ] **Step 9: 验证活文件零 comet**

Run:
```bash
grep -rniE 'comet' skills/ lib/ commands/ .claude-plugin/ AGENTS.md CLAUDE.md README.md 2>/dev/null | wc -l
```
Expected: `0`

- [ ] **Step 10: 验证技能正文不再硬编码 CLAUDE.md**

Run（只应剩「CLAUDE.md / AGENTS.md」并列形式与本仓库自身文件的说明）：

```bash
grep -rn 'CLAUDE\.md' skills/ | grep -v 'CLAUDE\.md / AGENTS\.md' | grep -v '仓库自身布局见仓库 AGENTS\.md'
```
Expected: 空输出

- [ ] **Step 11: Commit**

```bash
git add AGENTS.md CLAUDE.md skills/
git commit -m "docs(repo): AGENTS.md 厂商中立化 + 移除 Comet 托管块

CLAUDE.md 内容迁移为 AGENTS.md（Codex/Zed/DSH 都读 AGENTS.md；DSH 不自动
加载 CLAUDE.md），CLAUDE.md 保留为入口（指针 + @AGENTS.md）。
AGENTS.md 新增 DSH 适配节，记录 provider 契约与「解析器必须支持 4 种标量形态」
这一硬约束。移除第三方 Comet 工具耦合与全部 comet 引用。"
```

---

## Task 9: 仓库清理（.gitignore、取消追踪、LICENSE、插件地址）

**Files:**
- Modify: `.gitignore`
- Create: `LICENSE`
- Modify: `.claude-plugin/plugin.json`
- Untrack: `.claude/**`、`.superpowers/**`

**Interfaces:**
- Consumes: 无
- Produces: `.claude/` 与 `.superpowers/` 不再被 git 追踪但保留磁盘文件；`LICENSE` 存在；`plugin.json` 的 `repository` 指向 GitHub

> **顺序硬约束**：必须先写 `.gitignore` 再取消追踪。反过来后续 `git add -A` 会把它们重新加回。
> **必须带 `--cached`**：省掉它会把本地 `.claude/` 物理删除，Claude Code 自动发现路径失效。

- [ ] **Step 1: 更新 .gitignore**

用以下内容整体替换 `.gitignore`：

```gitignore
# specpowers 运行时状态（状态机 state.json 与 Gate 产物）——不应进公开仓库
/.superpowers/

# openspec init 生成物（用户本地内容）——用 openspec init --tools claude 重建，
# 见 README「依赖安装步骤」。注意 /.claude/ 与 /.claude-plugin/ 是不同目录：
# 后者是本仓库资产，必须保留追踪。
/.claude/

# Codex / Zed Agent 共享技能根与 Codex 本地目录（生成物，同上）
/.agents/
/.codex/

# skill-up 评测输出目录（每个技能根目录下生成 <skill>-workspace/）
skills/*-workspace/
```

- [ ] **Step 2: 验证 .gitignore 不会误伤 .claude-plugin/**

Run:
```bash
git check-ignore -v .claude-plugin/plugin.json; echo "exit=$?"
```
Expected: `exit=1`（未被忽略）。若输出匹配规则则说明模式写错，必须修成 `/.claude/`。

Run:
```bash
git check-ignore -v .claude/settings.json 2>/dev/null || git check-ignore -v .claude/
```
Expected: 命中 `/.claude/` 规则

- [ ] **Step 3: 取消追踪（保留磁盘文件）**

Run:
```bash
git rm -r --cached .claude .superpowers
```

- [ ] **Step 4: 验证磁盘文件仍在、git 已不追踪**

Run:
```bash
ls .claude/skills/ | head -3
git ls-files .claude .superpowers | wc -l
```
Expected: 第一段列出 `openspec-*` 目录（磁盘文件在）；第二段为 `0`（已取消追踪）

- [ ] **Step 5: 新增 LICENSE**

创建 `LICENSE`（MIT，年份与版权人按仓库 owner）：

```
MIT License

Copyright (c) 2026 SpecPowers Team

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 6: 更新 plugin.json 的 repository**

把 `.claude-plugin/plugin.json` 中的：

```json
  "repository": "http://<内网 GitLab 主机>/ai/specpowers.git",
```

改为：

```json
  "repository": "https://github.com/SAXEM1997/specpowers.git",
```

- [ ] **Step 7: 验证零内网地址（README 除外）**

Run:
```bash
INTERNAL_HOST='<实际内网主机名>'   # 执行时填入；文档中不以字面量记录
grep -rnE "${INTERNAL_HOST}|<internal-domain>" --include='*' . 2>/dev/null \
  | grep -v '^\./\.git/' | grep -v '^\./README\.md' | grep -v '^\./README\.en\.md' | wc -l
```
Expected: **已追踪文件**中 `0`。

区分两个作用域，否则这个断言永远不成立：

| 作用域 | 期望 | 说明 |
|---|---|---|
| 已追踪文件、排除 `docs/` 与两份 README | `0` | **产品面**——这是判据的真实意图 |
| `docs/**` | `0` | 本计划与 spec 已把主机名改为 `<内网 GitLab 主机>` 占位、命令改用 `${INTERNAL_HOST}`，因此也应为 0；**若你看到 `docs/` 命中，说明有人写回了字面量** |
| `.superpowers/**` | 非 0（预期） | 运行时工作区（ledger/brief/报告），已被 gitignore，不随仓库分发 |
| 两份 README | 非 0（本任务时点） | Task 10 整体重写时消除 |

> **编排说明**：`README.md` 的 2 处内网地址由 Task 10 整体重写时消除，因此本任务必须把它们排除在断言之外——否则此处必然失败。仓库级（含 README）的零残留断言由 Task 11 判据 7 在 Task 10 之后执行。这不是放松要求，而是把断言放在它成立的那个时点。

- [ ] **Step 8: 验证清单仍合法**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: `ALL PASS`

Run: `node --input-type=module -e "import assert from 'node:assert/strict'; import { readFileSync } from 'node:fs'; for (const f of ['.claude-plugin/plugin.json', '.claude-plugin/marketplace.json', 'package.json']) { JSON.parse(readFileSync(f, 'utf8')); } console.log('PASS json manifests')"`
Expected: `PASS json manifests`

- [ ] **Step 9: Commit**

```bash
git add .gitignore LICENSE .claude-plugin/plugin.json
git commit -m "chore(repo): 运行时状态与生成物移出版本控制 + 补 LICENSE + 插件地址改 GitHub

.claude/（openspec init 生成物）与 .superpowers/（状态机运行时状态）改为
用户本地内容：git rm -r --cached 取消追踪并保留磁盘文件，README 依赖安装
步骤承载重建。补上缺失的 LICENSE（README 与 plugin.json 早已声明 MIT）。
plugin.json repository 改为公开 GitHub 地址。"
```

---

## Task 10: README 双语与架构图

**Files:**
- Modify: `README.md`
- Create: `README.en.md`
- Create: `static/architecture.svg`

**Interfaces:**
- Consumes: Task 1-9 的全部产物（安装命令、依赖清单、平台表、目录结构均已确定）
- Produces: `README.md` 与 `README.en.md`；`static/architecture.svg`

- [ ] **Step 1: 创建架构图**

创建 `static/architecture.svg`：

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="880" height="420" viewBox="0 0 880 420" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif">
  <rect width="880" height="420" fill="#ffffff"/>
  <text x="440" y="34" text-anchor="middle" font-size="20" font-weight="700" fill="#111">specpowers — one repo, three platforms</text>

  <rect x="24" y="70" width="832" height="96" rx="10" fill="#f6f8fa" stroke="#d0d7de"/>
  <text x="44" y="96" font-size="14" font-weight="700" fill="#111">skills/  (single source of truth)</text>
  <g font-size="12" fill="#24292f">
    <rect x="44" y="108" width="120" height="40" rx="6" fill="#fff" stroke="#8c959f"/>
    <text x="104" y="133" text-anchor="middle">specpowers</text>
    <rect x="176" y="108" width="128" height="40" rx="6" fill="#fff" stroke="#8c959f"/>
    <text x="240" y="133" text-anchor="middle">specpowers-design</text>
    <rect x="316" y="108" width="120" height="40" rx="6" fill="#fff" stroke="#8c959f"/>
    <text x="376" y="133" text-anchor="middle">specpowers-plan</text>
    <rect x="448" y="108" width="128" height="40" rx="6" fill="#fff" stroke="#8c959f"/>
    <text x="512" y="133" text-anchor="middle">specpowers-apply</text>
    <rect x="588" y="108" width="132" height="40" rx="6" fill="#fff" stroke="#8c959f"/>
    <text x="654" y="133" text-anchor="middle">specpowers-review</text>
    <rect x="732" y="108" width="104" height="40" rx="6" fill="#fff" stroke="#8c959f"/>
    <text x="784" y="133" text-anchor="middle">…-archive</text>
  </g>

  <g stroke="#57606a" stroke-width="1.5" fill="none">
    <path d="M200 166 L200 214"/>
    <path d="M440 166 L440 214"/>
    <path d="M680 166 L680 214"/>
  </g>

  <g font-size="13">
    <rect x="60" y="214" width="280" height="120" rx="10" fill="#ddf4ff" stroke="#0969da"/>
    <text x="200" y="240" text-anchor="middle" font-weight="700" fill="#0a3069">DeepSeek Harness</text>
    <text x="200" y="264" text-anchor="middle" fill="#0a3069">dsh plugin add …/specpowers</text>
    <text x="200" y="286" text-anchor="middle" fill="#0a3069">package.json + cordis.patch.yml</text>
    <text x="200" y="308" text-anchor="middle" fill="#0a3069">lib/index.js → ctx.skills</text>
    <text x="200" y="326" text-anchor="middle" font-size="11" fill="#57606a">skill(name: "specpowers")</text>

    <rect x="300" y="214" width="280" height="120" rx="10" fill="#fff8c5" stroke="#9a6700"/>
    <text x="440" y="240" text-anchor="middle" font-weight="700" fill="#7d4e00">Claude Code</text>
    <text x="440" y="264" text-anchor="middle" fill="#7d4e00">/plugin marketplace add</text>
    <text x="440" y="286" text-anchor="middle" fill="#7d4e00">.claude-plugin/plugin.json</text>
    <text x="440" y="308" text-anchor="middle" fill="#7d4e00">Slash commands /opsx:*</text>
    <text x="440" y="326" text-anchor="middle" font-size="11" fill="#57606a">Skill({skill: "specpowers"})  ← 回退 specpowers:&lt;skill&gt;</text>

    <rect x="540" y="214" width="280" height="120" rx="10" fill="#f6f8fa" stroke="#8c959f" stroke-dasharray="6 4"/>
    <text x="680" y="240" text-anchor="middle" font-weight="700" fill="#57606a">Codex CLI</text>
    <text x="680" y="264" text-anchor="middle" fill="#57606a">reserved · unverified</text>
    <text x="680" y="290" text-anchor="middle" fill="#57606a">target: .agents/skills/&lt;name&gt;/</text>
    <text x="680" y="312" text-anchor="middle" fill="#57606a">skills-only (no slash commands)</text>
  </g>

  <text x="440" y="372" text-anchor="middle" font-size="12" fill="#57606a">Phase 0 design → Phase 1 propose → Phase 2 plan → Phase 3 TDD apply → Phase 4 verify &amp; archive</text>
  <text x="440" y="396" text-anchor="middle" font-size="12" fill="#57606a">every phase exits through a review Gate; upstream TDD skills come from superpowers / superpowers-dsh</text>
</svg>
```

- [ ] **Step 2: 重写 README.md**

用以下内容整体替换 `README.md`：

````markdown
<div align="center">

[English](README.en.md) | **简体中文**

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

技能评测套件位于 `skills/*/evals/`（YAML 用例 + 规则断言）。**评测引擎为 Claude Code，DSH 上无法运行**——这是已知限制。

详见 [AGENTS.md](AGENTS.md) 了解开发工作流与关键设计决策。

## 许可

MIT。上游技能内容来自 [Superpowers](https://github.com/obra/superpowers)（MIT，© Jesse Vincent 及贡献者）与 [OpenSpec](https://github.com/Fission-AI/OpenSpec)（MIT）。
````

- [ ] **Step 3: 创建 README.en.md**

创建 `README.en.md`，与 `README.md` 逐节对应（同顺序、同表格列、同代码块内容，仅正文语言为英文）。顶部互链块：

```markdown
<div align="center">

**English** | [简体中文](README.md)

</div>
```

各节标题固定为：`# specpowers`、`## Skill Group Architecture`、`## Installation`（含 `### Prerequisites`、`### Install in DeepSeek Harness`、`### Install in Claude Code`、`### Dependency Setup`、`### Project Initialization`）、`## Quick Start`、`## Phase Workflow`、`## Review System`、`## Platform Adaptation`、`## Repository Layout`、`## Development`、`## License`。

必须逐字保留的英文段落（命令、路径、标识符不可翻译）：

- 所有 ```sh / ```bash 代码块内容与 `README.md` 完全一致。
- 平台适配表三行：DSH 行为 `skill(name: "specpowers")`；Claude Code 行为 bare name with fallback `Skill({skill: "specpowers:specpowers"})`；Codex 行为 **reserved · unverified**，路径 `.agents/skills/<name>/SKILL.md`。
- 硬依赖的 8 个技能名：`brainstorming`, `writing-plans`, `subagent-driven-development`, `test-driven-development`, `systematic-debugging`, `requesting-code-review`, `verification-before-completion`, `finishing-a-development-branch`。
- 关于 frontmatter 解析器的警告段：必须传达「DSH routes skills solely by `description`; degrading the parser to single-line scalars makes skills visible but unselectable; always run `node scripts/verify-dsh-provider.mjs`」。
- 评测限制段：evals require the Claude Code engine and cannot run on DSH.

- [ ] **Step 4: 验证两文件结构对称**

Run:
```bash
echo "zh sections: $(grep -c '^## ' README.md)"; echo "en sections: $(grep -c '^## ' README.en.md)"
grep -c '^## ' README.md README.en.md
```
Expected: 两个文件的 `## ` 计数均为 **9**（`技能组架构`/`Skill Group Architecture`、`安装`/`Installation`、`快速开始`/`Quick Start`、`Phase 工作流`/`Phase Workflow`、`审查体系`/`Review System`、`平台适配`/`Platform Adaptation`、`目录结构`/`Repository Layout`、`开发`/`Development`、`许可`/`License`）。

> 注意：代码块内的 shell 注释（如 `# 卸载后同样需要重启 profile`）以 `# ` 开头，不计入 `^## `；但若后续在 README 里写以 `## ` 开头的 shell 注释会污染此判据——不要那样写。

Run:
```bash
grep -c 'specpowers:specpowers' README.md README.en.md
```
Expected: 两文件各 `1`（平台适配表中的回退示例）

Run:
```bash
grep -c 'SAXEM1997/specpowers' README.md README.en.md
```
Expected: 两文件均 `≥3`（DSH 安装、Claude clone、marketplace add）

- [ ] **Step 5: 验证 svg 是合法 XML**

Run: `node --input-type=module -e "import { readFileSync } from 'node:fs'; const s = readFileSync('static/architecture.svg','utf8'); if (!s.trimStart().startsWith('<svg') || !s.includes('</svg>')) throw new Error('svg 结构异常'); console.log('PASS svg structure')"`
Expected: `PASS svg structure`

- [ ] **Step 6: Commit**

```bash
git add README.md README.en.md static/architecture.svg
git commit -m "docs(readme): 中英双语 README 重写 + 手写架构图

README.md 中文主档 + README.en.md 英文，顶部互链，结构对齐 superpowers-dsh
并补齐本仓库特有的双平台安装、依赖安装步骤（.claude/ 已移出 git 的重建载体）、
三平台适配表与「改 frontmatter 解析器必读」警告。
架构图为文字手写 SVG（可 diff、无虚构）；不伪造安装成功截图。"
```

---

## Task 11: 最终验证（spec 的 8 项可执行判据）

**Files:**
- 无新增；只运行验证

**Interfaces:**
- Consumes: Task 1-10 的全部产物
- Produces: 8 项判据的执行证据

- [ ] **Step 1: 判据 1 — frontmatter 解析**

Run: `node scripts/verify-dsh-provider.mjs`
Expected: 以 `ALL PASS` 结束，且包含四行 `PASS manifests` / `PASS list(): 6 技能…` / `PASS get(): 6 技能正文与 resourceBase 全部正确` / `PASS resourceBase: refs/ 与 scripts/ 相对资源可达`

- [ ] **Step 2: 判据 2 — 前缀残留（白名单外为 0）**

先看原始命中：

Run:
```bash
grep -rnoE 'specpowers:specpowers|superpowers:' skills/ lib/ commands/ .claude-plugin/ AGENTS.md CLAUDE.md README.md README.en.md 2>/dev/null
```

再用脚本做白名单断言。**不要预测固定命中行数**——块内示例措辞一变数字就失效；真正的判据是「每一处命中都落在白名单文件里、且处在回退指南上下文中」：

```bash
node --input-type=module <<'EOF'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const files = ['skills', 'lib', 'commands', '.claude-plugin', 'AGENTS.md', 'CLAUDE.md', 'README.md', 'README.en.md']
let raw = ''
try {
  raw = execFileSync('grep', ['-rnoE', 'specpowers:specpowers|superpowers:', ...files], { encoding: 'utf8' })
} catch (error) {
  raw = error.stdout ?? '' // grep 退出码 1 = 无命中
}
const hits = raw.split('\n').filter(Boolean)

const SKILL_FILES = [
  'skills/specpowers/SKILL.md',
  'skills/specpowers-design/SKILL.md',
  'skills/specpowers-plan/SKILL.md',
  'skills/specpowers-apply/SKILL.md',
  'skills/specpowers-review/SKILL.md',
  'skills/specpowers-archive/SKILL.md'
]
const WHITELIST_FILES = [
  ...SKILL_FILES,
  'skills/specpowers/refs/platform-tools.md',
  'README.md',
  'README.en.md'
]

const byFile = new Map()
for (const hit of hits) {
  const file = hit.slice(0, hit.indexOf(':'))
  const lineNo = Number(hit.slice(hit.indexOf(':') + 1, hit.indexOf(':', hit.indexOf(':') + 1)))
  assert.ok(WHITELIST_FILES.includes(file), `白名单外出现前缀字样：${hit}`)
  if (!byFile.has(file)) byFile.set(file, [])
  byFile.get(file).push(lineNo)
}

// 6 个 SKILL.md：两处命中同在一行（回退指南行），该行必须含「回退」
for (const file of SKILL_FILES) {
  const lineNos = byFile.get(file) ?? []
  assert.equal(
    lineNos.length,
    2,
    `${file} 应含 2 处前缀示例（specpowers 与 superpowers 各一），实测 ${lineNos.length}`
  )
  const lines = readFileSync(file, 'utf8').split('\n')
  for (const lineNo of lineNos) {
    assert.ok(
      lines[lineNo - 1].includes('回退'),
      `${file}:${lineNo} 的前缀字样不在回退指南上下文：${lines[lineNo - 1]}`
    )
  }
}

// 实现文件、指令文件、命令文件必须完全干净
for (const file of ['lib/index.js', 'AGENTS.md', 'CLAUDE.md']) {
  assert.ok(!byFile.has(file), `${file} 不应出现前缀字样`)
}
for (const file of byFile.keys()) {
  assert.ok(
    !file.startsWith('commands/') && !file.startsWith('.claude-plugin/'),
    `${file} 不应出现前缀字样`
  )
}

console.log(`PASS prefix-residue: ${hits.length} 处命中全部落在白名单的回退指南内`)
console.log('命中文件：', [...byFile.keys()].sort().join(', '))
EOF
```
Expected: `PASS prefix-residue: …`，且「命中文件」仅列出 6 个 `skills/*/SKILL.md` + `skills/specpowers/refs/platform-tools.md` + `README.md` + `README.en.md`。

`docs/` 不在作用域内（历史记录，spec 明确排除）。

- [ ] **Step 3: 判据 3 — provider 契约**

已由判据 1 的 `PASS get()` 与 `PASS resourceBase` 覆盖。

- [ ] **Step 4: 判据 4 — 协议与状态机一致**

Run:
```bash
node --input-type=module <<'EOF'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const protocol = JSON.parse(readFileSync('skills/specpowers/refs/workflow-protocol.json', 'utf8'))
assert.equal(protocol.nodes.length, 5)
for (const node of protocol.nodes) {
  assert.ok(!node.skill.includes(':'), `节点 ${node.id} 的 skill 仍带前缀：${node.skill}`)
}
console.log('PASS protocol:', protocol.nodes.map((n) => n.skill).join(' '))
EOF
```
Expected: `PASS protocol: specpowers-design specpowers-design specpowers-plan specpowers-apply specpowers-archive`

Run:
```bash
ls /dsh-home/profiles/web/node_modules/superpowers-dsh/README.md 2>/dev/null
TMP=$(mktemp -d); mkdir -p "$TMP/.superpowers"
printf '%s\n' '{"name":"demo-feature","currentPhase":"phase0","completedPhases":[],"mode":"medium","blockedReason":null,"evidence":{}}' > "$TMP/.superpowers/state.json"
(cd "$TMP" && node /workspace/specpowers/skills/specpowers/scripts/workflow-state.mjs next) | grep '^SKILL:'
rm -rf "$TMP"
```
Expected: `SKILL: specpowers-design`（不含 `specpowers:` 前缀）

- [ ] **Step 5: 判据 5 — 清单有效性**

Run:
```bash
node --input-type=module -e "import assert from 'node:assert/strict'; import { existsSync, readFileSync } from 'node:fs'; for (const f of ['package.json','.claude-plugin/plugin.json','.claude-plugin/marketplace.json']) JSON.parse(readFileSync(f,'utf8')); const pkg=JSON.parse(readFileSync('package.json','utf8')); assert.equal(pkg.dsh.bundle.patch,'./cordis.patch.yml'); assert.ok(existsSync(pkg.dsh.bundle.patch)); const lines=readFileSync('cordis.patch.yml','utf8').split('\n').map(l=>l.trim()).filter(l=>l&&!l.startsWith('#')); assert.deepEqual(lines,['- insert:',\"- id: specpowers\",\"name: 'specpowers'\"]); console.log('PASS manifests')"
```
Expected: `PASS manifests`

Run: `git ls-files .claude-plugin | wc -l`
Expected: `2`（`plugin.json` 与 `marketplace.json` 仍被追踪，未被 `.gitignore` 误伤）

- [ ] **Step 6: 判据 6 — 技能文件无损坏**

Run:
```bash
for f in skills/*/SKILL.md; do printf '%-40s %s\n' "$f" "$(wc -l < "$f")"; done
```
Expected: 行数相对改造前增加约 6-7 行（每个文件新增一个 6 行平台适配块）：

| 文件 | 改造前 | 改造后预期 |
|---|---|---|
| `skills/specpowers/SKILL.md` | 379 | 386 |
| `skills/specpowers-design/SKILL.md` | 217 | 224 |
| `skills/specpowers-plan/SKILL.md` | 85 | 92 |
| `skills/specpowers-apply/SKILL.md` | 125 | 132 |
| `skills/specpowers-review/SKILL.md` | 569 | 576 |
| `skills/specpowers-archive/SKILL.md` | 173 | 180 |

Run（结构完整性）：
```bash
grep -c '前置检查' skills/specpowers-*/SKILL.md
grep -c '^#' skills/*/SKILL.md
```
Expected: 5 个子技能各含 `前置检查`；标题行数较改造前只增加 0（平台适配块是引用行，不是标题）

- [ ] **Step 7: 判据 7 — 无内网地址残留**

Run:
```bash
INTERNAL_HOST='<实际内网主机名>'   # 执行时填入；文档中不以字面量记录
echo "已追踪文件（排除 docs/）: $(git grep -nE "${INTERNAL_HOST}|<internal-domain>" -- . ':!docs/' | wc -l)"
echo "已追踪文件（含 docs/）  : $(git grep -nE "${INTERNAL_HOST}|<internal-domain>" -- . | wc -l)"
grep -rnE "${INTERNAL_HOST}|<internal-domain>" --include='*' . 2>/dev/null | grep -v '^\./\.git/' | grep -v '^\./\.superpowers/' | wc -l
```
Expected: **三行全为 `0`**（Task 10 已消除 README 的两处；spec/plan 已用占位符）。

> 工作区全量 grep（含 `.superpowers/`）会命中非 0——那是运行时 ledger/brief/报告记录了实际主机名以便执行，已被 gitignore，不随仓库分发。判据的对象是**会被发布的内容**，所以用 `git grep`（只搜已追踪文件）加上排除 `.superpowers/` 的工作区 grep 两路交叉确认。

> ⚠️ **必须向用户报告的残留（本判据无法消除）**：仓库的 **git 历史提交信息**中仍有 1 处内网主机名（早期提交 `65e1030` 的标题记录了远程地址迁移）。修改提交信息需要重写历史（`filter-repo` / rebase），属于破坏性操作且会让所有提交哈希变化——本计划不做。首次推送到 GitHub 前应当由用户决定：接受该历史残留，或先重写历史再推送。

- [ ] **Step 8: 判据 8 — 无 Comet 残留（活文件）**

Run:
```bash
grep -rniE 'comet' skills/ lib/ commands/ .claude-plugin/ AGENTS.md CLAUDE.md README.md README.en.md 2>/dev/null | wc -l
```
Expected: `0`（`docs/` 历史按 spec 定义排除）

- [ ] **Step 9: 汇总并输出验证报告**

把判据 1-8 的实际命令输出整理成验证报告，写入 `docs/superpowers/plans/2026-09-17-dsh-adaptation-verification.md`，逐项列出：判据编号、实际执行的命令、实际输出、结论（PASS/FAIL）。

**任何 FAIL 都必须报告为 FAIL，不得用文字声称替代实际输出。** 特别注意 spec 已声明的已知限制：DSH 端到端安装（`dsh plugin --profile web add`）需写工作区外的 profile 目录，受 `workspace-write` 沙箱限制，本次**未**执行——报告中必须如实写明这一点，并说明所验证的是同一份 provider 代码的真实执行。

- [ ] **Step 10: Commit**

```bash
git add docs/superpowers/plans/2026-09-17-dsh-adaptation-verification.md
git commit -m "test(dsh): 8 项判据验证报告

frontmatter 解析 / 前缀残留 / provider 契约 / 协议状态机一致 / 清单有效性 /
技能无损坏 / 无内网地址 / 无 Comet。含已知限制声明：DSH 端到端安装受沙箱
限制未执行，所验证的是同一份 provider 代码的真实执行。"
```

---

## 完成后

实施完成后**不要**推送。本地提交全部完成后向用户报告，由用户决定：

1. 是否推送到内网 GitLab（`origin`，当前为 `<内网 GitLab 主机>:<端口>`）——注意推送会带上仓库里既有的 PAT。
2. 是否推送到 GitHub（`https://github.com/SAXEM1997/specpowers`，需用户自行添加 remote 与凭据）。
3. 是否需要真实的 DSH 端到端安装验证（需另起 `--profile` 测试 profile 并申请一次沙箱提权）。
