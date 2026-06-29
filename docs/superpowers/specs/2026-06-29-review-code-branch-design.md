# specpowers-review 代码审查分支判定逻辑优化

## 概述

将 specpowers-review 的代码类型审查分支从当前的 2 路径（加强审查/UltraReview）+ 微小任务跳过，改为 2 路径级联判定，引入文件数和修改行数的组合条件作为阈值，并在 UltraReview 中补齐对齐审查维度。

**核心变化**：
- 最小变更不再跳过审查，至少走加强审查
- 阈值从单纯文件数变为文件数+行数组合条件
- UltraReview 新增对齐审查维度（COVERED/MISSING/DRIFT 对照），补齐原 spec-compliance 的结构化检查

## 目标逻辑

级联判定（按顺序评估，命中即停止）：

| 条件 | 文件数 | 修改总行数 | 审查类型 | 说明 |
|------|--------|-----------|---------|------|
| 条件 1 | ≤2 | ≤200 | 加强审查 | specpowers-apply code-review + specpowers-review 对齐Agent单审 |
| 条件 2 | 其他 | 其他 | UltraReview + 对齐审查 | 6-agent 团队审查 + 多模型渐进式中的对齐Agent（COVERED/MISSING/DRIFT 对照） |

**示例**：
- 2文件 150行 → 条件1命中 → 加强审查
- 2文件 250行 → 条件1失败（行>200），条件2命中 → UltraReview + 对齐审查
- 3文件 80行 → 条件1失败（文件>2），条件2命中 → UltraReview + 对齐审查
- 10文件 1000行 → 条件1失败，条件2命中 → UltraReview + 对齐审查

**修改总行数** = `git diff --stat` additions + deletions，由 specpowers-apply 在调用 specpowers-review 前计算。

## 改动范围

| 文件 | 改动数 | 说明 |
|------|--------|------|
| `skills/specpowers-review/SKILL.md` | ~10处 | 主修改：决策树、流程图、Gate定义、章节条件、UltraReview对齐审查、分工对照表 |
| `skills/specpowers/SKILL.md` | 2处 | 路由表简化、微小任务审查列更新 |
| `skills/specpowers-apply/SKILL.md` | ~6处 | 前置检查、决策树摘要、验证0/1、code-review条件 |
| `skills/specpowers-review/refs/protocols.md` | 1处 | 标记块验证规则表阈值标签更新 |
| `README.md` | ~3处 | 旧阈值残留替换 |
| `CLAUDE.md` | ~2处 | 旧阈值残留替换 |
| `commands/specpowers.md` | ~1处 | 旧阈值残留替换 |

### 不改的文件

- `specpowers-plan/SKILL.md` — 仅涉及 Gate 0/1/2（文档类），不受影响
- `specpowers-archive/SKILL.md` — 微小任务跳过 Phase 4 的逻辑不变

## 改动 1: specpowers-review/SKILL.md

| # | 位置 | 改动内容 | 新文本 |
|---|------|---------|--------|
| 1 | L20 术语说明 | 删除"微小任务"定义行（审查层面不再有"跳过"路径） | 整行删除 |
| 2 | L26-39 审查决策树 | 重写代码分支为 2 路径级联判定 | 见下方 |
| 3 | L77-78 流程图 Gate 3 | 更新审查方式标注 | `加强审查（≤2文件且≤200行） / UltraReview+对齐审查（其他）` |
| 4 | L95 Gate 3 定义表 | 更新审查方式列，移除微小任务例外括号 | `加强审查（≤2文件且≤200行） / UltraReview+对齐审查（其他）` |
| 5 | L108 Gate 执行规则 | "每个 Gate 不可跳过（微小任务模式除外…）" → "每个 Gate 不可跳过" | `- 每个 Gate 不可跳过` |
| 6 | L112 Gate 执行规则 | 删除"微小任务模式"整条 | 整条删除 |
| 7 | L118-121 Gate 执行规则 | 原"代码<10文件时"条目改为新条件 | 见下方 |
| 8 | L125-127 UltraReview 章节 | 标题和适用条件改为"其他情况"，新增对齐审查维度 | 见下方 |
| 9 | L188-197 加强审查章节 | 标题和条件改为"≤2文件且≤200行" | `## 加强审查（代码类，≤2 文件且 ≤200 行）` |
| 10 | L392-399 分工对照表 | 审查对象列更新，Agent 数量 5→6 | UltraReview 列审查对象改为"大规模代码（其他情况）" |
| 11 | L577 Gate 触发协议汇总表 Gate 3 行 | 审查方式列同步更新 | `加强审查（≤2文件且≤200行） / UltraReview+对齐审查（其他）` |

