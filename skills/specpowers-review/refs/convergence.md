# specpowers-review 协议参考：收敛与通读
> 含协议 7、9；加载时机见 SKILL.md「按需加载表」。

## 协议 7: 收敛判定与硬阻止输出模板

> 由 specpowers-review SKILL.md「收敛判定与硬阻止机制」节引用。

**输出判定**（依据本轮**合并后问题数** p0_merged/p1_merged/p2_merged/p3_merged，禁止用修复后剩余数；加强审查子路径按 raw 口径——该路径默认轮无独立验证者复核合并表（**`[拒绝异常]` 子分支除外**：N>0 有例外 Step 3、N==0 有例外独立 Step 5），见 SKILL.md「问题数口径权威定义」）：

| 场景 | 条件 | 输出 |
|------|------|------|
| 硬阻止 | p0 未清零（修复后仍 p0 > 0） | `[GATE_BLOCKED]` 强制语气 + 修复-重审循环 |
| 默认继续下一轮 | 下方 5 触发条件任一满足 | `[CONVERGENCE_CHECK]` action=continue + 摘要 + 干预窗口 |
| 用户终止 | 用户显式终止（触发条件满足） | `[CONVERGENCE_CHECK]` action=exit + exit_reason=用户终止理由 → 最终通读 → `[GATE_PASSED]` |
| 用户中途终止 | 用户在本轮 Step 1–5 进行中终止（非轮末干预窗口） | 本轮在账本中**标记 `aborted: true`**（**不删除记录**，保留审计痕迹），轮次计算与上轮基准取用均**跳过**该轮；**Gate 不通过**：父技能验证 1（标记块完整性）会因缺失 STEP 标记而阻塞，须重新触发 review。**不得**输出 `[CONVERGENCE_CHECK] action=exit` 冒充完成轮——那会把未完成的审查伪装成收敛退出。**受支持的终止出口仅为轮末干预窗口**（见「默认继续制」节的用户交互模板）。**Step 2 汇总前中止的边界规则**：中止发生在 **Step 2 汇总前** → 创建仅含 `"aborted": true` 与 `timestamp` 的**占位条目**（计数字段缺省为 `null`，视为 unknown，**不参与任何计算**；`effective` 过滤后自动被跳过）。**标记侧对账**：被中止轮不输出 `[CONVERGENCE_CHECK]`（其判定不存在）；若上一轮的标记仍在上下文中，重跑时以**新轮的**标记为准，且新轮标记的 `round` 字段必须大于上下文中的历史标记（父技能与审计可用 `round` 号交叉校验，避免误取被中止轮或上一轮的标记） |
| 收敛退出 | 以上均不满足 | `[CONVERGENCE_CHECK]` action=exit + 最终通读 → `[GATE_PASSED]` |

> **为什么中途终止不放行**：`[CONVERGENCE_CHECK]` 的字段（含 `p*_merged`）要求本轮判定已算出；中途终止时判定不存在，任何"补一个 exit"的写法都是伪造。阻塞是安全行为——Gate 不应放行一个审查未完成的轮次。

**下一轮 5 触发条件**（任一满足即默认继续，全部基于**合并后问题数** p*_merged）：① p0_merged > 1；② p1_merged > 5；③ p0_merged+p1_merged+p2_merged > 10；④ p0_merged+p1_merged+p2_merged+p3_merged > 20；⑤ p1_merged − 上轮有效轮次的 p1_merged > 3（轮间新增 P1 趋势；上轮基准取协议 6 的 `effective` 序列最后一个——跳过被中止轮，无有效上轮时⑤为 n/a；两轮必须同口径比对（同口径与否按账本轮次条目的 `caliber` 字段判定），旧轮次缺 p*_merged 时按协议 1「⑤（差值型条件）特殊处理」的三差值规则计算；round 1 无上轮基准时⑤不参与判定，视为 n/a）。

