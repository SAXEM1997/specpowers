# specpowers-review 协议参考：路由
> 含协议 6；加载时机见 SKILL.md「按需加载表」。

## 协议 6: 两级路由算法（tier routing）

> 定义审查层级（tier）的路由矩阵、评估算法、层级裁剪声明及典型场景。由 specpowers-review SKILL.md 按需引用。路由决策由主 Agent 在 Step 0 执行，输出 `[TIER_ROUTING]` 标记。

### 路由矩阵

规模分桶按对象类型区分（详见下方算法预计算和 `bucket_doc` 函数）：
- **代码类**按 `file_count`：微小 1-3（`file_count=0` 归入微小——空 diff 回退后仍为 0 的归属，见协议 3「独立调用场景自检」）/ 中等 4-19 / 复杂 20-49 / 大规模 50+
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
- UltraReview：代码类完整层大代码 bucket（中等且file_count≥10/复杂/大规模）的 6-agent recipe（见本文件协议 8）

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
2b. 文档类 UltraReview 特殊路径: if 文档类且用户指定"UltraReview" → 跳过步骤 3-5, 直接 recipe=完整层多模型渐进式(3-agent), 但仍须经护栏1
3. 矩阵: matrix_tier = MATRIX[bucket][round]; tier = (base_tier!=null) ? max(base_tier, matrix_tier) : matrix_tier; if matrix_tier>base_tier reason+="矩阵升级"
4. 行数地板: floor_tier = floor(line_count); if floor_tier>tier → tier=floor_tier, reason+="行数地板升级"
5. 收敛闸门(仅 prev_raw!=null 时执行):
   - tier==关键 且 bucket==中等 且 prev_raw.p0_raw>0 → tier=完整, reason+="上轮含P0,阵容加强"（闸门口径 p0_raw>0 比收敛①的 p0_merged>1 保守，有意设计——**验证强度类判定统一取 raw**，见 SKILL.md「问题数口径权威定义」；旧账本缺 p0_raw 时按"验证强度类判定取保守值"视为 p0_raw>0 并升级完整，reason+="旧账本缺 p0_raw,保守升级完整"）
   convergence = (prev_raw==null) ? n/a : (闸门触发 ? failed : passed)
6. recipe = RECIPES[object_type][tier][bucket_class]
输出: [TIER_ROUTING] tier=<>, round=<>, file_count=<>, bucket=<>, line_count=<>, floor=<>, convergence=<passed|failed|n/a>, recipe=<>, reason=<>, expected_steps=[...]
```

**评估顺序（箭头=先后，非覆盖；每层只升不降）**：护栏 1（ledger 缺失 early-return）→ 手动覆盖 → 矩阵 → 行数地板（max 升级）→ 收敛闸门（条件升级）。

**文档类 bucket 函数（按 line_count）**：`bucket_doc(line≤100)=微小; bucket_doc(100<line≤300)=中等; bucket_doc(300<line≤600)=复杂; bucket_doc(line>600)=大规模`。**`line_count` 口径来源**：文档类＝**审查对象总行数**（`wc -l`，见协议 3「独立调用场景自检」）；代码类＝修改总行数（git diff），不进入本函数——700 行 design.md 只改 20 行时按总行数口径判（复杂→完整层），不得用 git diff 口径判微小。文档行数与内容复杂度正相关——1 个 design.md 可能描述 3 个文件的简单修改，也可能描述 50 个文件的系统重构。file_count 对文档无区分度（Gate 0/2 始终 1 文件，Gate 1 通常 4-6 文件），故文档类按 line_count 分桶。

> 文档类 bucket 阈值（100/300/600）与代码类 bucket 阈值（3/19/49 文件）语义对齐。行数地板对文档类仍生效（作为安全网）。

**行数地板（只升不降）**：`floor(line>500)={round1:完整, round2+:关键}; floor(200<line≤500)=关键; floor(line≤200)=矩阵tier`；`tier=max(tier, 地板tier)`。

> 护栏 1 是安全护栏（与行数地板同级），可覆盖手动覆盖——floor 语义是"不低于此 tier"，安全护栏升级手动值不违背用户控制。reason 字段会注明"手动覆盖被安全护栏覆盖"。

### 层级裁剪声明块

tier 裁剪专用，与协议 4「退化声明」区分。review 侧在裁剪掉的 STEP 输出此块。当前仅完整层加强审查子路径使用（裁剪 STEP3/4/5；**`[拒绝异常]` 例外分支除外**——N>0 该轮不输出 `STEP3_TIER_SKIPPED`（例外 Step 3 独立监督）、N==0 不输出 `STEP5_TIER_SKIPPED`（例外启动独立 Step 5 复核拒绝理由与守恒等式，须输出 `STEP5_EXECUTED`），见 SKILL.md「加强审查」节例外条）。**输出形态与 `STEP<N>_EXECUTED` 一致**：以 `` ```STEP<N>_TIER_SKIPPED `` 围栏行起始的 fenced code block（识别规则见协议 3「TIER_SKIPPED 块识别规则」）。

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

