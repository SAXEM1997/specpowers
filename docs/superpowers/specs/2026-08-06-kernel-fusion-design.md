# specpowers-kernel 能力融合到原版 specpowers — 设计文档

## 概述

把 Comet workflow-kernel 整理阶段产出的 5 个核心机制（状态机索引、节点出口机械 guard、机器可读协议、Decision Core、可选 hooks）融合到原版 specpowers 技能组，消除 specpowers-kernel 与 specpowers 的双层入口嵌套（省 ~2-3K tokens/流程），同时保留 kernel 相比原版的流程纪律增强。

**改造原则**：原 6 个 SKILL.md 业务流程一字不改；新增轻量专用脚本（~160 行，零 comet 依赖）；Phase 自动检测保留为回退路径；hooks 默认 off。

**不变的部分**：Gate Token 产物依赖链（`.superpowers/.gate-passed-<N>` + name 绑定）；决策树（微小/中等/复杂/大规模）；GitFlow/Checklist/Pitfalls 全局规则；refs/ 原 5 个 bundled resource。

## 背景

### 当前双入口问题

```
specpowers-kernel (entry, 130 行) → specpowers-design (原, 205 行) → superpowers:brainstorming
```

- 三层 skill 嵌套，每次流程浪费 ~2-3K tokens 在重复路由描述
- 两个 specpowers-* 系列入口造成混乱
- kernel 的 scripts（workflow-state.mjs 1759 行、workflow-guard.mjs 1865 行）是 Comet factory 确定性生成的通用代码，含大量与 specpowers 无关的 pathBase/classic overlay/native 处理——直接搬到原版等于塞入 3500+ 行无关代码

### 解决方向

不搬 kernel 完整脚本，而是为原版写专用轻量脚本（~160 行），只保留 specpowers 真正需要的命令与检查逻辑。

## 设计决策

### 决策 1：节点流转主导机制 = 状态机为主，Phase 自动检测为回退

入口启动协议改为「先 `node scripts/workflow-state.mjs status` 判定 Phase」，state.json 缺失/损坏/脚本失败时回退到原版「Phase 自动检测表」（扫产物文件推断）。state.json 只是索引，最终裁判是 `.superpowers/.gate-passed-<N>` 文件 + 产物扫描。

### 决策 2：hooks 默认 = off，文档告知如何开启

hooks 影响全局会话性能，不应由单个技能组默认开启。hooks-reference.yaml 作为 bundled reference 提供，用户按需复制到 `.claude/settings.json` 启用。

### 决策 3：微小模式豁免

微小任务（1-3 文件）不 init state.json、不走状态机，保留原版轻量行为（避免给小改动强加流程开销）。中等+模式才走完整状态机。

## 文件结构

### 改造后目录

```
skills/specpowers/
├── SKILL.md                 （改造：+Decision Core 节，启动协议改写，Phase 自动检测降级标注）
├── refs/                    （原 5 文件不变 + 新增 2 文件）
│   ├── onboarding.md
│   ├── project-template.md
│   ├── ultraplan-overview.md
│   ├── ultraplan-code-expert.md
│   ├── ultraplan-research-expert.md
│   ├── pkg-xmake-template.md
│   ├── workflow-protocol.json   （新增，~70 行，精简版）
│   └── decision-points.md       （新增，~80 行，8 停顿点 + 分类表）
└── scripts/                    （新增，3 文件）
    ├── workflow-state.mjs       （~80 行，status/next/init/reset）
    ├── workflow-guard.mjs       （~80 行，exit <phase>）
    └── hooks-reference.yaml     （~30 行，bundled hook 模板）
```

### 文件改动清单

| 操作 | 文件 | 改动 |
|------|------|------|
| 修改 | `skills/specpowers/SKILL.md` | +Decision Core 节（~50 行）/ 启动协议改写（+10/-15）/ Phase 自动检测降级标注（+3） |
| 修改 | `skills/specpowers-design/SKILL.md` | Gate 0/1 出口 +guard 调用（+3 行×2 处） |
| 修改 | `skills/specpowers-plan/SKILL.md` | Gate 2 出口 +guard 调用（+3） |
| 修改 | `skills/specpowers-apply/SKILL.md` | Gate 3 出口 +guard 调用（+3） |
| 修改 | `skills/specpowers-archive/SKILL.md` | Step 4 全 PASS 后 +guard 调用（+4） |
| 修改 | `skills/specpowers-review/SKILL.md` | Gate Token 输出节 +衔接注释（+3） |
| 新增 | `skills/specpowers/scripts/workflow-state.mjs` | 轻量状态机（~80 行） |
| 新增 | `skills/specpowers/scripts/workflow-guard.mjs` | 节点出口守卫（~80 行） |
| 新增 | `skills/specpowers/scripts/hooks-reference.yaml` | bundled hook 模板（~30 行） |
| 新增 | `skills/specpowers/refs/workflow-protocol.json` | 精简版协议（~70 行） |
| 新增 | `skills/specpowers/refs/decision-points.md` | 8 停顿点 + 分类表（~80 行） |
| 删除 | `.claude/skills/specpowers-kernel/` + 5 node skill | kernel 全部 6 skill |

