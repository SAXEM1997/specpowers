# specpowers-design 拆分子技能 + Review Gate 原始发现数判断 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建 specpowers-design 子技能（提取 Phase 0+1），缩窄 specpowers-plan 为 Phase 2 only，更新入口路由和审查收敛逻辑为基于原始发现数判断。

**Architecture:** 7 个任务（6 个实现 + 1 个全局验证），按依赖顺序：需求 1（Task 1→2→3，技能拆分+路由更新）与需求 2（Task 4→5，审查逻辑+账本结构）独立，Task 6（文档更新）收尾，Task 7（全局验证+清理）。

**Tech Stack:** Markdown (SKILL.md files), git, grep

## Global Constraints

### A. 设计约束映射（来自 design.md "约束条件" 节）

- GC1: Phase 0/1 内容从 specpowers-plan 迁移到 specpowers-design 时保持原文不变（仅添加 OpenSpec 跳过路径）
- GC2: OpenSpec 跳过路径下需写入 `.superpowers/.phase1-skipped`，入口技能在 Phase 检测时读取以区分"已跳过"与"未开始"
- GC3: specpowers-plan 缩窄后所有引用处（specpowers/SKILL.md 路由表、CLAUDE.md、README.md）必须更新
- GC4: 旧格式账本兼容——缺失 `p0_raw/p1_raw/p2_raw/p3_raw` 时不使用旧 `p0/p1/p2` 伪装，回退独立判断并输出 `[DEGRADED]`
- GC5: 审查流程 Step 1-5 不变，仅 Step 5 完成后的收敛提醒逻辑变更
- GC6: 父技能 Gate 验证协议不变——双层验证读取 `[GATE_BLOCKED]` 和 `STEP<N>_EXECUTED`，不依赖账本字段

### B. 实施级补充约束

- 技能 description 不含工作流摘要（writing-skills SDO 准则）
- 跨 Skill 的 grep 匹配模式（`[GATE_BLOCKED]`、`STEP<N>_EXECUTED`）精确格式不变
- 账本字段 `p0_raw/p1_raw/p2_raw/p3_raw` 为新增字段，旧 `p0/p1/p2` 保留用于向后兼容
- GitLab Flow：在当前 master 分支操作，每 task 完成后 commit
- 任务级回滚：每个 Task 提供明确的回滚命令（`git checkout -- <file>`），失败时执行

---

### Task 1: 新建 specpowers-design/SKILL.md

> **依赖**: 无
> **回滚**: `rm skills/specpowers-design/SKILL.md`

**Files:**
- Create: `skills/specpowers-design/SKILL.md`
- Reference: `skills/specpowers-plan/SKILL.md`（Phase 0+1 内容来源）

**Interfaces:**
- Consumes: specpowers-plan SKILL.md Phase 0+1 原文（L1-L285）
- Produces: specpowers-design SKILL.md，含 Phase 0 Step 0.1-0.6 + Phase 1 Step 1.1-1.3 + OpenSpec 跳过路径 + Gate 验证协议

- [ ] **Step 1: 确认 source material 存在**

```bash
grep -c "Phase 0: brainstorming" skills/specpowers-plan/SKILL.md
grep -c "Phase 1: propose" skills/specpowers-plan/SKILL.md
grep -c "Gate 返回后验证协议" skills/specpowers-plan/SKILL.md
```
预期: 三次 grep 均返回非零行数（Phase 0/1 内容和验证协议存在于 specpowers-plan）

- [ ] **Step 2: 创建 specpowers-design/SKILL.md**

将以下内容写入 `skills/specpowers-design/SKILL.md`：

YAML frontmatter:
```yaml
---
name: specpowers-design
description: Use when the user says "brainstorm this feature", "write the design doc",
  "explore requirements", or when specpowers entry skill routes to Phase 0 or Phase 1.
---
```

正文：从 specpowers-plan SKILL.md 复制以下区段（保持原文不变）：
1. 前置检查段（L8-L12，去掉"如为复杂/大规模任务，Phase 2..." 后半句中的 specpowers-plan 特定引用）
2. Phase 0 完整内容（L15-L131）：Step 0.1-0.6
3. Phase 1 完整内容（L134-L191）：Step 1.1-1.3
4. Gate 验证协议（L250-L285）：验证 0/1/2 完整协议文本

