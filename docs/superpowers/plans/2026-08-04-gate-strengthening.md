# Gate 强化 + 多轮默认继续 + UltraReview 阈值修正 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 强化 specpowers 技能组的 Gate 评审强制性、多轮审查默认继续机制、UltraReview 触发阈值修正

**Architecture:** 三项独立改动——(1) Gate Token 产物依赖链（会话标记+文件后备+入口路由阻断）(2) 多轮默认继续+CONVERGENCE_CHECK 强制输出（review 内部循环+用户干预窗口）(3) UltraReview 阈值从 ≥20 降为 ≥10

**Tech Stack:** Markdown 技能文件（YAML frontmatter + Markdown 正文）

## Global Constraints

- 产物为 Markdown 技能文件，非可执行代码
- "测试" = 逐条 grep 核对跨文件标记/阈值一致性 + 场景推演验证
- YAML frontmatter 的 `name` 和 `description` 字段不可修改
- 跨技能引用（recipe 表 ↔ protocols.md ↔ 入口验证协议）必须保持一致
- 现有 STEP 标记块格式不修改（新增标记是独立标记）
- `.superpowers/.gate-passed-<N>` 文件含 `name=<任务标识符>` 字段（任务绑定）

**设计文档**：`docs/superpowers/specs/2026-08-04-gate-strengthening-design.md`

---

## File Structure

| 文件 | 职责 | 涉及改动 |
|------|------|---------|
| `skills/specpowers-review/SKILL.md` | 审查技能主文件 | 改动 1+2+3 |
| `skills/specpowers-review/refs/protocols.md` | 审查协议参考 | 改动 2+3 |
| `skills/specpowers/SKILL.md` | 入口技能 | 改动 1 |
| `skills/specpowers-design/SKILL.md` | 设计阶段 | 改动 1 |
| `skills/specpowers-plan/SKILL.md` | 衔接阶段 | 改动 1 |
| `skills/specpowers-apply/SKILL.md` | 实现阶段 | 改动 1 |
| `skills/specpowers-archive/SKILL.md` | 归档阶段 | 改动 1 |

---

## Task 1: 改动 3 — UltraReview 阈值降回 ≥10（review SKILL.md）

**Files:**
- Modify: `skills/specpowers-review/SKILL.md:59-65`（recipe 表）
- Modify: `skills/specpowers-review/SKILL.md:74`（完整层不对称说明）
- Modify: `skills/specpowers-review/SKILL.md:152-154`（UltraReview 适用条件）
- Modify: `skills/specpowers-review/SKILL.md:229`（加强审查适用条件）

**Interfaces:**
- Produces: recipe 表中代码类完整层的 bucket 分界从"中等/复杂"改为"中小(4-9)/中大(10-19)"
- protocols.md 协议 6 的 bucket_class 函数需同步修改（Task 2）

- [ ] **Step 1: 修改 recipe 表 L59-65——代码类完整层行拆分**

将：
```markdown
| **代码类（复杂/大规模 bucket）** | **UltraReview**(6 Agent: build/code/specs/docs/deps/对齐) [STEP1-5] | 同代码类（微小/中等）关键 |
```
改为：
```markdown
| **代码类（中大 10-19/复杂/大规模 bucket）** | **UltraReview**(6 Agent: build/code/specs/docs/deps/对齐) [STEP1-5] | 同代码类（微小/中小）关键 |
```

将"代码类（微小/中等 bucket）"行标注改为：
```markdown
| **代码类（微小/中小 4-9 bucket）** | **加强审查**：code-review（由 specpowers-apply 执行）+ 对齐单审 [STEP1-2] | **3 独立视角**：code-review（由 specpowers-apply 执行）+ 对齐 Agent + 监督 Agent [STEP1-5] |
```

将 bucket_class 映射注释（L65）改为：
```markdown
> bucket_class 映射（与 protocols.md 协议6 对齐）：{微小, 中等且file_count<10}→小代码（加强审查 recipe）；{中等且file_count≥10, 复杂, 大规模}→大代码（UltraReview recipe）
```

- [ ] **Step 2: 修改完整层不对称说明 L74**