## 入口 SKILL.md 改造

### 节顺序

```
1. 概述 + 职责分工（不变）
2. 技能组结构（不变）
3. 启动协议（改造：融合 Decision Core）         ← 主要改动
4. 执行模式选择（决策树，不变）
5. 阶段路由（不变）
6. Phase 自动检测（降级标注为「回退路径」）      ← 加注释
7. 审查路由 + 各模式映射（不变）
8. 适用场景 + 环境准备 + Git Flow + Checklist + Pitfalls（不变）
9. Gate 返回后验证协议（不变）
10. 参考资源（新增 workflow-protocol.json + decision-points.md 条目）
```

### 启动协议改造后内容

#### Step 0：语义化意图检测（每次启动/恢复/压缩后执行）

1. **判定当前 Phase**：运行 `node scripts/workflow-state.mjs status`。
   - 未初始化 → 进入 Step 1（首次启动）
   - 已初始化 → 读 currentPhase + completedPhases + 持久化阻塞原因
   - 脚本失败/缺失 → 回退到「Phase 自动检测（回退路径）」表，扫产物文件推断
2. **意图对齐**：从用户消息判定意图落点。意图超前 → 核对前序 Gate 文件，未过回前序 Phase；意图回退 → `reset <phase>` 回退。
3. **文件证据优先**：state.json 只是索引。最终裁判是 `.superpowers/.gate-passed-<N>`（`name=` 行与当前 `<name>` 完全匹配才算数）+ 产物文件 + git log。

#### Step 1：首次启动决策

1. 决策树判定模式（微小/中等/复杂/大规模）
2. `Plan: <mode>` 写入会话上下文；中等+模式 `node scripts/workflow-state.mjs init` 初始化 state.json
3. 微小任务特判：不创建 state.json，不走状态机，直接子代理执行

#### Step 2：推进纪律

- 节点流转：每完成一个 Phase，`node scripts/workflow-state.mjs next` 返回 `NEXT: <auto|blocked|done>` + `SKILL: <下一子技能>`
- 出口守卫：每个子技能 Gate 完成后调 `node ../scripts/workflow-guard.mjs exit <phase> --apply`
- 决策停顿点：见 `refs/decision-points.md`（PP-01..PP-08），必须停顿等用户

### 决策分类表

| 分类 | 情况 | 处理 |
|------|------|------|
| 自动处理 | 首次调用且需求主题清晰 | 直接进入 Phase 0 澄清流程 |
| 自动处理 | Gate 0-3 审查收敛判定 | 默认继续制：通知继续，非询问 |
| 自动处理 | guard 失败 | 先自动诊断：gate 文件缺失→回上一 Phase；产物缺失→停留补产物 |
| 自动处理 | openspec CLI 不可用 | 自动走跳过路径 |
| 停止条件 | Phase 4 硬 Gate 链失败 | 报告失败步骤与恢复路径 |
| 停止条件 | implementer BLOCKED / 状态损坏 | 报告恢复条件 |
| 手动衔接 | NEXT: manual | 交还控制权 |
| 用户决策 | PP-01..PP-08 | 停顿等用户 |

### Red Flags

| Agent 想法 | 实际风险 |
|---|---|
| `.gate-passed-N` 文件存在，所以 Gate 通过了 | name 不匹配 = 未通过 |
| 用户提了需求，澄清算完成了 | 未经审批 = 未完成 |
| 产物文件都在，这个 Phase 算完成 | 无 gate token = 未通过 |
| state.json completedPhases 有它，直接走下一步 | state 可能过期；gate 文件缺失按未完成 |
| 状态机脚本失败，流程卡死 | 回退到 Phase 自动检测表 |
| 收敛判定问用户是否继续 | 默认继续制：通知不是询问 |
| 全量测试没过，手动 mv change 到 archive | 硬 Gate 链不可降级 |
| task 简单，内联做掉 | Phase 3 必须每 task 独立子代理 |

