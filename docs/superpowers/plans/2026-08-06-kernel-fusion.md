# Kernel 能力融合实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Comet workflow-kernel 的 5 个核心机制（状态机索引、节点出口机械 guard、机器可读协议、Decision Core、可选 hooks）融合到原版 specpowers 技能组（6 个 SKILL.md + scripts + refs），删除 specpowers-kernel 双层入口嵌套。

**Architecture:** 原 6 个 SKILL.md 业务 Phase 流程语义不变，仅插入 guard 调用（及 Phase 0 Step 0.3 后的 init 调用）与 Decision Core 节；新增轻量专用脚本（~270 行，零 comet 依赖，纯 Node.js 标准库）；状态机先行判定 Phase、文件证据（`.gate-passed-<N>` token + name 绑定）最终裁决；Phase 自动检测保留为回退路径；hooks 默认 off（仅提供模板，不注册）。

**Tech Stack:** Node.js ≥18（仅脚本运行时，零 npm 依赖）、JSON（workflow-protocol.json）、YAML（hooks 模板）、Markdown（技能文件）。

## Global Constraints

- **脚本零外部依赖**：只用 Node.js 标准库（fs/path/url/child_process），不 import comet、不 npm install。
- **调用路径**：所有脚本以 `node skills/specpowers/scripts/<name>.mjs` 调用，cwd = 项目根（Claude Code Bash 工具行为）。
- **退出码约定**：0 = 正常（含 STATE_MISSING/blocked/done）、1 = guard fail、2 = 参数错误/guard CAS 冲突。
- **state.json 路径**：`.superpowers/state.json`；gate token 目录 `.superpowers/`，前缀 `.gate-passed-`；token 内容含 `name=<name>` 行，name 绑定完全匹配才算有效。（建议提交到 git——.superpowers/ 未被 gitignore，实现跨设备恢复）
- **name 替换**：产物路径中的 `<name>` 从 `--name` 参数读（显式传参优先）；缺失时从 state.json name 字段读。（设计文档 L288 表述为 state 优先——语义等价，最终 name 来源一致；两者同时提供时以显式参数为准）
- **Windows/Linux 兼容**：路径用 `path.join()`，存在性用 `fs.existsSync()`（不做真 glob，只检查 protocol 声明的确切路径替换 `<name>` 后的字面路径）。
- **停顿点分配（相对设计文档样例的调整）**：设计文档 `refs/workflow-protocol.json` 样例的 pausePoints 分配（PP-04→phase2、PP-08→phase4）与 PP 定义正本（kernel decision-points.md 的 PP→节点归属）不一致；设计文档 L280 明确样例分配"为示意"，实施时以定义正本为对齐基准：phase0=[PP-01,PP-02]、phase1=[PP-03,PP-04]、phase2=[PP-05]、phase3=[PP-06,PP-07,PP-08]、phase4=[]（phase4 硬 Gate 链失败是停止条件，非用户决策点）。
- **token 先写、guard 后调**：`.gate-passed-<N>` 由 specpowers-review 在 Gate 通过后写入；guard 调用由各子技能在验证链通过后执行（子技能 Gate 出口为唯一 guard 调用责任方）。微小任务无 state.json，不调 guard、不 init。
- **删除目标**：`.claude/skills/specpowers-kernel/` + 5 个 node skill（共 6 目录）；`.comet/skills/specpowers-{apply,archive,design,plan}` 4 目录。保留 `.comet/bundle-drafts/specpowers-kernel/`、`.comet/bundle-authoring/`、`.comet/bundle-factory-plans/`、`.comet/inputs/`（创作记录备查）。删除前 grep 确认无残留引用。

---

### Task 1: workflow-protocol.json（机器可读协议）

**Files:**
- Create: `skills/specpowers/refs/workflow-protocol.json`

**Interfaces:**
- Produces: protocol 的 `nodes[].id/skill/gate/outputs/skipIf/pausePoints`、`outputSchemas.*.artifacts/skipArtifact` —— Task 2（workflow-state.mjs 读 nodes.pausePoints + state）、Task 3（workflow-guard.mjs 读 nodes.gate/outputs + outputSchemas.artifacts + skipIf）依赖。

- [ ] **Step 1: 写文件（数据契约，先于脚本）**

创建 `skills/specpowers/refs/workflow-protocol.json`，内容如下（与设计文档 L255-278 样例一致，仅 pausePoints 按 Global Constraints 调整为与定义正本对齐）：

```json
{
  "schemaVersion": 1,
  "kind": "specpowers",
  "name": "specpowers",
  "goal": "SDD+TDD 工程化开发方法论：Phase 0-4 全流程 + Gate Token 产物依赖链。",
  "nodes": [
    {"id": "phase0", "label": "Phase 0: 需求澄清与设计", "skill": "specpowers:specpowers-design", "gate": 0, "outputs": ["clarifications.v1", "design-doc.v1"], "skipIf": null, "pausePoints": ["PP-01", "PP-02"]},
    {"id": "phase1", "label": "Phase 1: OpenSpec 格式转换", "skill": "specpowers:specpowers-design", "gate": 1, "outputs": ["openspec-change.v1"], "skipIf": ".superpowers/.phase1-skipped", "pausePoints": ["PP-03", "PP-04"]},
    {"id": "phase2", "label": "Phase 2: 衔接计划", "skill": "specpowers:specpowers-plan", "gate": 2, "outputs": ["plan.v1"], "skipIf": null, "pausePoints": ["PP-05"]},
    {"id": "phase3", "label": "Phase 3: 子代理 TDD 实现", "skill": "specpowers:specpowers-apply", "gate": 3, "outputs": ["implementation.v1"], "skipIf": null, "pausePoints": ["PP-06", "PP-07", "PP-08"]},
    {"id": "phase4", "label": "Phase 4: 验证与归档", "skill": "specpowers:specpowers-archive", "gate": null, "outputs": ["archive.v1"], "skipIf": null, "pausePoints": [], "hardGateChain": ["full-test", "openspec-validate", "opsx-archive", "integrity-verify"]}
  ],
  "outputSchemas": {
    "clarifications.v1": {"artifacts": ["docs/superpowers/clarifications/<name>.md"]},
    "design-doc.v1": {"artifacts": ["docs/superpowers/specs/<name>-design.md"]},
    "openspec-change.v1": {"artifacts": ["openspec/changes/<name>/proposal.md", "openspec/changes/<name>/design.md", "openspec/changes/<name>/specs/", "openspec/changes/<name>/tasks.md"], "skipArtifact": ".superpowers/.phase1-skipped"},
    "plan.v1": {"artifacts": ["docs/superpowers/plans/<name>.md"]},
    "implementation.v1": {"artifacts": [], "evidence": ["git-committed"]},
    "archive.v1": {"artifacts": ["openspec/changes/archive/<name>/"], "skipArtifact": ".superpowers/.phase1-skipped"}
  },
  "state": {"path": ".superpowers/state.json", "gateTokenDir": ".superpowers/", "gateTokenPrefix": ".gate-passed-"}
}
```

注：hardGateChain 与 implementation.v1.evidence 为协议文档字段（供人读/审计），当前脚本不消费——保留以备后续扩展

- [ ] **Step 2: 验证 JSON 语法与契约**

Run: `node -e "const p=require('./skills/specpowers/refs/workflow-protocol.json'); console.log('nodes:', p.nodes.length, '| schemas:', Object.keys(p.outputSchemas).length, '| phase4.pausePoints:', JSON.stringify(p.nodes.find(n=>n.id==='phase4').pausePoints))"`
Expected: `nodes: 5 | schemas: 6 | phase4.pausePoints: []`

