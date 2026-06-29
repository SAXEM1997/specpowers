# 代码审查分支判定逻辑优化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 specpowers-review 代码类审查分支从旧的"微小跳过 / <10加强 / ≥10UltraReview"改为级联判定(≤2且≤200→加强 / 其他→UltraReview+对齐)，同步更新入口 skill、apply skill、协议文件和 3 个入口文档。

**Architecture:** 7 个文件修改，按依赖顺序执行：先改核心审查 skill（specpowers-review），再改调用方（specpowers-apply + specpowers），最后改辅助文件（protocols + 入口文档）。

**Tech Stack:** Markdown (SKILL.md files), git, grep

## Global Constraints

- 所有现有协议行为保持不变（双层验证、硬阻止、标记块验证、退化声明）
- 跨 Skill 的 grep 匹配模式（`[GATE_BLOCKED]`、`STEP<N>_EXECUTED`）精确格式不变
- 旧阈值（`>=10 文件`、`<10 文件`、`微小任务跳过`）全部替换，不留残留引用
- 修改后每个文件独立验证：grep 确认无旧阈值残留 + 通读确认逻辑自洽
- 阈值格式统一为 `≤2 文件且 ≤200 行`（带空格）
- GitLab Flow：在当前 feature 分支操作，每 task 完成后 commit
- 每个 Task 执行前创建临时保存点。Task 执行中任一步骤失败：执行 `git checkout -- <file>` 回滚该 Task 的所有文件，修复计划后重试。

---

### Task 1: 修改 specpowers-review/SKILL.md — 核心审查决策逻辑

> **回滚**: 若任一步骤失败，执行 `git checkout -- skills/specpowers-review/SKILL.md` 恢复原始状态后重试。

**Files:**
- Modify: `skills/specpowers-review/SKILL.md`

**Interfaces:**
- Consumes: 当前 SKILL.md（579 行），设计文档改动 1 表
- Produces: 更新后的 SKILL.md，审查决策树改为 2 路径级联判定

#### 改动清单（按行号升序，共 11 处）

**#1 L20 — 删除微小任务定义行**

- [ ] 搜索 `**微小任务**：变更文件数`，删除整行

**#2 L26-39 — 重写审查决策树代码分支**

查找以 `审查对象类型?` 开头、以 `└── 用户可手动切换审查路径` 结尾的代码块，替换代码分支为：

```text
审查对象类型?
├── 文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）
│   └── 多模型渐进式审查（默认，通用）
│       用户可手动选择其他审查方式（UltraReview / 加强审查）
│
└── 代码类（实现代码 / 项目结构 / 构建配置 / 项目创建或变更）
    ├── 条件判定（级联，按顺序评估）：
    │   ├── 条件 1：文件数 ≤ 2 且 修改总行数 ≤ 200 → 加强审查
    │   │   （详见下方"加强审查（代码类，≤2 文件且 ≤200 行）"节）
    │   └── 条件 2：其他情况 → UltraReview + 对齐审查
    │       （6-agent 团队审查 + 多模型渐进式中的对齐Agent COVERED/MISSING/DRIFT 对照）
    └── 用户可手动切换审查路径
```

决策树后追加注释：
```
> 注：`修改总行数` = `git diff --stat` 的 additions + deletions，由调用方（specpowers-apply）在调用 specpowers-review 前计算（`<base>` = `git merge-base main HEAD`）并传入。
```

**#3 L77-78 — 流程图 Gate 3 审查方式标注**

> 注意区分：流程图（L77-78，跨行 ASCII art）和 Gate 定义表（L95，内联 Markdown 表格）。目标为流程图位置。搜索锚文本：`审查方式:\n                                                                     UltraReview`（跨行匹配）。

搜索 `审查方式:` 后紧跟 `UltraReview(≥10文件)` 的行，替换为：
```
                                                                    审查方式:
                                                                    加强审查（≤2文件且≤200行）
                                                                    / UltraReview+对齐审查（其他）
```