在 Phase 1 末尾、Gate 验证协议之前，追加 **OpenSpec 跳过路径** 段：

```markdown
## OpenSpec 跳过路径

**触发条件**: 用户要求跳过 或 `openspec --version` 不可用。

**行为**:
1. 输出 `[OPENSPEC_SKIPPED] Phase 1 已跳过，design doc 将直接作为 Phase 2 输入`
2. 写入持久化标记文件 `.superpowers/.phase1-skipped`，内容为 `<name>`
3. 跳过 Phase 1 Step 1.1-1.3，不生成 openspec/changes/ 产物

specpowers-plan Phase 2 衔接时需适配此场景：无 openspec/ 产物时，只以 design doc + clarifications 为输入。
```

在 Gate 验证协议开头追加注释：
```markdown
> **Gate 验证协议迁移说明（specpowers-design 分支）**: 通用验证逻辑 + 协议定义（验证 0/1/2 三步检查流程）随 Phase 0/1 移入本技能。本技能仅保留 Gate 0/1 的特化参数行。验证 2（Gate 2）保留在 specpowers-plan 中。
```

Gate 验证协议的"各 Gate 特化参数"表中，删除 Gate 2 行（仅保留 Gate 0 和 Gate 1）。

- [ ] **Step 3: 验证新文件正确**

```bash
grep -c "Phase 0: brainstorming" skills/specpowers-design/SKILL.md
grep -c "Phase 1: propose" skills/specpowers-design/SKILL.md
grep -c "OpenSpec 跳过路径" skills/specpowers-design/SKILL.md
grep -c ".phase1-skipped" skills/specpowers-design/SKILL.md
grep -c "Gate 0" skills/specpowers-design/SKILL.md
grep -c "Gate 1" skills/specpowers-design/SKILL.md
```
预期: 每次 grep 返回非零值。Phase 0/1 原文、OpenSpec 跳过路径、Gate 0/1 均存在。

```bash
grep -c "Gate 2" skills/specpowers-design/SKILL.md
```
预期: 0（Gate 2 特化参数行保留在 specpowers-plan 中，design 不应有）

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-design/SKILL.md
git commit -m "feat: 新建 specpowers-design 子技能（Phase 0+1 提取 + OpenSpec 跳过路径）

从 specpowers-plan 提取 Phase 0 brainstorming + Phase 1 propose 完整内容，
新增 OpenSpec 跳过路径（.phase1-skipped 持久化标记），
Gate 验证协议仅保留 Gate 0/1。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

> **注意**: Task 1 完成后 specpowers-design 名称已就位。Task 4 Step 2b/2c 引用此名称。

---

### Task 2: 缩窄 specpowers-plan/SKILL.md 为 Phase 2 only

> **依赖**: Task 1（Phase 0/1 内容已迁移到 specpowers-design）
> **回滚**: `git checkout -- skills/specpowers-plan/SKILL.md`

**Files:**
- Modify: `skills/specpowers-plan/SKILL.md`

**Interfaces:**
- Consumes: Task 1 完成后的 specpowers-design SKILL.md
- Produces: specpowers-plan SKILL.md 仅含 Phase 2 衔接 + Gate 2 验证

- [ ] **Step 1: 确认旧内容仍存在**

```bash
grep -c "Phase 0: brainstorming" skills/specpowers-plan/SKILL.md
grep -c "Phase 1: propose" skills/specpowers-plan/SKILL.md
grep "设计+衔接阶段" skills/specpowers-plan/SKILL.md
```
预期: Phase 0/1 内容和旧标题均存在于 specpowers-plan

- [ ] **Step 2: 执行修改**

修改 `skills/specpowers-plan/SKILL.md`：

**YAML frontmatter 修改**（L3）:
```yaml
description: Use when the user says "plan the implementation", "bridge OpenSpec to
  Superpowers", or when specpowers entry skill routes to Phase 2.
```
（删除 "brainstorm this feature"、"write the design doc"、"explore the codebase"）

**标题修改**（L6）:
```markdown
# specpowers-plan: 衔接阶段
```