Run: `node -e "const p=require('./skills/specpowers/refs/workflow-protocol.json'); for(const n of p.nodes){if(n.id!=='phase4'){console.log(n.id, 'gate='+n.gate, 'pps='+n.pausePoints.join('/')||'none')}}"`
Expected:
```
phase0 gate=0 pps=PP-01/PP-02
phase1 gate=1 pps=PP-03/PP-04
phase2 gate=2 pps=PP-05
phase3 gate=3 pps=PP-06/PP-07/PP-08
```

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers/refs/workflow-protocol.json
git commit -m "feat(specpowers): 新增 workflow-protocol.json 精简协议（pausePoints 与定义正本对齐）"
```

---

### Task 2: workflow-state.mjs（轻量状态机）

**Files:**
- Create: `skills/specpowers/scripts/workflow-state.mjs`

**Interfaces:**
- Consumes: Task 1 protocol（`nodes[].pausePoints` 读 manual 判定）、`.superpowers/` 下 gate token 文件、`.superpowers/state.json`（state.path/gateTokenDir/gateTokenPrefix 由脚本硬编码，不读 protocol.state——见设计约束"protocol 是数据"的取舍）
- Produces: 命令 `status|next|init|set-name|reset`；`NEXT: auto|blocked|manual|done` + `SKILL:` + `PHASE:` + `REASON:` 输出契约 —— Task 6（入口 SKILL.md Step 0/1/2 文本引用）依赖。

- [ ] **Step 1: 写文件（完整实现）**

创建 `skills/specpowers/scripts/workflow-state.mjs`：

```javascript
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
```

- [ ] **Step 2: 语法验证**

Run: `node --check skills/specpowers/scripts/workflow-state.mjs`
Expected: 无输出（语法通过）

- [ ] **Step 3: 冒烟测试（全用例，含 manual/done/blocked/reset 陈旧 token/STATE_CORRUPT）**

```bash
cd D:/workspace/specpowers
# 注意：本冒烟在真实仓库执行，会写 .superpowers/ 与 docs/superpowers/ 产物并依赖 git 状态（用例 8 依赖末位 commit 不含 name，用例 9 依赖 archive 目录）；
# 中断会留残渣——执行前确认无进行中的真实 workflow 状态（.superpowers/ 无 state.json 且无真实 token），
# 执行后确认清理命令执行完毕（最后一行 rm 已跑）。
# 前置清理（冒烟不污染真实状态）
rm -f .superpowers/state.json .superpowers/.gate-passed-0 .superpowers/.gate-passed-1 .superpowers/.gate-passed-2 .superpowers/.gate-passed-3 .superpowers/.phase1-skipped

# 1) 缺失状态
node skills/specpowers/scripts/workflow-state.mjs status
# 预期: STATE_MISSING

# 2) init
node skills/specpowers/scripts/workflow-state.mjs init --name 2026-08-06-smoke --mode medium
# 预期: INIT done (name=2026-08-06-smoke mode=medium resume=false completed=none)

# 3) status
node skills/specpowers/scripts/workflow-state.mjs status
# 预期: STATE: initialized / NAME: 2026-08-06-smoke / MODE: medium / CURRENT_PHASE: phase0 / COMPLETED_PHASES: none / BLOCKED_REASON: (无) / GATE_TOKENS_FOUND: none

# 4) next → manual（phase0 停顿点 PP-01/PP-02 未持久化）
node skills/specpowers/scripts/workflow-state.mjs next
# 预期: NEXT: manual / SKILL: specpowers:specpowers-design / PHASE: phase0 / REASON: 停顿点 PP-01/PP-02 未持久化于 evidence（见 refs/decision-points.md）

# 5) PP 决策持久化后 → auto
node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync('.superpowers/state.json','utf8'));s.evidence.phase0={'PP-01':{decision:'selected',option:'B'},'PP-02':{decision:'approved'}};fs.writeFileSync('.superpowers/state.json',JSON.stringify(s,null,2))"
node skills/specpowers/scripts/workflow-state.mjs next
# 预期: NEXT: auto / SKILL: specpowers:specpowers-design / PHASE: phase0 / REASON: 第一个未完成 phase

# 6) blocked：completedPhases 含 phase1 但 token 缺失
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-0
node -e "const fs=require('fs');const s=JSON.parse(fs.readFileSync('.superpowers/state.json','utf8'));s.completedPhases=['phase0','phase1'];fs.writeFileSync('.superpowers/state.json',JSON.stringify(s,null,2))"
node skills/specpowers/scripts/workflow-state.mjs next
# 预期: NEXT: blocked / PHASE: phase1 / REASON: phase1 在 completedPhases 中但 gate token 缺失或 name 不匹配
# 并确认 state.json blockedReason 已写回:
node -e "console.log(JSON.parse(require('fs').readFileSync('.superpowers/state.json','utf8')).blockedReason)"

# 7) reset phase0：删除陈旧 token + 清 blockedReason
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-0
node skills/specpowers/scripts/workflow-state.mjs reset phase0
# 预期: RESET to phase0 (completed=none)  且 .gate-passed-0 已删除
test ! -f .superpowers/.gate-passed-0 && echo "token 已删除" 

# 8) phase1-skipped 豁免：phase1 视为完成
printf '2026-08-06-smoke' > .superpowers/.phase1-skipped
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-0
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-2
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-3
node skills/specpowers/scripts/workflow-state.mjs next
# 预期: NEXT: auto / SKILL: specpowers:specpowers-archive / PHASE: phase4 / REASON: token 0-3 齐，进入归档

# 9) done：归档证据齐
mkdir -p openspec/changes/archive/2026-08-06-smoke
node skills/specpowers/scripts/workflow-state.mjs next
# 预期: NEXT: done / PHASE: phase4 / REASON: 归档证据已记录（git 严格检查由 guard exit phase4 执行）
rm -rf openspec/changes/archive/2026-08-06-smoke

# 10) reset 回退 phase1 时同时删除 .phase1-skipped
node skills/specpowers/scripts/workflow-state.mjs reset phase1
# 预期: RESET to phase1 (completed=none)
test ! -f .superpowers/.phase1-skipped && echo "phase1-skipped 已删除"
node skills/specpowers/scripts/workflow-state.mjs next
# 预期: NEXT: manual（回退后 phase1 无 token，第一个未完成=phase1，PP-03/PP-04 未决 → manual）

# 11) STATE_CORRUPT
echo "{broken json" > .superpowers/state.json
node skills/specpowers/scripts/workflow-state.mjs status
# 预期: STATE_CORRUPT / 恢复指引: init --force --resume-artifacts [--name <name>]

# 12) 恢复指引链路：--force 重建
node skills/specpowers/scripts/workflow-state.mjs init --force --name 2026-08-06-smoke --mode medium
# 预期: INIT done (name=2026-08-06-smoke ...)

# 13) resume 4-token 全齐 → currentPhase=phase4
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-0
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-1
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-2
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-3
rm -f .superpowers/state.json
node skills/specpowers/scripts/workflow-state.mjs init --resume-artifacts --name 2026-08-06-smoke --mode medium
node skills/specpowers/scripts/workflow-state.mjs status
# 预期: CURRENT_PHASE: phase4（token 0-3 全齐 → 第一个无 token 的 phase = phase4）

# 14) resume 多 name 候选 → HINT
mkdir -p docs/superpowers/clarifications
printf 'x' > docs/superpowers/clarifications/2026-08-06-alpha.md
printf 'x' > docs/superpowers/clarifications/2026-08-06-beta.md
rm -f .superpowers/state.json
node skills/specpowers/scripts/workflow-state.mjs init --resume-artifacts --mode medium
# 预期: HINT: 检测到多个 name 候选（至少含 2026-08-06-alpha 与 2026-08-06-beta；候选数不精确枚举——inferNames 还扫描 plans/ 下历史文档），请用 init --resume-artifacts --name <name> 指定
# 注: 脚本先输出 HINT 再输出 INIT done
rm -f docs/superpowers/clarifications/2026-08-06-alpha.md docs/superpowers/clarifications/2026-08-06-beta.md

# 15) resume 显式 --name（真实仓库 plans/ 恒有历史文档，单候选自动推断无法构造）
printf 'x' > docs/superpowers/clarifications/2026-08-06-smoke.md
rm -f .superpowers/.gate-passed-0 .superpowers/.gate-passed-1 .superpowers/.gate-passed-2 .superpowers/.gate-passed-3
rm -f .superpowers/state.json
node skills/specpowers/scripts/workflow-state.mjs init --resume-artifacts --name 2026-08-06-smoke --mode medium
# 预期: INIT done（name=2026-08-06-smoke 由 --name 显式指定，completed=none——无 token）
rm -f docs/superpowers/clarifications/2026-08-06-smoke.md

# 16) name 前缀碰撞：token 内容 name=2026-08-06-smoke-b 不匹配 2026-08-06-smoke
# 注: name 已由用例 15 设置（state.name=2026-08-06-smoke），且用例 16 的 token 0-2 内容与 name 匹配（有效）
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-0
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-1
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-2
printf 'name=2026-08-06-smoke-b\nround=1\n' > .superpowers/.gate-passed-3
node skills/specpowers/scripts/workflow-state.mjs next
# 预期: NEXT: manual / PHASE: phase3 / REASON: 停顿点 PP-06/PP-07/PP-08 未持久化于 evidence（见 refs/decision-points.md）

# 17) set-name：init 未带 --name → set-name 补充
rm -f .superpowers/state.json
node skills/specpowers/scripts/workflow-state.mjs init --mode medium
node skills/specpowers/scripts/workflow-state.mjs set-name 2026-08-06-smoke
# 预期: NAME_SET name=2026-08-06-smoke
node skills/specpowers/scripts/workflow-state.mjs status
# 预期: NAME: 2026-08-06-smoke

# 18) 脚本缺失→Phase 自动检测回退路径（设计验证策略要求）
mv skills/specpowers/scripts/workflow-state.mjs skills/specpowers/scripts/workflow-state.mjs.bak
node skills/specpowers/scripts/workflow-state.mjs status
# 预期: 命令失败（脚本不存在）→ 入口技能按「Phase 自动检测（回退路径）」表扫产物文件推断 Phase（本用例验证回退触发机制存在，具体推断由入口技能文本协议执行）
mv skills/specpowers/scripts/workflow-state.mjs.bak skills/specpowers/scripts/workflow-state.mjs

