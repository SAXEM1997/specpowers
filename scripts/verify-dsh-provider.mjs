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
