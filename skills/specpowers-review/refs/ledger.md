# specpowers-review 协议参考：账本与缓存
> 含协议 1–2；加载时机见 SKILL.md「按需加载表」。

## 协议 1: 会话上下文账本

P0/P1/P2 计数和问题清单不写入文件，由主 Agent 在内存中维护会话上下文账本（dict 结构）。此举确保：(a) 数据存续受限于会话生命周期；(b) 不会因文件残留导致 Gate 误判；(c) 无法被其他进程/会话篡改。

### 账本结构

```
session_ledger = {
    "<gate_id>": {
        "gate": "Gate 0",
        "rounds": [
            {
                "round": 1,
                "tier": "full",       // 本轮路由到的层级（full|critical）
                "aborted": false,     // 用户在本轮中途终止时置 true；该轮不计入有效轮次，也不作为上轮基准
                "caliber": "merged",  // 本轮的收敛触发口径（merged=默认；raw=加强审查子路径轮）——供下一轮 ⑤ 判定两轮是否同口径
                "p0": 0,            // 修复后剩余 P0（向后兼容，Step 5 写入）
                "p1": 0,            // 修复后剩余 P1
                "p2": 0,            // 修复后剩余 P2
                // 注: 不追踪 p3（修复后剩余）——P3 为风格问题，不计入阻塞判定或剩余计数，仅通过 p3_raw/p3_merged 追踪发现数
                "p0_raw": 2,        // 原始发现 P0（Step 2 汇总时记录）——审计基线，不参与收敛触发
                "p1_raw": 5,        // 原始发现 P1
                "p2_raw": 3,        // 原始发现 P2
                "p3_raw": 2,        // 原始发现 P3
                // p*_merged = 合并后问题数（判定口径）：五个收敛触发条件默认由它计算（**加强审查子路径例外，按 raw——见 SKILL.md「问题数口径权威定义」**），具体条件见 `refs/convergence.md` 协议 7
                "p0_merged": 1,     // 合并后问题数 P0（Step 2 记录，Step 3 结束后冻结终值）
                "p1_merged": 3,     // 合并后问题数 P1
                "p2_merged": 2,     // 合并后问题数 P2
                "p3_merged": 1,     // 合并后问题数 P3
                "p0_rejected": 0,   // 未纳入数 P0（未纳入清单条数；守恒等式与 [拒绝异常] 检测用）
                "p1_rejected": 1,   // 未纳入数 P1
                "p2_rejected": 0,   // 未纳入数 P2
                "p3_rejected": 0,   // 未纳入数 P3
                "agent_rejected": 1,   // 主 Agent 判定不成立而拒绝的项数（未纳入清单中 disposition=agent_rejected 的条数，含被否决的监督 sup3 项；与 user_rejected 共同构成 rejected 的两个来源——**恒等式 rejected = agent_rejected + user_rejected**。[拒绝异常] 分子仅计其中计入 Σp*_raw 的部分——被否决 sup3 项不占分子，由 [补充否决异常] 单独承接。本例 = 1：守恒验算中 12 条原始发现里被拒绝的那 1 条 P1（1 ≤ 3 且 1/12 ≈ 8% ≤ 30%，不触发 [拒绝异常]））
                "user_rejected": 0,   // 用户裁决拒绝的项数（**仅** Step 2 阶段记入未纳入清单的 user_rejected 条数；Step 4 前置 Gate 的用户豁免 P0 **不更新此字段**——改记 user_exempt_p0）——与 agent_rejected 共同构成 rejected 的两个来源
                "user_exempt_p0": 0,  // Step 4 前置 Gate 后的用户豁免 P0 数（独立计数字段，单列；rejected = agent_rejected + user_rejected，**不含**此数）——须在 [GATE_PASSED]、[CONVERGENCE_CHECK] 与用户提示中单列体现（「用户豁免 P0」说明）
                "p0_supplement": 0, // 监督补充数 P0（p*_supplement 按 SKILL.md「问题数口径权威定义」的记账口径统计——发现型计入；更正型不计入。Step 3 结束后写入；Step 2 时恒为 0）。守恒等式：Σ(所有行的 sources 条数) + Σp*_rejected == Σp*_raw + Σp*_supplement
                "p1_supplement": 1, // 监督补充数 P1（Step 3 结束后写入；Step 2 时恒为 0）
                "p2_supplement": 0, // 监督补充数 P2（Step 3 结束后写入；Step 2 时恒为 0）
                "p3_supplement": 0, // 监督补充数 P3（Step 3 结束后写入；Step 2 时恒为 0）
                // 守恒验算：7 行（P0×1、P1×3、P2×2、P3×1，与 p*_merged 各分量一致）的 sources 条数分别为 2,2,2,1,2,1,2 = 12（其中 11 条来自 Step 1 的原始发现、1 条为监督补充 sup3#1，sup3# 不属于原始发现）；Σsources(12) + Σrejected(1) == Σraw(12) + Σsupplement(1) → 13 == 13 ✓
                "issues_summary": ["问题简述1", "问题简述2"],
                "timestamp": "2026-06-25T10:30:00Z"
            }
        ],
        "lessons_learned": [
            "教训1: ...",
            "教训2: ..."
        ],
        "final_readthrough": {
            "status": "pending|pass|fail",
            "timestamp": "2026-06-25T11:00:00Z",
            "remaining_issues": []
        }
    }
}
```