# 清理
rm -f .superpowers/state.json .superpowers/.gate-passed-0 .superpowers/.gate-passed-1 .superpowers/.gate-passed-2 .superpowers/.gate-passed-3 .superpowers/.phase1-skipped
```

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers/scripts/workflow-state.mjs
git commit -m "feat(specpowers): 新增轻量状态机 workflow-state.mjs（status/next/init/set-name/reset，零依赖）"
```

---

### Task 3: workflow-guard.mjs（节点出口守卫）

**Files:**
- Create: `skills/specpowers/scripts/workflow-guard.mjs`

**Interfaces:**
- Consumes: Task 1 protocol（nodes.gate/outputs/skipIf + outputSchemas.*.artifacts/skipArtifact（产物豁免））、`.superpowers/` gate token、`.superpowers/state.json`、git log（phase3/4）
- Produces: `exit <phaseId> [--apply] [--name <name>]` → `GUARD: pass|fail|conflict` + CHECKS/MISSING/REASON；退出码 0/1/2 —— Task 7-10（5 子技能 guard 调用）依赖。

- [ ] **Step 1: 写文件（完整实现）**

创建 `skills/specpowers/scripts/workflow-guard.mjs`：

```javascript
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
```

- [ ] **Step 2: 语法验证**

Run: `node --check skills/specpowers/scripts/workflow-guard.mjs`
Expected: 无输出（语法通过）

- [ ] **Step 3: 冒烟测试（pass/fail/skip/CAS/降级）**

```bash
cd D:/workspace/specpowers
rm -f .superpowers/state.json .superpowers/.gate-passed-0 .superpowers/.gate-passed-1 .superpowers/.gate-passed-2 .superpowers/.gate-passed-3 .superpowers/.phase1-skipped

# 1) 无 token → fail（退出码 1）
node skills/specpowers/scripts/workflow-guard.mjs exit phase0 --name 2026-08-06-smoke
# 预期: GUARD: fail / MISSING: gate token .gate-passed-0（name=2026-08-06-smoke）, docs/superpowers/clarifications/2026-08-06-smoke.md, docs/superpowers/specs/2026-08-06-smoke-design.md
echo "exit=$?"

# 2) 参数错误（退出码 2）
node skills/specpowers/scripts/workflow-guard.mjs exit phase9
# 预期: GUARD: fail / REASON: 用法: ...（退出码 2）

# 3) 产物齐 + token 齐 → pass
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-0
mkdir -p docs/superpowers/clarifications docs/superpowers/specs
printf 'smoke' > docs/superpowers/clarifications/2026-08-06-smoke.md
printf 'smoke' > docs/superpowers/specs/2026-08-06-smoke-design.md
node skills/specpowers/scripts/workflow-guard.mjs exit phase0 --name 2026-08-06-smoke
# 预期: GUARD: pass / CHECKS: 全部通过

# 4) --apply 更新状态
node skills/specpowers/scripts/workflow-state.mjs init --name 2026-08-06-smoke --mode medium
node skills/specpowers/scripts/workflow-guard.mjs exit phase0 --apply
# 预期: GUARD: pass ... APPLY: 状态已更新（completedPhases += phase0，currentPhase → phase1）

# 5) 重复 --apply → CAS conflict（退出码 2）
node skills/specpowers/scripts/workflow-guard.mjs exit phase0 --apply
# 预期: GUARD: conflict / REASON: currentPhase=phase1 ≠ phase0（退出码 2）

# 6) phase1 skip 路径：.phase1-skipped（内容==name）→ token + 产物豁免
printf '2026-08-06-smoke' > .superpowers/.phase1-skipped
node skills/specpowers/scripts/workflow-guard.mjs exit phase1 --apply
# 预期: GUARD: pass（无 .gate-passed-1、无 openspec 四件套也通过——skip 豁免生效）

# 7) state.json 缺失降级：--apply 跳过状态更新、name 匹配仍执行
rm -f .superpowers/state.json
node skills/specpowers/scripts/workflow-guard.mjs exit phase2 --name 2026-08-06-smoke --apply
# 预期: GUARD: fail（.gate-passed-2 不存在）→ 先补 token：
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-2
mkdir -p docs/superpowers/plans
printf 'smoke' > docs/superpowers/plans/2026-08-06-smoke.md
node skills/specpowers/scripts/workflow-guard.mjs exit phase2 --name 2026-08-06-smoke --apply
# 预期: GUARD: pass ... NOTE: state.json 缺失，--apply 跳过状态更新

# 8) phase3 git 检查：临时空提交验证
rm -f .superpowers/state.json .superpowers/.phase1-skipped
printf 'name=2026-08-06-smoke\nround=1\n' > .superpowers/.gate-passed-3
node skills/specpowers/scripts/workflow-guard.mjs exit phase3 --name 2026-08-06-smoke
# 预期: GUARD: fail（git log 无含 2026-08-06-smoke 的 commit）
git commit --allow-empty -m "feat: smoke 2026-08-06-smoke temp" --quiet
node skills/specpowers/scripts/workflow-guard.mjs exit phase3 --name 2026-08-06-smoke
# 预期: GUARD: pass
git reset --soft HEAD~1 --quiet

# 9) phase4 skip 路径：phase1-skipped + 末位 commit 含 name（确定性：先提交临时 commit）
printf '2026-08-06-smoke' > .superpowers/.phase1-skipped
git commit --allow-empty -m "temp 2026-08-06-smoke" --quiet
node skills/specpowers/scripts/workflow-guard.mjs exit phase4 --name 2026-08-06-smoke
# 预期: GUARD: pass（phase1-skipped 内容==name 且 git log -1 含 name——临时 commit 已保证）
git reset --soft HEAD~1 --quiet

# 10) phase4 正常路径：archive 目录 + 归档 commit
rm -f .superpowers/.phase1-skipped
mkdir -p openspec/changes/archive/2026-08-06-smoke
git commit --allow-empty -m "chore: archive 2026-08-06-smoke" --quiet
node skills/specpowers/scripts/workflow-guard.mjs exit phase4 --name 2026-08-06-smoke
# 预期: GUARD: pass
git reset --soft HEAD~1 --quiet
rm -rf openspec/changes/archive/2026-08-06-smoke

# 清理
rm -f .superpowers/state.json .superpowers/.gate-passed-0 .superpowers/.gate-passed-1 .superpowers/.gate-passed-2 .superpowers/.gate-passed-3 .superpowers/.phase1-skipped
rm -f docs/superpowers/clarifications/2026-08-06-smoke.md docs/superpowers/specs/2026-08-06-smoke-design.md docs/superpowers/plans/2026-08-06-smoke.md
```

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers/scripts/workflow-guard.mjs
git commit -m "feat(specpowers): 新增节点出口守卫 workflow-guard.mjs（5 phase 检查矩阵 + git 双路径 + CAS）"
```

---

### Task 4: hook-validate-token.mjs + hooks-reference.yaml（可选 hooks）

**Files:**
- Create: `skills/specpowers/scripts/hook-validate-token.mjs`
- Create: `skills/specpowers/scripts/hooks-reference.yaml`

**Interfaces:**
- Produces: 最小可运行 hook（PreToolUse Write，写 `.gate-passed-*` 时校验 name 绑定）；yaml 模板（默认不注册，用户复制到 `.claude/settings.json` 启用）。Task 6 不引用 hooks（hooks 默认 off，仅作为 bundled 模板存在）。

- [ ] **Step 1: 写 hook-validate-token.mjs**

创建 `skills/specpowers/scripts/hook-validate-token.mjs`：

```javascript
#!/usr/bin/env node
// specpowers token 校验 hook（PreToolUse，仅写 .superpowers/.gate-passed-* 时触发）
// state.json 缺失（微小模式）→ fail-open + 警告（与设计文档决策 3 微小仍写 .gate-passed-3 一致）
// state.json 存在 → 校验 name 绑定（token 内容必须含 name=<state.name>）
// stdout JSON: {"decision": "approve"|"block", "reason": "..."}
import { existsSync, readFileSync } from 'node:fs';