> 条件 1（p0_merged > 1）与 `[GATE_BLOCKED]` 独立：本轮发现 ≥2 个**互不相同**的 P0 时，即使已全部修复（Gate 通过），仍默认继续下一轮验证修复质量；p0_merged=1 且已修复时不因此强制下一轮。注意"≥2 个"指合并去重后的**不同** P0——同一个 P0 被 k 个 Agent 重复报告只算 1 个（这正是改用 merged 口径的目的）。多条件同时触发时按编号升序列出全部。
>
> 条件 5 同样基于合并后问题数：上轮修复引入的回归 P1 会被本轮 Step 1 重新发现、经 Step 2 去重后计入 p1_merged，⑤ 捕获"修复引入问题"的轮间恶化趋势。两轮口径必须一致（默认两轮同取 merged；**任一轮的 `caliber=raw`（加强审查子路径轮）时，⑤ 对两轮同取 `p1_raw`**，并在 notes 标注「触发口径切换（merged→raw）」——不称"口径混合"；某轮缺失 `p*_merged` 时按协议 1「⑤（差值型条件）特殊处理」的三差值规则计算，并在 notes 标注使用了回退口径）。

> 用户显式裁决拒绝/跳过的项：按 `disposition=user_rejected` 从 `p*_merged` 中排除（**仅适用于 Step 2 阶段**的用户裁决；Step 4 阶段的用户拒绝按 SKILL.md Step 4 前置 Gate 的记账规则处理——不回改 disposition、不重算 `p*_merged`。）（**由口径本身承担**，不再需要额外的"扣除"操作）；被用户拒绝的项若在后续轮次再次被发现，则按新发现正常计入该轮。若主 Agent 在口径之外另做扣除（如认定某条与上轮重复），必须在 `[CONVERGENCE_CHECK]` 的 notes 中列明扣除明细——账本仍保留完整 `p*_raw` 与 `p*_merged` 原值，扣除仅影响触发计算，不改写账本记录。

### `[CONVERGENCE_CHECK]` 标记格式

```
[CONVERGENCE_CHECK] triggers=<编号列表|none>, action=<continue|exit>, p0_merged=<N>, p1_merged=<N>, p2_merged=<N>, p3_merged=<N>, p0_raw=<N>, p1_raw=<N>, p2_raw=<N>, p3_raw=<N>, supplement=<N>, rejected=<N>, agent_rejected=<N>, user_rejected=<N>, user_exempt_p0=<N>, conservation=<pass|fail>, exit_reason=<文本|n/a>, notes=<文本|n/a>
```

- `triggers`：满足的触发条件编号列表（如 `[1,3]`），none 表示无触发
- `p*_merged`：**判定口径**（合并判断表**行**数——行均为已采纳项（`disposition ∈ {agent_accepted, user_adjudicated}`），不含被拒项（被拒项在未纳入清单）；Step 3 结束后冻结终值）——5 个触发条件全部由它计算；加强审查子路径（recipe=[STEP1-2]）的 `p*_merged` **如实填 Step 2 合并表值**（仅**触发计算**改用 raw 口径，不得把 merged 字段也填成 raw）。若本轮 Step 5 发生误合拆行，`p*_merged` 采用拆行后的修正值，并在 notes 中记录拆行前后的差值
- `p*_raw`：**审计基线**（各 Agent RAW_COUNT 求和，去重前）——不参与触发计算，仅供审计分辨"真的问题少"与"被合并/拒绝压下去的"
- `supplement`：监督补充数（`p*_supplement` 按 SKILL.md「问题数口径权威定义」的记账口径统计——发现型计入；更正型不计入；Step 2 时为 0）——审计字段，守恒等式 `Σ(所有行的 sources 条数) + Σp*_rejected == Σp*_raw + Σp*_supplement` 核对用（右侧 `Σp*_supplement` 只含"两类去向各有承载"的发现型——更正型不参与，否则等式假失败）
- `rejected` / `agent_rejected`：未纳入总数 / 其中主 Agent 拒绝数——**仅供审计 `[拒绝异常]` 是否触发**（不参与判定，也不影响 5 触发条件的计算）；`rejected = agent_rejected + user_rejected`，**不含** `user_exempt_p0`
- `user_rejected`：**用户**裁决拒绝的项数（**仅** Step 2 阶段记入未纳入清单的条目；区别于主 Agent 拒绝的 `agent_rejected`）——与 `agent_rejected` 共同构成 `rejected` 的两个来源
- `user_exempt_p0`：Step 4 前置 Gate 后的**用户豁免 P0 数**（独立计数字段，单列；**不计入 `rejected`**）——用于审计「用户豁免 P0」声明，须在用户提示中一并单列体现
- `conservation`：守恒等式核对结果；不成立时不得输出 action=exit。
- `action`：triggers 非空时默认 `continue`；triggers 为空时 `exit`（exit_reason=收敛达标）；用户显式终止时 `exit` + exit_reason
- `exit_reason`：仅 action=exit 时填写。用户显式终止须记录理由；无触发条件时填 `收敛达标`；P0 未清零（[GATE_BLOCKED] 循环进行中）的轮次如输出此标记，exit_reason 必须填 `p0 未清零，修复-重审循环继续`，禁止填 `收敛达标`
- `notes`：触发口径切换（merged→raw）、回退口径使用、口径外扣除明细等需披露信息的标注处；无则填 `n/a`。