### Phase 自动检测降级标注

在原表前加：

> **本节为回退路径**：当 `scripts/workflow-state.mjs status` 失败、脚本缺失或 state.json 损坏时使用。正常运行时由 Step 0 的状态机判定主导。两套机制判定的依据相同（产物文件 + Gate token），结论应一致——不一致时以文件证据为准。

## 5 子技能 guard 调用改造

### specpowers-design

Phase 0 Step 0.6 Gate 0 后：
```
node ../scripts/workflow-guard.mjs exit phase0 --apply
```
检查 `.gate-passed-0`（name 匹配）+ clarifications + design.md。

Phase 1 Step 1.3 Gate 1 后：
```
node ../scripts/workflow-guard.mjs exit phase1 --apply
```
检查 `.gate-passed-1`（`.phase1-skipped` 存在时豁免）+ openspec 四件套。

### specpowers-plan

Plan 审查 Gate 2 后：
```
node ../scripts/workflow-guard.mjs exit phase2 --apply
```
检查 `.gate-passed-2` + plans/<name>.md。

### specpowers-apply

Gate 3 验证后：
```
node ../scripts/workflow-guard.mjs exit phase3 --apply
```
检查 `.gate-passed-3` + git log 含任务 commit。

### specpowers-archive

Step 4 全 PASS 后：
```
node ../scripts/workflow-guard.mjs exit phase4 --apply
```
检查归档证据（archive/ 或 .phase1-skipped 简化路径）+ git commit。

### specpowers-review

Gate Token 输出节增加衔接注释：父技能验证协议通过后会调 guard 二次校验；独立调用 review 时不触发 guard。

## 脚本命令契约

### workflow-state.mjs（~80 行）

零外部依赖（纯 Node.js 标准库）。state.json 路径：`.comet/runs/specpowers/state.json`。

**init [--name \<name\>]**：写 state.json（name/currentPhase=phase0/completedPhases=[]/mode）。已存在不覆盖（除非 --force）。输出 `INIT_OK name=<name>`。

**status**：读 state.json + 扫 `.superpowers/.gate-passed-{0,1,2,3}`。输出 STATE/NAME/MODE/CURRENT_PHASE/COMPLETED_PHASES/GATE_TOKENS_FOUND。state.json 缺失→`STATE_MISSING`（退出码 0）；损坏→`STATE_CORRUPT`（退出码 0，触发回退）。

**next**：基于 status 判定。输出 `NEXT: auto|blocked|done` + `SKILL: <name>` + `PHASE: <id>` + `REASON: <文本>`。退出码 0。

**reset \<phaseId\>**：回退 currentPhase + 从 completedPhases 移除该 phase 及之后。不删 .gate-passed 文件。state.json 缺失→退出码 1。

### workflow-guard.mjs（~80 行）

**exit \<phaseId\> [--apply]**：

检查矩阵：

| phaseId | gate 文件 | 关键产物 |
|---------|----------|---------|
| phase0 | .gate-passed-0（name 匹配） | clarifications/<name>.md + specs/<name>-design.md |
| phase1 | .gate-passed-1 **或** .phase1-skipped | openspec/changes/<name>/ 四件套（.phase1-skipped 时豁免） |
| phase2 | .gate-passed-2（name 匹配） | plans/<name>.md |
| phase3 | .gate-passed-3（name 匹配） | git log 含 commit |
| phase4 | 无 gate 文件 | archive/ 归档证据 或 .phase1-skipped 简化路径 + git commit |

输出 `GUARD: pass|fail` + PHASE + CHECKS 或 MISSING + REASON。--apply 时通过则更新 state.json（completedPhases 追加 + currentPhase 推进）。退出码 pass=0，fail=1。

### 精简 workflow-protocol.json（~70 行）