将：
```
> **完整层不对称（设计意图，非遗漏）**：代码类完整层按 bucket 分——微小/中等=加强审查(STEP1-2，无监督，轻量路径，微小变更无需监督即可控)；复杂/大规模=UltraReview(STEP1-5，含 6 维度审查)。关键层统一含监督，覆盖强度高于加强审查。
```
改为：
```
> **完整层不对称（设计意图，非遗漏）**：代码类完整层按 bucket 分——微小/中小(4-9)=加强审查(STEP1-2，无监督，轻量路径，小变更无需监督即可控)；中大(10-19)/复杂/大规模=UltraReview(STEP1-5，含 6 维度审查)。关键层统一含监督，覆盖强度高于加强审查。
```

- [ ] **Step 3: 修改 UltraReview 适用条件 L154**

将：
```
**适用条件**：代码类完整层 + 复杂/大规模 bucket（文件数 ≥ 20），由 tier 路由自动判定（见上方 recipe 表）。
```
改为：
```
**适用条件**：代码类完整层 + 中大(10-19)/复杂/大规模 bucket（文件数 ≥ 10），由 tier 路由自动判定（见上方 recipe 表）。
```

同步修改 L152 节标题：
```
## UltraReview + 对齐审查（代码类 recipe，中大/复杂/大规模 bucket 完整层）
```

- [ ] **Step 4: 修改加强审查适用条件 L229**

将：
```
**适用条件**：代码类完整层 + 微小/中等 bucket（文件数 ≤ 19），由 tier 路由自动判定（见上方 recipe 表）。
```
改为：
```
**适用条件**：代码类完整层 + 微小/中小 bucket（文件数 ≤ 9），由 tier 路由自动判定（见上方 recipe 表）。
```

同步修改 L227 节标题：
```
## 加强审查（代码类 recipe，微小/中小 bucket 完整层）
```

- [ ] **Step 5: 验证一致性**

Run: `grep -n "≥ 20\|≤ 19\|微小/中等 bucket\|复杂/大规模 bucket" skills/specpowers-review/SKILL.md`
Expected: 无输出（所有旧阈值/标注已替换）

Run: `grep -n "≥ 10\|≤ 9\|中大\|中小" skills/specpowers-review/SKILL.md`
Expected: 多行匹配（新标注已到位）

- [ ] **Step 6: Commit**

```bash
git add skills/specpowers-review/SKILL.md
git commit -m "feat(review): UltraReview 阈值从≥20降为≥10——中等bucket内部按file_count分叉"
```

---

## Task 2: 改动 3 — UltraReview 阈值（protocols.md 协议 6）

**Files:**
- Modify: `skills/specpowers-review/refs/protocols.md:370`（bucket_class 函数）
- Modify: `skills/specpowers-review/refs/protocols.md:429`（典型场景验证表）

**Interfaces:**
- Consumes: Task 1 的 recipe 表 bucket 分界（中大 10-19 / 复杂/大规模 = UltraReview）
- Produces: bucket_class 函数与 recipe 表一致

- [ ] **Step 1: 修改 bucket_class 函数 L370**

将：
```text
  bucket_class = (object_type==代码) ? (bucket in {微小,中等} ? 小代码 : 大代码) : null
```
改为：
```text
  bucket_class = (object_type==代码) ? ((bucket==微小 || (bucket==中等 && file_count<10)) ? 小代码 : 大代码) : null
```

- [ ] **Step 2: 修改典型场景验证表——新增 UltraReview 场景**

在场景 6 后追加场景 6b（L429 之后）：

```markdown
| 6b | 代码类 10 文件/400 行 round1（假设 ledger 存在） | 完整（UltraReview 子路径） | 矩阵→完整，bucket=中等但 file_count≥10→bucket_class=大代码→recipe=UltraReview STEP1-5 |
```

同时修改场景 6 描述（确认 4 文件仍为加强审查）：

将：
```markdown
| 6 | 代码类 4 文件/400 行 round1（假设 ledger 存在） | 完整（加强审查子路径） | 矩阵→完整，bucket=中等→recipe=加强审查 STEP1-2 |
```
改为：
```markdown
| 6 | 代码类 4 文件/400 行 round1（假设 ledger 存在） | 完整（加强审查子路径） | 矩阵→完整，bucket=中等且file_count<10→bucket_class=小代码→recipe=加强审查 STEP1-2 |
```

- [ ] **Step 3: 验证一致性**