**无论是否触发，此标记必须输出。** 加强审查子路径（STEP5 被裁剪）按分支锚定（见 SKILL.md「加强审查」节「收敛判定（按分支锚定）」）：**默认轮（无 Step 3）在轻量通读完成后**输出此标记（顺序写死：STEP2 合并 → 内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token）；**检出 `[拒绝异常]` 的轮**——N>0（例外 Step 3，mode=standard）在**口径冻结后**输出（同标准路径，`supplement/rejected/conservation` 取终值），N==0 在**例外独立 Step 5 复核输出后**输出。

> **设计理由（writing-skills "Match the Form to the Failure"）**：收敛判定被跳过属于"omits a required element"——正确形式是 structural（REQUIRED field），而非 prohibition 或 prose reminder。`[CONVERGENCE_CHECK]` 是 structural form——必须输出的结构化字段，父技能验证链检查其存在性。

### 统一输出模板

```markdown
> **[GATE_BLOCKED] p0_count=<修复后剩余P0>**   ← 仅 P0 未全部修复时输出此行（p0_count=修复后剩余数，区别于下方合并后问题数），否则删除
>
> 本轮合并后问题数 P0: <p0_merged>, P1: <p1_merged>, P2: <p2_merged>, P3: <p3_merged>（**判定口径**——Step 2 合并判断表**行**数——行均为已采纳项（`disposition ∈ {agent_accepted, user_adjudicated}`），不含被拒项（被拒项在未纳入清单）；Step 3 结束后冻结；非修复后剩余数）。
> 本轮原始发现 P0: <p0_raw>, P1: <p1_raw>, P2: <p2_raw>, P3: <p3_raw>（**审计基线**——去重前，含多 Agent 重复；不参与触发计算）。
> 未纳入清单 P0: <p0_rejected>, P1: <p1_rejected>, P2: <p2_rejected>, P3: <p3_rejected>；守恒等式 conservation: <pass|fail>。
> 其中主 Agent 拒绝 `<agent_rejected>` 条；监督补充 `<supplement>` 条；用户裁决拒绝 `<user_rejected>` 条（Step 2 未纳入清单口径）；用户豁免 P0 `<user_exempt_p0>` 条（Step 4 前置 Gate 口径，如有 → 同时输出「用户豁免 P0」说明；**不计入 rejected**）（`[拒绝异常]` 阈值：`agent_rejected` 与 `user_rejected` 合计 > 3 条或占比 > 30%——**占 `Σp*_raw`（= `p0_raw+p1_raw+p2_raw+p3_raw` 四项合计，与判档用的 `N` 不是同一个数）的比例**；**分子仅计计入 `Σp*_raw` 的被拒项（被否决 `sup3` 项不占分子，由 `[补充否决异常]` 承接）**；`user_rejected` 部分仅核验「用户裁决记录是否存在且理由已如实记录」，不质疑用户判断）。
>
> [p0 未清零时] P0 未清零，审查 Gate 未通过，当前 Phase 被阻塞。specpowers-review 必须执行修复-重审循环（修复子 Agent 修 P0 → 主 Agent 逐条校验 → 重跑 Step 1-5），直到 P0（修复后剩余）清零——循环出口仅看 P0；P1 轮间趋势由触发条件⑤监控，不参与阻塞循环出口判定。本轮修复+重审中发现的 P1/P2 纳入累积计数。调用方将检查 [GATE_BLOCKED]，P0>0 时拒绝进入下一 Phase。
>
> [触发条件任一满足时]
> 📊 Round <N> 审查完成。合并后问题数 P0:<p0_merged> P1:<p1_merged> P2:<p2_merged> P3:<p3_merged>（原始发现 P0:<p0_raw> P1:<p1_raw> P2:<p2_raw> P3:<p3_raw>，去重前基线）。
> 触发条件 <编号+描述> 满足，即将开始 Round <N+1>。
> 如需终止审查，请说明理由。无反馈则继续。
>
> [触发条件均不满足时]
> 本轮合并后问题数未达下一轮触发阈值。审查收敛，可进入最终通读。
>
> **上轮对比**（如适用）：上轮 p0_merged:X（raw:x） p1_merged:Y（raw:y） → 本轮 p0_merged:X'（raw:x'） p1_merged:Y'（raw:y'），趋势：收敛中 ↗ / 持平 → / 恶化 ↘（括号内附同轮 raw 值供审计；两轮口径不一致时显式标注）
>
> **[DEGRADED]**（账本缺少 `p*_merged`）：按账本向后兼容规则回退 raw 口径计算并声明"账本缺少合并后问题数，该轮回退 raw 口径"；若连 `p*_raw` 也缺失（旧格式账本）：不展示上轮对比段，仅展示当轮可得计数 + 声明"旧格式账本缺少原始发现数，回退独立判断"。
```