**前置检查修改**（L8-L12）:
删除 "如为微小任务" 句和 "如为复杂/大规模任务" 句中引用 specpowers-plan 的部分。新增产物存在性检查：
```markdown
> 3. 确认 `docs/superpowers/specs/<name>-design.md` 和 `docs/superpowers/clarifications/<name>.md` 存在（由 specpowers-design 产出）。如不存在，输出 `[PRECHECK_FAILED] Phase 0/1 产物缺失，请先运行 specpowers-design`。
> 4. 如 `openspec/changes/<name>/` 不存在，OpenSpec 已跳过——以 design doc + clarifications 作为 Phase 2 writing-plans 唯一输入。
```

**正文修改**:
- 删除 Phase 0 全部内容（从 `## Phase 0: brainstorming 前置阶段` 到 `### Step 0.6` 结束，含 Gate 0 审查调用）
- 删除 Phase 1 全部内容（从 `## Phase 1: propose` 到 `### Step 1.3` 结束，含 Gate 1 审查调用）
- 保留 Phase 2 衔接指令（`## Phase 2: 衔接阶段`）及之后所有内容
- 在衔接指令中追加 OpenSpec 跳过适配说明：
  ```markdown
  **OpenSpec 跳过场景适配**: 如 openspec/changes/<name>/ 不存在（Phase 1 已跳过），Phase 2 writing-plans 衔接时使用以下简化输入集：
  - docs/superpowers/specs/<name>-design.md
  - docs/superpowers/clarifications/<name>.md
  ```
- Gate 验证协议的"各 Gate 特化参数"表中，删除 Gate 0 和 Gate 1 行，仅保留 Gate 2 行

- [ ] **Step 3: 验证修改正确**

```bash
grep "Phase 0: brainstorming" skills/specpowers-plan/SKILL.md
```
预期: 无输出（Phase 0 已删除）

```bash
grep "Phase 1: propose" skills/specpowers-plan/SKILL.md
```
预期: 无输出（Phase 1 已删除）

```bash
grep -c "衔接阶段" skills/specpowers-plan/SKILL.md
```
预期: ≥ 2（标题 + 正文引用）

```bash
grep "brainstorm this feature" skills/specpowers-plan/SKILL.md
```
预期: 无输出（YAML description 已删除 Phase 0 触发词）

```bash
grep "specpowers-design" skills/specpowers-plan/SKILL.md
```
预期: ≥ 2（前置检查中引用 design 产出 + OpenSpec 跳过适配段）

```bash
grep -c "Gate 0\|Gate 1" skills/specpowers-plan/SKILL.md
```
预期: 0（Gate 0/1 特化参数行已删除，如果还有引用则为残留）

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-plan/SKILL.md
git commit -m "refactor: specpowers-plan 缩窄为 Phase 2 only

删除 Phase 0 brainstorming + Phase 1 propose 全部内容，
YAML description 删除 Phase 0 触发词，
新增 Phase 0/1 产物存在性前置检查和 OpenSpec 跳过场景适配，
Gate 验证协议仅保留 Gate 2。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: 更新 specpowers/SKILL.md 入口路由

> **依赖**: Task 1 + Task 2（specpowers-design 和缩窄后的 specpowers-plan 均就位）
> **回滚**: `git checkout -- skills/specpowers/SKILL.md`

**Files:**
- Modify: `skills/specpowers/SKILL.md`

**Interfaces:**
- Consumes: Task 1（specpowers-design 存在）+ Task 2（specpowers-plan 缩窄后）
- Produces: 入口技能路由表、架构声明、映射表、快速上手映射均与新架构一致

- [ ] **Step 1: 确认旧架构引用仍存在**

```bash
grep "1 入口 + 4 子技能" skills/specpowers/SKILL.md
grep "Phase 0.*specpowers-plan" skills/specpowers/SKILL.md
grep "Phase 1-2.*specpowers-plan" skills/specpowers/SKILL.md
```
预期: 三次 grep 均返回匹配（旧架构引用存在）

- [ ] **Step 2: 执行修改**

修改 `skills/specpowers/SKILL.md`：

**(a) 架构声明更新**（L33, L37，将 "4 子技能" 改为 "5 子技能"）:

