#!/usr/bin/env node
// specpowers 节点出口守卫：exit <phaseId> [--apply] [--name <name>]
// 零外部依赖（fs/path + child_process 查 git）。cwd = 项目根。
// 检查矩阵硬编码（gate 文件 + name 匹配）；产物路径/skipIf 从 protocol.json 读取；git 检查（phase3/4）由本脚本承担。
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATE_PATH = '.superpowers/state.json';
const TOKEN_DIR = '.superpowers';
const TOKEN_PREFIX = '.gate-passed-';
const PROTOCOL_PATH = 'skills/specpowers/refs/workflow-protocol.json';
const PHASES = ['phase0', 'phase1', 'phase2', 'phase3', 'phase4'];

function readJson(p) {
  return JSON.parse(readFileSync(p, 'utf8'));
}
function readState() {
  if (!existsSync(STATE_PATH)) return { missing: true };
  try { return { data: readJson(STATE_PATH) }; } catch { return { corrupt: true }; }
}
function readProtocol() {
  if (!existsSync(PROTOCOL_PATH)) return null;
  try { return readJson(PROTOCOL_PATH); } catch { return null; }
}
function writeState(data) {
  writeFileSync(STATE_PATH, JSON.stringify(data, null, 2));
}
function tokenOk(n, name) {
  const p = join(TOKEN_DIR, `${TOKEN_PREFIX}${n}`);
  if (!existsSync(p)) return false;
  const c = readFileSync(p, 'utf8').trim();
  return name ? c.split('\n').some((l) => l.trim() === `name=${name}`) : true;
}
function skipped1(name) {
  const p = join(TOKEN_DIR, '.phase1-skipped');
  return existsSync(p) && readFileSync(p, 'utf8').trim() === name;
}
function resolvePath(tpl, name) {
  return tpl.replace(/<name>/g, name);
}
function gitLog(n) {
  try {
    return execSync(`git log --oneline -${n}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}

function checkPhase(phaseId, name) {
  const protocol = readProtocol();
  const node = (protocol?.nodes || []).find((x) => x.id === phaseId);
  if (!node) return { missing: [`未知 phaseId: ${phaseId}（protocol.json 无此节点）`], node: null };
  const missing = [];
  const skipActive = node.skipIf && skipped1(name);
  // 1) gate token（phase4 无 gate 文件）
  if (phaseId !== 'phase4' && !tokenOk(node.gate, name) && !skipActive) {
    missing.push(`gate token .gate-passed-${node.gate}（name=${name || '(未提供)'}）`);
  }
  // 2) 产物（skip 路径豁免）；phase4 跳过 outputSchemas 产物循环——archive.v1.artifacts 已由下方显式检查覆盖，避免重复报告同一条
  for (const out of node.outputs || []) {
    if (phaseId === 'phase4') continue;
    const skipArtifact = protocol?.outputSchemas?.[out]?.skipArtifact;
    const skipOut = skipActive || (skipArtifact && skipped1(name));
    for (const a of (protocol?.outputSchemas?.[out]?.artifacts) || []) {
      if (!existsSync(resolvePath(a, name)) && !skipOut) missing.push(resolvePath(a, name));
    }
  }
  // 3) git 检查（phase3/4）
  if (phaseId === 'phase3' && !gitLog('100').includes(name)) {
    missing.push(`git log 无含 <${name}> 的 commit`);
  }
  if (phaseId === 'phase4') {
    if (skipped1(name)) {
      if (!gitLog('1').includes(name)) missing.push(`git log --oneline -1 不含 <${name}>`);
    } else {
      if (!existsSync(join('openspec', 'changes', 'archive', name))) missing.push(`openspec/changes/archive/<${name}>/ 不存在`);
      if (!gitLog('1').includes(`archive ${name}`)) missing.push(`git log --oneline -1 不含 "archive <${name}>"`);
    }
  }
  return { missing, node };
}

const argv = process.argv.slice(2);
const sub = argv[0];
const phaseId = argv[1];
const apply = argv.includes('--apply');
const ni = argv.indexOf('--name');
let name = ni >= 0 ? argv[ni + 1] : undefined;
if (!name && existsSync(STATE_PATH)) {
  try { name = readJson(STATE_PATH).name || undefined; } catch { /* 损坏则按 undefined 处理 */ }
}

if (sub !== 'exit' || !phaseId || !PHASES.includes(phaseId)) {
  console.log('GUARD: fail\nREASON: 用法: workflow-guard.mjs exit <phase0|phase1|phase2|phase3|phase4> [--apply] [--name <name>]');
  process.exit(2);
}

const { missing, node } = checkPhase(phaseId, name);
if (missing.length) {
  console.log(`GUARD: fail\nPHASE: ${phaseId}\nMISSING: ${missing.join(', ')}\nREASON: 产物/gate 检查未通过（详见 MISSING）`);
  process.exit(1);
}
if (!apply) {
  console.log(`GUARD: pass\nPHASE: ${phaseId}\nCHECKS: 全部通过`);
  process.exit(0);
}
// --apply：更新 state.json（CAS：currentPhase 必须等于被退出的 phase）
const st = readState();
if (st.missing || st.corrupt) {
  const noteName = name ? '' : '无 --name，name 匹配已跳过；';
  console.log(`GUARD: pass\nPHASE: ${phaseId}\nCHECKS: 全部通过\nNOTE: state.json ${st.missing ? '缺失' : '损坏'}，--apply 跳过状态更新${noteName ? '（' + noteName.slice(0, -1) + '）' : ''}`);
  process.exit(0);
}
if (st.data.currentPhase !== phaseId) {
  console.log(`GUARD: conflict\nPHASE: ${phaseId}\nREASON: currentPhase=${st.data.currentPhase || '(未设置)'} ≠ ${phaseId}（状态已被推进，疑似重复调用或并发写入）`);
  process.exit(2);
}
const completed = st.data.completedPhases || [];
if (!completed.includes(phaseId)) {
  st.data.completedPhases = [...completed, phaseId];
  const nextIdx = PHASES.indexOf(phaseId) + 1;
  if (nextIdx < PHASES.length) st.data.currentPhase = PHASES[nextIdx];
}
writeState(st.data);
console.log(`GUARD: pass\nPHASE: ${phaseId}\nCHECKS: 全部通过\nAPPLY: 状态已更新（completedPhases += ${phaseId}，currentPhase → ${st.data.currentPhase}）`);
process.exit(0);