> **gate_id 取值规则（轮次隔离关键）**: gate_id 是每个 Gate 的唯一标识，**每个 Gate 必须使用独立的 gate_id**，确保轮次计数互不累加：
> - Gate 0（design 审查）→ `gate_0`
> - Gate 1（proposal/specs 审查）→ `gate_1`
> - Gate 2（plan 审查）→ `gate_2`
> - Gate 3（代码审查）→ `gate_3`
> - 独立调用（非 Gate 路由）→ `standalone`
>
> ⚠️ **禁止对不同 Gate 复用同一 gate_id**——否则 rounds 数组跨 Gate 累加，导致 round 误算（如 Gate 2 首轮被算成第 2 轮，路由错误降级）。

### 读写时机

| 操作 | 时机 | 执行者 |
|------|------|--------|
| 写入 rounds（原始发现数 + 合并后问题数 + 未纳入数 + 监督补充数；Step 2 时 supplement 恒为 0） | 每轮 Step 2 汇总完成后 | 主 Agent |
| 写入 rounds（修复后剩余 `p0`/`p1`/`p2`） | 每轮 Step 5 完成后（加强审查子路径见下方专用行；`p3` 不追踪） | 主 Agent |
| 写入 rounds（caliber + `user_rejected`） | 每轮 Step 2 汇总 / 收敛判定时（加强审查轮 caliber=raw） | 主 Agent |
| 写入 rounds（`user_exempt_p0`） | Step 4 前置 Gate 用户豁免 P0 后（如发生；**不更新 `user_rejected`**——该字段仅记 Step 2 未纳入清单的用户裁决拒绝数） | 主 Agent |
| 写入 rounds（merged 终值 + 监督补充数） | 每轮 Step 3 完成后（监督调整过合并表或有 [补充] 项时） | 主 Agent |
| 写入 rounds（`p*_merged` 误合拆行修正值） | Step 5 误合抽查发现误合、拆行之后，或加强审查子路径轻量通读之后（如发生）；加强审查子路径**检出 `[拒绝异常]` 的例外轮**——N>0 的例外 Step 3（监督第③维合并去重合理性）或 N==0 的例外独立 Step 5 发现误合并拆行之后（如发生） | 主 Agent |
| 写入 rounds（中止标记 `aborted`） | 用户在本轮 Step 1-5 进行中终止时 | 主 Agent |
| 写入 lessons_learned | 每轮审查 Step 5 完成后，追加本轮新教训 | 主 Agent |
| 写入 rounds（修复后剩余）+ lessons_learned【加强审查子路径】 | 该子路径**轻量通读 + 收敛判定输出后**（**默认子路径无 Step 5——`[拒绝异常]` N==0 例外除外**（该分支例外启动独立 Step 5）；执行顺序写死：STEP2 合并 → 内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token，见 SKILL.md「加强审查」节——内联修复先于轻量通读与收敛判定；**检出 `[拒绝异常]` 的例外分支**：N>0 的账本写入时机在例外 Step 3（口径冻结）→ 内联修复 + 轻量通读之后，N==0 在例外独立 Step 5 复核输出之后——`supplement/rejected/conservation` 取终值，见 SKILL.md「收敛判定（按分支锚定）」） | 主 Agent |
| 读取 rounds | 下一轮审查开始前（Step 0），构建上轮对比数据 | 主 Agent |
| 读取 lessons_learned | 下一 Gate 加载时，注入对齐 Agent prompt（Step 0） | 主 Agent |
| 写/读 final_readthrough | 写：最终通读完成后；读：最终通读执行前（判断是否需要执行） | 主 Agent |

> **final_readthrough 同名说明**: 会话上下文账本（协议 1）的 `final_readthrough` 与会话内审查状态绑定（每 Gate 独立 key），review-cache.json（协议 2）的 `final_readthrough` 为跨会话持久化缓存。两者同名但存储位置不同、生命周期不同——账本随会话消亡，缓存跨会话持久化。读取优先级：账本优先（反映当前会话最新状态），缓存作为跨会话恢复的 fallback。