let input = '';
process.stdin.on('data', (d) => (input += d));
process.stdin.on('end', () => {
  try {
    const event = JSON.parse(input);
    const toolInput = event.tool_input || {};
    const filePath = event.file_path || toolInput.file_path || '';
    if (!String(filePath).includes('.superpowers/.gate-passed-')) {
      console.log(JSON.stringify({ decision: 'approve', reason: '非 gate token 写入' }));
      process.exit(0);
    }
    if (!existsSync('.superpowers/state.json')) {
      console.log(JSON.stringify({ decision: 'approve', warning: 'state.json 缺失（微小模式），跳过 name 校验' }));
      process.exit(0);
    }
    const state = JSON.parse(readFileSync('.superpowers/state.json', 'utf8'));
    const content = String(toolInput.content || '');
    const name = state.name;
    if (name && content && !content.includes(`name=${name}`)) {
      console.log(JSON.stringify({ decision: 'block', reason: `gate token name 不匹配 state.name=${name}` }));
      process.exit(2);
      // 注：decision=block 即阻断契约；退出码 2 仅供脚本诊断，PreToolUse 以 decision 字段为准
    }
    console.log(JSON.stringify({ decision: 'approve' }));
  } catch (e) {
    // fail-open：hook 自身异常不阻断写入
    console.log(JSON.stringify({ decision: 'approve', warning: `hook 异常，fail-open: ${e.message}` }));
    process.exit(0);
  }
});
```

- [ ] **Step 2: 写 hooks-reference.yaml**

创建 `skills/specpowers/scripts/hooks-reference.yaml`：

```yaml
# specpowers 可选 hooks 模板（bundled resource）
# ⚠️ 默认不注册——必须复制到 .claude/settings.json 才生效，不会因技能加载自动生效。
# ⚠️ 本仓库已安装 comet-hook-router（PreToolUse Write|Edit，fail-closed）——
#    启用前先处理互斥（由 router 统一承载或显式停用 router）；一次写入事件最多进入一个 workflow Guard。
hooks:
  PreToolUse:
    - matcher: 'Write'
      hooks:
        - type: command
          command: 'node skills/specpowers/scripts/hook-validate-token.mjs'
          comment: 'specpowers: 写 .superpowers/.gate-passed-* token 时校验 name 绑定（matcher 限定 Write：Edit 修改已有 token 时 PreToolUse 无法拿完整新内容，故不校验 Edit 路径；state.json 缺失时 fail-open，微小模式不阻断）'
  # 跨 Phase 写入边界检查 hook（较重，每次 Write 触发）——可选扩展，启用前需先实现：
  # PreToolUse:
  #   - matcher: 'Write|Edit'
  #     hooks:
  #       - type: command
  #         command: 'node skills/specpowers/scripts/hook-check-phase-boundary.mjs'
  #         comment: 'specpowers: 检查普通项目文件写入是否越过当前 Phase 边界（未实现）'
```

- [ ] **Step 3: 冒烟测试（pass/block/fail-open）**

```bash
cd D:/workspace/specpowers
# 1) 非 token 路径 → pass
echo '{"tool_input": {"file_path": "src/main.js", "content": "x"}}' | node skills/specpowers/scripts/hook-validate-token.mjs
# 预期: {"decision":"approve","reason":"非 gate token 写入"}

# 2) state.json 缺失（微小模式）→ fail-open + 警告
echo '{"tool_input": {"file_path": ".superpowers/.gate-passed-3", "content": "name=smoke"}}' | node skills/specpowers/scripts/hook-validate-token.mjs
# 预期: {"decision":"approve","warning":"state.json 缺失（微小模式），跳过 name 校验"}

# 3) state.json 存在且 name 匹配 → pass
node skills/specpowers/scripts/workflow-state.mjs init --name 2026-08-06-smoke --mode medium > /dev/null
echo '{"tool_input": {"file_path": ".superpowers/.gate-passed-3", "content": "name=2026-08-06-smoke\nround=1\n"}}' | node skills/specpowers/scripts/hook-validate-token.mjs
# 预期: {"decision":"approve"}

# 4) name 不匹配 → block
echo '{"tool_input": {"file_path": ".superpowers/.gate-passed-3", "content": "name=OTHER\n"}}' | node skills/specpowers/scripts/hook-validate-token.mjs
# 预期: {"decision":"block","reason":"gate token name 不匹配 state.name=2026-08-06-smoke"}

# 5) 损坏输入 → fail-open
echo 'not-json' | node skills/specpowers/scripts/hook-validate-token.mjs
# 预期: {"decision":"approve","warning":"hook 异常，fail-open: ..."}

rm -f .superpowers/state.json
```

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers/scripts/hook-validate-token.mjs skills/specpowers/scripts/hooks-reference.yaml
git commit -m "feat(specpowers): 新增 token 校验 hook + 可选 hooks 模板（默认 off，含 router 互斥声明）"
```

---

### Task 5: decision-points.md（停顿点定义正本）

**Files:**
- Create: `skills/specpowers/refs/decision-points.md`

**Interfaces:**
- Consumes: kernel bundle 的 `decision-points.md`（改编来源）
- Produces: PP-01..PP-08 定义正本（protocol.json pausePoints 字段引用本文件；next 的 manual 判定依赖其分配）—— Task 6（入口 SKILL.md 决策分类表引用）依赖。

- [ ] **Step 1: 写文件**

创建 `skills/specpowers/refs/decision-points.md`（改编自 kernel 版：节点名对齐 phase 命名、evidence 路径改为 `.superpowers/state.json`、保留全部 8 个停顿点定义与不可绕过约束、压缩分类表为引用）：

