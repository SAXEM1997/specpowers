# specpowers-kernel 能力融合到原版 specpowers — 设计文档

## 概述

把 Comet workflow-kernel 整理阶段产出的 5 个核心机制（状态机索引、节点出口机械 guard、机器可读协议、Decision Core、可选 hooks）融合到原版 specpowers 技能组，消除 specpowers-kernel 与 specpowers 的双层入口嵌套，同时保留 kernel 相比原版的流程纪律增强。运行期 token 净额账目：省 2 层入口加载（kernel entry + node skill 合计 ≈ 219 行/流程）；自身新增入口 +51 行 + refs 2 文件 ~150 行（bundled resource，随入口加载）≈ +201 行；净额 ≈ 省 18 行/流程（约数百 tokens）。注意：运行期实际进入上下文的文件清单需实施前实证——scripts/ 与 refs/ 的加载行为以 Claude Code 实际资源加载机制为准，若 scripts/（~300 行）同样进入上下文，净额为负，届时需将 scripts/ 移出技能目录（如 .claude/scripts/specpowers/）。

**改造原则**：原 6 个 SKILL.md 业务 Phase 流程语义不变，仅插入 guard 调用（及 Phase 0 Step 0.3 后的 init 调用）与 Decision Core 节；新增轻量专用脚本（~270 行，零 comet 依赖）；Phase 自动检测保留为回退路径；hooks 默认 off。

**不变的部分**：Gate Token 产物依赖链（`.superpowers/.gate-passed-<N>` + name 绑定）；决策树（微小/中等/复杂/大规模）；GitFlow/Checklist/Pitfalls 全局规则；refs/ 原 6 个 bundled resource。

## 背景

### 当前双入口问题

```
specpowers-kernel (entry, 133 行) → specpowers-kernel-open (node, 86 行) → specpowers-design (原, 205 行) → superpowers:brainstorming
```

- 四层 skill 嵌套（注：「双入口」指入口数 2 个，「四层嵌套」指加载链路深度），每次流程多加载 2 层入口（kernel entry 133 行 + node skill 86 行 ≈ 219 行）的重复路由描述
- 两个 specpowers-* 系列入口造成混乱
- kernel 的 scripts（workflow-state.mjs 1759 行、workflow-guard.mjs 1865 行）是 Comet factory 确定性生成的通用代码，含大量与 specpowers 无关的 pathBase/classic overlay/native 处理——直接搬到原版等于塞入 3500+ 行无关代码

### 解决方向

不搬 kernel 完整脚本，而是为原版写专用轻量脚本（~270 行），只保留 specpowers 真正需要的命令与检查逻辑。

## 设计决策

### 决策 1：节点流转主导机制 = 状态机先行判定，文件证据最终裁决

入口启动协议改为「先 `node skills/specpowers/scripts/workflow-state.mjs status` 判定 Phase」，state.json 损坏/脚本失败时回退到原版「Phase 自动检测表」（扫产物文件推断）；state.json 缺失时按 Step 0.1 首次启动流程处理（决策树判定模式 → 延迟 init）。状态机先行判定，文件证据最终裁决：state.json 只是索引，最终裁判是 `.superpowers/.gate-passed-<N>` 文件（token）；产物扫描仅对回退路径与 phase4 有意义。

### 决策 2：hooks 默认 = off，文档告知如何开启

hooks 影响全局会话性能，不应由单个技能组默认开启。hooks 默认 off + 初版仅 token 校验是相对 kernel 强制能力的主动裁剪（理由：性能 + 与 comet-hook-router 互斥）；强制主力回归技能文本纪律 + 可选 token 校验；启用路径：由 router 统一承载或显式停用 router。hooks-reference.yaml 作为 bundled hook 模板（位于 scripts/ 下；hooks 必须经 `.claude/settings.json` 注册才能生效，不会因技能加载而自动生效——用户按需注册启用）提供。

### 决策 3：微小模式豁免