> **向后兼容（两档回退，①②③④ 方向更严格；⑤ 需特殊处理）**:
> - **缺 `p*_merged` 但存在 `p*_raw`**（上一版账本）：计算收敛触发时**用 `p*_raw` 回退**（raw ≥ merged，回退方向更严格，不会漏审——仅对绝对阈值条件①②③④成立，且以「**不含监督补充、未经用户裁决升级严重度、未发生书面降级**」为前提：**总量**必然 raw ≥ merged，**逐级比较不保证**），输出 `[DEGRADED] 账本缺少合并后问题数，该轮回退 raw 口径`。回退只影响触发计算，不改写账本记录。
> - **⑤（差值型条件）特殊处理**：回退到 raw 不保证更严格。设本轮为 R、上轮为 R−1，当任一轮缺 `p*_merged` 时，**必须同时计算三个差值**：`A = p1_raw(R) − p1_raw(R−1)`、`B = p1_merged(R) − p1_raw(R−1)`（本轮有 merged 时 `p1_merged(R)` 取实际值，无则用 `p1_raw(R)` 代替——此时 B≡A）、`C = p1_raw(R) − p1_merged(R−1)`（**仅当上轮存在 `p*_merged` 时**）；**A > 3、B > 3、C > 3 任一成立即触发⑤**；三差值均不成立则不触发，并在 notes 中记录"使用了回退口径"。各差值的适用：A 恒可算（最保守的 raw 对 raw）；B 用于本轮有 merged 时捕获"合并后仍增长"；C 用于上轮有 merged 时取更严锚点（因 `p1_merged(R−1) ≤ p1_raw(R−1)`，以它为基准不放过上轮合并已压低的增长）。
> - **`p*_raw` 与 `p*_merged` 均缺失**（旧格式账本，仅 p0/p1/p2 修复后剩余数）：该轮数据视为不可用（unknown），不参与收敛判断条件计算，改用当轮数据做独立判断，输出 `[DEGRADED] 旧格式账本缺少原始发现数，回退独立判断`。
> - **回退轮的拒绝审计不可回放**：旧版账本无「未纳入清单」实体（被拒项曾以 `agent_rejected` 表行存在），故回退轮的 `p*_rejected` / `agent_rejected` / `user_rejected` 必须视为**未知（不是 0）**——`[拒绝异常]` 的占比判据在该轮**不适用**；`[DEGRADED]` 声明中须注明「拒绝审计不可回放」。
> - 两档都必须区分于"数据可用"：不得因缺字段而静默跳过触发条件⑤——⑤为差值型条件，缺同口径基准时按上方「⑤（差值型条件）特殊处理」执行（不简单回退取 raw）；两轮仍无法同口径比对时视为 n/a 并显式说明，不得省略输出。

### 跨 Gate 传递

同一会话内跨 Gate（如 Gate 0 → Gate 1 → Gate 2）时，主 Agent 将前几个 Gate 的账本数据通过 prompt 参数注入下一 Gate 的审查 Agent。传递内容：lessons_learned + 上一 Gate 的 issues_summary（用于对齐 Agent 逐条验证遗留问题是否已修复）。

各 Gate 的账本数据以 gate_id 为独立 key 存储，互不覆盖。跨 Gate 传递时，主 Agent 将所有已执行 Gate 的 lessons_learned 合并去重后注入。如因会话压缩导致前 Gate 数据丢失，仅从当前可用的数据注入，不阻塞审查。合并去重规则：相同场景+相同根因+相同结论视为重复，由主 Agent 逐条比对判断（启发式指引，非精确计算）。

> **轮次隔离（重要）**: 跨 Gate 传递的仅是 lessons_learned + issues_summary（审查经验共享）。**rounds（轮次计数）每 Gate 独立，绝不跨 Gate 累加**——每个 Gate 的 round 从 1 重新开始。例如 Gate 0 审了 2 轮，Gate 2 审查时 round 仍从 1 开始（不因 Gate 0 的 2 轮而变成 round 3）。这是 tier 路由正确性的前提（不同阶段产物应按各自首轮/后续轮独立路由）。