```markdown
# specpowers 用户停顿点与决策分类（PP-01..PP-08 定义正本）

本文件定义 specpowers 全流程（Phase 0-4）中必须由用户决策的位置（PP-01..PP-08），以及自动处理、停止条件的边界。**分类原则**（自动处理/停止条件/手动衔接的判定逻辑）见入口 SKILL.md「决策分类表」节——本文件不重复定义分类原则，只列停顿点与 protocol.json 的 pausePoints 分配依据。

## 停顿点 × Phase 映射（protocol.json pausePoints 字段分配依据）

| Phase | 节点 skill | pausePoints |
|-------|-----------|-------------|
| phase0（需求澄清与设计） | specpowers-design | PP-01, PP-02 |
| phase1（OpenSpec 格式转换） | specpowers-design | PP-03, PP-04 |
| phase2（衔接计划） | specpowers-plan | PP-05 |
| phase3（子代理 TDD 实现） | specpowers-apply | PP-06, PP-07, PP-08 |
| phase4（验证与归档） | specpowers-archive | （无——硬 Gate 链失败是停止条件，非决策点） |

## 用户停顿点定义

### PP-01（phase0）：方案选择

- **触发条件**：需求澄清完毕后，呈现 2-3 个替代方案（每个含思路/优势/劣势/适用场景）与推荐方案之后。
- **用户可选择项**：①采用推荐方案 ②选择其他方案 ③提出调整（合并方案要素/缩小范围 → 回 Step 0.2/0.3 补充澄清后重新探讨）。
- **证据写入位置**：`docs/superpowers/clarifications/<name>.md`（方案选择结论与理由）+ `.superpowers/state.json` evidence（`{"phase0": {"PP-01": {"decision": "selected", "option": "<方案名>"}}}`）。
- **不可绕过**：推荐不能代替用户选择；未记录所选方案不得进入设计呈现。

### PP-02（phase0）：设计逐段审批 + design.md 整体审批（硬 Gate）

- **触发条件**（两个实例，同一决策类型）：①每个设计段落呈现后（架构/数据流/接口/错误处理/测试策略）等待审批；②design.md 写入并自审完成后（Step 0.6 整体审批硬 Gate）。
- **用户可选择项**：①通过 → 下一段/整体 → Gate 0 审查；②修改（提出意见）→ 回 Step 0.5 修订 → 重新自审 → 再次 Step 0.6 审批。
- **证据写入位置**：`.superpowers/state.json` evidence（`{"phase0": {"PP-02": {"decision": "approved"}}}`）；整体通过 + Gate 0 后由 review 写 `.superpowers/.gate-passed-0`（`name=<name>`）。
- **不可绕过**：Step 0.6 硬 Gate 不可跳过，未审批不得进入 Phase 1；逐段审批不可合并成一次整体汇报。

### PP-03（phase1）：OpenSpec 跳过（用户主动要求）

- **触发条件**：用户在 Phase 1 主动要求跳过 OpenSpec 转换（或要求不生成 openspec/changes/ 产物）。注意：openspec CLI 不可用属自动 fallback（入口决策分类表），不触发本停顿点。
- **用户可选择项**：①确认跳过 → 输出 `[OPENSPEC_SKIPPED]` + 写 `.superpowers/.phase1-skipped`（内容 `<name>`）→ 进入 phase2（简化输入，Gate 1 豁免）；②继续转换 → 执行 Phase 1 格式转换 → 对照验证 → Gate 1 审查。
- **证据写入位置**：`.superpowers/.phase1-skipped`（内容 `<name>`）+ state.json evidence（`{"phase1": {"PP-03": {"decision": "skip"}}}`）。
- **不可绕过**：跳过一旦确认即影响 openspec-change.v1 校验（skip 豁免），必须持久化标记，不得仅在会话内口头跳过。

### PP-04（phase1）：MISSING/DRIFT 确认 + 人工审核

- **触发条件**：强制对照验证输出 [DRIFT] 项（偏离需用户确认），或 [MISSING] 项修复方案超出机械补充范围；Step 1.3 人工审核发现问题（对照表未全 COVERED / 设计不一致 / 需求遗漏）。
- **用户可选择项**：①确认修复方案 → 修复后重新对照直到全部 COVERED → Gate 1 审查；②修正 Phase 0 design（根因在 design.md）→ 回 phase0 修订 → 重新转换；③放弃转换、要求跳过 OpenSpec（仅当用户提出）→ 同 PP-03 选项 ①。
- **证据写入位置**：对照表输出 + state.json evidence（`{"phase1": {"PP-04": {"decision": "confirmed", "items": "<对照项>"}}}`）；Gate 1 通过后写 `.gate-passed-1`（或 `.phase1-skipped` 豁免）。
- **不可绕过**：DRIFT 未确认不得修复；对照表未全部 COVERED 不得进入 Gate 1。

### PP-05（phase2）：plan 已存在——重新生成 vs 使用现有

- **触发条件**：`docs/superpowers/plans/<name>.md` 已存在（防御 Phase 自动检测行序错误的纵深保护，技能明示必须询问）。
- **用户可选择项**：①跳过（使用现有 plan，默认，避免覆盖）；②重新生成（重跑 writing-plans 覆盖）。
- **证据写入位置**：state.json evidence（`{"phase2": {"PP-05": {"decision": "skip"}}}`）。
- **不可绕过**：无论默认值如何，必须询问后决定；不得静默覆盖或静默跳过。

### PP-06（phase3）：隔离工作区同意（主分支执行）

- **触发条件**：没有可用的 git worktree / 隔离工作区，且任务将直接在 main/master 分支执行（subagent-driven-development 要求：未经用户明确同意不得在主分支开始实现）。
- **用户可选择项**：①创建/使用 git worktree（推荐）；②明确同意在主分支执行。
- **证据写入位置**：state.json evidence（`{"phase3": {"PP-06": {"decision": "worktree"}}}`）。
- **不可绕过**：未记录同意不得启动第一个实现子代理。

### PP-07（phase3）：计划冲突裁决（plan 文本 vs 审查发现）

- **触发条件**：任务预扫描（dispatch 前 batched 问题）或任务审查/修复循环发现 finding 与 plan 文本冲突（which governs）。
- **用户可选择项**：①plan 文本优先 → 按 plan 执行（finding 标注 plan-mandated）；②finding 优先 → 修订 plan 并修复；③保持现状并记录 ruling → 该 finding 记入 ledger 不再进入修复循环。
- **证据写入位置**：SDD ledger（`.superpowers/sdd/<plan>/progress.md`）+ state.json evidence（`{"phase3": {"PP-07": {"decision": "plan-first"}}}`）。
- **不可绕过**：禁止自行丢弃 plan 冲突型 finding；每个裁决必须有 ledger 记录。

### PP-08（phase3）：Gate 3 合并判断表逐条审批 + P0 修复方案确认

- **触发条件**：Gate 3 审查（code-review + 对齐检查）返回后，合并判断表呈现（逐条裁决），且存在 P0 修复方案需确认。
- **用户可选择项**：①逐条行裁决（修复默认全量 P0-P3 / 接受记录理由 / 驳回记录 ruling）；②P0 修复方案确认（执行方案 → 派发修复子 Agent；调整方案 → 用户修改后派发）。
- **证据写入位置**：审查报告 + state.json evidence（`{"phase3": {"PP-08": {"decisions": "<逐行>", "p0PlanConfirmed": true}}}`）；Gate 3 通过后写 `.superpowers/.gate-passed-3` + 会话 `[GATE_PASSED] gate=3`。
- **不可绕过**：合并判断表不得由主 Agent 代批；P0 修复方案未经确认不得派发。

## 自动处理与停止条件摘要

- **自动处理（直接推进，不询问）**：上下文探索、澄清问答、自审修复、格式转换、MISSING 机械补充、Gate 前置检查失败回退、Gate 0-3 审查收敛（默认继续制，通知而非询问）、执行模式路由、子代理任务循环、任务修复循环 R≤5、breaker 裁决（非 load-bearing）、Phase 4 硬 Gate 链推进、finishing。
- **停止条件（只报告恢复条件，不发明选项）**：implementer BLOCKED（load-bearing）、R=5 后 load-bearing finding、全量测试失败（恢复=回 Phase 3 systematic-debugging）、validate 失败（恢复=回 Phase 1 或 Phase 3）、/opsx:archive 失败（恢复=根因修复后从 archive 重试）、归档完整性 FAIL（人工介入）、state.json 缺失/损坏（恢复=init --force --resume-artifacts 重建）。

```

- [ ] **Step 2: 结构验证（grep 锚点）**

