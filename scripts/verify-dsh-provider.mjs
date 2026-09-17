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

console.log('ALL PASS')
