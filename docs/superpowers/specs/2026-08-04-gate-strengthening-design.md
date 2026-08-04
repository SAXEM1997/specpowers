# specpowers Gate 强化 + 多轮默认继续 + UltraReview 阈值修正

> 状态：设计确认，待写实施计划。

## 概述

specpowers 技能组在实际使用中暴露三个退化模式，根因均为"文本指令约束力不足，长上下文下 Agent 自然倾向于跳过/简化"：

1. **Gate 评审容易跳过**：Gate 调用是"推"模型（父技能主动推 review），无产物依赖——跳过 Gate 无技术后果，Agent 可直接进入下一 Phase。
2. **多轮评审不触发**：收敛提醒是 advisory（建议性询问），触发条件满足后仍允许"不继续"，且"连询问本身都容易被跳过"。
3. **UltraReview 难触发**：上次精简将 UltraReview 门槛从 ~10 文件提升到 ≥20 文件，中等规模（10-19 文件）代码变更失去了 6-agent 全面审查覆盖。

## 改动 1：Gate 产物依赖链

### 问题根因

当前 Gate 机制依赖两层防护：
- review SKILL.md 文本声明"每个 Gate 不可跳过"
- 父技能（design/plan/apply）在 Gate 返回后执行验证链（检查标记块完整性）

关键缺口：验证链在 Gate **返回后**执行——如果 Gate 审查根本没被调用，验证链也没有机会执行。Gate 调用和 Gate 返回验证都在同一 Agent 的同一 Skill 上下文中，没有"不做 A 就无法做 B"的依赖链。

### 设计：Gate Token 三层保障

**核心思路**：从"推"模型改为"拉"模型——下一 Phase **必须拉取**上一 Gate 产物（Gate Token）才能启动。

#### 第 1 层：会话标记（主轨）

specpowers-review 在 Gate 审查通过后（最终通读 PASS 后），输出 `[GATE_PASSED]` 标记：

```
[GATE_PASSED] gate=<N>, round=<N>, tier=<tier>, p0_raw=<N>, p1_raw=<N>, convergence_triggers=<编号列表|none>
```

与现有的 `[TIER_ROUTING]`、`STEP<N>_EXECUTED` 同类机制。此标记在会话上下文中可搜索。

> **P0 未清零时不输出此标记**——Gate 未通过时输出的是 `[GATE_BLOCKED]`（现有机制不变），`[GATE_PASSED]` 仅在 Gate 确实通过后输出。

> **Positive recipe 表述（借鉴 brainstorming HARD-GATE 模式）**：Gate 依赖链在 SKILL.md 中应以 positive recipe 语气描述——"Phase 推进的唯一路径：Gate N-1 通过 → Phase N 启动"，而非 prohibition（"Gate 不可跳过"）。brainstorming 的 `<HARD-GATE>` 标签定义了唯一前进路径（先呈现设计→获批准→再实现），不列举"不能做什么"——这比 prohibition 更有效，因为 Agent 遵循 recipe 比对抗合理化更容易。

#### 第 2 层：文件标记（后备轨）

Gate 通过后写入 `.superpowers/.gate-passed-<N>` 文件：

```
name=<任务标识符>
round=<N>
timestamp=<ISO 8601>
tier=<critical|full>
```

跨 Skill 边界、跨上下文压缩时后备。与入口技能 Phase 自动检测表通过文件产物判断 Phase 是同一设计模式。

> 此文件不是审查状态产物（`.review-*` 已废弃），而是 Phase 流转控制标记——语义类似 `.phase1-skipped`（已有的跳过标记文件，内容也是 `<name>` 任务标识符）。

> **任务标识符绑定**：`name` 字段绑定到特定任务。入口技能/子技能检查时不仅检查文件存在，还检查 `name` 与当前任务匹配——不匹配视为不存在（防止上一任务残留标记误导新任务的 Phase 判定）。

#### 第 3 层：下一 Phase 入口硬阻断

每个子技能的前置检查增加 Gate 确认行：

| 子技能 | 入口检查 | 未通过行为 |
|--------|---------|-----------|
| design Phase 1 | 确认 Gate 0 通过（搜索 `[GATE_PASSED] gate=0` OR `.gate-passed-0` 文件） | 回退执行 Gate 0 |
| plan | 确认 Gate 1 通过 | 回退执行 Gate 1 |
| apply | 确认 Gate 2 通过 | 回退执行 Gate 2 |
| archive | 确认 Gate 3 通过 | 回退执行 Gate 3 |

