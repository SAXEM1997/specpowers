# specpowers-review 协议参考：路由
> 含协议 6；加载时机见 SKILL.md「按需加载表」。

## 协议 6: 两级路由算法（tier routing）

> 定义审查层级（tier）的路由矩阵、评估算法、层级裁剪声明及典型场景。由 specpowers-review SKILL.md 按需引用。路由决策由主 Agent 在 Step 0 执行，输出 `[TIER_ROUTING]` 标记。

### 路由矩阵

规模分桶按对象类型区分（详见下方算法预计算和 `bucket_doc` 函数）：
- **代码类**按 `file_count`：微小 1-3（`file_count=0` 归入微小——空 diff 回退后仍为 0 的归属，见 `refs/markers.md` 协议 3「独立调用场景自检」）/ 中等 4-19 / 复杂 20-49 / 大规模 50+
- **文档类**按 `line_count`：微小 ≤100 / 中等 101-300 / 复杂 301-600 / 大规模 >600

> 代码类中等 bucket=4-19，须与入口 skill 分桶定义一致。

| 规模 × 轮数 | 第 1 轮 | 第 2 轮 | 第 3 轮+ |
|------------|--------|--------|---------|
| 微小 | 关键 | 关键 | 关键 |
| 中等 | 完整 | 关键★ | 关键★ |
| 复杂 | 完整 | 完整 | 完整 |
| 大规模 | 完整 | 完整 | 完整 |

★ 触发收敛闸门，不满足则升级。详见下方算法 step 5。

### 路由算法

**符号定义**：