### 决策树代码分支（改动 2 的新文本）

```text
└── 代码类（实现代码 / 项目结构 / 构建配置 / 项目创建或变更）
    ├── 条件判定（级联，按顺序评估）：
    │   ├── 条件 1：文件数 ≤ 2 且 修改总行数 ≤ 200 → 加强审查
    │   │   （详见下方"加强审查（代码类，≤2 文件且 ≤200 行）"节）
    │   └── 条件 2：其他情况 → UltraReview + 对齐审查
    │       （6-agent 团队审查 + 多模型渐进式中的对齐Agent COVERED/MISSING/DRIFT 对照）
    └── 用户可手动切换审查路径
```

> 注：`修改总行数` = `git diff --stat` 的 additions + deletions，由调用方（specpowers-apply）在调用 specpowers-review 前计算（`<base>` = `git merge-base main HEAD`）并传入。

### Gate 执行规则代码分支（改动 7 的新文本）

```
- **加强审查（代码 ≤2 文件且 ≤200 行）时**：Gate 3 拆分为两部分：
  1. specpowers-apply 的 code-review（通过标准：无 P0 问题）
  2. specpowers-review 的对齐 Agent 单 Agent 审查（对齐检查，通过标准：无 MISSING 或 DRIFT 标记为 P0 的项）
  两者均通过方可进入 Phase 4。
- **UltraReview + 对齐审查（其他情况）时**：执行完整 Gate 3 UltraReview（6-agent 团队审查），并在审查维度中新增对齐审查 Agent，执行 COVERED/MISSING/DRIFT 对照（同多模型渐进式审查中的对齐 Agent 对照方法）。
```

### UltraReview 章节（改动 8 的新文本）

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

### 加强审查章节（改动 9）

标题和条件更新，机制不变。

## 改动 2: specpowers/SKILL.md

| # | 位置 | 改动内容 |
|---|------|---------|
| 1 | L110 阶段路由表审查行 | 简化为"代码类（由 specpowers-review 内部按文件数+行数自动判定）或 文档类 或 用户手动触发" |
| 2 | L126 各模式映射表 | 微小任务审查列从"跳过"改为"→ specpowers-review 内部判定" |

## 改动 3: specpowers-apply/SKILL.md

| # | 位置 | 改动内容 |
|---|------|---------|
| 1 | L12 前置检查 item 4 | 整句替换为："如当前模式为微小任务，仍须加载 specpowers-review 执行 Gate 3 审查（走 specpowers-review 内部级联判定路径）。" |
| 2 | L43-46 Gate 3 决策树摘要 | 审查类型由 specpowers-review 内部决策树按级联条件自动判定（命中即停止）：<br>- 条件 1：文件数 ≤ 2 且修改总行数 ≤ 200 → 加强审查（code-review 由本技能执行 + 对齐检查由 specpowers-review 对齐 Agent 单 Agent 执行）<br>- 条件 2：其他情况 → UltraReview + 对齐审查（specpowers-review 的 6-agent 团队审查） |
| 3 | L52-56 验证 0 | 移除 `mode === "tiny" → 跳过全部验证`，所有模式均继续验证 |
| 4 | L58-64 验证 1 | STEP 标记预期更新为新条件 |
| 5 | L75-77 code-review 章节 | 条件从"<10文件"改为"≤2文件且≤200行" |
| 6 | Gate 3 入口前（新增） | 新增步骤：执行 `git diff --stat $(git merge-base main HEAD)..HEAD` 计算 additions + deletions 作为修改总行数，传入审查决策 | — |

### 验证 1 新文本（改动 4）

```
- 加强审查（≤2 文件且 ≤200 行）: STEP1, STEP2
- UltraReview + 对齐审查（其他情况）: STEP1, STEP2, STEP3, STEP4, STEP5
```

## 改动 4: refs/protocols.md