Run: `grep -n "bucket_class\|file_count<10\|file_count≥10" skills/specpowers-review/refs/protocols.md`
Expected: bucket_class 行含 `file_count<10` 条件

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-review/refs/protocols.md
git commit -m "feat(review): protocols协议6 bucket_class函数增加中等内部≥10分叉"
```

---

## Task 3: 改动 2 — 多轮默认继续 + CONVERGENCE_CHECK（review SKILL.md）

**Files:**
- Modify: `skills/specpowers-review/SKILL.md:530`（Step 5 末尾增加 CONVERGENCE_CHECK 强制步骤）
- Modify: `skills/specpowers-review/SKILL.md:567-594`（收敛提醒与硬阻止机制节重写）

**Interfaces:**
- Produces: `[CONVERGENCE_CHECK]` 标记格式 + 默认继续制行为 + review 内部循环逻辑
- 入口 SKILL.md 验证协议需同步增加验证 3（Task 5）

- [ ] **Step 1: 在 Step 5 末尾（L530-531 之间）增加 CONVERGENCE_CHECK 强制步骤**

在 `- Quick Review 通过后输出收敛提醒` 行之前插入：

```markdown
- **收敛判定（强制步骤，不可跳过）**: Step 5 完成后，主 Agent **必须**计算 4 个触发条件（见下方「收敛提醒与硬阻止机制」节）并输出 `[CONVERGENCE_CHECK]` 标记。**加强审查子路径**（STEP5 被裁剪）在 **STEP2 完成后**输出此标记（基于 STEP2 的 raw_count_sum 计算 p*_raw）。无论是否触发，标记必须输出——缺失 = 收敛判定被跳过 = 审查未完成，父技能验证 3 将阻塞。
```

- [ ] **Step 2: 重写「收敛提醒与硬阻止机制」节（L567-594）**

将整个节替换为：

```markdown
## 收敛提醒与硬阻止机制

### 每 Gate 审查+修复完成后输出

审查完成后，依据本轮 P0/P1 计数输出对应声明。输出模板见 `refs/protocols.md` 协议 7。

### 收敛判定（强制输出 + 默认继续制）

Step 5（加强审查子路径为 Step 2）完成后，主 Agent **必须**计算 4 个触发条件并输出 `[CONVERGENCE_CHECK]` 标记。

> **⚠️ 防偷懒硬约束**: 计算以下 4 个触发条件时，**必须**使用 Step 2 汇总时记录的原始发现问题数
> （`p0_raw`, `p1_raw`, `p2_raw`, `p3_raw`——来自会话上下文账本 `rounds[N-1].p*_raw`），
> **禁止**使用修复后剩余计数（`p0`, `p1`, `p2`——来自 `rounds[N-1].p0/p1/p2`）。
> 原始发现数反映本轮变更的真实影响面——即使所有问题已修复，大规模变更仍有隐藏风险。
> 使用修复后剩余数替代原始发现数做阈值判断，是最常见的偷懒模式之一。

4 个触发条件，**任一满足即默认继续下一轮**：

| # | 条件 | 含义 |
|---|------|------|
| 1 | p0_raw > 0 | 本轮发现阻塞性问题 |
| 2 | p1_raw ≥ 3 | 重要问题较多 |
| 3 | p0_raw + p1_raw + p2_raw ≥ 5 | 总问题数达到中等规模 |
| 4 | p0_raw + p1_raw + p2_raw + p3_raw ≥ 10 | 含风格问题总数很多 |

> 条件 1（p0_raw > 0）与 `[GATE_BLOCKED]` 硬阻止独立：P0 已全部修复后 p0_raw 仍 > 0（本轮发现过 P0），此时 Gate 已通过，但仍触发下一轮。

#### `[CONVERGENCE_CHECK]` 标记格式

```
[CONVERGENCE_CHECK] triggers=<编号列表|none>, action=<continue|exit>, p0_raw=<N>, p1_raw=<N>, p2_raw=<N>, p3_raw=<N>, exit_reason=<文本|n/a>
```

- `triggers`：满足的触发条件编号列表（如 `[1,3]`），none 表示无触发
- `action`：triggers 非空时默认 `continue`；triggers 为空时 `exit`（exit_reason=收敛达标）；用户显式终止时 `exit` + exit_reason
- `exit_reason`：仅 action=exit 时填写。用户显式终止须记录理由；无触发条件时填 `收敛达标`