微小任务（1-3 文件）不 init state.json、不走状态机，保留原版轻量行为（避免给小改动强加流程开销）。相对 kernel 的行为弱化：微小任务绕过状态机（kernel 全量强制）——权衡：微小变更无需状态机开销。微小不 init 状态机，但仍按原版执行 Gate 3 审查 + token 写入（`.gate-passed-3`）；Gate 0/1/2 跳过。中等+模式才走完整状态机。

## 文件结构

### 改造后目录

```
skills/specpowers/
├── SKILL.md                 （改造：+Decision Core 节，启动协议改写，Phase 自动检测降级标注）
├── refs/                    （原 6 文件不变 + 新增 2 文件）
│   ├── onboarding.md
│   ├── project-template.md
│   ├── ultraplan-overview.md
│   ├── ultraplan-code-expert.md
│   ├── ultraplan-research-expert.md
│   ├── pkg-xmake-template.md
│   ├── workflow-protocol.json   （新增，~70 行（含完整 JSON，本文样例为紧凑排版示意），精简版，nodes 含 pausePoints 字段）
│   └── decision-points.md       （新增，~80 行，8 停顿点（PP-01..PP-08 定义正本，protocol.json pausePoints 字段引用本文件）+ 分类表引用）
└── scripts/                    （新增，4 文件）
    ├── workflow-state.mjs       （~100 行，status/next/init/set-name/reset，含 resume-artifacts 扫描）
    ├── workflow-guard.mjs       （~120 行，exit <phase>；承载 protocol 解析 + 5 phase 矩阵 + name 匹配 + skipIf + git 双路径 + CAS + 三档退出码）
    ├── hook-validate-token.mjs  （~50 行，最小可运行 hook，仅 .gate-passed-* 校验）
    └── hooks-reference.yaml     （~30 行，bundled hook 模板）
```

### 文件改动清单

| 操作 | 文件 | 改动 |
|------|------|------|
| 修改 | `skills/specpowers/SKILL.md` | +Decision Core 节（~50 行）/ 启动协议改写（+10/-15）/ Phase 自动检测降级标注（+3）/ 环境准备表 +Node.js 行 + Pre-Flight Check 检查项（+3） |
| 修改 | `skills/specpowers-design/SKILL.md` | Step 0.3 后 +init 调用（+2 行：`node skills/specpowers/scripts/workflow-state.mjs init --name <name> --mode <mode>`）/ Gate 0/1 出口 +guard 调用（+3 行×2 处） |
| 修改 | `skills/specpowers-plan/SKILL.md` | Gate 2 出口 +guard 调用（+3） |
| 修改 | `skills/specpowers-apply/SKILL.md` | Gate 3 出口 +guard 调用（+3） |
| 修改 | `skills/specpowers-archive/SKILL.md` | Step 4 全 PASS 后 +guard 调用（+4） |
| 修改 | `skills/specpowers-review/SKILL.md` | Gate Token 输出节 +衔接注释（+3） |
| 修改 | `CLAUDE.md` | 技能组架构描述 / refs 清单 / 新机制说明同步 |
| 新增 | `skills/specpowers/scripts/workflow-state.mjs` | 轻量状态机（~100 行，含 resume-artifacts 扫描） |
| 新增 | `skills/specpowers/scripts/workflow-guard.mjs` | 节点出口守卫（~120 行，含 protocol 解析 + git 双路径 + CAS） |
| 新增 | `skills/specpowers/scripts/hook-validate-token.mjs` | 最小可运行 hook（~50 行，仅 .gate-passed-* 校验） |
| 新增 | `skills/specpowers/scripts/hooks-reference.yaml` | bundled hook 模板（~30 行） |
| 新增 | `skills/specpowers/refs/workflow-protocol.json` | 精简版协议（~70 行） |
| 新增 | `skills/specpowers/refs/decision-points.md` | 8 停顿点（PP-01..PP-08 定义正本，protocol.json pausePoints 字段引用本文件）+ 分类表引用（~80 行） |
| 删除 | `.claude/skills/specpowers-kernel/` + 5 node skill | kernel 全部 6 skill |
| 删除 | `.comet/skills/specpowers-{apply,archive,design,plan}` | 4 个旧副本（已过时） |