检查逻辑：先搜索会话标记（快速），找不到时检查文件标记（后备）。两者都没有 → 阻断，回退执行 Gate。

#### 入口技能适配（最终执行点）

入口技能 Phase 自动检测表是产物依赖链的**最终执行点**——入口技能是所有子技能调用的起点，Agent 无法绕过入口技能直接路由（它需要知道加载哪个子技能）。Phase 自动检测表每个判定行增加 Gate 标记检查条件（`name=<当前任务>` 匹配的 `.gate-passed-<N>` 文件），确保即使 Agent 跳过了子技能内部的前置检查，入口技能路由时仍能拦截。

> **Structural form（引用 writing-skills "Match the Form to the Failure"）**：入口技能路由表中的 Gate 标记检查是 REQUIRED field（structural form），而非 prose reminder。对于"omits a required element"（遗漏 Gate 调用），structural form 比 prohibition list 更有效——路由表中 Gate 检查是 Phase 推进的必需字段，缺失即路由失败，不存在"跳过"的空间。

### 边界处理

| 边界 | 处理 |
|------|------|
| 微小任务（tiny） | tiny 模式跳过 Gate 0/1/2（现有行为不变），但 Gate 3 仍执行（apply 现有行为）。tiny 模式下不写 `.gate-passed-0/1/2` 文件，子技能前置检查对 tiny 跳过（与验证协议验证 0 一致） |
| Gate 审查多次轮次 | 文件标记记录最终 round 数，覆盖写入（最新通过轮次为准） |
| OpenSpec 跳过路径 | Phase 1 跳过时，Gate 0 仍执行（design SKILL.md 现有流程），Gate 1 仍执行（Phase 1 内部 Step 1.3 后执行）。跳过的是 OpenSpec 产物生成，不是 Gate 审查 |
| 跨会话恢复 | 文件标记跨会话持久。入口技能 Phase 自动检测 + Gate 文件标记联合判定，恢复到正确 Phase |

## 改动 2：多轮默认继续 + 强化触发不漏

### 问题根因

两个层面的问题：

**层面 A——决策太弱**：当前收敛提醒模板是 `请确认：是否进行下一轮审查？`，这是中性询问。触发条件满足时仍完全开放决策权，Agent 默认倾向"已完成→进入下一步"。

**层面 B——判定本身被跳过**：收敛判定是 review 内部 Step 5 之后的可选步骤。长上下文下 Agent 在 Step 5 完成后直接返回，跳过收敛判定——连"询问"都没有，用户根本不知道应该多轮。

### 设计 A：默认继续制

修改协议 7 输出模板——触发条件满足时从"建议性询问"改为"默认继续 + 显式退出"：

**触发条件满足时**：
```
⚠️ 触发条件 <编号+描述> 满足。默认进入下一轮审查。
如需终止，请显式声明"终止审查"并说明理由（理由将记录到会话上下文账本）。
```

**触发条件不满足时**：
```
本轮原始发现问题数未达下一轮触发阈值。审查收敛，可进入下一阶段。
```

4 个触发条件不变（已有定义）：
1. p0_raw > 0
2. p1_raw ≥ 3
3. p0_raw + p1_raw + p2_raw ≥ 5
4. p0_raw + p1_raw + p2_raw + p3_raw ≥ 10

#### 多轮循环执行主体：review 内部循环

action=continue 时，**review 主 Agent 在同一 Skill 调用内部自动循环**——回到 Step 0 启动 Round 2。父技能 Gate 调用仅一次返回：

- 返回 `[GATE_PASSED]` → 循环退出（收敛达标或用户终止），Gate 通过
- 返回 `[GATE_BLOCKED]` → P0 未清零，Gate 阻塞

父技能无需理解 `[CONVERGENCE_CHECK]` 或实现循环逻辑——循环完全封装在 review 内部。这与 brainstorming 的"在同一 Skill 上下文中完成全部迭代"模式一致（设计呈现→反馈→修改→再呈现→批准，全部在 brainstorming 内部循环）。

#### 用户交互设计（知情权 + 干预窗口）

action=continue 时，review 主 Agent 在开始 Round 2 前**向用户输出本轮审查摘要 + 下一轮计划**，提供干预窗口：