**无论是否触发，此标记必须输出。** 缺失 = 收敛判定被跳过 = 审查未完成。

#### 默认继续制（action=continue 时）

触发条件满足时，**默认进入下一轮审查**——不询问"是否继续"，而是通知即将继续并提供干预窗口。

**执行主体**：review 主 Agent 在同一 Skill 调用内部自动循环——action=continue 时回到 Step 0 启动 Round 2。父技能 Gate 调用仅一次返回：
- 返回 `[GATE_PASSED]` → 循环退出（收敛达标或用户终止），Gate 通过
- 返回 `[GATE_BLOCKED]` → P0 未清零，Gate 阻塞

父技能无需理解 `[CONVERGENCE_CHECK]` 或实现循环逻辑——循环完全封装在 review 内部。

**用户交互（知情权 + 干预窗口）**：action=continue 时，review 主 Agent 在开始下一轮前向用户输出：

```
📊 Round <N> 审查完成。原始发现 P0:<N> P1:<N> P2:<N> P3:<N>。
触发条件 <编号> 满足，即将开始 Round <N+1>。
如需终止审查，请说明理由。无反馈则继续。
```

这不是"询问是否继续"（退回到原来的问题），而是"通知即将继续 + 给用户干预窗口"——默认行为是继续，用户需主动干预才能终止。

#### action=exit 时

触发条件不满足（收敛达标）或用户显式终止后，输出 action=exit + exit_reason，然后执行最终通读 Gate，通过后输出 `[GATE_PASSED]` 标记（见改动 1 Gate Token）。

> **优先级规则**：多条件同时触发时，按条件编号升序显示（1 > 2 > 3 > 4），列出所有触发条件的编号和描述。
```

- [ ] **Step 3: 验证一致性**

Run: `grep -n "CONVERGENCE_CHECK\|默认继续\|内部循环\|干预窗口" skills/specpowers-review/SKILL.md`
Expected: 多行匹配

Run: `grep -n "请确认：是否进行下一轮" skills/specpowers-review/SKILL.md`
Expected: 无输出（旧的中性询问已替换）

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-review/SKILL.md
git commit -m "feat(review): 多轮默认继续制+CONVERGENCE_CHECK强制输出+review内部循环"
```

---

## Task 4: 改动 2 — 协议 7 输出模板重写（protocols.md）

**Files:**
- Modify: `skills/specpowers-review/refs/protocols.md:435-467`（协议 7 整节）

**Interfaces:**
- Consumes: Task 3 的 CONVERGENCE_CHECK 标记格式 + 默认继续制

- [ ] **Step 1: 重写协议 7 整节**

将协议 7 节（从 `## 协议 7` 到文件末尾）替换为：