## 入口 SKILL.md 改造

### 节顺序

```
1. 概述 + 职责分工（不变）
2. 技能组结构（不变）
3. 启动协议（改造：融合 Decision Core；改写触及其中「子 Agent 启动方式」子节）  ← 主要改动
4. 执行模式选择（决策树，不变）
5. 阶段路由（不变；Phase 自动检测是其子节，降级标注为「回退路径」）          ← 加注释
6. 审查路由 + 各模式映射（不变）
7. 适用场景 + 环境准备 + Git Flow + Checklist（环境准备表 +Node.js 行：≥18，脚本依赖；缺失时回退到 Phase 自动检测，状态机功能不可用；Pre-Flight Check +对应检查项）
8. Gate 返回后验证协议（不变，位于 Pitfalls 之前）
9. Pitfalls（不变）
10. 故障排查 + 快速上手（不变）
11. 参考资源（新增 workflow-protocol.json + decision-points.md 条目）
```

### 启动协议改造后内容

#### Step 0：语义化意图检测（每次启动/恢复/压缩后执行）

1. **判定当前 Phase**：运行 `node skills/specpowers/scripts/workflow-state.mjs status`。
   - 未初始化 → 进入 Step 1（首次启动）；但存在 name-keyed 产物/token（如 docs/superpowers/ 下 name 目录、`.superpowers/.gate-passed-*`）→ 提示 `init --resume-artifacts`（不按全新任务处理）；**微小任务忽略此提示**（微小不 init state.json，缺失属预期，见决策 3）
   - 已初始化 → 读 currentPhase + completedPhases + 持久化阻塞原因（对应脚本契约 status 输出的 BLOCKED_REASON 字段）
   - 脚本失败/缺失 → 回退到「Phase 自动检测（回退路径）」表，扫产物文件推断
2. **意图对齐**：从用户消息判定意图落点。意图超前 → 核对前序 Gate 文件，未过回前序 Phase；意图回退 → `reset <phase>` 回退。
3. **文件证据最终裁决**：状态机先行判定，state.json 只是索引。最终裁判是 gate 文件（token）——`.superpowers/.gate-passed-<N>`（`name=` 行与当前 `<name>` 完全匹配才算数）；产物文件仅对回退路径与 phase4 有意义。

#### Step 1：首次启动决策（只决策不 init）

1. 决策树判定模式（微小/中等/复杂/大规模）
2. `Plan: <mode>` 写入会话上下文。**首次启动只决策不 init**——init 延迟到 Phase 0 产出 name 后（Phase 0 Step 0.3 之后）执行：`node skills/specpowers/scripts/workflow-state.mjs init --name <name> --mode <mode>` 初始化 state.json
3. 微小任务特判：豁免规则见决策 3（不创建 state.json，不走状态机，直接子代理执行）。微小任务跨会话恢复仍按原版产物 + 会话上下文推断，不走状态机（state.json 不存在属预期）
4. 迁移分支：若产物已存在（如 clarifications/design.md）→ 提示 `init --resume-artifacts --mode <mode>` + `set-name <name>`（name 从产物目录推断或用户提供）

#### Step 2：推进纪律

- 节点流转：每完成一个 Phase，`node skills/specpowers/scripts/workflow-state.mjs next` 返回 `NEXT: <auto|blocked|manual|done>` + `SKILL: <Skill 工具全名，带 provider 前缀>` + `PHASE: <id>` + `REASON: <文本>`（auto 时 SKILL=下阶段技能；manual 时 SKILL 保持当前待用户决策；blocked 时 SKILL=回退 phase 对应技能；done 时无 SKILL）
- 出口守卫：每个子技能 Gate 完成后调 `node skills/specpowers/scripts/workflow-guard.mjs exit <phase> --apply`
- 决策停顿点：见 `refs/decision-points.md`（PP-01..PP-08），必须停顿等用户
- 恢复规则（移植 kernel Decision Core 的恢复类规则）：恢复时复用已持久化选择（方案选择/跳过决定/worktree 同意/逐条裁决），只呈现未决部分；已持久化选择存于 state.json evidence 字段（跨设备恢复依赖该文件）；换话题先确认继续还是新任务，不得混用 name