## 协议 9: 最终通读 Gate 详细流程

> 由 specpowers-review SKILL.md「最终通读 Gate」节按需引用。触发时机简述与 PASS 四条件概要见 SKILL.md；执行方式、检查项与判定规则在本协议。

最终通读 Gate 是横切 Gate，不参与 Gate 0-4 编号体系，适用于所有审查（无论单轮还是多轮循环）。单轮审查在 Step 5 完成后立即执行最终通读；多轮审查在最后一轮 Step 5 完成后执行最终通读。适用对象含文档类 Gate 0/1/2 和代码类 Gate 3。代码类 Gate 3 的"通读全文"指通读所有变更文件的 diff 及关键文件的完整内容。关键文件的判定标准：被 diff 中引用但未完全展示的函数/类/模块的源文件，以及变更涉及的配置文件。由主 Agent 根据 diff 中的 import/reference 关系自动判断。

### 与 Step 5 的关系

Step 5 检查本轮修复质量（单轮范围），最终通读 Gate 检查跨轮累积一致性（全局范围）。在多轮审查的最后一轮，Step 5 和最终通读 Gate 先后执行，Step 5 先（本轮修复验证），最终通读 Gate 后（全局一致性检查）。单轮审查中，Step 5 完成后立即执行最终通读 Gate。

### 触发时机