**#4 L95 — Gate 3 定义表审查方式列**

搜索 `UltraReview(≥10 文件) / 加强审查(<10 文件)（微小任务模式不走此 Gate，见执行规则）`，替换为：
```
| **Gate 3** | Phase 3 代码实现完成后 | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | 加强审查（≤2文件且≤200行） / UltraReview+对齐审查（其他） |
```

**#5 L108 — 移除微小任务例外**

搜索 `每个 Gate 不可跳过（微小任务模式除外`，替换整行为：
```
- 每个 Gate 不可跳过
```

**#6 L112 — 删除微小任务模式条目**

搜索 `**微小任务模式**：不触发 specpowers-review，Gate 0/1/2/3/4 全部跳过`，删除整条。

**#7 L118-121 — Gate 执行规则代码分支**

搜索 `**代码 <10 文件时**：Gate 3 拆分为两部分`，将整个条目（含两个子项和末尾"两者均通过方可进入 Phase 4"）替换为：
```
- **加强审查（代码 ≤2 文件且 ≤200 行）时**：Gate 3 拆分为两部分：
  1. specpowers-apply 的 code-review（通过标准：无 P0 问题）
  2. specpowers-review 的对齐 Agent 单 Agent 审查（对齐检查，通过标准：无 MISSING 或 DRIFT 标记为 P0 的项）
  两者均通过方可进入 Phase 4。
- **UltraReview + 对齐审查（其他情况）时**：执行完整 Gate 3 UltraReview（6-agent 团队审查），并在审查维度中新增对齐审查 Agent，执行 COVERED/MISSING/DRIFT 对照（同多模型渐进式审查中的对齐 Agent 对照方法）。
```

**#8 L125-127 — UltraReview 章节标题和条件**

搜索 `## UltraReview（代码类，≥10 文件）`，将整个章节头替换为：

删除范围：从 `## UltraReview（代码类，≥10 文件）` 开始，到 `### 审查规则` 之前的空行结束（含 `**适用条件**` 行、`### 创建审查团队` 子节及该子节下的旧 5-agent 表格）。
保留：`### 审查规则` 及之后所有内容不变。

```
## UltraReview + 对齐审查（代码类，其他情况）

**适用条件**：代码类 + 不满足条件 1（即文件数 > 2 或修改总行数 > 200）。

### 创建审查团队

除现有 5 个审查 Agent 外，新增第 6 个维度——对齐审查 Agent：

| 维度 | prompt 要点 |
|------|-----------|
| build-reviewer | 检查构建系统配置正确性 |
| code-reviewer | 检查源码修改、编码、include 路径 |
| specs-reviewer | 逐条对照 OpenSpec specs/ 检查合规性 |
| docs-reviewer | 检查文档和记忆一致性 |
| deps-reviewer | 检查依赖路径和库命名 |
| **对齐审查 Agent**（新增） | 逐条对照 plan + specs + design，输出 COVERED/MISSING/DRIFT 对照表 |

对齐审查 Agent 的对照方法复用多模型渐进式审查中"对齐 Agent 对照方法"协议（逐条提取→逐一查找→输出对照表）。COVERED=需求点有对应且语义一致；MISSING=完全无对应（P1）；DRIFT=有对应但语义偏离（P0）。

> **STEP 兼容性说明**: 对齐审查 Agent 在 Step A 与其他 5 个审查 Agent 并行启动，产出在 Step B-C 中与其他报告一同去重合并，不产生独立 STEP 标记块。STEP 标记块体系（STEP1-STEP5）不变，STEP1_EXECUTED 的 agents 列表从 5 个扩展为 6 个。

> **术语说明**: 加强审查中的"对齐 Agent 单审"与 UltraReview 中的"对齐审查 Agent"为同一审查维度，区别仅在于部署模式——加强审查中作为独立 Agent 产出 STEP1/STEP2 标记块，UltraReview 中作为 6-agent 团队成员在 Step A 并行产出、融入 Step B-C 去重合并。
```