L33:
```markdown
> 旧完整单体版本已删除（~2026-06-10）。当前使用拆分版本：1 入口 + 5 子技能（design/plan/apply/review/archive）。
```

L37:
```markdown
specpowers 是一个 **1 入口 + 5 子技能（覆盖 Phase 0-4）**的技能组，按 Phase 按需加载：
```

**(b) 技能组结构表**（L39-L45），在第 42 行 specpowers-plan 之上插入 specpowers-design 行：

```markdown
| **specpowers-design** | Phase 0+1 | brainstorming 前置+设计+propose 阶段 |
| **specpowers-plan** | Phase 2 | 衔接阶段 |
```
（其余行不变：specpowers "全局"，specpowers-apply "Phase 3"，specpowers-review "审查"，specpowers-archive "Phase 4"）

**(c-prime) Phase 自动检测表**（在阶段路由表之前新增）：

当前入口技能（L100-101）的"完成模式选择后，按当前 Phase 加载对应子技能"假设 Phase 已知，但跨会话恢复时 Phase 未知。在阶段路由表之前（L101 之后）插入以下产物状态检测表：

```markdown
## Phase 自动检测（跨会话恢复）

入口技能按以下产物状态自动判定当前 Phase。行按从上到下顺序求值，首次匹配即停止。

| 产物状态 | Phase 判定 | 加载技能 |
|---------|-----------|---------|
| `clarifications/` 存在，`design.md` 不存在 | Phase 0 中途 | specpowers-design |
| `.phase1-skipped` 存在 | Phase 1 已跳过 | specpowers-plan (Phase 2) |
| `clarifications/` + `design.md` 存在，`openspec/` 不存在 | Phase 0 完成 | specpowers-design |
| `openspec/changes/<name>/` 存在 | Phase 1 完成 | specpowers-plan (Phase 2) |
| `plans/<name>.md` 存在 | Phase 2 完成 | specpowers-apply (Phase 3) |
```

同步更新故障排查表（L234）的跨会话恢复点——将恢复点映射改为引用此表：`> 跨会话中断恢复：按上述 Phase 自动检测表判定当前 Phase 和应加载技能。`

**(c) 阶段路由表**（L105-L112），将当前的 Phase 0 和 Phase 1-2 两行拆为三行：

```markdown
| Phase 0 | 中等+ | specpowers-design | `Skill({skill: "specpowers-design"})` |
| Phase 1 | 中等+ | specpowers-design | `Skill({skill: "specpowers-design"})` |
| Phase 2 | 中等+ | specpowers-plan | `Skill({skill: "specpowers-plan"})` |
```
（删除原来的 "Phase 0 | 中等+ | specpowers-plan" 和 "Phase 1-2 | 中等+ | specpowers-plan"）

**(d) 快速上手映射表**（L241-L244），将 brainstorming 和 propose 行从 specpowers-plan 改为 specpowers-design：

```markdown
| brainstorming | `Skill({skill: "specpowers-design"})`（Phase 0，需求澄清+方案设计） | specpowers-design |
| propose | `Skill({skill: "specpowers-design"})`（Phase 1，格式转换+强制对照） | specpowers-design |
| Plan 审查 | 询问用户是否审查 plan（Phase 2 Gate） | specpowers-plan |
| 衔接 | "读取 openspec changes/, 用 writing-plans 拆 TDD 计划" | specpowers-plan |
```

- [ ] **Step 3: 验证修改正确**

```bash
grep "1 入口 + 5 子技能" skills/specpowers/SKILL.md
```
预期: ≥ 2 处匹配

```bash
grep "1 入口 + 4 子技能" skills/specpowers/SKILL.md
```
预期: 无输出

```bash
grep "specpowers-design" skills/specpowers/SKILL.md
```
预期: ≥ 5 处匹配（结构表 + 路由表 3 行 + 快速上手 2 行）

```bash
grep "Phase 0.*specpowers-plan" skills/specpowers/SKILL.md
```
预期: 无输出（Phase 0 不再路由到 specpowers-plan）

```bash
grep "Phase 1-2.*specpowers-plan" skills/specpowers/SKILL.md
```
预期: 无输出（Phase 1-2 合并行已拆分）

同时验证 Phase 自动检测表已正确插入：