当审查进入最终通读环节，**在进入下一环节（如下一 Phase、Gate 3 进入 Phase 4 等）之前**，必须执行最终通读。触发时机按 tier 分支：
- **加强审查子路径（STEP5 被裁剪）**：最终通读以主 Agent 在**内联修复 + 对齐复检（P0 清零）之后**执行的轻量通读形式完成（执行顺序写死：`STEP2 合并 → 内联修复 + 对齐复检（P0 清零）→ 轻量通读（记录拆行差值）→ 收敛判定 → Gate Token`，见 SKILL.md「加强审查」节——不得在 STEP2 合并后立即通读，否则 PASS 条件 (a) 不可满足）——即 SKILL.md 质量底线第④条所指的"轻量替代"。PASS 四条件相同，但通读范围为变更区域+关联上下文（非全文逐行）。仍须输出 STEP_FINAL_READTHROUGH 标记块（**`notes` 注明「轻量替代」**——`status` 仍取通用枚举 complete|degraded|failed、不承载「轻量替代」；通读结果由 `result: pass|fail` 字段表达）。**轻量替代的附加检查**：对照 `STEP2` 合并判断表，抽取 `sources` 条数 ≥2 的行，逐行判断被合并的各条是否确为同一问题（文档类＝同一段落/章节/代码块且类型相同；代码类＝同一文件+同一符号+同一类型）。发现误合 → 拆行并重算 `p*_merged`，并在 `STEP_FINAL_READTHROUGH` 中记录。**拆行后的记账与留痕**：拆行后更新账本 `rounds` 的 `p*_merged`，并在 `STEP_FINAL_READTHROUGH` 中记录拆行前后的差值；`[CONVERGENCE_CHECK]` **不重出**（该子路径触发口径为 raw，拆行不影响触发结论），差值随标记块留痕。**注意本检查由主 Agent 自执行，无独立复核**——协议 6 `fallback_coverage` 中的「已知残留」表述保持
- **关键/完整层**：单轮审查在 Step 5 完成后执行标准最终通读；多轮审查在 [CONVERGENCE_CHECK] action=exit（5 触发条件全不满足或用户显式终止）且 Step 5 完成后执行标准最终通读。通读触发与收敛判定 action 单一对应，不另设数值条件——原"P0≤1 且 P1≤5 且新增 P1≤3"数值表述已废止，其语义分别由触发条件①②⑤承接

### 执行方式

- 启动独立子 Agent（非实施者，使用可用模型），通读审查对象全文。由 specpowers-review 主 Agent 在 Step 5 完成后、向父技能返回结果前启动。
- 仅单一模型可用时：由主 Agent 自行执行最终通读（无法获取独立视角），在最终通读报告中声明"单一模型，最终通读缺少独立视角交叉验证"。
- **跨会话状态**: 跨会话重启后，主 Agent 从 `.specpowers/review-cache.json` 的 `final_readthrough` 字段读取状态：status === "pass" 时检查 `file_hashes`（如存在）判断 staleness——当前审查对象文件 hash 与缓存不一致 → 缓存过期，重置为 pending 并重新执行。hash 不可用时仅输出警告，继续使用缓存状态。缓存读取的完整规则见本文件协议 2（跨会话缓存）的 `final_readthrough` 读写规则。

### 检查项

- 所有已确认修复是否正确应用？
- 修复之间是否存在冲突？
- 全文术语和格式是否一致？
- 是否有废弃引用或残留旧术语？

### 输出

最终通读结果以标记块的 **`result: pass|fail` 字段**表达 + 残余问题清单（如有）。映射：**PASS → `result: pass`（`status: complete`）**；**FAIL → `result: fail`（`status` 取 `degraded`——存在残余问题、修复后可重新通读；或 `failed`——不可继续、须提请用户裁决）**。`status` 一律取通用枚举 complete|degraded|failed，「轻量替代」「单一模型」等限定一律写 `notes`，不得写进 `status`。

### PASS 标准

（四条全部满足）：
- (a) 所有已确认修复均已正确应用（加强审查子路径：指主 Agent 内联修复 + 对齐复检（P0 清零）后的状态——轻量通读在该修复之后执行，见上方触发时机）
- (b) 无修复间冲突
- (c) 全文术语和格式一致
- (d) 无废弃引用或残留旧术语

### 判定

- `result: pass`（即 PASS）→ 允许进入下一环节（`status: complete`）
- `result: fail`（即 FAIL，存在残余问题）→ 修复后重新通读，直到 pass（FAIL 轮 `status: degraded`；不可继续/重通读不可行时 `status: failed` 并提请用户裁决）
- 此 Gate 不可跳过，不设自动循环上限

目的：防止多轮修复累积后在文档中留下残余不一致（如术语两写、废弃引用残留、修复冲突）。多轮审查中每次修复只关注局部，最终通读提供全局一致性检查。