```bash
cd D:/workspace/specpowers
grep -c "^### PP-0" skills/specpowers/refs/decision-points.md   # 预期: 8（PP-01..PP-08 全部定义）
grep -c "PP-01\|PP-08" skills/specpowers/refs/decision-points.md  # 预期: ≥2（映射表引用）
grep -n "phase0.*PP-01\|PP-01.*phase0" skills/specpowers/refs/decision-points.md  # 映射表行存在
```

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers/refs/decision-points.md
git commit -m "feat(specpowers): 新增 decision-points.md（PP-01..PP-08 停顿点定义正本，phase 映射对齐）"
```

---

### Task 6: 入口 SKILL.md 改造（Decision Core + 启动协议）

**Files:**
- Modify: `skills/specpowers/SKILL.md`（启动协议节替换 + Phase 自动检测降级标注 + 环境准备 +Node.js + Pre-Flight + 参考资源）

**Interfaces:**
- Consumes: Task 2（workflow-state.mjs 命令契约）、Task 5（decision-points.md 引用）
- Produces: 新启动协议（Step 0/1/2 + 决策分类表 + Red Flags）—— 子技能 guard 调用（Task 7-11）以此为权威；验证链协议（Task 11 衔接注释）引用。

**改动点 1 — 替换「启动协议」节**（现有 L46-55 checkbox 块 + L57-66 子 Agent 启动方式，替换为下列完整新节；子 Agent 启动方式子节内容保持不变、位置移到节尾）：

````markdown
## 启动协议

### Step 0：语义化意图检测（每次启动/恢复/压缩后执行）

1. **判定当前 Phase**：运行 `node skills/specpowers/scripts/workflow-state.mjs status`。
   - 未初始化 → 进入 Step 1（首次启动）；但存在 name-keyed 产物/token（如 docs/superpowers/ 下 name 目录、`.superpowers/.gate-passed-*`）→ 提示 `init --resume-artifacts`（不按全新任务处理）；**微小任务忽略此提示**（微小不 init state.json，缺失属预期，见设计文档决策 3）
   - 已初始化 → 读 currentPhase + completedPhases + 持久化阻塞原因（对应脚本契约 status 输出的 BLOCKED_REASON 字段）
   - 脚本失败/缺失 → 回退到「Phase 自动检测（回退路径）」表，扫产物文件推断
2. **意图对齐**：从用户消息判定意图落点。意图超前 → 核对前序 Gate 文件，未过回前序 Phase；意图回退 → `reset <phase>` 回退。
3. **文件证据最终裁决**：状态机先行判定，state.json 只是索引。最终裁判是 gate 文件（token）——`.superpowers/.gate-passed-<N>`（`name=` 行与当前 `<name>` 完全匹配才算数）；产物文件仅对回退路径与 phase4 有意义。

### Step 1：首次启动决策（只决策不 init）

1. 决策树判定模式（微小/中等/复杂/大规模）
2. `Plan: <mode>` 写入会话上下文。**首次启动只决策不 init**——init 延迟到 Phase 0 产出 name 后（Phase 0 Step 0.3 之后）执行：`node skills/specpowers/scripts/workflow-state.mjs init --name <name> --mode <mode>` 初始化 state.json
3. 微小任务特判：豁免规则见设计文档决策 3（不创建 state.json，不走状态机，直接子代理执行）。微小任务跨会话恢复仍按原版产物 + 会话上下文推断，不走状态机（state.json 不存在属预期）
4. 迁移分支：若产物已存在（如 clarifications/design.md）→ 提示 `init --resume-artifacts --mode <mode>` + `set-name <name>`（name 从产物目录推断或用户提供）（kernel 用户迁移：kernel state.json 不被原版读取——运行 init --resume-artifacts 重建；`.superpowers/.gate-passed-*` 通用，Gate 进度不丢失；已完成归档的 kernel 用户跳过 Phase 4 直接收尾，不重跑 /opsx:archive）
5. 微小→中等升级分支：微小任务中途升为中等（如变更范围扩大触发运行时升级）→ 补 Phase 0 流程（产生 name 与 design.md）后执行 `init --name <name> --mode medium`（**用 init 而非 --resume-artifacts**，以便 currentPhase=phase0 从头走 Gate 0/1/2 审查）；微小已写的 `.gate-passed-3` 保留——升级后 phase3 由既有 token 自动跳过，phase1/2 需追溯补做

### Step 2：推进纪律

- 节点流转：每完成一个 Phase，`node skills/specpowers/scripts/workflow-state.mjs next` 返回 `NEXT: <auto|blocked|manual|done>` + `SKILL: <Skill 工具全名，带 provider 前缀>` + `PHASE: <id>` + `REASON: <文本>`（auto 时 SKILL=下阶段技能；manual 时 SKILL 保持当前待用户决策；blocked 时 SKILL=回退 phase 对应技能；done 时无 SKILL）
- 出口守卫：每个子技能 Gate 完成后调 `node skills/specpowers/scripts/workflow-guard.mjs exit <phase> --apply`
- 决策停顿点：见 `refs/decision-points.md`（PP-01..PP-08），必须停顿等用户
- 恢复规则（移植 kernel Decision Core 的恢复类规则）：恢复时复用已持久化选择（方案选择/跳过决定/worktree 同意/逐条裁决），只呈现未决部分；已持久化选择存于 state.json evidence 字段（跨设备恢复依赖该文件）；换话题先确认继续还是新任务，不得混用 name

### 决策分类表

| 分类 | 情况 | 处理 |
|------|------|------|
| 自动处理 | NEXT: auto（当前应执行 phase 已确定——init 后 phase0 若 PP 未决会先输出 manual，PP 已决或后续 phase 无待决停顿点时输出 auto） | 直接进入该 phase 对应技能 |
| 自动处理 | Gate 0-3 审查收敛判定 | 默认继续制：通知继续，非询问 |
| 自动处理 | guard 失败（GUARD: fail，token 已写产物缺失） | 停留当前 phase 补产物 |
| 自动处理 | next 输出 blocked（completedPhases 有记录但 token 缺失/name 不匹配） | 回到第一个缺有效 token 的 phase |
| 自动处理 | openspec CLI 不可用 | 自动走跳过路径 |
| 停止条件 | Phase 4 硬 Gate 链失败 | 报告失败步骤与恢复路径 |
| 停止条件 | implementer BLOCKED / 状态损坏 | 报告恢复条件 |
| 手动衔接 | NEXT: manual（下一步需用户决策 PP-01..PP-08 时输出 manual + SKILL 保持当前） | 交还控制权 |
| 用户决策 | PP-01..PP-08 | 停顿等用户 |
| 流程结束 | NEXT: done（所有 Phase 完成，archive 证据已记录） | 收尾：Post-Task Checklist + finishing |

本表为决策分类正本；`refs/decision-points.md` 引用本表（不重复定义分类原则，只列停顿点）。

### Red Flags

| Agent 想法 | 实际风险 |
|---|---|
| `.gate-passed-N` 文件存在，所以 Gate 通过了 | name 不匹配 = 未通过 |
| 用户提了需求，澄清算完成了 | 未经审批 = 未完成 |
| 产物文件都在，这个 Phase 算完成 | 无 gate token = 未通过 |
| state.json completedPhases 有它，直接走下一步 | state 可能过期；gate 文件缺失按未完成 |
| 状态机脚本失败，流程卡死 | 回退到 Phase 自动检测表 |
| 收敛判定问用户是否继续 | 默认继续制：通知不是询问 |
| 换话题继续记到当前 name 下 | 污染 Gate 链：先确认继续还是新任务 |
| 全量测试没过，手动 mv change 到 archive | 硬 Gate 链不可降级 |
| task 简单，内联做掉 | Phase 3 必须每 task 独立子代理 |

### 子 Agent 启动方式（全局硬约束）

**必须使用后台子 agent，禁止 teammate 方式。**

```
✅ Agent({run_in_background: true, prompt: "..."})  // 不指定 name，通过 task-notification 获取结果
❌ Agent({name: "xxx", ...}) + SendMessage           // mailbox 不可靠，agent 可能不返回报告
```

适用于所有子技能的子 Agent 启动。
````

> **实施说明**：替换时把现有「启动协议」checkbox 块与「子 Agent 启动方式」子节整体替换为上述内容；原 checkbox 中「审查级别/子代理上下文/阶段校验/并发检查」信息已被 Step 0-2 + 决策分类表覆盖（审查级别由 specpowers-review 动态确定、阶段校验由状态机推进 + 阶段校验提问覆盖、并发检查为多 Agent 写入约束保留在子技能硬约束中），不丢失。原「持久化计划（Plan: <mode>）」语义保留在 Step 1 动作 2。

**改动点 2 — Phase 自动检测降级标注**（在「### Phase 自动检测（跨会话恢复）」节标题与表格之间插入）：

```markdown
> **本节为回退路径**：当 `node skills/specpowers/scripts/workflow-state.mjs status` 失败、脚本缺失或 state.json 损坏时使用。正常运行时由 Step 0 的状态机判定主导。两套机制判定的依据相同（产物文件 + Gate token），结论应一致——不一致时以文件证据为准（状态机先行判定，文件证据最终裁决）。
```

**改动点 3 — 环境准备表 + Node.js 行**（在「## 环境准备」表格末尾追加一行）：

```markdown
| **Node.js** | 状态机脚本 | `node --version`（≥18） | ✅（脚本依赖；缺失时回退到 Phase 自动检测，状态机功能不可用） |
```

**改动点 4 — Pre-Flight Check +检查项**（在「## Pre-Flight Check」代码块内追加一项）：

```markdown
□ node --version: 状态机脚本依赖（≥18）。缺失时状态机不可用，回退到 Phase 自动检测表（状态机功能降级但不阻塞流程）
```

**改动点 5 — 参考资源表 +2 条目**（在「## 参考资源」表格末尾追加两行）：

```markdown
| 协议正本 | `refs/workflow-protocol.json` |
| 停顿点正本 | `refs/decision-points.md` |
```

- [ ] **Step 1: 应用改动点 1（替换启动协议节）**
- [ ] **Step 2: 应用改动点 2（降级标注）**
- [ ] **Step 3: 应用改动点 3-5（Node.js + Pre-Flight + 参考资源）**
- [ ] **Step 4: 结构验证（grep 锚点 + 无残留 + 无重复）**

```bash
cd D:/workspace/specpowers
# 1) 新节锚点全部存在
grep -c "### Step 0：语义化意图检测" skills/specpowers/SKILL.md   # 预期: 1
grep -c "### 决策分类表" skills/specpowers/SKILL.md               # 预期: 1
grep -c "### Red Flags" skills/specpowers/SKILL.md                # 预期: 1
grep -c "本节为回退路径" skills/specpowers/SKILL.md               # 预期: 1
grep -c "Node.js" skills/specpowers/SKILL.md                      # 预期: ≥1（环境准备表；Pre-Flight 行为 node --version 不含该字样）
grep -c "workflow-protocol.json" skills/specpowers/SKILL.md       # 预期: ≥1（参考资源）
grep -c "decision-points.md" skills/specpowers/SKILL.md           # 预期: ≥2（Step 2 + 参考资源）
# 2) 旧启动协议 checkbox 已移除（残留 = 替换不完整）
grep -c "□ 流程设计" skills/specpowers/SKILL.md || true                   # 预期: 0（grep 无匹配时退出码 1，|| true 防 && 链中断）
# 3) 子 Agent 启动方式保留
grep -c "子 Agent 启动方式（全局硬约束）" skills/specpowers/SKILL.md  # 预期: 1
# 4) 脚本调用路径统一
grep -c "node skills/specpowers/scripts/workflow-state.mjs" skills/specpowers/SKILL.md  # 预期: ≥3（Step 0/1/2）
```

- [ ] **Step 5: Commit**

```bash
git add skills/specpowers/SKILL.md
git commit -m "feat(specpowers): 入口融合 Decision Core（Step 0-2 状态机协议 + 决策分类表 + Red Flags + 降级标注）"
```

---

### Task 7: specpowers-design guard 调用（init + guard×2）

**Files:**
- Modify: `skills/specpowers-design/SKILL.md`（Step 0.3 后 init 调用 + Gate 0/1 出口 guard 调用）

**Interfaces:**
- Consumes: Task 2（init 命令）、Task 3（guard 命令契约）
- Produces: Phase 0/1 的 guard 调用点（token 先写、guard 后调；子技能为唯一 guard 调用责任方）—— protocol phase0/phase1 的推进依赖。

**改动点 1 — Step 0.3 末尾插入 init 调用**（在「**动作2 — 外化（写文件）**:」代码块之后追加；name 实参来自动作 2 定义的 `<name>`，mode 实参来自会话上下文 `Plan: <mode>`）：

```markdown
**动作3 — 初始化状态机（中等+，微小跳过）**:
非微小任务执行（name/mode 实参：动作 2 的 `<name>` + 会话上下文 `Plan: <mode>`）：
node skills/specpowers/scripts/workflow-state.mjs init --name <name> --mode <mode>
```

**改动点 2 — Gate 0 出口 guard 调用**（在「Gate 0 返回后，执行 Gate 返回后验证协议（参数: Gate=0, Phase=0）。」之后追加）：

```markdown
验证链通过后（token 已由 review 写入 `.superpowers/.gate-passed-0`），执行节点出口守卫（中等+；微小无 state.json，不调用）：
node skills/specpowers/scripts/workflow-guard.mjs exit phase0 --apply
```

**改动点 3 — Gate 1 出口 guard 调用**（在「Gate 1 返回后，执行 Gate 返回后验证协议（参数: Gate=1, Phase=1）。」之后追加）：

```markdown
验证链通过后（token 已写入 `.superpowers/.gate-passed-1`，或 `.superpowers/.phase1-skipped` 内容==name 豁免），执行节点出口守卫（中等+）：
node skills/specpowers/scripts/workflow-guard.mjs exit phase1 --apply
```

- [ ] **Step 1: 应用改动点 1-3**
- [ ] **Step 2: 结构验证**

```bash
grep -c "workflow-state.mjs init" skills/specpowers-design/SKILL.md    # 预期: 1
grep -c "workflow-guard.mjs exit phase0" skills/specpowers-design/SKILL.md  # 预期: 1
grep -c "workflow-guard.mjs exit phase1" skills/specpowers-design/SKILL.md  # 预期: 1
# token 先写 guard 后调语义：guard 行必须在验证协议行之后
grep -n "验证链通过后\|Gate 返回后，执行 Gate 返回后验证协议" skills/specpowers-design/SKILL.md
# 预期: 每个 "Gate N 返回后..." 行号 < 对应 "验证链通过后" 行号
```

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers-design/SKILL.md
git commit -m "feat(specpowers-design): 插入 init + guard×2 调用（Step 0.3 后 + Gate 0/1 出口）"
```