```bash
grep "Phase 自动检测" skills/specpowers/SKILL.md
```
预期: ≥ 1（新表已插入）

```bash
grep ".phase1-skipped" skills/specpowers/SKILL.md
```
预期: ≥ 1（检测表含 .phase1-skipped 行）

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers/SKILL.md
git commit -m "refactor: 入口skill路由拆分——Phase 0/1→specpowers-design, Phase 2→specpowers-plan

架构声明 4→5子技能，阶段路由拆为三行，快速上手映射表+技能组结构表同步更新。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: 修改 specpowers-review/SKILL.md — 收敛逻辑 + Gate 触发表

> **依赖**: 逻辑依赖 Task 1（Step 2b/2c 引用 specpowers-design 名称，建议 Task 1 先完成）。Step 2a（收敛逻辑重写，需求 2 核心变更）本身独立。
> **回滚**: `git checkout -- skills/specpowers-review/SKILL.md`

**Files:**
- Modify: `skills/specpowers-review/SKILL.md`

**Interfaces:**
- Consumes: 当前 specpowers-review SKILL.md "收敛提醒与硬阻止机制"节
- Produces: 收敛提醒改为基于原始发现数 4 条件判断 + Gate 触发协议汇总表 Gate 0/1 触发者改为 specpowers-design

- [ ] **Step 1: 确认旧内容仍存在**

```bash
grep "P0 > 0 — 硬阻止声明" skills/specpowers-review/SKILL.md
grep "P1 > 3 — 着重提醒" skills/specpowers-review/SKILL.md
grep "specpowers-plan 调用" skills/specpowers-review/SKILL.md
```
预期: 三次 grep 均匹配（旧收敛逻辑和 Gate 触发表旧调用者均存在）

- [ ] **Step 2a: 重写"收敛提醒与硬阻止机制"节**

在 `skills/specpowers-review/SKILL.md` 中定位 "## 收敛提醒与硬阻止机制" 节，将 "#### 场景 A: P0 > 0" 到 "首轮审查（无上轮数据）时..." 之间的全部场景重写为：

**保留不变**: `[GATE_BLOCKED]` 硬阻止声明（场景 A，P0>0 时的强制修复-重审循环逻辑）。此场景不受需求 2 影响——P0>0 时 Gate 本身就未通过，修复-重审循环是审查内部行为。

**新增**: 在 `[GATE_BLOCKED]` 场景之后，新增"下一轮判断"节，替代原有的场景 B/C/D：

```markdown
### 下一轮判断（基于原始发现数）

Step 5 Quick Review 通过后，依据 **本轮审查原始发现的问题数**（Step 2 汇总时记录的 `p0_raw/p1_raw/p2_raw/p3_raw`）判断是否建议下一轮审查。

4 个触发条件，**任一满足即强烈提醒进行下一轮**：

| # | 条件 | 含义 |
|---|------|------|
| 1 | p0_raw > 0 | 本轮发现阻塞性问题 |
| 2 | p1_raw ≥ 3 | 重要问题较多 |
| 3 | p0_raw + p1_raw + p2_raw ≥ 5 | 总问题数达到中等规模 |
| 4 | p0_raw + p1_raw + p2_raw + p3_raw ≥ 10 | 含风格问题总数很多 |

> 条件 1（p0_raw > 0）与 `[GATE_BLOCKED]` 硬阻止独立：P0 已全部修复后 p0_raw 仍 > 0（本轮发现过 P0），此时 Gate 已通过，但仍触发下一轮建议。

#### 场景 A（触发条件）— 强烈提醒

```markdown
> **审查下一轮提醒**
>
> 本轮原始发现 P0: N 个, P1: Y 个, P2: Z 个, P3: W 个。
>
> ⚠️ **触发条件：<编号+描述>**（触发即强烈建议下一轮）
> 本轮审查原始发现的问题数已达到需要额外审查的级别，即使当前问题已全部修复，仍建议启动下一轮审查，避免修复引入的回归问题、高复杂度变更中的隐藏缺陷、审查盲区的累积。
>
> **上轮对比**（如适用）：
> - 上轮原始发现 → 本轮原始发现（P0/P1/P2/P3）
> - 趋势：收敛中 ↗ / 持平 → / 恶化 ↘
>
> 请确认：是否进行下一轮审查？
>
> **[DEGRADED] 模式**（旧格式账本）：不展示上轮对比段，仅展示当轮原始发现数 + "旧格式账本缺少原始发现数，回退独立判断"。
```

> **优先级规则**：多条件同时触发时，按条件编号升序显示（1 > 2 > 3 > 4），列出所有触发条件的编号和描述。

#### 场景 B（不触发）— 轻量提醒

```markdown
> **审查收敛提醒**
>
> 本轮原始发现 P0: 0, P1: Y, P2: Z, P3: W，未触发下一轮审查阈值，趋于收敛。是否继续下一轮审查？
```
```

