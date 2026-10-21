#!/usr/bin/env node
// specpowers DSH 打包自检：清单有效性 + provider list()/get() 契约。
// 零依赖（纯 Node.js 标准库）。用法：node scripts/verify-dsh-provider.mjs
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

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

// ---- 解析失败 warn-and-skip（#4） ----
// 一个缺 name 的 SKILL.md 不应拖垮整个 provider：告警、跳过，其余技能继续注册。
const skipRoot = await mkdtemp(join(tmpdir(), 'specpowers-skip-'))
const warnings = []
const originalWarn = console.warn
try {
  await mkdir(join(skipRoot, 'lib'), { recursive: true })
  await mkdir(join(skipRoot, 'skills', 'good'), { recursive: true })
  await mkdir(join(skipRoot, 'skills', 'bad'), { recursive: true })
  await mkdir(join(skipRoot, 'skills', 'unparseable'), { recursive: true })
  await writeFile(join(skipRoot, 'package.json'), '{"type":"module"}\n', 'utf8')
  await writeFile(
    join(skipRoot, 'lib', 'index.js'),
    readFileSync(join(root, 'lib', 'index.js'), 'utf8'),
    'utf8'
  )
  await writeFile(
    join(skipRoot, 'skills', 'good', 'SKILL.md'),
    '---\nname: good\ndescription: A healthy skill that must survive a sibling parse failure.\n---\n\n# good\n',
    'utf8'
  )
  await writeFile(
    join(skipRoot, 'skills', 'bad', 'SKILL.md'),
    '---\ndescription: Missing name on purpose.\n---\n\n# bad\n',
    'utf8'
  )
  await writeFile(
    join(skipRoot, 'skills', 'unparseable', 'SKILL.md'),
    '# no frontmatter\n',
    'utf8'
  )

  console.warn = (...args) => warnings.push(args.join(' '))
  const skipMod = await import(pathToFileURL(join(skipRoot, 'lib', 'index.js')).href)
  let skipProvider
  skipMod.apply({ skills: { registerProvider(fn) { skipProvider = fn() } } })
  const skipRows = await skipProvider.list({})
  assert.equal(skipRows.length, 1, `warn-and-skip: 应只注册 1 个健康技能，实测 ${skipRows.length}`)
  assert.equal(skipRows[0].name, 'good', 'warn-and-skip: 健康技能应保留')
  assert.equal(warnings.length, 2, `warn-and-skip: 应输出 2 条告警，实测 ${warnings.length}`)
  for (const badName of ['bad', 'unparseable']) {
    assert.ok(
      warnings.some((warning) => warning.includes(join(skipRoot, 'skills', badName, 'SKILL.md'))),
      `warn-and-skip: 告警应包含 ${badName} 的路径：${warnings.join(' | ')}`
    )
  }
  const badFull = await skipProvider.get(
    { path: join(skipRoot, 'skills', 'bad', 'SKILL.md'), locator: join(skipRoot, 'skills', 'bad') },
    {}
  )
  assert.equal(badFull, undefined, 'warn-and-skip: get() 对坏文件应返回 undefined')
} finally {
  console.warn = originalWarn
  await rm(skipRoot, { recursive: true, force: true })
}
console.log('PASS warn-and-skip: 坏文件与不可解析文件告警并跳过，健康技能保留')

console.log('ALL PASS')
