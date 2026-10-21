#!/usr/bin/env node
// CI helper: convert every skill's SKILL.md to CRLF and assert the result.
// Used by .github/workflows/provider.yml to exercise the Windows/CRLF path on
// any runner. Zero dependencies (Node.js standard library only).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const skillsRoot = join(root, 'skills')
let converted = 0

for (const entry of readdirSync(skillsRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue
  const skillFile = join(skillsRoot, entry.name, 'SKILL.md')
  const lf = readFileSync(skillFile, 'utf8').replace(/\r\n/g, '\n')
  writeFileSync(skillFile, lf.replace(/\n/g, '\r\n'))
  if (!readFileSync(skillFile, 'utf8').includes('\r\n')) {
    throw new Error(`CRLF conversion failed: ${skillFile}`)
  }
  converted++
}

if (converted === 0) throw new Error('no SKILL.md files found under skills/')
console.log(`converted ${converted} SKILL.md files to CRLF`)