- `floor(line_count)`: 行数地板函数，定义见下方"行数地板"节（round1: line>500→完整; 200<line≤500→关键; line≤200→矩阵tier）
- tier 序：关键 < 完整（用于 `max()` 比较）
- `MATRIX`: 本协议上方"路由矩阵"表
- `RECIPES`: SKILL.md "recipe 表"——5 种编排的统一命名表，`[TIER_ROUTING]` 的 `recipe` 取值必须取自其中（禁止自造字符串，否则父技能验证 1 无法按枚举解析）：**文档类完整层=`文档3Agent`**（结构+落地+对齐 3 Agent）；**文档类关键层=`文档2Agent`**（对齐 Agent + `supervisor1` 监督 2 Agent）；**代码类关键层=`3视角`**（recipe 表「3 独立视角」行）；**代码类完整层**按 bucket_class 选 **`加强审查`**（小代码，STEP1-2）/**`UltraReview`**（大代码，STEP1-5）。文档类手动指定 UltraReview 时 recipe 仍填 `文档3Agent`（映射到完整层 3-agent，见下方步骤 2b）。
- UltraReview：代码类完整层大代码 bucket（中等且file_count≥10/复杂/大规模）的 6-agent recipe（见 `refs/ultrareview.md` 协议 8）

```text
输入: object_type, file_count, line_count (apply 传入)
预计算:
  # 文档类 bucket 按 line_count（文档行数与内容复杂度正相关；file_count 对文档无区分度）
  # 代码类 bucket 按 file_count（变更文件数直接反映代码变更范围）
  bucket = (object_type==文档) ? bucket_doc(line_count) : bucket(file_count)
  bucket_class = (object_type==代码) ? ((bucket==微小 || (bucket==中等 && file_count<10)) ? 小代码 : 大代码) : null
  effective = (!ledger || !ledger[gate_id]) ? [] : ledger[gate_id].rounds.filter(r => !r.aborted)   # 跳过被中止轮。被中止轮（aborted）不参与轮次计数，也不作为上轮基准——否则重跑时轮次被误算且闸门取到被中止轮的数据
  round = effective.length + 1   # round 基于【当前 gate_id】的有效轮次（非 aborted）。不同 Gate 的 gate_id 不同，轮次独立计数。gate_id 不存在视为首轮。
  prev_raw = (effective.length >= 1) ? effective[effective.length-1] : null   # 上轮基准取有效轮次序列的最后一个（rounds 0-indexed 语义由 effective 序列继承）
1. 护栏1(安全优先, early-return): if !ledger || !ledger[gate_id] → return tier=完整, reason="ledger缺失,保守完整"   # 最先, 覆盖手动覆盖
2a. 手动 tier 覆盖: if 用户指定"完整/关键审查" → base_tier=指定值, reason+="用户指定"; else base_tier=null
2b. 文档类 UltraReview 特殊路径: if 文档类且用户指定"UltraReview" → 跳过步骤 3-5, 直接 recipe=完整层多模型渐进式(3-agent), 但仍须经护栏1。**该路径的字段取值（不得留空）**：tier=完整、bucket=bucket_doc(line_count)、floor=floor(line_count)、convergence=n/a（未执行步骤 5 闸门）、expected_steps=[STEP1, STEP2, STEP3, STEP4, STEP5]、reason 注明"文档类 UltraReview→完整层 3-agent（跳过 2a-5）"
3. 矩阵: matrix_tier = MATRIX[bucket][round]; tier = (base_tier!=null) ? max(base_tier, matrix_tier) : matrix_tier; if matrix_tier>base_tier reason+="矩阵升级"
4. 行数地板: floor_tier = floor(line_count); if floor_tier>tier → tier=floor_tier, reason+="行数地板升级"
5. 收敛闸门(仅 prev_raw!=null 时执行):
   - tier==关键 且 bucket==中等 且 prev_raw.p0_raw>0 → tier=完整, reason+="上轮含P0,阵容加强"（闸门口径 p0_raw>0 比收敛①的 p0_merged>1 保守，有意设计——**验证强度类判定统一取 raw**，见 SKILL.md「问题数口径权威定义」；旧账本缺 p0_raw 时按"验证强度类判定取保守值"视为 p0_raw>0 并升级完整，reason+="旧账本缺 p0_raw,保守升级完整"）
   convergence = (prev_raw==null) ? n/a : (闸门触发 ? failed : passed)
6. recipe = RECIPES[object_type][tier][bucket_class]
输出: [TIER_ROUTING] tier=<>, round=<>, file_count=<>, bucket=<>, line_count=<>, floor=<>, convergence=<passed|failed|n/a>, recipe=<>, reason=<>, expected_steps=[...]
```

**评估顺序（箭头=先后，非覆盖；每层只升不降）**：护栏 1（ledger 缺失 early-return）→ 手动覆盖 → 矩阵 → 行数地板（max 升级）→ 收敛闸门（条件升级）。

**文档类 bucket 函数（按 line_count）**：`bucket_doc(line≤100)=微小; bucket_doc(100<line≤300)=中等; bucket_doc(300<line≤600)=复杂; bucket_doc(line>600)=大规模`。**`line_count` 口径来源**：文档类＝**审查对象总行数**（`wc -l`，见 `refs/markers.md` 协议 3「独立调用场景自检」）；代码类＝修改总行数（git diff），不进入本函数——700 行 design.md 只改 20 行时按总行数口径判（复杂→完整层），不得用 git diff 口径判微小。文档行数与内容复杂度正相关——1 个 design.md 可能描述 3 个文件的简单修改，也可能描述 50 个文件的系统重构。file_count 对文档无区分度（Gate 0/2 始终 1 文件，Gate 1 通常 4-6 文件），故文档类按 line_count 分桶。

> 文档类 bucket 阈值（100/300/600）与代码类 bucket 阈值（3/19/49 文件）语义对齐。行数地板对文档类仍生效（作为安全网）。

**行数地板（只升不降）**：`floor(line>500)={round1:完整, round2+:关键}; floor(200<line≤500)=关键; floor(line≤200)=矩阵tier`；`tier=max(tier, 地板tier)`。

> 护栏 1 是安全护栏（与行数地板同级），可覆盖手动覆盖——floor 语义是"不低于此 tier"，安全护栏升级手动值不违背用户控制。reason 字段会注明"手动覆盖被安全护栏覆盖"。

### 层级裁剪声明块

tier 裁剪专用，与 `refs/dispatch.md` 协议 4「退化声明」区分。review 侧在裁剪掉的 STEP 输出此块。当前仅完整层加强审查子路径使用（裁剪 STEP3/4/5；**`[拒绝异常]` 例外分支除外**——N>0 该轮不输出 `STEP3_TIER_SKIPPED`（例外 Step 3 独立监督）、N==0 不输出 `STEP5_TIER_SKIPPED`（例外启动独立 Step 5 复核拒绝理由与守恒等式，须输出 `STEP5_EXECUTED`），见 SKILL.md「加强审查」节例外条）。**输出形态与 `STEP<N>_EXECUTED` 一致**：以 `` ```STEP<N>_TIER_SKIPPED `` 围栏行起始的 fenced code block（识别规则见 `refs/markers.md` 协议 3「TIER_SKIPPED 块识别规则」）。

```markdown
\`\`\`STEP<N>_TIER_SKIPPED
tier: full
step: <N>
reason: 完整层加强审查子路径轻量
fallback_coverage: 最终通读 Gate 横切 + 主 Agent STEP2 合并判断 + 收敛闸门；**误合风险由轻量通读兜底（无独立复核，已知残留）**；**例外注记：检出 `[拒绝异常]` 时本声明对该 STEP 失效**——N>0 → STEP3 改为 EXECUTED（独立监督复核合并表），N==0 → STEP5 改为 EXECUTED（独立 Quick Review 复核拒绝理由与守恒等式）
\`\`\`
```

| 字段 | 说明 |
|------|------|
| `tier` | 当前路由层级（full） |
| `step` | 被裁剪的 STEP 编号 |
| `reason` | 完整层加强审查子路径：轻量路径无需监督+QuickReview（STEP3/4/5） |
| `fallback_coverage` | 裁剪的补偿机制：最终通读 Gate 横切 + 主 Agent STEP2 合并判断 + 收敛闸门；**误合风险由轻量通读兜底（无独立复核，已知残留）**；**例外注记：检出 `[拒绝异常]` 时本声明对相应 STEP 失效**——N>0 → STEP3 改为 EXECUTED（独立监督复核合并表），N==0 → STEP5 改为 EXECUTED（独立 Quick Review 复核拒绝理由与守恒等式），见 SKILL.md「加强审查」节例外条 |

**review 侧（必须输出）**：tier 裁剪掉的 STEP 输出此块，供父技能 reason 抽查与人类审计追溯。

**父技能验证侧（中性）**：TIER_SKIPPED 块既不计入已执行也不计入缺失；父技能按 `expected_steps` 检查（expected 中的 STEP 必须有 STEP<N>_EXECUTED，不在 expected 中的 STEP 不需检查）。

### 典型场景验证

以下场景覆盖路由算法全部路径（含步骤 2b 文档类 UltraReview 特殊路径、文档类微小/中等/复杂/大规模全部 bucket、代码类手动 UltraReview）：

| # | 场景 | 预期 tier | 关键路径 |
|---|------|----------|---------|
| 1 | 微小 round3 + 收敛（假设 ledger 存在） | 关键 | 矩阵→关键 |
| 2 | 中等 round2（假设 ledger 存在） | 关键 | 矩阵→关键★ + 闸门（p0_raw=0 则通过） |
| 3 | 中等 round3 但上轮 p0_raw>0（假设 ledger 存在） | 完整 | 矩阵→关键 → 闸门升级完整（上轮含P0,阵容加强） |
| 4 | 复杂任意轮（假设 ledger 存在） | 完整 | 矩阵→完整，永不降级 |
| 5 | 跨会话恢复（ledger 缺失） | 完整 | 护栏1 early-return，覆盖手动覆盖 |
| 6 | 代码类 4 文件/400 行 round1（假设 ledger 存在） | 完整（加强审查子路径） | 矩阵→完整，bucket=中等且file_count<10→bucket_class=小代码→recipe=加强审查 STEP1-2 |
| 6b | 代码类 10 文件/400 行 round1（假设 ledger 存在） | 完整（UltraReview 子路径） | 矩阵→完整，bucket=中等但 file_count≥10→bucket_class=大代码→recipe=UltraReview STEP1-5 |
| 7 | 代码类 3 文件 round2（假设 ledger 存在） | 关键（3 独立视角） | 矩阵→关键，recipe=3 独立视角 |
| 8 | round1 手动指定关键但 line>500（假设 ledger 存在） | 完整 | 手动→关键 → 行数地板升级完整 |
| 9 | **文档类** design.md 1 文件/450 行 round1（假设 ledger 存在） | 完整（recipe=文档3Agent，3-agent 多模型渐进式） | bucket_doc(450)=复杂 → 矩阵→完整 |
| 10 | **文档类** plan.md 1 文件/80 行 round1（假设 ledger 存在） | 关键（recipe=文档2Agent，对齐+监督 2-agent） | bucket_doc(80)=微小 → 矩阵→关键 |
| 11 | **文档类** 手动指定 "UltraReview"（任意 bucket，round1，假设 ledger 存在） | 完整（recipe=文档3Agent） | 护栏1 → 步骤 2b：跳过步骤 3-5，直接完整层 3-agent 多模型渐进式（不经 bucket_class 分支；文档类 UltraReview 不走 6-agent） |
| 12 | **文档类** proposal 四件套合计 250 行 round1（假设 ledger 存在） | 完整（recipe=文档3Agent） | bucket_doc(250)=中等 → 矩阵→完整 |
| 13 | **文档类** README 1 文件 900 行 round1（假设 ledger 存在） | 完整（recipe=文档3Agent） | bucket_doc(900)=大规模 → 矩阵→完整（行数地板 line>500 同向升级） |
| 14 | **代码类** 12 文件手动指定 "UltraReview"（round1，假设 ledger 存在） | 完整（recipe=UltraReview） | 手动覆盖关键词 "UltraReview" → 代码类按完整层 6-agent recipe 处理（SKILL.md 手动覆盖关键词节）→ 大代码 bucket 命中 recipe=UltraReview STEP1-5 |

## 细则 F: 加强审查例外完整叙述

**P0 修复机制**：本路径裁剪独立修复子 Agent（STEP4_TIER_SKIPPED），但对齐 Agent 发现 MISSING/DRIFT 标记为 P0 的项时，主 Agent 在 STEP2 合并后对接受的 P0 项**先经用户逐条确认（问题判定 + 修复方案），确认后直接执行修复**（主 Agent 内联，非独立子 Agent），修复后重新运行对齐检查直到 P0 清零——避免 [GATE_BLOCKED] 死循环。**循环出口（上限）**：该「修复 → 对齐复检」循环**最多 3 轮**，超限仍未清零 → 标注「修复失败」并提请用户裁决（与 Step 4 校验重试上限一致）。**本子路径不接受「用户拒绝 P0」**——P0 一律修复；用户在逐条确认中拒绝某项 P0（判定为非问题或拒绝修复）时，**转 mode=standard 完整层处理**：放弃本子路径裁剪，按完整层 Step 3/4/5 执行（独立监督 Agent → 独立修复子 Agent → Quick Review，均输出对应 `STEP<N>_EXECUTED`，不再输出对应的 `STEP<N>_TIER_SKIPPED`；`[TIER_ROUTING]` 不重出，但在报告中声明「用户拒绝 P0，加强审查子路径升级完整层」——父技能 expected_steps 检查只要求声明的 STEP 存在，额外 STEP 不受阻，见 `refs/markers.md` 协议 3「动态检查规则」；下方「STEP3/4/5 被层级裁剪」注的例外与裁剪声明自此不适用于本轮）。上述动作与后续动作的**执行顺序（写死）**见下方「STEP3/4/5 被层级裁剪」注：`STEP2 合并 → 内联修复 + 对齐复检（P0 清零）→ 轻量通读（记录拆行差值）→ 收敛判定 → Gate Token`。

> STEP3/4/5 被层级裁剪：输出 STEP3_TIER_SKIPPED / STEP4_TIER_SKIPPED / STEP5_TIER_SKIPPED（格式见 refs/routing.md 协议 6）。**例外（检出 `[拒绝异常]` 时）**：本子路径**不裁剪 Step 3**——但按 N 分叉：**N>0** → 按 mode=standard 启动独立监督 Agent 完整 4 维（拒绝理由由监督第④维复核；**不注入 Step 5 字段组**；Step 4/5 仍按本子路径规则裁剪，**且不输出 `STEP3_TIER_SKIPPED`**；若该 Step 3 触发 `[补充否决异常]`，其复核**不转移至 Step 5**——Step 5 保持裁剪，改为 **Step 3 复议留痕**：监督复议结论 + 双方理由必须写入 `STEP3_EXECUTED` 的 `notes`（或审计说明），并同步写入 `[CONVERGENCE_CHECK]` 的 `notes`）；**N==0**（trivial）→ 不启动 Step 3，**例外启动独立 Step 5** 复核拒绝理由与守恒等式（此时**不输出 `STEP5_TIER_SKIPPED`**，须输出 `STEP5_EXECUTED`）。主 Agent STEP2 合并判断 + 变更区域轻量通读共同作为最终通读轻量替代（不可省略）。**执行顺序（写死，不得乱序）**：`STEP2 合并 → 内联修复 + 对齐复检（P0 清零）→ 轻量通读（记录拆行差值）→ 收敛判定 → Gate Token`——轻量通读的 PASS 条件 (a)「所有已确认修复均已正确应用」（refs/convergence.md 协议 9）要求修复先行，故不得在 STEP2 合并后立即通读；收敛判定与 Gate Token 依次后置。**收敛判定（按分支锚定）**：①**无 Step 3 的加强审查轮（默认）** → **轻量通读完成后**（而非「STEP2 合并后」立即）输出 `[CONVERGENCE_CHECK]` 标记（按 raw 口径，理由见「问题数口径权威定义」；见 SKILL.md「收敛判定与硬阻止机制」节），替代标准路径 STEP5 后的收敛判定位置；②**有 Step 3 的轮（检出 `[拒绝异常]` 且 N>0 → mode=standard 独立监督）** → 与标准路径一致，**口径冻结后（Step 3 完成后）**输出——该 Step 3 可调整合并表，已输出的 `supplement/rejected/conservation` 在其完成前**非终值**，收敛判定禁止早于口径冻结（分支顺序：STEP2 合并 → 独立 Step 3（口径冻结）→ 内联修复 + 对齐复检（含监督新发现，P0 清零）→ 轻量通读 → 收敛判定 → Gate Token）；③**N==0 例外（独立 Step 5 复核）** → 该 Step 5 复核输出后再输出收敛判定（复核可标记 [问题数存疑] 触发重审，重审轮重新计算）。