---

### Task 8: specpowers-plan guard 调用

**Files:**
- Modify: `skills/specpowers-plan/SKILL.md`

**Interfaces:**
- Consumes: Task 3（guard 命令契约）
- Produces: Phase 2 的 guard 调用点。

**改动点 — Gate 2 出口 guard 调用**（在「Gate 2 返回后，执行 Gate 返回后验证协议（参数: Gate=2, Phase=2）。」之后追加）：

```markdown
验证链通过后（token 已写入 `.superpowers/.gate-passed-2`），执行节点出口守卫（中等+）：
node skills/specpowers/scripts/workflow-guard.mjs exit phase2 --apply
```

- [ ] **Step 1: 应用改动点**
- [ ] **Step 2: 结构验证**

```bash
grep -c "workflow-guard.mjs exit phase2" skills/specpowers-plan/SKILL.md  # 预期: 1
```

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers-plan/SKILL.md
git commit -m "feat(specpowers-plan): Gate 2 出口 guard 调用"
```

---

### Task 9: specpowers-apply guard 调用

**Files:**
- Modify: `skills/specpowers-apply/SKILL.md`

**Interfaces:**
- Consumes: Task 3（guard 命令契约）
- Produces: Phase 3 的 guard 调用点。

**改动点 — Gate 3 验证后 guard 调用**（在「**Gate 3 返回后，执行以下验证（不可跳过）**:」块中"本 Gate 特化"blockquote 之后、"设计说明"blockquote 之前追加——apply SKILL.md 实际结构：L92 验证协议引用 + L94 设计说明两行 blockquote）：

```markdown
**验证链通过后（中等+），执行节点出口守卫**（token 已由 review 写入 `.superpowers/.gate-passed-3`；微小模式无 state.json，不调 guard）：
node skills/specpowers/scripts/workflow-guard.mjs exit phase3 --apply
```

- [ ] **Step 1: 应用改动点**
- [ ] **Step 2: 结构验证**

```bash
grep -c "workflow-guard.mjs exit phase3" skills/specpowers-apply/SKILL.md  # 预期: 1
```

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers-apply/SKILL.md
git commit -m "feat(specpowers-apply): Gate 3 出口 guard 调用（仅中等+）"
```

---

### Task 10: specpowers-archive guard 调用

**Files:**
- Modify: `skills/specpowers-archive/SKILL.md`

**Interfaces:**
- Consumes: Task 3（guard phase4 检查矩阵：正常路径 = archive 目录 + 归档 commit；skip 路径 = phase1-skipped + 末位 commit 含 name）
- Produces: Phase 4 的 guard 调用点（Step 4 全 PASS 后）。

**改动点 — Step 4 全 PASS 后 guard 调用**（在「全部 PASS → 进入 Step 5。任一 FAIL → Phase 4 终止，人工介入。」之后追加）：

```markdown
全部 PASS 后，执行节点出口守卫（中等+；微小模式无 state.json，跳过本技能不调用）：
node skills/specpowers/scripts/workflow-guard.mjs exit phase4 --apply
```

> **注**：guard 是 Step 4 检查的子集（覆盖检查 1 归档目录迁移 + 检查 4 归档 commit；检查 2/3 由本技能自身完成）。

- [ ] **Step 1: 应用改动点**
- [ ] **Step 2: 结构验证**

```bash
grep -c "workflow-guard.mjs exit phase4" skills/specpowers-archive/SKILL.md  # 预期: 1
```

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers-archive/SKILL.md
git commit -m "feat(specpowers-archive): Step 4 全 PASS 后 guard phase4 调用"
```

---

### Task 11: specpowers-review 衔接注释

**Files:**
- Modify: `skills/specpowers-review/SKILL.md`

**Interfaces:**
- Consumes: 设计文档「Gate Token 输出」节的 token 先写/guard 后调顺序
- Produces: guard 调用责任方声明（子技能 Gate 出口为唯一责任方；独立调用 review 不触发 guard）。

**改动点 — Gate Token 输出节追加衔接注释**（在「Gate Token 输出」节中「**第 2 层：文件标记（后备轨）**」小节末尾、独立调用场景自检节之前追加）：

```markdown
> **衔接注释（guard 调用）**: token 写入与 guard 调用顺序为 **token 先写、guard 后调**——review 写 `.superpowers/.gate-passed-<N>` 后，由父技能（design/plan/apply/archive）在验证链通过后调 `node skills/specpowers/scripts/workflow-guard.mjs exit phase<N> --apply`（子技能 Gate 出口为唯一 guard 调用责任方）。独立调用 review（gate_id=standalone）不触发 guard。
```

- [ ] **Step 1: 应用改动点**
- [ ] **Step 2: 结构验证**

```bash
grep -c "guard 调用" skills/specpowers-review/SKILL.md  # 预期: ≥1
```

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers-review/SKILL.md
git commit -m "feat(specpowers-review): Gate Token 输出节衔接注释（token 先写 guard 后调）"
```

---

### Task 12: 删除 kernel + CLAUDE.md 同步 + 回归检查点

**Files:**
- Delete: `.claude/skills/specpowers-kernel/`、`.claude/skills/specpowers-kernel-open/`、`.claude/skills/specpowers-kernel-design/`、`.claude/skills/specpowers-kernel-plan/`、`.claude/skills/specpowers-kernel-execute/`、`.claude/skills/specpowers-kernel-archive/`（6 目录）
- Delete: `.comet/skills/specpowers-apply/`、`.comet/skills/specpowers-archive/`、`.comet/skills/specpowers-design/`、`.comet/skills/specpowers-plan/`（4 目录）
- Modify: `CLAUDE.md`（技能组架构 + 目录结构 + 关键设计决策同步）

**Interfaces:**
- Consumes: 设计文档「删除与迁移」节（保留 `.comet/bundle-drafts/specpowers-kernel/` 等创作记录备查）
- Produces: 单入口技能组（消除双层入口嵌套）+ CLAUDE.md 同步。

**改动点 1 — 删除 10 个目录**：

```bash
cd D:/workspace/specpowers
# kernel 6 skill
rm -rf .claude/skills/specpowers-kernel .claude/skills/specpowers-kernel-open .claude/skills/specpowers-kernel-design .claude/skills/specpowers-kernel-plan .claude/skills/specpowers-kernel-execute .claude/skills/specpowers-kernel-archive
# .comet/skills 4 旧副本
rm -rf .comet/skills/specpowers-apply .comet/skills/specpowers-archive .comet/skills/specpowers-design .comet/skills/specpowers-plan
# 验证删除
ls .claude/skills/ | grep specpowers-kernel   # 预期: 无输出
ls .comet/skills/ 2>/dev/null | grep -v "^specpowers-" || echo "（无 specpowers-* 子目录残留）"
```

**改动点 2 — CLAUDE.md 同步**（三处编辑）：

编辑 A — 技能组架构 ASCII 图入口行：
```diff
- specpowers (入口, 决策模式+路由)
+ specpowers (入口, 决策模式+路由+状态机)
```