标记块验证规则表 Gate 3 部分，现有行阈值标签同步更新：

```
| Gate 3（加强审查, ≤2 文件且 ≤200 行） | STEP1(...), STEP2(...) |
| Gate 3（UltraReview+对齐审查, 其他情况） | STEP1, STEP2, STEP3, STEP4, STEP5 |
```

## 改动 5: README.md / CLAUDE.md / commands/specpowers.md

旧阈值（`≥10 文件`、`<10 文件`）全部替换为新阈值描述。

### README.md

| # | 旧文本 | 新文本 |
|---|--------|--------|
| 1 | `UltraReview（代码 ≥10 文件）` | `UltraReview + 对齐审查（其他情况）` |
| 2 | `<10 文件 → 加强审查` | `≤2 文件且 ≤200 行 → 加强审查` |
| 3 | `≥10 文件 → UltraReview (5 Agent 团队)` / `加强审查 (code-review + 对齐 Agent 单审)` | `其他情况 → UltraReview + 对齐审查 (6 Agent 团队)` / `≤2 文件且 ≤200 行 → 加强审查 (code-review + 对齐 Agent 单审)` |

### CLAUDE.md

| # | 旧文本 | 新文本 |
|---|--------|--------|
| 1 | `代码≥10文件→UltraReview，<10文件→加强审查` | `代码类由 specpowers-review 内部按文件数+行数级联判定` |
| 2 | `代码类≥10文件→UltraReview，<10文件→加强审查` | `代码类由 specpowers-review 内部按文件数+行数级联判定` |

### commands/specpowers.md

| # | 旧文本 | 新文本 |
|---|--------|--------|
| 1 | `UltraReview for code ≥10 files` | `UltraReview + 对齐审查 for code（级联条件 2）` |

## 关键设计决策

1. **Why 2 路径而非 3 路径**：多模型渐进式审查用于代码增加复杂度但增量价值有限——其 3-agent 结构与 UltraReview 的 5-agent 团队有重叠（对齐检查维度）。将对齐审查直接合并入 UltraReview，减少审查类型但补齐对照能力。
2. **Why ≤2 文件且 ≤200 行**：(2, 200) 覆盖典型的单文件/两文件局部修改，放宽行数从 100 到 200 确保中等规模的单文件修改也能走轻量审查。
3. **Why 边界跳变可接受**：条件 1 和条件 2 之间没有中间梯度。2文件201行或3文件80行的变更直接进入 6-agent 审查。理由：(a) 超过 200 行的单文件变更通常涉及重构级修改，单 Agent 不足以覆盖风险；(b) 超过 2 文件的变更需要跨文件协调，需多维度审查；(c) 增加中间梯度会增加路由复杂度，增量价值有限。
4. **Why 对齐审查合并入 UltraReview 而非独立路径**：对齐审查（COVERED/MISSING/DRIFT）是 spec-compliance 的结构化检查，与 UltraReview 中 specs-reviewer 的合规检查互补——specs-reviewer 做定性审查，对齐 Agent 做结构化逐条对照。合并后 UltraReview 覆盖 6 个维度。
5. **微小任务执行模式保留**：入口技能的微小任务定义（1-3文件, <50行）控制 Phase 0-2 是否跳过，与审查阈值独立。微小任务 Phase 3 完成后进入 specpowers-review 内部级联判定——1-2 文件走加强审查，3 文件（文件数 >2）走 UltraReview+对齐审查。

## 约束条件

- 文档类审查路径（多模型渐进式）不变
- 所有现有协议行为保持不变（双层验证、硬阻止、标记块验证、退化声明）
- 跨 Skill 的 grep 匹配模式精确格式不变
- 旧阈值（`≥10 文件`、`<10 文件`、`微小任务跳过`）全部替换，不留残留引用
- 阈值格式统一为 "≤2 文件且 ≤200 行"（带空格），跨文件 grep 搜索以此为锚点

## 验证方法

1. 通读修改后的审查决策树，确认 2 路径级联逻辑正确
2. `grep` 搜索 `>=10.*文件\|<10.*文件\|微小任务.*跳过\|微小任务模式` 确认无残留旧引用
3. 确认验证 1 的 STEP 标记预期与各审查类型匹配
4. 确认各模式映射表审查列不再有"跳过"