```markdown
## 协议 7: 收敛提醒与硬阻止输出模板

> 由 specpowers-review SKILL.md「收敛提醒与硬阻止机制」节引用。

**输出判定**（依据本轮原始发现数 p0_raw/p1_raw/p2_raw/p3_raw，禁止用修复后剩余数）：

| 场景 | 条件 | 输出 |
|------|------|------|
| 硬阻止 | p0 未清零（修复后仍 p0 > 0） | `[GATE_BLOCKED]` 强制语气 + 修复-重审循环 |
| 默认继续下一轮 | 下方 4 触发条件任一满足 | `[CONVERGENCE_CHECK]` action=continue + 摘要+干预窗口 |
| 收敛退出 | 以上均不满足 | `[CONVERGENCE_CHECK]` action=exit + 最终通读 → `[GATE_PASSED]` |

**下一轮 4 触发条件**（任一满足即默认继续）：① p0_raw > 0；② p1_raw ≥ 3；③ p0_raw+p1_raw+p2_raw ≥ 5；④ p0_raw+p1_raw+p2_raw+p3_raw ≥ 10。

> 条件 1（p0_raw > 0）与 `[GATE_BLOCKED]` 独立：P0 已全部修复后 p0_raw 仍 > 0（本轮发现过 P0），Gate 已通过但仍默认继续下一轮。多条件同时触发时按编号升序列出全部。

### `[CONVERGENCE_CHECK]` 标记格式

```
[CONVERGENCE_CHECK] triggers=<编号列表|none>, action=<continue|exit>, p0_raw=<N>, p1_raw=<N>, p2_raw=<N>, p3_raw=<N>, exit_reason=<文本|n/a>
```

- `triggers`：满足的触发条件编号列表（如 `[1,3]`），none 表示无触发
- `action`：triggers 非空时默认 `continue`；triggers 为空时 `exit`（exit_reason=收敛达标）；用户显式终止时 `exit` + exit_reason
- `exit_reason`：仅 action=exit 时填写。用户显式终止须记录理由；无触发条件时填 `收敛达标`

**无论是否触发，此标记必须输出。** 加强审查子路径（STEP5 被裁剪）在 STEP2 完成后输出此标记。

> **设计理由（writing-skills "Match the Form to the Failure"）**：收敛判定被跳过属于"omits a required element"——正确形式是 structural（REQUIRED field），而非 prohibition 或 prose reminder。`[CONVERGENCE_CHECK]` 是 structural form——必须输出的结构化字段，父技能验证链检查其存在性。

### 统一输出模板

```markdown
> **[GATE_BLOCKED] p0_count=<修复后剩余P0>**   ← 仅 P0 未全部修复时输出此行（p0_count=修复后剩余数，区别于下方原始发现数），否则删除
>
> 本轮原始发现 P0: <p0_raw>, P1: <p1_raw>, P2: <p2_raw>, P3: <p3_raw>（原始发现数——Step 2 汇总记录，非修复后剩余数）。
>
> [p0 未清零时] P0 未清零，审查 Gate 未通过，当前 Phase 被阻塞。specpowers-review 必须执行修复-重审循环（修复子 Agent 修 P0 → 主 Agent 逐条校验 → 重跑 Step 1-5），直到 P0 清零且 P1 总数较上轮不增加。本轮修复+重审中发现的 P1/P2 纳入累积计数。调用方将检查 [GATE_BLOCKED]，P0>0 时拒绝进入下一 Phase。
>
> [触发条件任一满足时] 
> 📊 Round <N> 审查完成。原始发现 P0:<p0_raw> P1:<p1_raw> P2:<p2_raw> P3:<p3_raw>。
> 触发条件 <编号+描述> 满足，即将开始 Round <N+1>。
> 如需终止审查，请说明理由。无反馈则继续。
>
> [触发条件均不满足时]
> 本轮原始发现问题数未达下一轮触发阈值。审查收敛，可进入最终通读。
>
> **上轮对比**（如适用）：上轮 P0:X P1:Y P2:Z P3:W → 本轮 P0:X' P1:Y' P2:Z' P3:W'，趋势：收敛中 ↗ / 持平 → / 恶化 ↘
>
> **[DEGRADED]**（旧格式账本缺少 _raw 字段）：不展示上轮对比段，仅展示当轮原始发现数 + 声明"旧格式账本缺少原始发现数，回退独立判断"。
```
```

- [ ] **Step 2: 验证一致性**

Run: `grep -n "请确认：是否进行下一轮\|轻量收敛提醒\|轻量提醒" skills/specpowers-review/refs/protocols.md`
Expected: 无输出（旧模板已替换）

Run: `grep -n "CONVERGENCE_CHECK\|默认继续\|干预窗口" skills/specpowers-review/refs/protocols.md`
Expected: 多行匹配

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers-review/refs/protocols.md
git commit -m "feat(review): protocols协议7重写——默认继续制+CONVERGENCE_CHECK格式定义"
```

---

## Task 5: 改动 1 — Gate Token 产物依赖链（review SKILL.md）

**Files:**
- Modify: `skills/specpowers-review/SKILL.md:530-534`（Step 5 末尾区域增加 GATE_PASSED + .gate-passed 文件写入说明）

**Interfaces:**
- Produces: `[GATE_PASSED]` 标记 + `.superpowers/.gate-passed-<N>` 文件写入行为
- 入口 SKILL.md 验证协议需增加验证 3（Task 6）；子技能前置检查需增加 Gate 确认行（Task 7）

- [ ] **Step 1: 在 Step 5 区域后、独立调用场景自检节之前，增加 Gate Token 输出说明**

在 L534 `Step 5 在本轮审查层面检查修复质量...` 行之后，`### 独立调用场景自检` 节之前，插入新节：