删除原有场景 B（P1 > 3 着重提醒）、场景 C（中等提醒）、场景 D（轻量提醒）、硬阻止与着重提醒的区分表、趋势判定标准、首轮审查判断规则（这些逻辑已整合入新格式）。

- [ ] **Step 2b: 更新 Gate 触发协议汇总表**

定位 Gate 触发协议汇总表（"| **Gate 0** | Phase 0 用户审批通过后 | ..."），将 Gate 0 和 Gate 1 的触发者列从"specpowers-plan 调用"改为"specpowers-design 调用"：

```markdown
| **Gate 0** | Phase 0 用户审批通过后 | specpowers-design 调用 | `design.md` | `clarifications/<name>.md` | 多模型渐进式 | 无 P0 |
| **Gate 1** | Phase 1 用户审核通过后 | specpowers-design 调用 | proposal/design/specs/tasks | Phase 0 design + clarifications | 多模型渐进式 | 无 P0 |
```

Gate 2 触发者保持 "specpowers-plan 调用" 不变。

- [ ] **Step 2c: 更新 L411 独立调用自检注释**

定位 "当 specpowers-review 被用户直接调用（非通过 specpowers-plan/apply 的 Gate 路由）时"，改为：

```markdown
当 specpowers-review 被用户直接调用（非通过 specpowers-design/plan/apply/archive 的 Gate 路由）时
```

- [ ] **Step 3: 验证修改正确**

```bash
grep "p0_raw.*p1_raw" skills/specpowers-review/SKILL.md
```
预期: ≥ 2 处匹配（新收敛提醒场景 A 模板 + 场景 B 模板中各一次）

```bash
grep "原始发现" skills/specpowers-review/SKILL.md
```
预期: ≥ 3 处匹配（场景 A + 场景 B + 判断逻辑说明）

```bash
grep "P1 > 3 — 着重提醒\|P1 ≤ 3, 较上轮有新增 P1\|较上轮无新增 P1" skills/specpowers-review/SKILL.md
```
预期: 无输出（旧场景 B/C/D 已删除）

```bash
grep "specpowers-design 调用" skills/specpowers-review/SKILL.md
```
预期: ≥ 2 处匹配（Gate 0 + Gate 1 触发者列）

```bash
grep "specpowers-plan 调用" skills/specpowers-review/SKILL.md
```
预期: ≥ 1 处（Gate 2 触发者保持 specpowers-plan）

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-review/SKILL.md
git commit -m "refactor: 收敛提醒改为基于原始发现数4条件判断 + Gate触发表同步

收敛提醒节重写：判断源从修复后剩余数改为Step 2记录的原始发现数(p0-3_raw)，
4条件(P0>0/P1≥3/总≥5/含P3≥10)任一触发即强烈提醒，含[DEGRADED]旧格式降级分支。
Gate触发协议汇总表Gate 0/1触发者→specpowers-design，L411自检追加archive。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: 修改 protocols.md — 账本结构 + 读写时机表

> **依赖**: Task 4（审查 SKILL.md 已更新，protocols.md 需同步）
> **回滚**: `git checkout -- skills/specpowers-review/refs/protocols.md`

**Files:**
- Modify: `skills/specpowers-review/refs/protocols.md`

**Interfaces:**
- Consumes: Task 4 完成后的 specpowers-review SKILL.md
- Produces: protocols.md 账本结构新增 p0-3_raw + p3 字段，读写时机表新增 Step 2 行

- [ ] **Step 1: 确认旧结构仍存在**