```
📊 Round <N> 审查完成。原始发现 P0:<N> P1:<N> P2:<N> P3:<N>。
触发条件 <编号> 满足，即将开始 Round <N+1>。
如需终止审查，请说明理由。无反馈则继续。
```

这不是"询问是否继续"（退回到原来的问题），而是"通知即将继续 + 给用户干预窗口"——默认行为是继续，用户需主动干预才能终止。与 brainstorming 的"每段呈现后等待确认"模式类似，但方向相反（brainstorming 默认暂停等待确认，review 默认继续等待终止）。

### 设计 B：收敛判定强制输出

**核心改动**：将收敛判定从"可选附加步骤"提升为"Step 5 的硬性后继步骤"，并增加结构化标记。

#### `[CONVERGENCE_CHECK]` 标记

review 主 Agent 在 Step 5（Quick Review）完成后，**必须**计算 4 个触发条件并输出：

```
[CONVERGENCE_CHECK] triggers=<编号列表|none>, action=<continue|exit>, p0_raw=<N>, p1_raw=<N>, p2_raw=<N>, p3_raw=<N>, exit_reason=<文本|n/a>
```

- `triggers`：满足的触发条件编号列表（如 `[1,3]`），none 表示无触发
- `action`：triggers 非空时默认 `continue`；triggers 为空时 `exit`；用户显式终止时 `exit` + exit_reason
- `exit_reason`：仅 action=exit 时填写。用户显式终止须记录理由；无触发条件时填 `收敛达标`

**无论是否触发，此标记必须输出。** 缺失 = 收敛判定被跳过 = 审查未完成。

> **加强审查子路径覆盖**：加强审查子路径裁剪 STEP5（recipe=[STEP1-2]，输出 STEP5_TIER_SKIPPED）。此子路径的 `[CONVERGENCE_CHECK]` 在 **STEP2 完成后**输出（替代 STEP5 后位置）。验证 3 的搜索逻辑不依赖 STEP5 存在——只要找到 `[CONVERGENCE_CHECK]` 标记即可，无论其位于 STEP2 还是 STEP5 之后。加强审查子路径的收敛判定基于 STEP2 的合并结果（p*_raw 来自 raw_count_sum），判断逻辑与其他子路径一致。

#### 父技能验证强化

在入口技能的 Gate 返回后验证协议（横切）中增加验证：

```
验证 3（新增）: 收敛判定完整性
  - 搜索 [CONVERGENCE_CHECK] 标记
  - 缺失 → 视为审查未完成（收敛判定被跳过），阻塞 Phase
  - 存在且 action=exit 但 exit_reason 为空 → 阻塞（无理由终止）
  - 存在且 action=continue → 审查将继续下一轮（预期行为）
  - 存在且 action=exit 且 exit_reason 非空 → 通过
```

这使得收敛判定从 review 内部的可选步骤升级为**父技能验证链覆盖的必需产物**——跳过收敛判定 = 父技能验证不通过 = Phase 被阻塞。

#### 与 `[GATE_PASSED]` 的关系

`[GATE_PASSED]` 仅在 Gate 最终通过（用户决定不再继续多轮，或收敛达标）时输出。多轮审查进行中时，每轮输出 `[CONVERGENCE_CHECK]` 但不输出 `[GATE_PASSED]`——因为 Gate 尚未最终通过。

时序：
```
Round 1: ... Step5 → [CONVERGENCE_CHECK] action=continue → Round 2
Round 2: ... Step5 → [CONVERGENCE_CHECK] action=continue → Round 3
Round 3: ... Step5 → [CONVERGENCE_CHECK] action=exit（收敛达标 OR 用户终止）→ 最终通读 → [GATE_PASSED]
```

### 防偷懒补强

收敛判定使用原始发现数（p*_raw）而非修复后剩余数——这在现有 SKILL.md L577-581 中已有硬约束。本次改动将此约束从文本提醒升级为结构化标记字段（`[CONVERGENCE_CHECK]` 中的 `p0_raw` 等字段），父技能可验证：

- 标记中的 `p0_raw` 与账本 `rounds[N-1].p0_raw` 一致？
- 标记中的 `triggers` 与 p*_raw 计算结果一致？
- 不一致 → 收敛判定被篡改，阻塞