```markdown

### Gate Token 输出（Gate 通过后）

Gate 审查最终通过（收敛判定 action=exit + 最终通读 PASS）后，review 主 Agent **必须**输出 Gate Token——两层保障：

**第 1 层：会话标记**
```
[GATE_PASSED] gate=<N>, round=<N>, tier=<tier>, p0_raw=<N>, p1_raw=<N>, convergence_triggers=<编号列表|none>
```
与现有的 `[TIER_ROUTING]`、`STEP<N>_EXECUTED` 同类机制。`[GATE_PASSED]` 仅在 Gate 确实通过后输出；P0 未清零时输出 `[GATE_BLOCKED]`（现有机制不变）。

> **与 `[CONVERGENCE_CHECK]` 的时序关系**：多轮审查进行中时，每轮输出 `[CONVERGENCE_CHECK]` 但不输出 `[GATE_PASSED]`——Gate 尚未最终通过。仅在 action=exit + 最终通读 PASS 后输出 `[GATE_PASSED]`。

**第 2 层：文件标记（后备轨）**

Gate 通过后写入 `.superpowers/.gate-passed-<N>` 文件：
```
name=<任务标识符>
round=<N>
timestamp=<ISO 8601>
tier=<critical|full>
```

跨 Skill 边界、跨上下文压缩时后备。`name` 字段绑定特定任务——入口技能/子技能检查时不仅检查文件存在，还检查 `name` 与当前任务匹配，不匹配视为不存在（防止上一任务残留标记误导）。

> 此文件是 Phase 流转控制标记（语义类似 `.phase1-skipped`），非审查状态产物。
```

- [ ] **Step 2: 验证一致性**

Run: `grep -n "GATE_PASSED\|gate-passed\|Gate Token" skills/specpowers-review/SKILL.md`
Expected: 多行匹配

- [ ] **Step 3: Commit**

```bash
git add skills/specpowers-review/SKILL.md
git commit -m "feat(review): Gate Token输出——GATE_PASSED标记+gate-passed文件后备"
```

---

## Task 6: 改动 1 — 入口技能验证协议 + Phase 自动检测（入口 SKILL.md）

**Files:**
- Modify: `skills/specpowers/SKILL.md:236-257`（Gate 返回后验证协议增加验证 3）
- Modify: `skills/specpowers/SKILL.md:118-124`（Phase 自动检测表增加 Gate 维度注释）

**Interfaces:**
- Consumes: Task 5 的 `[GATE_PASSED]` 标记 + `[CONVERGENCE_CHECK]` 标记 + `.gate-passed-<N>` 文件
- Produces: 验证链增加验证 3（收敛判定完整性）+ Phase 路由增加 Gate 标记检查

- [ ] **Step 1: 在验证协议验证 2 之后增加验证 3**

在 L255 `- p0_count=0 → 通过` 行之后，空行之前，插入：

```

验证3: 收敛判定完整性
  - 搜索 [CONVERGENCE_CHECK] 标记
  - 缺失 → 视为审查未完成（收敛判定被跳过），阻塞 Phase
  - 存在且 action=exit 但 exit_reason 为空 → 阻塞（无理由终止）
  - 存在且 action=continue → 审查将继续下一轮（预期行为，Gate 调用尚未返回）
  - 存在且 action=exit 且 exit_reason 非空 → 通过
```

同步修改 L241 `验证链（按顺序执行，任一失败阻止后续）:` 为 `验证链（按顺序执行，任一失败阻止后续。验证 3 仅在 Gate 调用返回 [GATE_PASSED] 或 [GATE_BLOCKED] 时执行——action=continue 时 Gate 尚在 review 内部循环，父技能尚未收到返回）:`

- [ ] **Step 2: 修改各子技能引用示例 L257**

将：
```
> 各子技能引用示例: "按入口 Gate 返回后验证协议执行验证链（Gate=1, Phase=1）：验证0→验证1→验证2。"
```
改为：
```
> 各子技能引用示例: "按入口 Gate 返回后验证协议执行验证链（Gate=1, Phase=1）：验证0→验证1→验证2→验证3。"
```

- [ ] **Step 3: 在 Phase 自动检测表后增加 Gate 标记检查说明**