```bash
grep '"p0": 0' skills/specpowers-review/refs/protocols.md
grep "每轮审查 Step 5 完成后" skills/specpowers-review/refs/protocols.md
```
预期: 两次 grep 均匹配（旧账本结构和读写时机存在）

- [ ] **Step 2: 执行修改**

修改 `skills/specpowers-review/refs/protocols.md`：

**(a) 账本结构更新**（rounds 数组元素新增字段）:

将 rounds 数组中的条目结构从：
```
"round": 1,
"p0": 0,
"p1": 0,
"p2": 0,
```
改为：
```
"round": 1,
"p0": 0,            // 保留：修复后剩余 P0（向后兼容）
"p1": 0,            // 保留
"p2": 0,            // 保留
"p0_raw": 1,        // 新增：原始发现 P0（Step 2 汇总时记录）
"p1_raw": 4,        // 新增：原始发现 P1
"p2_raw": 3,        // 新增：原始发现 P2
"p3_raw": 2,        // 新增：原始发现 P3
```

**(b) 读写时机表更新**:

修改 `写入 rounds` 行——时机从 Step 5 改为 Step 2，描述改为 `写入 rounds（原始发现数）`：

```markdown
| 写入 rounds（原始发现数） | 每轮审查 Step 2 汇总完成后 | 主 Agent |
```

`写入 lessons_learned | 每轮审查 Step 5 完成后 | 主 Agent` 行已存在（L43），保持不变。

**(c) 向后兼容说明**:

在读写时机表下方追加：
```markdown
> **向后兼容**: 旧格式账本仅有 p0/p1/p2（修复后剩余数），缺失 _raw 后缀字段。
> 读取旧格式时，该轮数据视为不可用（unknown），不参与收敛判断条件计算，
> 改用当轮数据做独立判断，输出 `[DEGRADED] 旧格式账本缺少原始发现数，回退独立判断`。
```

- [ ] **Step 3: 验证修改正确**

```bash
grep "p0_raw" skills/specpowers-review/refs/protocols.md
```
预期: ≥ 2 处匹配（账本结构 + 向后兼容说明）

```bash
grep "p3_raw" skills/specpowers-review/refs/protocols.md
```
预期: ≥ 1 处匹配

```bash
grep "Step 2 汇总完成后" skills/specpowers-review/refs/protocols.md
```
预期: ≥ 1 处匹配（读写时机表新增行）

```bash
grep "写入 lessons_learned" skills/specpowers-review/refs/protocols.md
```
预期: ≥ 1 处匹配（原行已拆分）

```bash
grep "旧格式账本" skills/specpowers-review/refs/protocols.md
```
预期: ≥ 1 处匹配（向后兼容说明）

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-review/refs/protocols.md
git commit -m "feat: 账本结构新增原始发现数字段 + 读写时机表拆分

rounds新增p0_raw/p1_raw/p2_raw/p3_raw字段（Step 2写入），
兼容旧p0/p1/p2字段（保留用于向后兼容），
读写时机表拆为Step 2写入原始计数 + Step 5追加lessons_learned，
追加旧格式降级说明。

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: 更新 CLAUDE.md + README.md

> **依赖**: Task 1-5 全部完成
> **回滚**: `git checkout -- CLAUDE.md README.md`

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [ ] **Step 1: 确认旧引用仍存在**

```bash
grep "1 入口 + 4 子技能\|plan.*Phase 0.*1.*2" CLAUDE.md README.md
```
预期: 匹配（旧架构引用存在）

- [ ] **Step 2: 修改 CLAUDE.md**

**(a) 技能组架构 ASCII 树**（L14-L18）：

将：
```
├── specpowers-plan   (Phase 0+1+2)
```
改为：
```
├── specpowers-design (Phase 0+1)
├── specpowers-plan   (Phase 2)
```

**(b) 目录结构表**（L29-L31）：

假设已有 specpowers-plan 行，在其之上插入 specpowers-design 行：
```markdown
| `skills/specpowers-design/SKILL.md` | Phase 0+1: brainstorming + propose + Gate 0/1 |
```

并修改 specpowers-plan 行的描述：
```markdown
| `skills/specpowers-plan/SKILL.md` | Phase 2: writing-plans 衔接 + Gate 2 |
```