### 决策分类表

| 分类 | 情况 | 处理 |
|------|------|------|
| 自动处理 | NEXT: auto（当前应执行 phase 已确定，含首次调用的 phase0 与恢复场景的 phase1-4） | 直接进入该 phase 对应技能（首次调用为 Phase 0 澄清流程） |
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

### Phase 自动检测降级标注

在原表前加：

> **本节为回退路径**：当 `skills/specpowers/scripts/workflow-state.mjs status` 失败、脚本缺失或 state.json 损坏时使用。正常运行时由 Step 0 的状态机判定主导。两套机制判定的依据相同（产物文件 + Gate token），结论应一致——不一致时以文件证据为准（状态机先行判定，文件证据最终裁决）。

## 5 子技能 guard 调用改造

插入点统一为：Gate N 返回 + 验证链（验证 0-3）通过 + `.gate-passed-<N>` token 写入之后（token 先写，guard 后调）。**子技能 Gate 出口为唯一 guard 调用责任方**。guard 调用以 state.json 存在为前提（微小无 state.json 故无调用；guard 在 state.json 缺失时的降级行为见脚本契约节的 guard 约定，仅覆盖独立调用场景）。

### specpowers-design

Phase 0 Step 0.3 末尾插入 init 调用（name/mode 实参来源：Step 0.3 动作 2 定义的 name + Step 1 决策的模式）：
```
node skills/specpowers/scripts/workflow-state.mjs init --name <name> --mode <mode>
```

Phase 0 Step 0.6 Gate 0 后：
```
node skills/specpowers/scripts/workflow-guard.mjs exit phase0 --apply
```
检查 `.superpowers/.gate-passed-0`（name 匹配）+ clarifications + design.md。

Phase 1 Step 1.3 Gate 1 后：
```
node skills/specpowers/scripts/workflow-guard.mjs exit phase1 --apply
```
检查 `.superpowers/.gate-passed-1`（name 匹配）**或** `.superpowers/.phase1-skipped`（内容==name 时豁免）+ openspec 四件套。

### specpowers-plan

Plan 审查 Gate 2 后：
```
node skills/specpowers/scripts/workflow-guard.mjs exit phase2 --apply
```
检查 `.superpowers/.gate-passed-2`（name 匹配）+ plans/<name>.md。

### specpowers-apply

Gate 3 验证后（仅中等+；微小模式无 state.json，不调 guard）：
```
node skills/specpowers/scripts/workflow-guard.mjs exit phase3 --apply
```
检查 `.superpowers/.gate-passed-3`（name 匹配）+ git log 含至少 1 条消息含 `<name>` 的 commit。

### specpowers-archive

Step 4 全 PASS 后：
```
node skills/specpowers/scripts/workflow-guard.mjs exit phase4 --apply
```
检查归档证据：正常路径 = `openspec/changes/archive/<name>/` 存在 + `git log --oneline -1` 含 `archive <name>`；skip 路径 = `.superpowers/.phase1-skipped` 内容==name + `git log --oneline -1` 含 `<name>`（末位 commit 为实现 commit，非归档 commit）。（guard 是原版 specpowers-archive Step 4 检查的子集——覆盖检查 1 归档目录迁移 + 检查 4 归档 commit；检查 2/3 由 archive 技能自身完成。）

### specpowers-review

Gate Token 输出节增加衔接注释：token 写入与 guard 调用顺序为 token 先写、guard 后调；父技能验证协议通过后**由子技能**调 guard（子技能 Gate 出口为唯一 guard 调用责任方）；独立调用 review 时不触发 guard。