```json
{
  "schemaVersion": 1,
  "kind": "specpowers",
  "name": "specpowers",
  "goal": "SDD+TDD 工程化开发方法论：Phase 0-4 全流程 + Gate Token 产物依赖链。",
  "nodes": [
    {"id": "phase0", "label": "Phase 0: 需求澄清与设计", "skill": "specpowers-design", "gate": 0, "outputs": ["clarifications.v1", "design-doc.v1"], "skipIf": null},
    {"id": "phase1", "label": "Phase 1: OpenSpec 格式转换", "skill": "specpowers-design", "gate": 1, "outputs": ["openspec-change.v1"], "skipIf": ".phase1-skipped"},
    {"id": "phase2", "label": "Phase 2: 衔接计划", "skill": "specpowers-plan", "gate": 2, "outputs": ["plan.v1"], "skipIf": null},
    {"id": "phase3", "label": "Phase 3: 子代理 TDD 实现", "skill": "specpowers-apply", "gate": 3, "outputs": ["implementation.v1"], "skipIf": null},
    {"id": "phase4", "label": "Phase 4: 验证与归档", "skill": "specpowers-archive", "gate": null, "outputs": ["archive.v1"], "skipIf": null, "hardGateChain": ["full-test", "openspec-validate", "opsx-archive", "integrity-verify"]}
  ],
  "outputSchemas": {
    "clarifications.v1": {"artifacts": ["docs/superpowers/clarifications/<name>.md"]},
    "design-doc.v1": {"artifacts": ["docs/superpowers/specs/<name>-design.md"]},
    "openspec-change.v1": {"artifacts": ["openspec/changes/<name>/proposal.md", "openspec/changes/<name>/design.md", "openspec/changes/<name>/specs/", "openspec/changes/<name>/tasks.md"], "skipArtifact": ".phase1-skipped"},
    "plan.v1": {"artifacts": ["docs/superpowers/plans/<name>.md"]},
    "implementation.v1": {"artifacts": [], "evidence": ["git-committed"]},
    "archive.v1": {"artifacts": ["openspec/changes/archive/"], "skipArtifact": ".phase1-skipped"}
  },
  "state": {"path": ".comet/runs/specpowers/state.json", "gateTokenDir": ".superpowers/", "gateTokenPrefix": ".gate-passed-"}
}
```

与 kernel 版的差异（精简掉的字段）：edges（线性顺序硬编码）/ evals（comet 专用）/ pathBase/classicArtifactLayout/nativeArtifactRoot（comet 多 workflow 兼容）/ requiredSkillCalls（保留在 SKILL.md 文本协议）/ guardrails 独立段（guard 检查逻辑内嵌脚本，由 gate 字段驱动）。

### 关键设计约束

1. 脚本零外部依赖——纯 Node.js 标准库（fs/path/url），不 npm install，不 import comet
2. protocol.json 是数据不是代码——脚本读它驱动检查逻辑
3. `<name>` 替换——从 state.json name 字段读；缺失时从 --name 参数读
4. Windows/Linux 兼容——路径用 path.join()；检查 fs.existsSync()（不做真 glob，只检查 protocol 声明的确切路径替换 <name> 后的字面路径）
5. 退出码——0=正常（含 STATE_MISSING/blocked/done），1=guard fail，2=参数错误

## hooks-reference.yaml

bundled hook 模板（默认不注册）。默认提供"防伪造 Gate token"hook（轻量，仅在写 .gate-passed-* 时触发）。"跨 Phase 写入边界检查"hook（较重，每次 Write 触发）作为注释的可选项。hook 命令（hook-validate-token / hook-check-phase-boundary）是可选扩展，初版可不实现（yaml 注明"启用前需先实现"）。

## 删除与迁移

### 删除

`.claude/skills/specpowers-kernel/` + 5 个 node skill 目录（共 6 个 kernel skill）。

### 保留备查

`.comet/bundle-drafts/specpowers-kernel/`、`.comet/bundle-authoring/`、`.comet/plans/`、`.comet/lane-outputs/`（创作记录，不再使用但保留审计）。

### 用户迁移路径

- 原版用户（从未用 kernel）：零迁移——改造后入口行为兼容（state.json 不存在时回退原逻辑）
- kernel 用户：kernel state.json 不被原版读取；用户按原版流程继续。`.superpowers/.gate-passed-*` 通用，Gate 进度不丢失
- kernel 用户（中途某 Phase）：运行 init 重建 state.json（或直接走回退路径）

## 改造总量

| 维度 | 数量 |
|------|------|
| SKILL.md 改动 | 6 文件，净增 ~64 行（入口 +45，5 子技能 +19） |
| 新增脚本 | 2 文件 ~160 行 |
| 新增 refs | 2 文件 ~150 行（protocol + decision-points） |
| 新增 hooks 模板 | 1 文件 ~30 行 |
| 删除 kernel | 6 skill 目录 |
| **净增** | **~404 行**（160 脚本 + 150 refs + 30 hooks + 64 SKILL.md） |
