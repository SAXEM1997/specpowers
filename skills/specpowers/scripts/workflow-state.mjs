#!/usr/bin/env node
// specpowers 轻量状态机：status / next / init / set-name / reset
// 零外部依赖（纯 Node.js 标准库）。cwd = 项目根。state.json 只是索引——gate 文件（token）是最终裁判。
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
function gitLog(n) {
  try {
    return execSync(`git log --oneline -${n}`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return '';
  }
}
function writeState(data) {
  writeFileSync(STATE_PATH, JSON.stringify(data, null, 2));
}
function tokenContent(n) {
  const p = join(TOKEN_DIR, `${TOKEN_PREFIX}${n}`);
  return existsSync(p) ? readFileSync(p, 'utf8').trim() : null;
}
function tokenOk(n, name) {
  const c = tokenContent(n);
  if (c === null) return false;
  return name ? c.split('\n').some((l) => l.trim() === `name=${name}`) : true;
}
function skipped1(name) {
  const p = join(TOKEN_DIR, '.phase1-skipped');
  return existsSync(p) && readFileSync(p, 'utf8').trim() === name;
}
function gateOk(n, name) {
  return n === 1 ? tokenOk(1, name) || skipped1(name) : tokenOk(n, name);
}
// 归档证据轻量近似：archive 目录 或（phase1-skipped 且 git log -1 含 name）；git 严格检查由 guard exit phase4 承担
function archiveEvidence(name) {
  if (existsSync(join('openspec', 'changes', 'archive', name))) return true;
  return skipped1(name) && gitLog(1).includes(name);
}
function nodeOf(protocol, id) {
  return (protocol?.nodes || []).find((x) => x.id === id) || null;
}
// resume 模式 name 推断：产物仅用于 name 推断，不改变 phase 判定
function inferNames() {
  const names = new Set();
  if (existsSync('docs/superpowers/clarifications')) {
    for (const e of readdirSync('docs/superpowers/clarifications')) {
      if (e.endsWith('.md')) names.add(e.replace(/\.md$/, ''));
    }
  }
  if (existsSync('docs/superpowers/plans')) {
    for (const e of readdirSync('docs/superpowers/plans')) {
      if (e.endsWith('.md')) names.add(e.replace(/\.md$/, ''));
    }
  }
  if (existsSync('openspec/changes')) {
    for (const e of readdirSync('openspec/changes')) {
      if (e !== 'archive') names.add(e);
    }
  }
  return [...names];
}

function cmdStatus() {
  const st = readState();
  if (st.missing) { console.log('STATE_MISSING'); return; }
  if (st.corrupt) {
    console.log('STATE_CORRUPT');
    console.log('恢复指引: init --force --resume-artifacts [--name <name>]');
    return;
  }
  const name = st.data.name;
  const found = [];
  for (let n = 0; n < 4; n++) {
    if (tokenContent(n) !== null) {
      found.push(`${TOKEN_PREFIX}${n}(${gateOk(n, name) ? 'name匹配' : 'name不匹配'})`);
    }
  }
  console.log('STATE: initialized');
  console.log(`NAME: ${name || '(未设置)'}`);
  console.log(`MODE: ${st.data.mode || '(未设置)'}`);
  console.log(`CURRENT_PHASE: ${st.data.currentPhase || 'phase0'}`);
  console.log(`COMPLETED_PHASES: ${(st.data.completedPhases || []).join(',') || 'none'}`);
  console.log(`BLOCKED_REASON: ${st.data.blockedReason || '(无)'}`);
  console.log(`GATE_TOKENS_FOUND: ${found.join(',') || 'none'}`);
}

function cmdInit(args) {
  const ni = args.indexOf('--name');
  const name = ni >= 0 ? args[ni + 1] : undefined;
  const mi = args.indexOf('--mode');
  const mode = mi >= 0 ? args[mi + 1] : undefined;
  const resume = args.includes('--resume-artifacts');
  const force = args.includes('--force');
  if (existsSync(STATE_PATH) && !force) {
    console.log('STATE_EXISTS（已存在，不覆盖；--force 删除重建）');
    return;
  }
  if (force && existsSync(STATE_PATH)) rmSync(STATE_PATH);
  let name2 = name;
  if (resume && !name2) {
    const cands = inferNames();
    if (cands.length === 1) name2 = cands[0];
    else if (cands.length > 1) console.log(`HINT: 检测到多个 name 候选（${cands.join(', ')}），请用 init --resume-artifacts --name <name> 指定`);
  }
  const completed = [];
  if (resume && name2) {
    for (let n = 0; n < 4; n++) if (gateOk(n, name2)) completed.push(PHASES[n]);
  }
  const state = {
    name: name2 || null,
    currentPhase: resume && completed.length ? PHASES[Math.min(completed.length, 4)] : 'phase0',
    completedPhases: completed,
    mode: mode || null,
    blockedReason: null,
    evidence: {}
  };
  writeState(state);
  console.log(`INIT done (name=${name2 || '未提供'} mode=${mode || '未提供'} resume=${resume} completed=${completed.join(',') || 'none'})`);
  if (resume && !name2) console.log('HINT: 产物已存在但未提供 --name，请运行 set-name <name>');
}

function cmdSetName(name) {
  const st = readState();
  if (st.missing) { console.log('STATE_MISSING'); return; }
  if (st.corrupt) { console.log('STATE_CORRUPT'); return; }
  st.data.name = name;
  writeState(st.data);
  console.log(`NAME_SET name=${name}`);
}

function cmdNext() {
  const st = readState();
  if (st.missing) { console.log('STATE_MISSING'); return; }
  if (st.corrupt) { console.log('STATE_CORRUPT'); console.log('恢复指引: init --force --resume-artifacts [--name <name>]'); return; }
  const name = st.data.name;
  if (!name) {
    console.log('NEXT: manual\nSKILL: (当前)\nPHASE: phase0\nREASON: NEED_NAME（state.name 未设置，运行 set-name <name>）');
    return;
  }
  const protocol = readProtocol();
  const completed = st.data.completedPhases || [];
  const clear = () => writeState({ ...st.data, blockedReason: null });
  // 1) blocked：completedPhases 记录但 gate 文件缺失/name 不匹配
  for (let n = 0; n < 4; n++) {
    if (completed.includes(PHASES[n]) && !gateOk(n, name)) {
      const reason = `${PHASES[n]} 在 completedPhases 中但 gate token 缺失或 name 不匹配`;
      writeState({ ...st.data, blockedReason: reason });
      const skill = nodeOf(protocol, PHASES[n])?.skill || 'specpowers:specpowers-design';
      console.log(`NEXT: blocked\nSKILL: ${skill}\nPHASE: ${PHASES[n]}\nREASON: ${reason}`);
      return;
    }
  }
  // 2) 第一个未完成 phase（gate 文件证据优先，不依赖 completedPhases）
  for (let n = 0; n < 4; n++) {
    if (gateOk(n, name)) continue;
    const node = nodeOf(protocol, PHASES[n]);
    const pps = node?.pausePoints || [];
    const decided = (node?.pausePoints || []).every((pp) => (st.data.evidence || {})[PHASES[n]]?.[pp]);
    clear();
    if (pps.length && !decided) {
      console.log(`NEXT: manual\nSKILL: ${node?.skill || 'specpowers:specpowers-design'}\nPHASE: ${PHASES[n]}\nREASON: 停顿点 ${pps.join('/')} 未持久化于 evidence（见 refs/decision-points.md）`);
    } else {
      console.log(`NEXT: auto\nSKILL: ${node?.skill || 'specpowers:specpowers-design'}\nPHASE: ${PHASES[n]}\nREASON: 第一个未完成 phase`);
    }
    return;
  }
  // 3) token 0-3 齐 → phase4 或 done
  clear();
  const archiveNode = nodeOf(protocol, 'phase4');
  if (archiveEvidence(name)) {
    console.log(`NEXT: done\nPHASE: phase4\nREASON: 归档证据已记录（git 严格检查由 guard exit phase4 执行）`);
  } else {
    console.log(`NEXT: auto\nSKILL: ${archiveNode?.skill || 'specpowers:specpowers-archive'}\nPHASE: phase4\nREASON: token 0-3 齐，进入归档`);
  }
}

function cmdReset(phaseId) {
  const st = readState();
  if (st.missing) { console.log('STATE_MISSING'); return; }
  if (st.corrupt) { console.log('STATE_CORRUPT'); return; }
  const idx = PHASES.indexOf(phaseId);
  if (idx < 0) {
    console.log(`参数错误: phaseId 必须为 ${PHASES.join('|')}`);
    process.exit(2);
  }
  const completed = (st.data.completedPhases || []).filter((p) => PHASES.indexOf(p) < idx);
  for (let n = idx; n < 4; n++) {
    const p = join(TOKEN_DIR, `${TOKEN_PREFIX}${n}`);
    if (existsSync(p)) rmSync(p);
  }
  if (idx <= 1) {
    const p = join(TOKEN_DIR, '.phase1-skipped');
    if (existsSync(p)) rmSync(p);
  }
  writeState({ ...st.data, currentPhase: phaseId, completedPhases: completed, blockedReason: null });
  console.log(`RESET to ${phaseId} (completed=${completed.join(',') || 'none'})`);
}

const [cmd, ...args] = process.argv.slice(2);
switch (cmd) {
  case 'status': cmdStatus(); break;
  case 'next': cmdNext(); break;
  case 'init': cmdInit(args); break;
  case 'set-name': cmdSetName(args[0]); break;
  case 'reset': cmdReset(args[0]); break;
  default:
    console.log('用法: workflow-state.mjs <status|next|init|set-name|reset> [参数]');
    process.exit(2);
}