## 脚本命令契约

### workflow-state.mjs（~100 行）

零外部依赖（纯 Node.js 标准库：fs/path/url）。state.json 路径：`.superpowers/state.json`（建议提交到 git——`.superpowers/` 未被 gitignore，实现跨设备恢复）。**cwd 约定**：所有脚本调用以项目根为 cwd（Claude Code Bash 工具行为），下文路径均为项目根相对路径。

**init [--name \<name\>] [--mode \<mode\>] [--resume-artifacts]**：写 state.json（schema：name / currentPhase=phase0 / completedPhases=[] / mode / blockedReason=null / evidence={}——对象，存 PP 决策记录，如 `{"phase0": {"decision": "chose-option-B"}, "phase3": {"worktree-consent": true}}`）。`--mode` 取值 medium|complex|large。已存在不覆盖（除非 --force；--force 语义 = 删除现有 state.json 重建）。`--resume-artifacts` 模式：token 优先——`.gate-passed-<N>` 存在且 name 匹配 → 对应 phase 完成；`.phase1-skipped`（内容==name）→ phase1 完成；**产物仅用于 name 推断**（`--name` 未提供时，从 docs/superpowers/clarifications/ 或 openspec/changes/ 下 name-keyed 目录推断；多 name 残留时暂停让用户选择）。completedPhases 与 currentPhase 完全由 token 推导（第一个无有效 token 的 phase 为 currentPhase），产物不改变 phase 判定。

**set-name \<name\>**：仅用于 init 未带 `--name` 的恢复路径（如 `init --resume-artifacts` 后）——正常路径 init 已带 `--name <name>`（Phase 0 Step 0.3 后执行），无需 set-name。更新 state.name。输出 `NAME_SET name=<name>`。

**status**：读 state.json + 扫 `.superpowers/.gate-passed-{0,1,2,3}`。输出 STATE/NAME/MODE/CURRENT_PHASE/COMPLETED_PHASES/BLOCKED_REASON/GATE_TOKENS_FOUND。state.json 缺失→`STATE_MISSING`（退出码 0）；损坏→`STATE_CORRUPT`（退出码 0，触发回退）+ 输出恢复指引（`init --force --resume-artifacts` 组合——--force 删除损坏档重建 + --resume-artifacts 按 token/产物恢复进度）。

**next**：基于 status 判定。输出 `NEXT: auto|blocked|manual|done` + `SKILL: <Skill 工具全名，带 provider 前缀>` + `PHASE: <id>` + `REASON: <文本>`；判定 blocked 时写回 `state.blockedReason = REASON`；返回 auto/manual/done 时清除 blockedReason；下一步需用户决策（PP-01..PP-08）时输出 `manual` + SKILL 保持当前——manual 判定依据 protocol.json 的 pausePoints 字段（与检查矩阵硬编码先例一致）。退出码 0。

**next 判定规则**（gate 文件证据 > completedPhases）：按 phase0→3 顺序检查，区分两种「token 缺失」——第一个既不在 completedPhases 也无有效 token 的 phase = 当前应执行 phase → `NEXT: auto`；**manual 条件：当前应执行 phase 的 pausePoints 非空且该 phase 的 PP 决策未持久化于 evidence → `NEXT: manual` + SKILL 保持当前**（PP 决策已持久化则直接 auto）；completedPhases 含某 phase 但 token 缺失或 name 不匹配 → blocked（无 token = 未通过 Gate，与 Red Flags/决策表一致），回到第一个缺有效 token 的 phase 并写回 blockedReason。`.superpowers/.phase1-skipped`（内容==name）存在 → phase1 视为完成。token 0-3 齐 + 无归档证据 → `NEXT: auto` + `SKILL: specpowers:specpowers-archive` + `PHASE: phase4`；归档证据齐（复用 guard phase4 检查，见 workflow-guard 检查矩阵）→ `NEXT: done`。state 与 gate 文件冲突时以 gate 文件为准（状态机先行判定，文件证据最终裁决）。