注意：保留原来 `### 审查规则` 及之后的所有内容不变。

**#9 L188-197 — 加强审查章节标题和条件**

搜索 `## 加强审查（代码类，<10 文件）`，替换标题为：
```
## 加强审查（代码类，≤2 文件且 ≤200 行）
```

搜索正文首句 `代码变更 <10 文件时，Gate 3 不启动 5-agent 团队`，替换为：
```
代码变更满足文件数 ≤ 2 且修改总行数 ≤ 200 时，Gate 3 不启动 6-agent 团队，而是由 specpowers-review 构造对齐 Agent 单 Agent 审查：
```

**#10 L392-399 — 分工对照表**

搜索 `| 审查对象 | 文档（设计/规范/计划等） | 代码实现/项目结构/构建配置 |`，替换为：
```
| 审查对象 | 文档（设计/规范/计划等） | 大规模代码（其他情况） |
```

搜索 `| Agent 数量 | 3 | 5 |`，替换为：
```
| Agent 数量 | 3 | 6 |
```

搜索 `| 对齐检查 | 对齐 Agent 专门负责 | 由 specs-reviewer Agent 承担 |`，替换为：
```
| 对齐检查 | 对齐 Agent 专门负责 | 对齐审查 Agent 专门负责（COVERED/MISSING/DRIFT 对照） |
```

**#11 L577 — Gate 触发协议汇总表 Gate 3 行**

搜索 `| **Gate 3** | Phase 3 代码实现完成后 | specpowers-apply 调用 | 代码变更 |`，替换该行审查方式列为：
```
| **Gate 3** | Phase 3 代码实现完成后 | specpowers-apply 调用 | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | 加强审查（≤2文件且≤200行） / UltraReview+对齐审查（其他） | 无 P0 |
```

#### 验证步骤

- [ ] `grep -n ">=10.*文件\|<10.*文件\|微小任务模式\|微小任务.*跳过\|≥10 文件" skills/specpowers-review/SKILL.md` — 预期：0 结果
- [ ] `grep -n "≤2 文件且 ≤200 行\|≤2文件且≤200行\|UltraReview + 对齐审查\|UltraReview+对齐审查" skills/specpowers-review/SKILL.md` — 预期：至少有 10 处匹配
- [ ] 通读审查决策树（L26-39），确认 2 路径逻辑正确
- [ ] 通读 UltraReview 章节，确认对齐审查 Agent 描述完整

- [ ] Commit:
```bash
git add skills/specpowers-review/SKILL.md
git commit -m "refactor: 代码审查分支改为2路径级联判定 + UltraReview补齐对齐审查"
```

---

### Task 2: 修改 specpowers/SKILL.md — 入口技能路由

**Files:**
- Modify: `skills/specpowers/SKILL.md`

**Interfaces:**
- Consumes: Task 1 完成后的 specpowers-review SKILL.md
- Produces: 路由表和映射表与新审查逻辑一致

**#1 L110 — 阶段路由表审查行**

搜索 `代码（≥10 文件触发 UltraReview，<10 文件由 specpowers-apply 加载`，替换为：
```
| 审查 | 代码类（由 specpowers-review 内部按文件数+行数自动判定）或 文档类 或 用户手动触发 | specpowers-review | `Skill({skill: "specpowers-review"})` |
```

**#2 L126 — 各模式映射表，微小任务审查列**

搜索 `| **微小** | 轻量上下文探索 | 跳过 | 跳过 | 子代理直接执行 | 跳过 | 跳过 |`，替换为：
```
| **微小** | 轻量上下文探索 | 跳过 | 跳过 | 子代理直接执行 | 跳过 | → specpowers-review 内部判定 |
```

#### 验证步骤