**(c) 关键设计决策**（L39-L42）：

如有 "1 入口 + 4 子技能" 引用，改为 "1 入口 + 5 子技能"。如有 "Phase 0+1+2" 引用 specpowers-plan，更新为与拆分后一致。

- [ ] **Step 3: 修改 README.md**

搜索并替换 README.md 中的旧架构引用：
- "1 入口 + 4 子技能" → "1 入口 + 5 子技能"
- "specpowers-plan (Phase 0+1+2)" → "specpowers-design (Phase 0+1), specpowers-plan (Phase 2)"
- 技能组架构 ASCII 图中插入 specpowers-design 行

- [ ] **Step 4: 验证修改正确**

```bash
grep "specpowers-design" CLAUDE.md README.md
```
预期: CLAUDE.md ≥ 2 处，README.md ≥ 2 处

```bash
grep "1 入口 + 4 子技能" CLAUDE.md README.md
```
预期: 无输出

```bash
grep "Phase 0+1+2.*specpowers-plan" CLAUDE.md README.md
```
预期: 无输出（旧 Phase 范围描述已更新）

- [ ] **Step 5: Commit（分文件提交）**

```bash
git add CLAUDE.md && git commit -m "docs: CLAUDE.md 同步 specpowers-design 拆分——架构树+目录表+Phase计数"
git add README.md && git commit -m "docs: README 同步 specpowers-design 拆分——技能组架构+计数更新"
```

---

### Task 7: 全局验证 + 清理

> **依赖**: Task 1-6 全部完成

- [ ] **全局 grep 确认 specpowers-design 引用完整**:

```bash
grep -rn "specpowers-design" skills/ CLAUDE.md README.md
```
预期: ≥ 15 处匹配（design SKILL.md itself + specpowers entry skill + specpowers-review + specpowers-plan + CLAUDE.md + README.md）

- [ ] **全局 grep 确认无旧架构残留**:

```bash
grep -rn "1 入口 + 4 子技能" skills/ CLAUDE.md README.md
grep -rn "Phase 0.*specpowers-plan\b" skills/
```
预期: 均无输出

- [ ] **全局 grep 确认收敛提醒新字段存在**:

```bash
grep -rn "p0_raw\|原始发现数" skills/specpowers-review/
```
预期: specpowers-review/SKILL.md ≥ 4 处 + protocols.md ≥ 4 处

- [ ] **全局 grep 确认无旧收敛阈值残留**:

```bash
grep -rn "P1 > 3\|着重提醒\|中等提醒" skills/specpowers-review/SKILL.md
```
预期: 无输出（旧场景 B/C/D 已被新逻辑替代）

- [ ] **通读关键位置**:
  - `skills/specpowers-design/SKILL.md` Phase 0/1 流程 + OpenSpec 跳过路径
  - `skills/specpowers-plan/SKILL.md` Phase 2 衔接 + 前置检查
  - `skills/specpowers/SKILL.md` 阶段路由表（三行拆分）
  - `skills/specpowers-review/SKILL.md` 收敛提醒节（4 条件 + DEGRADED 分支）

- [ ] **功能级验证（关键行为）**:

以下验证基于 grep 静态检查之上，在本地测试环境执行：

1. **specpowers-design 加载验证**: `Skill({skill: "specpowers-design"})` 能被正确加载
2. **入口路由验证**: 手动创建 `docs/superpowers/specs/<test-name>-design.md` 后，入口技能检测到产物并正确判定 Phase
3. **跨技能过渡验证**: design doc + clarifications 存在（不含 openspec/）→ 入口技能路由到 specpowers-design（非 specpowers-plan）
4. **跨会话恢复验证**: 手动写入 `.superpowers/.phase1-skipped`（内容 `<test-name>`）→ 入口技能识别 Phase 1 已跳过 → 路由到 specpowers-plan Phase 2

grep 静态验证由 Task 1-6 的 Step 3 覆盖。以上 4 项为功能级行为验证，在 Task 1-6 全部完成后、Task 7 全局 grep 之前执行。

- [ ] **Commit（如有遗漏修复）**:

```bash
git add -A && git commit -m "chore: 全局验证 + 残留清理"
```

- [ ] **Push**:

```bash
git push origin HEAD
```