**reset \<phaseId\>**：回退 currentPhase + 从 completedPhases 移除该 phase 及之后 + 删除该 phase 及之后的 `.superpowers/.gate-passed-<N>` 文件（防止陈旧 token 被 next 采信，与 next「gate 文件证据优先」一致）+ 清除 blockedReason；**回退到 phase1 或更早时同时删除 `.superpowers/.phase1-skipped`**（它是 phase1 的等效 token，不删则 next 仍判 phase1 完成，reset 静默失效）。state.json 缺失→输出 `STATE_MISSING`，退出码 0（与 status 一致）。

### workflow-guard.mjs（~120 行）

零外部依赖（纯 Node.js 标准库：fs/path/url/child_process——phase3/4 查 git 用 child_process execSync 调 git log，或读 .git/logs/HEAD）。

**exit \<phaseId\> [--apply] [--name \<name\>]**：

分工：检查矩阵（gate 文件存在性 / name 匹配逻辑）硬编码于脚本；产物路径 / skipArtifact（node 级 skipIf 字段对应的 outputSchemas 跳过标记）从 protocol.json 的 outputSchemas 读取；git 检查（phase3/phase4 证据）由 guard 承担。

检查矩阵：

| phaseId | gate 文件 | 关键产物 |
|---------|----------|---------|
| phase0 | .superpowers/.gate-passed-0（name 匹配） | docs/superpowers/clarifications/<name>.md + docs/superpowers/specs/<name>-design.md |
| phase1 | .superpowers/.gate-passed-1（name 匹配）**或** .superpowers/.phase1-skipped（内容==name 才生效） | openspec/changes/<name>/ 四件套（.phase1-skipped 时豁免） |
| phase2 | .superpowers/.gate-passed-2（name 匹配） | docs/superpowers/plans/<name>.md |
| phase3 | .superpowers/.gate-passed-3（name 匹配） | git log 含至少 1 条消息含 `<name>` 的 commit |
| phase4 | 无 gate 文件 | 正常路径 = `openspec/changes/archive/<name>/` 存在 + `git log --oneline -1` 含 `archive <name>`；skip 路径 = `.superpowers/.phase1-skipped` 内容==name + `git log --oneline -1` 含 `<name>`（末位 commit 为实现 commit，非归档 commit）。（guard 是原版 specpowers-archive Step 4 检查的子集：覆盖检查 1 归档目录迁移 + 检查 4 归档 commit；检查 2/3 由 archive 技能自身完成） |

输出 `GUARD: pass|fail` + PHASE + CHECKS 或 MISSING + REASON。--apply 时通过则更新 state.json（completedPhases 追加 + currentPhase 推进）；**约定：state.json 缺失时——有 --name 则按 --name 校验 name 匹配；无 --name 则输出 GUARD: fail（name 未设置——无法校验 name 绑定与产物路径，因产物路径内嵌 <name>；fail-closed 策略）；--apply 静默跳过状态更新，退出码语义不变**（正常流程 guard 调用以 state.json 存在为前提，此约定仅覆盖独立调用/降级场景）。--apply 更新前重读校验 currentPhase 未变（compare-and-swap）；CAS 检测到 currentPhase 已变 → 输出 `GUARD: conflict` + 退出码 2（与参数错误共用，注明语义）；并发约定：state.json 单会话独占写入。退出码 pass=0，fail=1，参数错误/CAS 冲突=2。

### 精简 workflow-protocol.json（~70 行，含完整 JSON，以下样例为紧凑排版示意）