在 L126 `**微小任务不加载子技能**` 行之前，插入：

```markdown
> **Gate 标记检查（产物依赖链最终执行点）**：Phase 自动检测在匹配产物状态后，额外检查对应 Gate 的 `.gate-passed-<N>` 文件（`name=<当前任务>` 匹配）。Gate 标记缺失 → 该 Phase 判定无效，回退到上一 Phase 执行 Gate。Gate 0→检查 `.gate-passed-0`（Phase 0 完成且 Gate 0 通过才能进入 Phase 1）；Gate 1→`.gate-passed-1`（Phase 1 完成且 Gate 1 通过才能进入 Phase 2）；以此类推。微小任务跳过 Gate 0/1/2（与验证 0 一致），Gate 3 仍检查。

```

- [ ] **Step 4: 验证一致性**

Run: `grep -n "验证3\|验证 3\|CONVERGENCE_CHECK\|gate-passed\|Gate 标记检查" skills/specpowers/SKILL.md`
Expected: 多行匹配

- [ ] **Step 5: Commit**

```bash
git add skills/specpowers/SKILL.md
git commit -m "feat(specpowers): 入口验证协议增加验证3+Phase自动检测增加Gate标记检查"
```

---

## Task 7: 改动 1 — 子技能前置检查增加 Gate 确认（design/plan/apply/archive）

**Files:**
- Modify: `skills/specpowers-design/SKILL.md:9-11`（前置检查增加 Gate 0 确认）
- Modify: `skills/specpowers-plan/SKILL.md:9-13`（前置检查增加 Gate 1 确认）
- Modify: `skills/specpowers-apply/SKILL.md:8-12`（前置检查增加 Gate 2 确认）
- Modify: `skills/specpowers-archive/SKILL.md:8-11`（前置检查增加 Gate 3 确认）

**Interfaces:**
- Consumes: Task 5/6 的 Gate Token 机制（`[GATE_PASSED]` 标记 + `.gate-passed-<N>` 文件）

- [ ] **Step 1: design SKILL.md — Phase 1 入口增加 Gate 0 确认**

在 `skills/specpowers-design/SKILL.md` 前置检查块的末尾（L11 `> 2.` 之后），增加：

```markdown
> 3. **Gate 0 确认（Phase 1 入口）**：搜索会话上下文中 `[GATE_PASSED] gate=0` 标记，或检查 `.superpowers/.gate-passed-0` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 0 Gate 0 未执行，回 specpowers-design Phase 0 完成 Gate 0 后再进入 Phase 1。微小任务跳过此项（与验证 0 一致）。
```

（注意：现有 L112-113 已有 Gate 0 执行的描述，此次增加的是 Phase 1 入口的**回看检查**。需要将现有编号 `> 2.` 后追加 `> 3.`）

- [ ] **Step 2: plan SKILL.md — 入口增加 Gate 1 确认**

在 `skills/specpowers-plan/SKILL.md` 前置检查块的末尾（L13 `> 4.` 之后），增加：

```markdown
> 5. **Gate 1 确认**：搜索会话上下文中 `[GATE_PASSED] gate=1` 标记，或检查 `.superpowers/.gate-passed-1` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 1 Gate 1 未执行，回 specpowers-design Phase 1 完成 Gate 1 后再进入 Phase 2。微小任务跳过此项。
```

- [ ] **Step 3: apply SKILL.md — 入口增加 Gate 2 确认**

在 `skills/specpowers-apply/SKILL.md` 前置检查块的末尾（L12 `> 4.` 之后），增加：

```markdown
> 5. **Gate 2 确认**：搜索会话上下文中 `[GATE_PASSED] gate=2` 标记，或检查 `.superpowers/.gate-passed-2` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 2 Gate 2 未执行，回 specpowers-plan 完成 Gate 2 后再进入 Phase 3。微小任务跳过此项。
```

- [ ] **Step 4: archive SKILL.md — 入口增加 Gate 3 确认**

在 `skills/specpowers-archive/SKILL.md` 前置检查块的末尾（L11 `> 3.` 之后），增加：