- [ ] `grep ">=10.*文件\|<10.*文件" skills/specpowers/SKILL.md` — 预期：0 结果
- [ ] 确认映射表微小行审查列不再为"跳过"

- [ ] Commit:
```bash
git add skills/specpowers/SKILL.md
git commit -m "refactor: 入口skill路由表和映射表同步新审查阈值"
```

---

### Task 3: 修改 specpowers-apply/SKILL.md — 应用技能 Gate 3

**Files:**
- Modify: `skills/specpowers-apply/SKILL.md`

**Interfaces:**
- Consumes: Task 1 完成后的 specpowers-review SKILL.md
- Produces: Gate 3 入口与新审查逻辑一致，含行数计算步骤

**#1 L12 — 前置检查 item 4**

搜索 `如当前模式为微小任务，跳过 specpowers-review Gate 体系`，将整个 item 4 替换为：
```
> 4. 如当前模式为微小任务，仍须加载 specpowers-review 执行 Gate 3 审查（走 specpowers-review 内部级联判定路径）。
```

**#2 L43-46 — Gate 3 决策树摘要**

搜索 `审查类型由 specpowers-review 内部决策树自动判定：`，将后续 3 行替换为：
```
审查类型由 specpowers-review 内部决策树按级联条件自动判定（命中即停止）：
- 条件 1：文件数 ≤ 2 且修改总行数 ≤ 200 → 加强审查（code-review 由本技能执行 + 对齐检查由 specpowers-review 对齐 Agent 单 Agent 执行）
- 条件 2：其他情况 → UltraReview + 对齐审查（specpowers-review 的 6-agent 团队审查）
```

**#3 L52-56 — 验证 0**

搜索 `mode === "tiny" → 跳过全部验证`，删除该行。修改后验证 0 为：
```
**验证 0 — 执行模式检查**:
读取会话上下文中的 `Plan: <mode>`:
- 所有模式均继续验证 1 + 验证 2
降级: 若 Plan mode 不存在，输出 `[WARNING] Plan mode 未设置` 后继续完整验证。
```

**#4 L58-64 — 验证 1 STEP 标记预期**

搜索 `UltraReview (≥10 文件): STEP1, STEP2, STEP3, STEP4, STEP5` 和 `加强审查 (<10 文件): STEP1, STEP2`，替换为：
```
- 加强审查（≤2 文件且 ≤200 行）: STEP1, STEP2
- UltraReview + 对齐审查（其他情况）: STEP1, STEP2, STEP3, STEP4, STEP5
```

**#5 L75-77 — code-review 章节条件**

搜索 `加强审查路径（代码 <10 文件）中，code-review 由本技能执行`，替换为：
```
加强审查路径（代码 ≤2 文件且 ≤200 行）中，code-review 由本技能执行：
```

**#6 Gate 3 入口前（新增）— 行数计算步骤**

在 `## 审查（Gate 3）` 节标题之后、决策树摘要之前，插入：
```
**Step 0 — 计算变更规模**:
执行以下命令获取文件数和修改总行数：
```bash
git diff --shortstat $(git merge-base main HEAD)..HEAD
```
从 `git diff --shortstat $(git merge-base main HEAD)..HEAD` 的输出提取数字。输出格式固定为 `N files changed, A insertions(+), D deletions(-)`（N/A/D 均为阿拉伯数字）。
使用命令提取：`git diff --shortstat $(git merge-base main HEAD)..HEAD | awk '{print $4+$6}'` 计算 additions + deletions。
将文件数和修改总行数传入 specpowers-review Skill 调用。
```

#### 验证步骤

- [ ] `grep ">=10.*文件\|<10.*文件\|微小任务.*跳过\|mode === \"tiny\" → 跳过" skills/specpowers-apply/SKILL.md` — 预期：0 结果
- [ ] 确认新增了 git diff --stat 计算步骤
- [ ] 确认验证 1 只有 2 行（加强审查 + UltraReview+对齐审查）