```json
{
  "schemaVersion": 1,
  "kind": "specpowers",
  "name": "specpowers",
  "goal": "SDD+TDD 工程化开发方法论：Phase 0-4 全流程 + Gate Token 产物依赖链。",
  "nodes": [
    {"id": "phase0", "label": "Phase 0: 需求澄清与设计", "skill": "specpowers:specpowers-design", "gate": 0, "outputs": ["clarifications.v1", "design-doc.v1"], "skipIf": null, "pausePoints": ["PP-01", "PP-02"]},
    {"id": "phase1", "label": "Phase 1: OpenSpec 格式转换", "skill": "specpowers:specpowers-design", "gate": 1, "outputs": ["openspec-change.v1"], "skipIf": ".superpowers/.phase1-skipped", "pausePoints": ["PP-03"]},
    {"id": "phase2", "label": "Phase 2: 衔接计划", "skill": "specpowers:specpowers-plan", "gate": 2, "outputs": ["plan.v1"], "skipIf": null, "pausePoints": ["PP-04", "PP-05"]},
    {"id": "phase3", "label": "Phase 3: 子代理 TDD 实现", "skill": "specpowers:specpowers-apply", "gate": 3, "outputs": ["implementation.v1"], "skipIf": null, "pausePoints": ["PP-06", "PP-07"]},
    {"id": "phase4", "label": "Phase 4: 验证与归档", "skill": "specpowers:specpowers-archive", "gate": null, "outputs": ["archive.v1"], "skipIf": null, "pausePoints": ["PP-08"], "hardGateChain": ["full-test", "openspec-validate", "opsx-archive", "integrity-verify"]}
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

state.json 并发约定：单会话独占写入；guard --apply 更新前重读校验 currentPhase 未变（compare-and-swap）。pausePoints 字段：每 node 列出其 PP 编号（上例分配为示意；PP-01..PP-08 的定义正本在 refs/decision-points.md）；next 的 manual 判定读取本字段。

与 kernel 版的差异（精简掉的字段）：edges（线性顺序硬编码）/ evals（comet 专用）/ pathBase/classicArtifactLayout/nativeArtifactRoot（comet 多 workflow 兼容）/ requiredSkillCalls（保留在 SKILL.md 文本协议）/ guardrails 独立段（检查矩阵硬编码于 guard 脚本，产物路径/skipIf 由脚本从 outputSchemas 读取）。

### 关键设计约束

1. 脚本零外部依赖——纯 Node.js 标准库（fs/path/url/child_process），不 npm install，不 import comet
2. protocol.json 是数据不是代码——产物路径/skipIf 由脚本从 outputSchemas 读取（gate 检查矩阵与 name 匹配逻辑硬编码于脚本）
3. `<name>` 替换——从 state.json name 字段读；缺失时从 --name 参数读
4. Windows/Linux 兼容——路径用 path.join()；检查 fs.existsSync()（不做真 glob，只检查 protocol 声明的确切路径替换 <name> 后的字面路径）
5. 退出码——0=正常（含 STATE_MISSING/blocked/done），1=guard fail，2=参数错误/guard CAS 冲突（`GUARD: conflict`）
6. cwd 约定——所有脚本调用以项目根为 cwd（Claude Code Bash 工具行为）；hooks-reference.yaml 的 command 也用项目根相对路径

## hooks-reference.yaml

bundled hook 模板（位于 scripts/ 下；hooks 必须经 `.claude/settings.json` 注册才能生效，不会因技能加载而自动生效；默认不注册）。初版移植最小可运行 hook：`hook-validate-token`（`scripts/hook-validate-token.mjs`，~50 行，仅在写 `.gate-passed-*` 时触发，校验 name 绑定），yaml 的 command 指向真实命令（项目根相对路径，如 `node skills/specpowers/scripts/hook-validate-token.mjs`）。"跨 Phase 写入边界检查"hook（hook-check-phase-boundary，较重，每次 Write 触发）仍为可选扩展，初版不实现（yaml 注明"启用前需先实现"）。

hook 两态定义：state.json 缺失（微小模式）→ fail-open + 警告（不阻断 token 写入，与决策 3 微小仍写 `.gate-passed-3` 一致）；state.json 存在 → 校验 name 绑定。已知限制：Edit 工具修改已有 token 时 PreToolUse 无法拿完整新内容 → matcher 限定 Write，或 Edit 路径读取现有文件 + 应用 new_string 后校验。

注意：本仓库已安装 comet-hook-router（PreToolUse Write|Edit，fail-closed）——启用本 hooks 前需先处理与 router 的互斥（由 router 统一承载或显式停用 router）；一次写入事件最多进入一个 workflow Guard。

## 删除与迁移

### 删除

`.claude/skills/specpowers-kernel/` + 5 个 node skill 目录（共 6 个 kernel skill）；`.comet/skills/specpowers-{apply,archive,design,plan}` 4 个旧副本（已过时，删除）。

### 保留备查

`.comet/bundle-drafts/specpowers-kernel/`、`.comet/bundle-authoring/`、`.comet/bundle-factory-plans/`、`.comet/inputs/`（创作记录，不再使用但保留审计）。

### 用户迁移路径

- 原版用户（从未用 kernel）：零迁移——改造后入口行为兼容（state.json 不存在时回退原逻辑）
- kernel 用户：kernel state.json 不被原版读取；用户按原版流程继续。`.superpowers/.gate-passed-*` 通用，Gate 进度不丢失
- kernel 用户（已完成归档）：跳过 Phase 4 直接收尾（不重跑 /opsx:archive）
- kernel 用户（中途某 Phase）：运行 `init --resume-artifacts --mode <mode>` 按已存在产物重建 state.json，随后必须 `set-name <name>`（name 从 openspec/changes/ 或 docs/superpowers/ 下 name-keyed 目录推断；多 name 残留时暂停让用户选择）（或直接走回退路径）
- 微小→中等升级路径：微小模式中途升中等 → 补 Phase 0（产生 name 与 design.md）→ `init --name <name> --mode medium`（此时 name-keyed 产物已存在，但用 init 而非 --resume-artifacts 以便 currentPhase=phase0 从头走 Gate 0/1/2 审查；微小已写的 `.gate-passed-3` 保留，升级后 phase3 由既有 token 自动跳过，phase1/2 需追溯补做）

## 验证策略

- **脚本冒烟用例**：init / set-name / status / next / reset / guard pass / guard fail / 回退路径（脚本缺失→Phase 自动检测）各跑一次；补 next 的 manual/done 分支、reset 后陈旧 token 用例（reset 后旧 `.gate-passed-<N>` 已删除、next 不再采信）、guard phase4 skip 路径用例；构造 STATE_CORRUPT 用例（写入损坏 JSON）验证回退触发与恢复指引输出
- **技能回归检查点**：入口路由（决策树→子技能分派）/ 子技能前置检查（Gate Token 依赖链拦截）/ Gate 强制执行（硬 Gate 链不可降级）仍生效

## 改造总量

| 维度 | 数量 |
|------|------|
| SKILL.md 改动 | 6 文件，净增 ~72 行（入口 +51：Decision Core +50 / 启动协议 +10/-15 / 降级标注 +3 / 环境准备 +3；5 子技能 +21） |
| 新增脚本 | 3 文件 ~270 行（state 100 + guard 120 + hook-validate-token 50） |
| 新增 refs | 2 文件 ~150 行（protocol + decision-points） |
| 新增 hooks 模板 | 1 文件 ~30 行 |
| 删除 kernel | 6 skill 目录 + `.comet/skills/` 4 旧副本 |
| **净增** | **~520 行**（270 脚本 + 150 refs + 30 hooks + ~72 SKILL.md） |

注：上表为静态足迹（新增/修改文件行数）；CLAUDE.md 同步修改不计入净增。运行期净额账目见概述（省 2 层入口加载 ≈ 219 行/流程 vs 新增入口 +51 行 + refs ~150 行随入口加载 ≈ +201 行，净额 ≈ 省 18 行/流程；scripts/ 与 refs/ 的实际加载行为需实施前实证）。