编辑 B — 目录结构表三行：
```diff
- | `skills/specpowers/SKILL.md` | 入口技能 — 决策树、路由表、全局规则（GitFlow/Checklist/Pitfalls） |
+ | `skills/specpowers/SKILL.md` | 入口技能 — 决策树、路由表、全局规则（GitFlow/Checklist/Pitfalls）+ Decision Core（状态机 Step 0-2/决策分类表/Red Flags） |
+ | `skills/specpowers/scripts/` | 轻量状态机脚本（workflow-state/guard/hook-validate-token，零依赖）+ hooks 模板（默认不注册） |
- | `skills/specpowers/refs/` | 入口技能 bundled resources（入门指南、项目模板、UltraPlan 提示词等） |
+ | `skills/specpowers/refs/` | 入口技能 bundled resources（入门指南、项目模板、UltraPlan 提示词、workflow-protocol.json、decision-points.md 等） |
```

编辑 C — 关键设计决策追加第 8 条：
```markdown
8. **状态机主导 + hooks 默认 off**: 入口启动协议融合 Decision Core——`node skills/specpowers/scripts/workflow-state.mjs status` 状态机先行判定 Phase，`.gate-passed-<N>` 文件（name 绑定）最终裁决，Phase 自动检测降级为回退路径；5 子技能 Gate 出口调 `workflow-guard.mjs exit <phase> --apply`（token 先写、guard 后调，子技能为唯一责任方）；hooks 默认不注册（模板在 scripts/，启用需显式复制到 .claude/settings.json，与 comet-hook-router 互斥）。微小任务豁免（不 init 状态机，保留轻量行为）。
```

**改动点 3 — 残留引用检查**：

```bash
# skills/、.claude/、.comet/ 下不得再引用 kernel（含 settings.json hook 配置、commands、AGENTS.md、comet config）
grep -rn "specpowers-kernel" skills/ .claude/ .comet/ AGENTS.md CLAUDE.md 2>/dev/null || echo "无 kernel 残留引用"
grep -rn "bundle-drafts/specpowers-kernel" skills/ .claude/ .comet/ CLAUDE.md 2>/dev/null || echo "无 bundle 残留引用"
# 注：grep 命中 .comet/bundle-drafts/specpowers-kernel/ 自身目录属预期（保留备查的创作记录，非残留）
```

**改动点 4 — 全链路回归检查点**（设计文档验证策略 L321-322 的集成验证）：

```bash
cd D:/workspace/specpowers
# 1) 入口路由完整性：决策树/子技能分派仍在
grep -c "执行模式选择" skills/specpowers/SKILL.md            # 预期: 1
grep -c "specpowers-design" skills/specpowers/SKILL.md       # 预期: ≥2（路由表 + 快速上手）
# 2) 子技能前置检查（Gate Token 依赖链拦截）仍在
grep -c "gate-passed-2" skills/specpowers-apply/SKILL.md     # 预期: ≥1
grep -c "gate-passed-3" skills/specpowers-archive/SKILL.md   # 预期: ≥1
# 3) 硬 Gate 链不可降级声明仍在
grep -c "不允许降级为手动操作" skills/specpowers-archive/SKILL.md  # 预期: ≥1
# 4) 跨技能引用一致：guard 调用路径在 5 子技能全部出现
for f in design plan apply archive; do echo -n "$f: "; grep -c "workflow-guard.mjs" skills/specpowers-$f/SKILL.md; done
# 预期: design: 2 / plan: 1 / apply: 1 / archive: 1（review 为衔接注释不计数）
# 5) 脚本语法最终确认
node --check skills/specpowers/scripts/workflow-state.mjs && node --check skills/specpowers/scripts/workflow-guard.mjs && node --check skills/specpowers/scripts/hook-validate-token.mjs && echo "3 脚本语法 OK"
# 6) 协议与 decision-points 引用一致
node -e "const p=require('./skills/specpowers/refs/workflow-protocol.json'); const dp=require('fs').readFileSync('skills/specpowers/refs/decision-points.md','utf8'); const all=[...new Set(p.nodes.flatMap(n=>n.pausePoints))]; const missing=all.filter(pp=>!dp.includes(pp)); console.log(missing.length? 'MISSING: '+missing.join(','): 'pausePoints 全部在 decision-points.md 中有定义 ('+all.join(',')+')')"
# 7) 实施后实证：scripts/refs 运行期加载行为（设计文档概述要求）
#    实证方式：下次真实流程运行时观察进入上下文的文件清单；若 scripts/（~300 行）同样进入上下文导致净额为负，
#    将 scripts/ 移出技能目录（如 .claude/scripts/specpowers/），同步更新 5 子技能与入口的调用路径
```

- [ ] **Step 1: 应用改动点 1（删除 10 目录）**
- [ ] **Step 2: 应用改动点 2（CLAUDE.md 三处编辑）**
- [ ] **Step 3: 应用改动点 3（残留引用检查）**
- [ ] **Step 4: 应用改动点 4（回归检查点全绿，含检查点 7 实施后实证）**
- [ ] **Step 5: Commit**

```bash
git add -A .claude/skills .comet/skills CLAUDE.md
git commit -m "feat(specpowers): 删除 kernel 6 skill + .comet/skills 4 旧副本，CLAUDE.md 同步（状态机主导 + hooks 默认 off）"
```

---

## 计划自审（writing-plans Self-Review）

**1. Spec coverage（设计文档 1-5 节 → task 映射）**：
- 设计文档「文件结构」→ Task 1-5（新增 6 文件）+ Task 6-11（修改 6 SKILL.md）+ Task 12（删除 10 目录 + CLAUDE.md）✓
- 设计文档「入口 SKILL.md 改造」（Step 0/1/2 + 决策分类表 + Red Flags + 降级标注 + Node.js + 参考资源）→ Task 6 全部覆盖 ✓
- 设计文档「5 子技能 guard 调用改造」（design init+guard×2 / plan guard / apply guard / archive guard / review 注释）→ Task 7-11 ✓
- 设计文档「脚本命令契约」（state 5 命令 + guard 检查矩阵 + protocol 字段 + 退出码 + cwd 约定）→ Task 1-3 实现完整 ✓
- 设计文档「hooks-reference.yaml」→ Task 4 ✓
- 设计文档「删除与迁移」（删除清单 + 保留备查 + 用户迁移路径）→ Task 12 删除清单 + 用户迁移路径已内建于 Task 2 冒烟用例 12-15（resume 重建/4-token/多候选/显式 --name）+ 入口 Step 1 迁移分支 ✓；微小→中等升级路径见 Task 6 改动点 1 Step 1 动作 5 ✓
- 设计文档「验证策略」（脚本冒烟 11 用例 + 技能回归检查点）→ Task 2 Step 3（18 用例，批 1-5 新增用例 13-18）、Task 3 Step 3（10 用例）、Task 4 Step 3（5 用例）、Task 12 Step 4（7 检查点）✓

**2. Placeholder scan**：所有脚本/JSON/YAML/插入文本均为完整代码（无 TBD/TODO）；hooks-reference.yaml 中的 hook-check-phase-boundary 为设计文档明示的"可选扩展，启用前需先实现"注释，非占位符。✓

**3. Type consistency**：
- 命令契约：`workflow-state.mjs status|next|init|set-name|reset` 与入口 Step 0/1/2 引用一致；`workflow-guard.mjs exit <phase> --apply` 与 5 子技能调用一致（design: phase0/phase1、plan: phase2、apply: phase3、archive: phase4）✓
- pausePoints 分配：Task 1 protocol（phase0=[PP-01,02]、phase1=[PP-03,04]、phase2=[PP-05]、phase3=[PP-06,07,08]、phase4=[]）与 Task 5 decision-points.md「停顿点 × Phase 映射」表一致；Task 12 回归检查点 6 验证该一致性 ✓
- state.json schema（name/currentPhase/completedPhases/mode/blockedReason/evidence）在 Task 2 init 与 guard --apply 中一致（evidence 对象、completedPhases 数组、currentPhase 推进语义）✓
- guard CAS 语义：Task 3 `--apply` 要求 `currentPhase === phaseId`，与 init/resume/推进链路（currentPhase 由 init 或 guard 维护）自洽 ✓

**4. 已知实现边界（如实声明）**：
- state.mjs `archiveEvidence` 为轻量近似（目录/标记检查），git 严格检查由 guard phase4 承担——脚本内已注释，Task 2 冒烟用例 9 验证近似行为
- guard state.json 缺失降级（Task 3 冒烟 7）：--apply 跳过状态更新但退出码语义不变（设计文档 L251 约定）
- hook 的 Edit 工具限制（无法拿完整新内容）已在 hooks-reference.yaml comment 中说明 matcher 语义

**5. 未覆盖项（显式排除）**：tier 路由矩阵、Gate 体系、收敛提醒逻辑、refs/ 原 6 个 bundled resource 内容——均不变（设计文档「不变的部分」）。