- [ ] Commit:
```bash
git add skills/specpowers-apply/SKILL.md
git commit -m "refactor: apply-skill Gate 3同步新阈值 + 新增行数计算步骤"
```

---

### Task 4: 修改 refs/protocols.md + README + CLAUDE + commands

**Files:**
- Modify: `skills/specpowers-review/refs/protocols.md`
- Modify: `README.md`
- Modify: `CLAUDE.md`
- Modify: `commands/specpowers.md`

**Interfaces:**
- Consumes: Task 1-3 完成后的所有 skill 文件
- Produces: 标记块验证规则表 + 入口文档与新阈值一致

**protocols.md — 标记块验证规则表 Gate 3 行**

搜索 `| Gate 3（UltraReview, >=10 文件）` 和 `| Gate 3（加强审查, <10 文件）`，替换为：
```
| Gate 3（加强审查, ≤2 文件且 ≤200 行） | STEP1(...), STEP2(...) |
| Gate 3（UltraReview+对齐审查, 其他情况） | STEP1, STEP2, STEP3, STEP4, STEP5 |
```

**README.md — 3 处旧阈值替换**

搜索并替换：
1. `UltraReview（代码 ≥10 文件）` → `加强审查（≤2 文件且 ≤200 行）/ UltraReview + 对齐审查（其他情况）`
2. `≥10 文件 → UltraReview (5 Agent 团队)` → `其他情况 → UltraReview + 对齐审查（6 Agent 团队）`
3. `加强审查` → `加强审查（≤2 文件且 ≤200 行, code-review + 对齐 Agent 单审）`

**CLAUDE.md — 3 处旧阈值替换**

搜索并替换：
1. `UltraReview（代码≥10文件）` → `UltraReview+对齐审查（其他情况）`（目录结构表 L31，与 L42 的内联文本是不同位置）
2. `代码类≥10文件→UltraReview，<10文件→加强审查` → `代码类由 specpowers-review 内部按文件数+行数级联判定`（内联文本 L42）

**commands/specpowers.md — 1 处旧阈值替换**

搜索并替换：
- `UltraReview for code ≥10 files` → `UltraReview + 对齐审查 for code (other cases, 级联条件 2)`

#### 验证步骤

- [ ] `grep -rn ">=10.*文件\|<10.*文件" README.md CLAUDE.md commands/specpowers.md skills/specpowers-review/refs/protocols.md` — 预期：0 结果
- [ ] 确认 protocols.md 中 Gate 3 行已更新为新阈值

- [ ] Commit（分文件提交）:
```bash
git add skills/specpowers-review/refs/protocols.md && git commit -m "docs: protocols.md标记块验证规则表同步新审查阈值"
git add README.md && git commit -m "docs: README同步新审查阈值"
git add CLAUDE.md && git commit -m "docs: CLAUDE.md同步新审查阈值"
git add commands/specpowers.md && git commit -m "docs: commands/specpowers.md同步新审查阈值"
```

---

### Task 5: 全局验证 + 清理

**Files:**
- All modified files

- [ ] **全局 grep 残留检查**:
```bash
grep -rn ">=10.*文件\|<10.*文件" skills/ README.md CLAUDE.md commands/ .claude/
```
预期：0 结果

- [ ] **全局 grep 新阈值确认**:
```bash
grep -rn "≤2.*200\|UltraReview.*对齐审查\|UltraReview+对齐" skills/ README.md CLAUDE.md commands/
```
预期：至少在 5 个文件中有匹配

- [ ] **通读关键位置**:
  - `skills/specpowers-review/SKILL.md` 审查决策树
  - `skills/specpowers-apply/SKILL.md` Gate 3 入口（含行数计算步骤）
  - `skills/specpowers/SKILL.md` 各模式映射表

- [ ] Commit（如有遗漏修复）:
```bash
git add -A && git commit -m "chore: 全局验证 + 残留旧阈值清理"
```

- [ ] Push:
```bash
git push origin HEAD
```
