#!/usr/bin/env node
// specpowers 内网信息/凭据泄漏自检。
//
// 零依赖（纯 Node.js 标准库）。用法：node scripts/verify-no-internal-refs.mjs
//
// 设计要点：本脚本**自身不含任何内网字面量**——否则它就成了新的泄漏源，
// 且在公开仓库里等于把内网拓扑抄了一遍。因此分两层：
//   1) 通用特征（内网 TLD、私网 IPv4、凭据前缀、私钥块）—— 内置于此，可公开
//   2) 项目专属 denylist（真实主机名等）—— 从仓库根 `.internal-refs.txt` 读取，
//      该文件已 gitignore，不随仓库分发；缺失时自动跳过该层
//
// 扫描对象：已追踪文件的当前内容 + 全部可达提交信息。
// 退出码：0 = 干净；1 = 发现疑似泄漏。
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** 通用特征：不依赖具体内网名称，可安全公开。 */
const GENERIC = [
  ['私网 IPv4（RFC1918）', /\b(?:10\.\d{1,3}|192\.168|172\.(?:1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b/g],
  ['内网 TLD（.lan/.internal/.corp/.local/.home）', /\b[A-Za-z0-9][A-Za-z0-9.-]*\.(?:lan|internal|corp|local|home)\b/g],
  ['GitLab PAT', /glpat-[A-Za-z0-9_-]{10,}/g],
  ['GitHub token', /\b(?:ghp_|github_pat_)[A-Za-z0-9_]{20,}\b/g],
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/g],
  ['通用 API key（sk- 前缀）', /\bsk-[A-Za-z0-9]{20,}\b/g],
  ['私钥块', /-----BEGIN [A-Z ]*PRIVATE KEY-----/g],
  ['URL 内嵌凭据', /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@/g],
]

/** 从 gitignored 的 `.internal-refs.txt` 读取项目专属的敏感 token。 */
function projectDenylist() {
  const file = join(root, '.internal-refs.txt')
  if (!existsSync(file)) return []
  return readFileSync(file, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'))
    .map((token) => [`项目 denylist：${token.slice(0, 3)}…`, new RegExp(escapeRe(token), 'g'), token])
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 打码匹配值，避免脚本输出把敏感内容再抄一遍。 */
function mask(text) {
  const s = String(text)
  if (s.length <= 8) return s.slice(0, 2) + '*'.repeat(Math.max(1, s.length - 2))
  return `${s.slice(0, 4)}${'*'.repeat(Math.min(12, s.length - 8))}${s.slice(-4)}`
}

const findings = []

function scan(label, text, patterns) {
  for (const [name, rx] of patterns) {
    const re = new RegExp(rx.source, rx.flags.includes('g') ? rx.flags : rx.flags + 'g')
    let m
    while ((m = re.exec(text)) !== null) {
      findings.push({ label, name, masked: mask(m[0]) })
      if (m.index === re.lastIndex) re.lastIndex++
    }
  }
}

const denylist = projectDenylist().map(([name, rx]) => [name, rx])
const all = [...GENERIC, ...denylist]

// 1) 已追踪文件的当前内容
const files = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)
for (const rel of files) {
  let text
  try {
    text = readFileSync(join(root, rel), 'utf8')
  } catch {
    continue // 二进制或不可读，跳过
  }
  scan(rel, text, all)
}

// 2) 全部可达提交信息（作者/提交者元数据由 git 本身保证，此处查正文）
let messages = ''
try {
  messages = execFileSync('git', ['log', '--all', '--format=%H%n%s%n%b'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  })
} catch {
  messages = ''
}
scan('<commit message>', messages, all)

if (findings.length === 0) {
  const d = denylist.length > 0 ? `${denylist.length} 条项目 denylist + ` : '（无 .internal-refs.txt，仅通用特征）'
  console.log(`PASS no-internal-refs: 已追踪文件 ${files.length} 个 + 提交信息，命中 0（检查项：${d}${GENERIC.length} 条通用特征）`)
  process.exit(0)
}

console.error(`FAIL no-internal-refs: 发现 ${findings.length} 处疑似泄漏\n`)
for (const f of findings.slice(0, 40)) {
  console.error(`  [${f.name}] ${f.label}  →  ${f.masked}`)
}
if (findings.length > 40) console.error(`  …另有 ${findings.length - 40} 处`)
console.error('\n处置：移除后重试；若已进入历史，需重写历史（见 .superpowers/audit/git-history-purge-plan.md）')
process.exit(1)