> **账本与缓存写入时机差异**: 账本写入时机分为两阶段：每轮 Step 2 后写入原始发现数（p0-3_raw）+ 合并后问题数（p0-3_merged，Step 3 后更新为终值）+ 未纳入数（p0-3_rejected），每轮 Step 5 后写入 lessons_learned 和修复后剩余计数（p0/p1/p2）。review-cache.json 写入时机为每 Gate 退出前（跨会话持久化到文件）。存在时间差——如会话在 Step 2 后、Gate 退出前崩溃，缓存可能丢失本轮 lessons_learned。差异总结如下表:
>
> | 数据存储 | 写入时机 | 持久化范围 | 崩溃丢失风险 |
> |---------|---------|-----------|------------|
> | 会话上下文账本 | 每轮 Step 2 + Step 5 后 | 会话内（内存） | 会话崩溃/压缩 → 全部丢失 |
> | review-cache.json | 每 Gate 退出前 | 跨会话（文件） | Step 5 后+退出前崩溃 → 本轮丢失 |

## 协议 2: 跨会话缓存 (review-cache.json)

### 设计定位

**尽力而为缓存，非 Gate 数据源**。文件丢失 → 从零开始，不影响审查正确性。文件存在 → 注入历史经验，提升审查质量。

### 位置与格式

```
.specpowers/review-cache.json
```

```json
{
  "lessons_learned": [
    "审查教训1: ...",
    "审查教训2: ..."
  ],
  "final_readthrough": {
    "status": "pending|pass|fail",
    "timestamp": "2026-06-25T11:00:00Z",
    "file_hashes": {"<relative_path>": "<sha256>", "...": "..."}
  }
}
```

**字段说明**:
- `file_hashes`（可选）: 最终通读审查对象文件的 SHA256 hash 映射。用于跨会话 staleness 检测——如文件已变更，缓存的 pass 状态失效。hash 计算不可用时留空。

**注意**: 仅存储两个字段。不存 P0/P1/P2 计数（纯会话上下文维护）。

### 读写规则

| 操作 | 时机 | 行为 |
|------|------|------|
| 读取 | specpowers-review 加载时（Step 0 之前） | 文件存在 → 注入 lessons_learned 到审查 Agent prompt。文件不存在 → 跳过，无提示 |
| 写入 lessons_learned | 每 Gate 全部轮次完成后（退出前） | 将本轮新产生的 lessons_learned 批次内部先去重，再与 review-cache.json 中已有的 lessons_learned 逐条比对去重。非重复项追加到已有数组末尾。文件不存在 → 创建 |
| 写入 final_readthrough | 最终通读完成后 | 更新 status + timestamp。同步计算并存储审查对象文件的 SHA256 hash（如 hash 计算可用）到 file_hashes 字段。如 hash 计算不可用（环境限制），file_hashes 留空 |
| 读取 final_readthrough | 跨会话重启后加载 specpowers-review 时 | status === "pass" → 检查 file_hashes（如存在）: 计算当前审查对象文件 hash 并比对。不匹配 → 将 status 重置为 pending，附带说明"缓存过期（文件已变更）"。hash 不可用时仅输出警告，继续使用缓存状态。status !== "pass" 或文件不存在 → 重新执行最终通读 |

**写入时机说明**: 缓存写入时机（每 Gate 退出前）与账本写入时机（每轮 Step 5 后）存在时间差。如会话在 Step 5 后、Gate 退出前崩溃，缓存可能丢失本轮 lessons_learned。此为可接受的降级行为（缓存语义为"尽力而为"）；下一会话重新积累相关教训。

> 首次写入前执行 `mkdir -p .specpowers` 确保目录存在。

**去重判断标准**: 主 Agent 读取 lessons_learned 的文字描述，判断以下三个维度是否全部实质相同——场景（问题发生的上下文）+ 根因（问题的直接原因）+ 结论（学到的教训/改进措施）。当三个维度全部实质相同时视为重复。当三个维度中有两个及以上实质相同时，倾向于视为重复（宁可少存重复教训，不可漏存不同教训）。此比对方法为启发式指引，非精确计算。

**尽力而为缓存操作化定义**:

| 场景 | 行为 | 是否告警 |
|------|------|---------|
| 文件不存在（读） | 跳过，无提示 | 否 |
| 文件损坏/JSON 解析失败（读） | 跳过，视为不存在 | 否 |
| 写入失败（磁盘满/权限） | 静默放弃本次写入 | 否 |
| 并发写入冲突 | 后写覆盖，不合并 | 否 |

### 与旧产物的关系

| 旧产物 | 处理方式 |
|--------|---------|
| `.review-summary.json` | 移除所有引用，不再创建或读取 |
| `.specpowers/review-state/<gate_id>.json` | 移除所有引用，不再创建或读取 |
| `.specpowers/review-cache.json` | **新增**，语义为"尽力而为缓存"，非"Gate 数据源" |