> **设计理由（引用 writing-skills "Match the Form to the Failure"）**：收敛判定被跳过的 baseline failure 属于"omits a required element"——Agent 遗漏了收敛判定这个必需步骤。writing-skills 指出对此类失败，正确形式是 **structural**（REQUIRED field/slot），而非 prohibition list 或 prose reminder。`[CONVERGENCE_CHECK]` 标记正是 structural form——它是一个必须输出的结构化字段，父技能验证链检查其存在性。这比文本提醒（"请记得做收敛判定"）更有效，因为 structural form 不可协商——要么输出了标记，要么没有。

## 改动 3：UltraReview 阈值降回 ≥10

### 问题根因

上次精简（删除快速层）时，bucket_class 映射将中等 bucket（4-19 文件）整体归入"小代码"（加强审查 recipe），UltraReview 门槛提升到 ≥20 文件。实际开发中 10-19 文件的代码变更很常见，这些变更失去了 6-agent 全面审查（build/code/specs/docs/deps + 对齐）的覆盖，只走了 2 步轻量路径（code-review + 对齐单审）。

### 设计：中等 bucket 内部按 ≥10 分叉

bucket_class 映射从按 bucket 粒度改为在中等 bucket 内按 file_count 分叉：

**当前**：
```
{微小, 中等(4-19)} → 小代码（加强审查）
{复杂(20-49), 大规模(50+)} → 大代码（UltraReview）
```

**改为**：
```
微小(1-3) → 小代码（加强审查）
中等(4-9) → 小代码（加强审查）
中等(10-19) → 大代码（UltraReview）  ← 新增分叉点
复杂(20-49) → 大代码（UltraReview）
大规模(50+) → 大代码（UltraReview）
```

### 影响范围

| 文件 | 改动点 |
|------|--------|
| review SKILL.md recipe 表 | 代码类完整层行拆分为双行：`代码类（微小/中小 4-9）`= 加强审查；`代码类（中大 10-19/复杂/大规模）`= UltraReview（原文档"中等"标注同时出现在两行，改用文件数区间消除歧义） |
| review SKILL.md L74 完整层不对称说明 | bucket 分界描述更新为"微小/中小(4-9)=加强审查，中大(10-19)/复杂/大规模=UltraReview" |
| review SKILL.md L154 UltraReview 适用条件 | "文件数 ≥ 20"改为"文件数 ≥ 10" |
| protocols.md 协议 6 算法 | `bucket_class` 函数增加中等内部分叉：`bucket==中等 && file_count>=10 → 大代码` |
| protocols.md 协议 6 典型场景 | 场景 6（4 文件→加强审查）保留，新增场景（10 文件→UltraReview） |

### 不受影响

- 路由矩阵不变（中等 4-19 第 1 轮仍为完整层）
- 关键层 recipe 不变（3 独立视角，不分 bucket）
- 文档类 recipe 不变
- 行数地板不变
- 收敛闸门不变

## 文件改动清单

| # | 文件 | 改动量 | 涉及改动 |
|---|------|--------|---------|
| 1 | `skills/specpowers-review/SKILL.md` | 大 | 改动 1（`[GATE_PASSED]` 输出 + `.gate-passed-<N>` 文件写入）、改动 2（`[CONVERGENCE_CHECK]` 强制步骤 + 输出模板改写 + 默认继续制）、改动 3（recipe 表 bucket 标注 + UltraReview 适用条件） |
| 2 | `skills/specpowers-review/refs/protocols.md` | 中 | 改动 2（协议 7 输出模板重写 + `[CONVERGENCE_CHECK]` 格式定义）、改动 3（协议 6 bucket_class 函数 + 典型场景） |
| 3 | `skills/specpowers/SKILL.md` | 中 | 改动 1（验证协议增加验证 3 收敛判定检查 + Phase 自动检测表增加 Gate 维度 + Gate 返回后验证协议引用更新） |
| 4 | `skills/specpowers-design/SKILL.md` | 小 | 改动 1（Phase 1 入口前置检查增加 Gate 0 确认行） |
| 5 | `skills/specpowers-plan/SKILL.md` | 小 | 改动 1（入口前置检查增加 Gate 1 确认行） |
| 6 | `skills/specpowers-apply/SKILL.md` | 小 | 改动 1（入口前置检查增加 Gate 2 确认行） |
| 7 | `skills/specpowers-archive/SKILL.md` | 小 | 改动 1（入口前置检查增加 Gate 3 确认行） |

## 显式排除