```markdown
> 4. **Gate 3 确认**：搜索会话上下文中 `[GATE_PASSED] gate=3` 标记，或检查 `.superpowers/.gate-passed-3` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 3 Gate 3 未执行，回 specpowers-apply 完成 Gate 3 后再进入 Phase 4。微小任务跳过此项（但 apply 中 tiny 仍执行 Gate 3——见 apply 前置检查）。
```

- [ ] **Step 5: 验证跨文件一致性**

Run: `grep -rn "GATE_PASSED\|gate-passed" skills/specpowers-design/ skills/specpowers-plan/ skills/specpowers-apply/ skills/specpowers-archive/`
Expected: 每个子技能各 1 行匹配

- [ ] **Step 6: Commit**

```bash
git add skills/specpowers-design/SKILL.md skills/specpowers-plan/SKILL.md skills/specpowers-apply/SKILL.md skills/specpowers-archive/SKILL.md
git commit -m "feat: 4个子技能前置检查增加Gate Token确认——产物依赖链"
```

---

## Task 8: 全链路一致性验证 + 场景推演

**Files:**
- 全部 7 个修改文件的交叉验证

- [ ] **Step 1: grep 核对跨文件标记一致性**

Run: `grep -rn "GATE_PASSED" skills/`
Expected: review SKILL.md（输出定义）+ 入口 SKILL.md（验证引用）+ design/plan/apply/archive（前置检查）= 6 个文件匹配

Run: `grep -rn "CONVERGENCE_CHECK" skills/`
Expected: review SKILL.md（输出定义）+ 入口 SKILL.md（验证 3）+ protocols.md（格式定义）= 3 个文件匹配

Run: `grep -rn "gate-passed" skills/`
Expected: review SKILL.md（写入定义）+ 入口 SKILL.md（Phase 检测）+ design/plan/apply/archive（前置检查）= 6 个文件匹配

- [ ] **Step 2: grep 核对阈值一致性**

Run: `grep -rn "≥ 20\|≥20" skills/specpowers-review/`
Expected: 无输出（旧阈值已全部替换）

Run: `grep -rn "≥ 10\|file_count.*10\|file_count<10\|file_count≥10" skills/specpowers-review/`
Expected: review SKILL.md + protocols.md 多行匹配

- [ ] **Step 3: grep 核对旧措辞清除**

Run: `grep -rn "请确认：是否进行下一轮\|轻量收敛提醒\|轻量提醒" skills/`
Expected: 无输出

Run: `grep -rn "强烈建议.*下一轮\|强烈提醒下一轮" skills/`
Expected: 无输出（旧的 advisory 措辞已替换为默认继续制）

- [ ] **Step 4: 场景推演验证**

逐项验证设计文档「验证方法 → 场景推演」节中的全部场景，确认改后文件能正确支撑每个场景。重点关注：
- 改动 1：跳过 Gate + 入口拦截、跨任务残留 name 不匹配、跨会话恢复
- 改动 2：触发条件满足→内部循环、加强审查子路径 CONVERGENCE_CHECK 在 STEP2 后、收敛判定被跳过→验证 3 阻塞
- 改动 3：4 文件→加强审查、10 文件→UltraReview

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "chore: 全链路一致性验证通过——Gate强化+多轮默认继续+UltraReview阈值"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ 改动 1 Gate 产物依赖链：Task 5（review 输出）+ Task 6（入口验证）+ Task 7（子技能前置检查）
- ✅ 改动 2 多轮默认继续 + CONVERGENCE_CHECK：Task 3（review SKILL）+ Task 4（protocols 协议 7）
- ✅ 改动 3 UltraReview 阈值：Task 1（review SKILL）+ Task 2（protocols 协议 6）
- ✅ 全链路验证：Task 8

**2. Placeholder scan:** 无 TBD/TODO/占位符。每步包含确切的 Markdown 文本片段。

**3. Type consistency:**
- `[GATE_PASSED]` 格式在 Task 5（定义）和 Task 6（验证引用）中一致 ✅
- `[CONVERGENCE_CHECK]` 格式在 Task 3（SKILL.md 定义）和 Task 4（protocols.md 定义）中一致 ✅
- `.gate-passed-<N>` 文件格式（含 `name=` 字段）在 Task 5（定义）和 Task 7（子技能检查）中一致 ✅
- bucket_class 分叉（file_count<10）在 Task 1（recipe 表注释）和 Task 2（算法函数）中一致 ✅