- tier 路由矩阵不动（改动 3 只改 recipe 选型，不改 tier 判定）
- 收敛闸门逻辑不动（改动 2 只改输出行为，不改闸门条件）
- 文档类 recipe 不动
- 加强审查 recipe 内部流程不动
- 退化声明/标记块格式不动（改动 1/2 新增的标记是独立标记，不修改现有 STEP 标记块）

## 验证方法

### 场景推演

**改动 1 — Gate 产物依赖链**：
- 正常流程：Phase 0 → Gate 0 审查 → `[GATE_PASSED] gate=0` + `.gate-passed-0`（含 name=<任务>） → Phase 1 入口检查通过
- 跳过 Gate：Phase 0 → 跳过 Gate 0 → Phase 1 入口检查 → 搜索标记失败 → 阻断，回退执行 Gate 0
- 跳过 Gate + 入口技能拦截：Agent 跳过子技能前置检查 → 入口技能路由时检查 Gate 标记 → 缺失 → 路由失败，拦截
- 跨任务残留：旧任务 `.gate-passed-0`（name=旧任务） → 新任务检查时 name 不匹配 → 视为不存在 → 不误导
- 跨会话恢复：新会话 → 会话标记丢失 → 文件标记后备（name 匹配） → Phase 自动检测正确恢复
- tiny 模式：跳过 Gate 0/1/2 → 子技能前置检查对 tiny 跳过 → 不阻断

**改动 2 — 多轮默认继续**：
- 触发条件满足：Round 1 发现 p0_raw=2 → `[CONVERGENCE_CHECK] triggers=[1,3], action=continue` → 输出摘要+干预窗口 → 无用户终止 → review 内部自动启动 Round 2
- 收敛达标：Round 3 发现 p0_raw=0, p1_raw=1 → `[CONVERGENCE_CHECK] triggers=none, action=exit, exit_reason=收敛达标` → 最终通读 → `[GATE_PASSED]`
- 用户终止：触发条件满足但用户说"终止审查" → `action=exit, exit_reason=用户终止：<理由>` → 最终通读 → `[GATE_PASSED]`
- 收敛判定被跳过：Step 5（或加强审查的 Step 2）完成后直接返回 → 无 `[CONVERGENCE_CHECK]` → 父技能验证 3 不通过 → 阻塞
- 加强审查子路径：STEP2 完成 → STEP3/4/5_TIER_SKIPPED → CONVERGENCE_CHECK 在 STEP2 后输出 → 验证 3 搜索到标记 → 通过
- 偷懒压数：标记中 p0_raw=0 但账本 rounds[N-1].p0_raw=2 → 不一致 → 阻塞

**改动 3 — UltraReview 阈值**：
- 4 文件 round1 → 完整层 → bucket_class=小代码 → 加强审查（STEP1-2）
- 10 文件 round1 → 完整层 → bucket_class=大代码 → UltraReview（STEP1-5, 6-agent）
- 19 文件 round1 → 完整层 → bucket_class=大代码 → UltraReview
- 20 文件 round1 → 完整层 → bucket_class=大代码 → UltraReview（不变）

### 契约一致性

grep 核对跨文件标记/阈值一致性：
- `[GATE_PASSED]` / `.gate-passed-` 在 review + 入口 + design/plan/apply/archive
- `[CONVERGENCE_CHECK]` 在 review + 入口验证协议
- `≥ 10` / `file_count >= 10` 在 review recipe 表 + protocols 协议 6

## 风险与缓解

| # | 风险 | 严重度 | 缓解 |
|---|------|-------|------|
| 1 | Gate 文件标记残留导致 Phase 误判 | 中 | Gate 文件标记在任务完成后清理（archive 阶段）；Phase 自动检测表以产物状态为主、Gate 标记为辅 |
| 2 | 默认继续制导致审查轮次过多 | 低 | 用户可显式终止（exit_reason 记录）；收敛闸门和触发条件已有上限趋势判断 |
| 3 | `[CONVERGENCE_CHECK]` 标记新增，父技能验证兼容 | 低 | 标记独立于 expected_steps 检查（不影响现有 STEP 标记块验证）；验证 3 为新增验证，不影响验证 0/1/2 |
| 4 | UltraReview 阈值变更影响已有场景预期 | 低 | 4-9 文件路径不变；10-19 从加强审查升级为 UltraReview，覆盖增强不减弱 |
