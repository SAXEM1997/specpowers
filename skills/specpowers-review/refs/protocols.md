# specpowers-review 协议与数据结构参考

> 由 specpowers-review SKILL.md 按需引用。仅在需要查阅具体格式定义时读取。

## 目录

1. [协议 1: 会话上下文账本](#协议-1-会话上下文账本)
2. [协议 2: 跨会话缓存 (review-cache.json)](#协议-2-跨会话缓存-review-cachejson)
3. [协议 3: 执行标记格式](#协议-3-执行标记格式)
4. [协议 4: 退化声明标准协议](#协议-4-退化声明标准协议)
5. [协议 5: 上下文传递与注入模板](#协议-5-上下文传递与注入模板)
6. [协议 6: 两级路由算法（tier routing）](#协议-6-两级路由算法tier-routing)
7. [协议 7: 收敛判定与硬阻止输出模板](#协议-7-收敛判定与硬阻止输出模板)
8. [协议 8: UltraReview 详细协议（Steps A-F）](#协议-8-ultrareview-详细协议steps-a-f)
9. [协议 9: 最终通读 Gate 详细流程](#协议-9-最终通读-gate-详细流程)

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
                "p0": 0,            // 修复后剩余 P0（向后兼容，Step 5 写入）
                "p1": 0,            // 修复后剩余 P1
                "p2": 0,            // 修复后剩余 P2
                // 注: 不追踪 p3（修复后剩余）——P3 为风格问题，不计入阻塞判定或剩余计数，仅通过 p3_raw 追踪原始发现数
                "p0_raw": 1,        // 原始发现 P0（Step 2 汇总时记录）
                "p1_raw": 4,        // 原始发现 P1
                "p2_raw": 3,        // 原始发现 P2
                "p3_raw": 2,        // 原始发现 P3
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
| 写入 rounds | 每轮审查 Step 5 完成后 | 主 Agent |
| 写入 rounds（原始发现数） | 每轮审查 Step 2 汇总完成后 | 主 Agent |
| 写入 lessons_learned | 每轮审查 Step 5 完成后，追加本轮新教训 | 主 Agent |
| 读取 rounds | 下一轮审查开始前（Step 0），构建上轮对比数据 | 主 Agent |
| 读取 lessons_learned | 下一 Gate 加载时，注入对齐 Agent prompt（Step 0） | 主 Agent |
| 写入 final_readthrough | 最终通读完成后 | 主 Agent |
| 读取 final_readthrough | 最终通读执行前，判断是否需要执行 | 主 Agent |

> **final_readthrough 同名说明**: 会话上下文账本（协议 1）的 `final_readthrough` 与会话内审查状态绑定（每 Gate 独立 key），review-cache.json（协议 2）的 `final_readthrough` 为跨会话持久化缓存。两者同名但存储位置不同、生命周期不同——账本随会话消亡，缓存跨会话持久化。读取优先级：账本优先（反映当前会话最新状态），缓存作为跨会话恢复的 fallback。

> **向后兼容**: 旧格式账本仅有 p0/p1/p2（修复后剩余数），缺失 _raw 后缀字段。
> 读取旧格式时，该轮数据视为不可用（unknown），不参与收敛判断条件计算，
> 改用当轮数据做独立判断，输出 `[DEGRADED] 旧格式账本缺少原始发现数，回退独立判断`。

### 跨 Gate 传递

同一会话内跨 Gate（如 Gate 0 → Gate 1 → Gate 2）时，主 Agent 将前几个 Gate 的账本数据通过 prompt 参数注入下一 Gate 的审查 Agent。传递内容：lessons_learned + 上一 Gate 的 issues_summary（用于对齐 Agent 逐条验证遗留问题是否已修复）。

各 Gate 的账本数据以 gate_id 为独立 key 存储，互不覆盖。跨 Gate 传递时，主 Agent 将所有已执行 Gate 的 lessons_learned 合并去重后注入。如因会话压缩导致前 Gate 数据丢失，仅从当前可用的数据注入，不阻塞审查。合并去重规则：相同场景+相同根因+相同结论视为重复，由主 Agent 逐条比对判断（启发式指引，非精确计算）。

> **轮次隔离（重要）**: 跨 Gate 传递的仅是 lessons_learned + issues_summary（审查经验共享）。**rounds（轮次计数）每 Gate 独立，绝不跨 Gate 累加**——每个 Gate 的 round 从 1 重新开始。例如 Gate 0 审了 2 轮，Gate 2 审查时 round 仍从 1 开始（不因 Gate 0 的 2 轮而变成 round 3）。这是 tier 路由正确性的前提（不同阶段产物应按各自首轮/后续轮独立路由）。

> **账本与缓存写入时机差异**: 账本写入时机分为两阶段：每轮 Step 2 后写入原始发现数（p0-3_raw），每轮 Step 5 后写入 lessons_learned 和修复后剩余计数（p0/p1/p2）。review-cache.json 写入时机为每 Gate 退出前（跨会话持久化到文件）。存在时间差——如会话在 Step 2 后、Gate 退出前崩溃，缓存可能丢失本轮 lessons_learned。差异总结如下表:
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

## 协议 3: 执行标记格式

### 标记块格式

specpowers-review 内部每个 Step 结束后，对应子 Agent 输出以下结构化标记块：

```markdown
\`\`\`STEP<N>_EXECUTED
status: complete|degraded|failed
mode: standard|transferred_to_step5|trivial   # 仅 Step 3 必填（描述合并验证部署形式），其他 Step 省略
raw_count_sum: p0=N p1=N p2=N p3=N   # 仅 Step 1 必填（各 Agent RAW_COUNT 求和，原始发现数）
agents: [<agent_name>(<model>), ...]
issues_found: <N>
degradation: none|<具体原因>|<影响分析>|<替代措施>
notes: <自由文本>   # 可选（如 Step 5 兼并合并验证声明、回退标注等）
ref: AgentId=<id>, tokens=<N>
\`\`\`
```

> **degradation 字段说明**: pipe 三段对应协议 4 退化声明三要素：(a) 具体原因（缺失能力+模型名），(b) 影响分析（尝试过的调用方式+失败信息），(c) 替代措施（降级路径选择依据）。`none` 表示无退化。

> **mode 字段说明（仅 Step 3 必填）**: 描述 Step 3 合并验证的部署形式，独立于 degradation（能力损失）。下文 N=p0_raw+p1_raw+p2_raw（不计 p3_raw，定义见 SKILL.md Step 3；协议 5 注入表中的 N 为轮次，同名不同义）。取值：`standard`=独立监督 Agent 执行（p0_raw≥3 或 N>15，完整 4 维）；`transferred_to_step5`=不启动独立 Agent，合并验证 2 维（溯源+遗漏）转移至 Step 5 兼并执行（N∈[1,15] 且 p0_raw≤2，结构重组非能力损失，故 degradation=none；p0_raw≥1 时 Step 5 追加严重度校准抽查）；`trivial`=无 P0/P1/P2 问题特判（N==0；p3_raw>0 时主 Agent 自修 P3 后走 Step 5 常规验证，防零进展循环）。详见 SKILL.md Step 3。

> **ref 行说明**: `ref: AgentId=<id>[, tokens=<N>]` 由**主 Agent 在汇总时追加**（非子 Agent 输出）。AgentId 从子 Agent 的 `Agent` 工具返回值提取（必填）；tokens 为主 Agent 估算的消耗（可选字段，不可用时省略或填 `null`）。AgentId 格式为 `a` + 16 位 hex（系统生成）。主 Agent 在遵循协议时从该路径获取真实 AgentId；但技术上可生成格式合法的虚假值——此为辅助真实度信号，非密码学验证。完整限制声明见标记块验证规则中的"验证能力与限制"表。

> **零问题标记块强制要求**: **无论 issues_found 是否为 0，每个执行的 Step 必须输出 STEP<N>_EXECUTED 标记块。** `issues_found: 0` = Step 正常完成且未发现新问题；标记块缺失 = Step 未执行。两者有本质区别。父技能的验证逻辑依赖标记块的存在性来判断审查是否完成，零问题 Step 省略标记块将导致父技能误判为审查未完成并阻塞当前 Phase。
>
> **完整性检查表的前提**: 完整性检查表中的"应存在的标记块"以此规则为前提——每个 Step 的标记块均应存在（无论 issues_found 是否为 0），缺失任一块即视为审查未完成。

### 各 Step 标记块定义

| Step | 输出者 | status 取值 | degradation 说明 |
|------|--------|------------|-------------------|
| Step 1 | 主 Agent（汇总三个子 Agent 完成状态） | complete / degraded | 某 Agent 未完成（原因+重试次数+替代措施）；汇总 raw_count_sum |
| Step 2 | 主 Agent（自执行，无子 Agent） | complete | none（主 Agent 执行，无降级路径）——标记块由主 Agent 为自己执行的 Step 输出，ref 行 AgentId 填 `self`，tokens 为主 Agent 执行 Step 2 的估算消耗 |
| Step 3 | 按 mode 分叉（见上方 mode 字段说明）：standard=必须启动独立监督 Agent；transferred_to_step5=主Agent自执行(转移至Step5)；trivial=主Agent自执行(N==0) | complete / degraded | mode=standard（p0_raw≥3 或 N>15 启动独立监督 Agent 完整4维；单一模型时声明缺少独立视角）；mode=transferred_to_step5（主 Agent 自执行，agents=self，degradation=none，合并验证转移至 Step 5；p0_raw≥1 时 Step 5 追加严重度校准抽查）；mode=trivial（N==0，主 Agent 自执行；p3_raw>0 时自修 P3 后走 Step 5） |
| Step 4 | 修复子 Agent + 主 Agent | complete / degraded / failed | 子 Agent 不可用时声明"退回主 Agent 自行修复"；修复重试超限声明"修复失败" |
| Step 5 | Quick Review Agent | complete / degraded | 单一 Agent 时声明"缺少独立视角"；Step 4 退化时声明"执行两轮补偿验证"；mode=transferred_to_step5 时经 notes 字段输出"兼并 Step 3 合并验证（溯源+遗漏+问题数核对；p0_raw≥1 时含严重度校准抽查）"（非 degradation——与 SKILL.md Step 5 统一） |
| 最终通读 | 独立子 Agent 或主 Agent（自执行） | complete / fail | 沿用通用标记块格式（STEP_FINAL_READTHROUGH）。agents 填子 Agent 模型名或 self（主 Agent 自执行）。issues_found 填残余问题数。子 Agent 工具不可用时由主 Agent 自执行，degradation 声明"单一模型，最终通读缺少独立视角" |

**多修复子 Agent 合并规则（Step 4）**: 当修复项涉及 ≥ 2 个无依赖文件时，拆分为多个修复子 Agent 并行执行（以文件为分组维度，无修复项数量阈值）；单文件内 > 10 条时分批顺序执行（见 SKILL.md Step 4 "同文件不并发"硬约束），主 Agent 收集所有修复子 Agent 的输出后，合并为**单个** STEP4_EXECUTED 标记块。issues_found 汇总所有修复子 Agent 发现的新问题数。agents 列表包含所有修复子 Agent 的名称和模型。degradation 取所有修复子 Agent 中最严重的退化状态（严重度序: `failed` > `degraded` > `complete`；多个 `degraded` 时保留覆盖范围最广的一条，如同时有 '子Agent不可用' 和 '环境不支持并行'，保留前者因其覆盖范围更广）。

### 标记块验证规则

**主 Agent 规则**:
- 只能汇总子 Agent 的实际输出，不能凭空生成标记块
- **例外**: Step 2（主 Agent 自执行）、Step 3 转移/trivial 路径（mode=transferred_to_step5|trivial，主 Agent 自执行）、最终通读（主 Agent 自执行路径）除外——主 Agent 为自己执行的 Step 输出标记块，ref 行 AgentId 填 `self`
- 汇总方式: 将子 Agent 输出中的 `STEP<N>_EXECUTED` 块原样附加到审查报告中。标记块附加在审查报告的执行日志表格之后，统一以 `## 执行标记原始记录` 标题开头，按 Step 编号排序
- 如果某 Step 的子 Agent 未输出标记块 → 主 Agent 标注 `STEP<N>_EXECUTED: missing`（不可补写内容）
- 汇总时必须在每个标记块末尾追加 `ref` 行（AgentId 必填，从子 Agent 的 `Agent` 工具返回值中提取，格式: `a` 开头 + 16 位 hex，由系统生成）；tokens 为可选估算值，不可用时省略或填 `null`。格式: `ref: AgentId=<id>[, tokens=<N>]`

**父技能（验证者）规则**:
- specpowers-review 返回后，父技能在 specpowers-review 的输出中检查每个应执行的 Step 的标记块是否存在
- 标记块完整性检查表:

| Gate | 应存在的标记块 |
|------|-------------|
| Gate 0/1/2（文档类） | 按 [TIER_ROUTING] expected_steps 动态检查（非固定 STEP 集）。无 TIER_ROUTING 标记时回退旧逻辑：STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 3（代码类） | 按 [TIER_ROUTING] expected_steps 动态检查（非固定 STEP 集）。无 TIER_ROUTING 标记时回退旧逻辑——2 文件且 ≤200 行：STEP1, STEP2；其他：STEP1, STEP2, STEP3, STEP4, STEP5 |
| 最终通读 | STEP_FINAL_READTHROUGH（独立调用场景由 SELF_VERIFY 检查，非父技能验证范围） |

> **动态检查规则**: 父技能（验证者）搜索 `[TIER_ROUTING]` 标记，提取 `expected_steps` 数组，以此作为应存在的 STEP 列表。无 TIER_ROUTING 标记时回退旧逻辑（上表"回退旧逻辑"列）以保证向前兼容。
>
> **TIER_SKIPPED 块识别规则**: `STEP<N>_TIER_SKIPPED` 块（见协议 6）表示 tier 裁剪主动跳过的 Step。识别规则：(a) 该块既不计入已执行的 STEP，也不计入缺失；(b) 仅当对应 STEP 号在 expected_steps 中且未找到 STEP<N>_EXECUTED 时，才视为缺失；(c) TIER_SKIPPED 块本身不参与完整性判断——父技能在 expected_steps 检查之外可忽略之。

> **加强审查标记块均在 specpowers-review 内部产出，非跨 skill**: specpowers-apply 的 code-review 结果作为上下文**注入** specpowers-review 的对齐 Agent prompt。对齐 Agent 接收 code-review 结果后执行对齐检查，输出 `STEP1_EXECUTED`（标记块中记录 code-review 结果引用）；主 Agent 综合判断后输出 `STEP2_EXECUTED`。两个标记块均由 specpowers-review 内部 Agent 产出，父技能（specpowers-apply）在 Gate 3 返回后统一检查。

- 缺失任一块 → 视为审查未完成，阻塞当前 Phase，要求重新执行 specpowers-review
- 检查方法: 搜索以 `` ```STEP<N>_EXECUTED `` 开头的 fenced code block（即匹配行首的 `` ``` `` 后紧跟 `STEP<N>_EXECUTED`，作为 fenced code block 的起始标记）。此匹配方式利用标记块固定为 fenced code block 的事实，排除审查报告正文中的示例引用或讨论提及。如果审查报告使用了非标准 code fence（如 `~~~`），同时搜索 `~~~STEP<N>_EXECUTED`
- 辅助真实度信号: 检查每个标记块末尾的 `ref: AgentId=<id>, tokens=<N>` 行——AgentId 格式必须匹配 `^a[0-9a-f]{16}$`，格式不符或缺失 → 记录警告但仍以标记块存在性为主要判断依据

**验证能力与限制（显式声明）**:

标记块验证机制能检测和不能检测的场景:

| 场景 | 能否检测 | 说明 |
|------|---------|------|
| 主 Agent 遗忘输出标记块 | 能 | 父技能搜索 `STEP<N>_EXECUTED` 字符串，缺失即发现 |
| 子 Agent 未执行但主 Agent 不伪造 | 能 | 子 Agent 未输出标记块 → 主 Agent 标注 `missing` → 父技能检测到缺失 |
| 主 Agent 故意跳过 Step 后伪造标记块 | 不能 | 主 Agent 可输出虚假的 `STEP<N>_EXECUTED` 块，父技能的字符串搜索无法区分真伪 |
| 主 Agent 伪造 AgentId | 不能（但有门槛） | AgentId 格式可验证（`a` + 16 hex），但无法验证是否为系统真实分配——主 Agent 可生成格式合法的虚假 AgentId。此信号提升伪造门槛但非技术性防伪 |

**这是纯 SKILL.md 文本协议的固有边界**: 所有指令均为文本指令，无进程隔离、无代码强制。Agent 若选择忽略指令，无技术手段阻止。双层验证的设计目标是将"静默跳过审查"从单 Agent 的疏忽/违规升级为需要在审查阶段和验证阶段中做出不一致行为（同一 Agent 的两个时序分离角色），显著提升跳过门槛，但不声称技术性不可伪造。

**多轮循环标记块保留策略**: 多轮修复-重审循环产生多套标记块时，主 Agent 按轮次分组（`## Round N 执行标记`）。父技能在搜索标记块时，如存在多轮标记块，仅检查**最后一轮**（以最大的 Round N 标题为准）的标记块完整性。前轮标记块因修复重审已过时，不参与完整性判断。

**同轮内多标记块权威规则**: 同轮内同一 STEP 输出多个标记块时，以最后输出为权威（后续标记块可能是回退/重试后的最终状态）。适用场景：Step 4 退化补偿回退路径——在原 STEP3_EXECUTED（transferred_to_step5）后追加新的 STEP3_EXECUTED（mode=standard，标注"回退自 transferred_to_step5"），父技能以最后输出的标记块判定该 Step 状态。与多轮保留策略互补：跨轮以最后一轮为准，同轮内以最后一个标记块为准。

### 双层验证原理

```
审查阶段（specpowers-review Skill 上下文）
  └── 输出 STEP<N>_EXECUTED 标记块（子 Agent 产生，主 Agent 汇总）
  └── 附带 ref: AgentId=<id>, tokens=<N>（辅助真实度信号）
        │
        │  Skill 边界（时序分离验证，非进程隔离）
        │
验证阶段（父技能 Skill 上下文，同一 Agent 的独立验证角色）
  └── 检查标记块完整性 + AgentId 格式 → 通过/阻塞
```

这构成了**双层验证**: 审查 Agent 无法自我声明"已完成"——必须由父技能验证阶段（同一 Agent 的独立验证角色，时序分离）检查标记块的存在性。审查阶段与验证阶段在同一 Agent 的不同 Skill 上下文中执行，虽非进程级隔离，但将"静默跳过"从单一步骤的疏忽升级为需要在两个阶段中做出不一致行为。

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

> 此文件是 Phase 流转控制标记（语义类似 `.phase1-skipped`），非审查状态产物。独立调用（gate_id=standalone）不输出 Gate Token（无父技能消费）。首次写入前执行 `mkdir -p .superpowers` 确保目录存在。

> **衔接注释（guard 调用）**: token 写入与 guard 调用顺序为 **token 先写、guard 后调**——review 写 `.superpowers/.gate-passed-<N>` 后，由父技能（design/plan/apply/archive）在验证链通过后调 `node <SKILL_BASE>/scripts/workflow-guard.mjs exit phase<N> --apply`（子技能 Gate 出口为唯一 guard 调用责任方；`<SKILL_BASE>` 占位符定义见入口技能「脚本路径解析」节）。独立调用 review（gate_id=standalone）不触发 guard。

### 独立调用场景自检

当 specpowers-review 被用户直接调用（非通过 specpowers-design/plan/apply/archive 的 Gate 路由）时，不存在父技能执行双层验证。此时主 Agent 在最后一个 STEP 完成后（加强审查为 STEP2，其他为 STEP5）自行执行标记块完整性检查：

1. 从 `[TIER_ROUTING]` 标记中提取 `expected_steps`，动态确定应存在的 STEP 集合（无 `[TIER_ROUTING]` 标记时回退为全集 `[STEP1, STEP2, STEP3, STEP4, STEP5, STEP_FINAL_READTHROUGH]`）
2. 搜索 `STEP<N>_EXECUTED` 和 `STEP<N>_TIER_SKIPPED` 标记块，确认 `expected_steps` 中的每个 STEP 要么已输出 `_EXECUTED` 标记块，要么已输出 `_TIER_SKIPPED` 标记块
3. 确认最终通读标记块已输出（缺失时标注"最终通读可能未执行"）
4. 确认 `[CONVERGENCE_CHECK]` 标记已输出（缺失时标注"收敛判定可能未执行"）
5. 以 `[SELF_VERIFY]` 标记输出检查结果

**自检结果格式**:

```[SELF_VERIFY]
verified_steps: <动态取值——从 [TIER_ROUTING] expected_steps，无 TIER_ROUTING 时回退全集>
missing_steps: <expected_steps 中既无 _EXECUTED 也无 _TIER_SKIPPED 的 STEP>
skipped_steps: <被 tier 裁剪的 STEP 列表——由 STEP<N>_TIER_SKIPPED 标记识别，识别规则见本协议「标记块验证规则」的 TIER_SKIPPED 块识别规则>
all_present: true|false
```

> `missing_steps` 排除已输出 `STEP<N>_TIER_SKIPPED` 的 STEP（tier 裁剪是预期行为，非缺失）。`skipped_steps` 记录因 tier 裁剪而未执行的 STEP，用于诊断 tier 路由是否按预期工作。

此自检与父技能验证处于同一信任域（同一 Agent），但至少确保标记块在独立调用场景下不会被完全忽略。独立调用场景下 `[GATE_BLOCKED]` 标记不触发外部阻塞（无父技能读取），仅作为信息性声明。

> **注**: 独立调用 specpowers-review 时，`修改总行数` 由主 Agent 自行计算：
> ```bash
> BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|origin/||'); BASE=${BASE:-master}; git diff --shortstat $(git merge-base $BASE HEAD)..HEAD | awk '{s=$4+$6; if(s=="") s=0; print s}'
> ```
> （与 specpowers-apply Step 0 同款逻辑；specpowers-apply「降级声明」中的"与 review 独立调用同款降级策略"即指此处）
> 若无 git 历史可用（如新项目），回退为手动估算文件行数。

## 协议 4: 退化声明标准协议

当任何 Step 无法按标准路径执行时（模型不足/Agent 工具不可用/并行不可用/修复重试超限），对应 Agent 必须在 `STEP<N>_EXECUTED` 标记块的 `degradation` 字段中输出退化声明，包含以下三要素：

| 要素 | 内容 | 示例 |
|------|------|------|
| (a) 具体缺失能力 + 模型名 | 标准路径要求什么、当前缺什么 | "标准路径要求 3 个不同模型，当前仅 Haiku 可用" |
| (b) 尝试过的调用方式 + 失败信息 | 尝试了什么、为什么失败 | "尝试调用 Opus 作为结构 Agent → 返回模型不可用" |
| (c) 降级路径选择依据 | 为什么选此降级路径而非其他 | "降级到串行单模型（落地→对齐→结构），此路径最小化交叉验证损失" |

### 各 Step 退化声明位置

| Step | 退化触发条件 | 退化路径 | 声明输出者 |
|------|------------|---------|-----------|
| Step 1 | 仅 2 个模型可用 | 结构+对齐不同模型，落地与对齐共用 | 主 Agent 汇总 |
| Step 1 | 仅 1 个模型可用 | 串行执行（落地→对齐→结构） | 主 Agent 汇总 |
| Step 3 | 仅 1 个模型可用 | 同模型执行监督，声明"缺少独立视角" | 监督 Agent |
| Step 3 | N∈[1,15] 且 p0_raw≤2 | **非退化**——mode=transferred_to_step5，合并验证 2 维转移至 Step 5 兼并执行（degradation=none，结构重组非能力损失） | 主 Agent |
| Step 3 | N==0 | **非退化**——mode=trivial，无 P0/P1/P2 问题特判，无合并验证对象（degradation=none） | 主 Agent |
| Step 4 | 子 Agent 工具不可用 | 退回主 Agent 自行修复 | 主 Agent |
| Step 4 | 环境不支持并行 | 修复子 Agent 串行执行 | 主 Agent |
| Step 5 | 仅 1 个 Agent 可用 | 声明"缺少独立视角" | Quick Review Agent |
| Step 5 | Step 4 退化 | 执行两轮补偿验证 | Quick Review Agent |
| 最终通读 | 子 Agent 工具不可用 | 由主 Agent 自行执行 | 主 Agent |

> **多降级并发格式**: 多降级条件同时触发时，`degradation` 字段用分号拼接多个三要素。注意：N∈[1,15] 且 p0_raw≤2 的转移路径用 mode=transferred_to_step5 标记（非 degradation，degradation=none）。

退化声明对所有降级场景强制要求，不可省略。这构成**横切规则**，覆盖 Step 3/4/5 的全部降级分支。

### 模型多样性降级细则（多模型渐进式审查 3 Agent）

多模型渐进式审查（SKILL.md「模型多样性规则」第 5 条降级策略）的操作细则，与上表 Step 1 退化行对应：

- 仅两个模型可用时：结构 + 对齐使用不同模型，落地与对齐共用模型。落地审查先行执行，其完整审查报告（问题列表 + 严重度 + 证据 + 边界条件检查结果）作为对齐 Agent 的额外输入（追加到对齐 Agent 的审查 prompt 中），以补偿模型重叠带来的视角损失。
- 仅单一模型可用时：三个 Agent 串行执行（非并行），顺序为 落地 → 对齐 → 结构（落地发现的具体问题为后续 Agent 提供上下文），在审查报告中声明"单一模型，缺少独立视角交叉验证"。

## 协议 5: 上下文传递与注入模板

### 上下文传递机制表

| 注入项 | 注入内容 | 注入方式 | 注入时机 | 附加指令 |
|--------|---------|---------|---------|----------|
| 模型配置 | 每个 Step 使用的模型列表 | 主 Agent 通过 prompt 参数传递 | Step 启动前 | 无（模型选择由主 Agent 决定） |
| 规范上下文 | 当前 Gate 的对齐检查目标（design/specs/plan/code） | 主 Agent 通过 prompt 参数传递 | Step 启动前 | 无（规范内容为审查输入） |
| 上轮审查经验 | lessons_learned（来自账本或 review-cache.json） | 主 Agent 通过 prompt 参数传递 | Step 0 / 对齐 Agent 注入 | 无（经验为辅助输入） |
| 标记块输出指令 | 每个子 Agent 完成审查/修复/检查后，必须在输出末尾附加结构化标记块 | 主 Agent 通过 prompt 参数注入子 Agent | 每个 Step 启动前 | **强制**: 子 Agent 需输出 STEP<N>_EXECUTED 标记块 |

截断策略：注入内容总长度超过 Agent prompt 限制时（通常 > 8000 字），优先保留"问题清单 + 严重度 + 证据"部分，截断"分析过程"和"冗余上下文"，截断处标注 `[... 已截断，完整报告已由主 Agent 在合并阶段审查 ...]`。合并判断表不截断。

### 子 Agent prompt 注入模板

主 Agent 在启动每个子 Agent 时，将以下指令附加到 prompt 参数末尾：

> **标记块格式**: 见本文件协议 3「标记块格式」节（`STEP<N>_EXECUTED` fenced code block 完整定义 + 字段说明）。注入时将 `\`\`\`` 还原为普通三反引号（```），否则父技能无法匹配标记块。

注入指令要点（基于协议 3 格式）：
- 子 Agent 完成审查/修复/检查后，必须在输出末尾附加 `STEP<N>_EXECUTED` 标记块
- `ref: AgentId=<id>, tokens=<N>` 行由**主 Agent 在汇总时追加**（非子 Agent 输出）
- **无论 issues_found 是否为 0，每个执行的 Step 必须输出此标记块**
- 标记块缺失将被父技能视为 Step 未执行，导致当前 Phase 被阻塞
- **完整性指令（强制注入，不可省略）**: 每个审查子 Agent 的 prompt 必须包含"请完整评审以下全部内容，逐章/逐节/逐文件审查，不要跳过任何章节、段落或文件，不要省略待评审内容。无论这是第几轮审查，都必须以第 1 轮的标准独立完整评审全部内容"。多轮审查中主 Agent 不得在子 Agent prompt 中缩减审查范围（如"只查修改部分"、"快速过一遍"）。违反 = 子 Agent 仅审查部分内容，遗漏问题进入下游 Phase

### Step 4 转移路径知情声明注入模板（mode=transferred_to_step5 时）

当 Step 3 转移至 Step 5（N∈[1,15] 且 p0_raw≤2）时，主 Agent 启动修复子 Agent 的 prompt **首段**必须注入以下知情声明：

> 本轮合并验证尚未执行（Step 3 已转移至 Step 5 兼并）。你修复的合并判断表为 Step 2 版本（未经独立监督交叉验证）。修复完成后，Step 5 的 Quick Review Agent 将执行合并验证（溯源+遗漏+问题数核对）+ 修复验证双重检查。**若你在修复过程中发现合并表疑似遗漏某条审查发现，请主动在输出中上报（标注 [疑似合并遗漏]）**——这是额外的横向检测点。

此声明让修复子 Agent 知情，捕获修复过程中发现的合并遗漏。

### Step 5 兼并合并验证模式注入模板（mode=transferred_to_step5 时）

当 Step 3 因 N∈[1,15] 且 p0_raw≤2 转移至 Step 5 时，主 Agent 启动 Quick Review Agent 的 prompt **必须注入**以下字段（不得省略，否则 Step 5 无法做合并验证+问题数核对）：

| 必注入字段 | 内容 | 用途 |
|---|---|---|
| 全部审查 Agent 原始报告全文 | Step 1 各 Agent 的完整审查报告（含 RAW_COUNT 行） | 溯源检查 + 遗漏检测 + 问题数核对 |
| 最终合并判断表 | Step 2 输出的合并表（含 disposition 列） | 溯源/遗漏对照基准 |
| 账本 rounds[N-2].p*_raw | 上一轮原始发现数（N 为当前轮次，rounds 0-indexed，上一轮=N-2） | 趋势对照 |
| Step 1 raw_count_sum | STEP1_EXECUTED 中汇总的各 Agent 计数求和 | 问题数核对（反偷懒核心） |

强制指令（追加到 Quick Review Agent prompt）：
- 问题数核对必须从注入的原始报告**重新计算**各 Agent RAW_COUNT 求和（不从 STEP1_EXECUTED 的 raw_count_sum 直接取信——防止主 Agent 篡改），与合并表 p*_raw 对照
- 兼并执行合并验证 3 项：溯源检查、遗漏检测（区分 disposition=user_adjudicated 的用户裁决项 vs agent_rejected 的主 Agent 拒绝项）、问题数核对（重算各 Agent RAW_COUNT 的 p0 合计 vs 合并表 p0_raw、总条数 vs raw_count_sum 求和，不一致且无书面去重依据 → [问题数存疑] 触发重审升级独立 Step 3）
- p0_raw≥1 时追加第 4 项严重度校准抽查：合并表每条 P1 逐条对照原始报告严重度，P0→P1 降级须有书面理由（用户裁决或事实依据），无理由降级 → [问题数存疑] 触发重审升级
- STEP5_EXECUTED 中注明"兼并 Step 3 合并验证（溯源+遗漏+问题数核对；p0_raw≥1 时含严重度校准抽查）"

> 问题数核对为启发式检测：合法去重（多 Agent 报同一问题）会导致合并表计数小于原始报告计数。量化容差：合并表计数 ≥ raw_count_sum × 0.6 且 p0 合计比对一致时视为合法去重；合并表计数 < raw_count_sum × 0.6 或 p0 合计不一致 → [问题数存疑]。
>
> 截断策略同协议 5 通用规则：原始报告超长时优先保留"问题清单+严重度+证据+RAW_COUNT 行"，截断分析过程。

## 协议 6: 两级路由算法（tier routing）

> 定义审查层级（tier）的路由矩阵、评估算法、层级裁剪声明及典型场景。由 specpowers-review SKILL.md 按需引用。路由决策由主 Agent 在 Step 0 执行，输出 `[TIER_ROUTING]` 标记。

### 路由矩阵

规模分桶按对象类型区分（详见下方算法预计算和 `bucket_doc` 函数）：
- **代码类**按 `file_count`：微小 1-3 / 中等 4-19 / 复杂 20-49 / 大规模 50+
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
- `RECIPES`: SKILL.md "recipe 表"（代码类完整层按 bucket_class 选 加强审查/UltraReview）
- UltraReview：代码类完整层大代码 bucket（中等且file_count≥10/复杂/大规模）的 6-agent recipe（见本文件协议 8）

```text
输入: object_type, file_count, line_count (apply 传入)
预计算:
  # 文档类 bucket 按 line_count（文档行数与内容复杂度正相关；file_count 对文档无区分度）
  # 代码类 bucket 按 file_count（变更文件数直接反映代码变更范围）
  bucket = (object_type==文档) ? bucket_doc(line_count) : bucket(file_count)
  bucket_class = (object_type==代码) ? ((bucket==微小 || (bucket==中等 && file_count<10)) ? 小代码 : 大代码) : null
  round = (!ledger || !ledger[gate_id]) ? 1 : ledger[gate_id].rounds.length + 1   # round 基于【当前 gate_id】的 rounds.length。不同 Gate 的 gate_id 不同，轮次独立计数。gate_id 不存在视为首轮。
  prev_raw = (round >= 2) ? ledger[gate_id].rounds[round-2] : null   # rounds 0-indexed，上一轮索引=round-2
1. 护栏1(安全优先, early-return): if !ledger || !ledger[gate_id] → return tier=完整, reason="ledger缺失,保守完整"   # 最先, 覆盖手动覆盖
2a. 手动 tier 覆盖: if 用户指定"完整/关键审查" → base_tier=指定值, reason+="用户指定"; else base_tier=null
2b. 文档类 UltraReview 特殊路径: if 文档类且用户指定"UltraReview" → 跳过步骤 3-5, 直接 recipe=完整层多模型渐进式(3-agent), 但仍须经护栏1
3. 矩阵: matrix_tier = MATRIX[bucket][round]; tier = (base_tier!=null) ? max(base_tier, matrix_tier) : matrix_tier; if matrix_tier>base_tier reason+="矩阵升级"
4. 行数地板: floor_tier = floor(line_count); if floor_tier>tier → tier=floor_tier, reason+="行数地板升级"
5. 收敛闸门(仅 prev_raw!=null 时执行):
   - tier==关键 且 bucket==中等 且 prev_raw.p0_raw>0 → tier=完整, reason+="上轮含P0,阵容加强"（闸门口径 p0_raw>0 比收敛①的 >1 保守，有意设计）
   convergence = (prev_raw==null) ? n/a : (闸门触发 ? failed : passed)
6. recipe = RECIPES[object_type][tier][bucket_class]
输出: [TIER_ROUTING] tier=<>, round=<>, file_count=<>, bucket=<>, line_count=<>, floor=<>, convergence=<passed|failed|n/a>, recipe=<>, reason=<>, expected_steps=[...]
```

**评估顺序（箭头=先后，非覆盖；每层只升不降）**：护栏 1（ledger 缺失 early-return）→ 手动覆盖 → 矩阵 → 行数地板（max 升级）→ 收敛闸门（条件升级）。

**文档类 bucket 函数（按 line_count）**：`bucket_doc(line≤100)=微小; bucket_doc(100<line≤300)=中等; bucket_doc(300<line≤600)=复杂; bucket_doc(line>600)=大规模`。文档行数与内容复杂度正相关——1 个 design.md 可能描述 3 个文件的简单修改，也可能描述 50 个文件的系统重构。file_count 对文档无区分度（Gate 0/2 始终 1 文件，Gate 1 通常 4-6 文件），故文档类按 line_count 分桶。

> 文档类 bucket 阈值（100/300/600）与代码类 bucket 阈值（3/19/49 文件）语义对齐。行数地板对文档类仍生效（作为安全网）。

**行数地板（只升不降）**：`floor(line>500)={round1:完整, round2+:关键}; floor(200<line≤500)=关键; floor(line≤200)=矩阵tier`；`tier=max(tier, 地板tier)`。

> 护栏 1 是安全护栏（与行数地板同级），可覆盖手动覆盖——floor 语义是"不低于此 tier"，安全护栏升级手动值不违背用户控制。reason 字段会注明"手动覆盖被安全护栏覆盖"。

### 层级裁剪声明块

tier 裁剪专用，与协议 4「退化声明」区分。review 侧在裁剪掉的 STEP 输出此块。当前仅完整层加强审查子路径使用（裁剪 STEP3/4/5）。

```
STEP<N>_TIER_SKIPPED
tier: full
step: <N>
reason: 完整层加强审查子路径轻量
fallback_coverage: 最终通读 Gate 横切 + 主 Agent STEP2 合并判断 + 收敛闸门
```

| 字段 | 说明 |
|------|------|
| `tier` | 当前路由层级（full） |
| `step` | 被裁剪的 STEP 编号 |
| `reason` | 完整层加强审查子路径：轻量路径无需监督+QuickReview（STEP3/4/5） |
| `fallback_coverage` | 裁剪的补偿机制：最终通读 Gate 横切 + 主 Agent STEP2 合并判断 + 收敛闸门 |

**review 侧（必须输出）**：tier 裁剪掉的 STEP 输出此块，供父技能 reason 抽查与人类审计追溯。

**父技能验证侧（中性）**：TIER_SKIPPED 块既不计入已执行也不计入缺失；父技能按 `expected_steps` 检查（expected 中的 STEP 必须有 STEP<N>_EXECUTED，不在 expected 中的 STEP 不需检查）。

### 典型场景验证

以下场景覆盖路由算法全部路径：

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
| 9 | **文档类** design.md 1 文件/450 行 round1（假设 ledger 存在） | 完整（3-agent 多模型渐进式） | bucket_doc(450)=复杂 → 矩阵→完整 |
| 10 | **文档类** plan.md 1 文件/80 行 round1（假设 ledger 存在） | 关键（对齐+监督 2-agent） | bucket_doc(80)=微小 → 矩阵→关键 |

## 协议 7: 收敛判定与硬阻止输出模板

> 由 specpowers-review SKILL.md「收敛判定与硬阻止机制」节引用。

**输出判定**（依据本轮原始发现数 p0_raw/p1_raw/p2_raw/p3_raw，禁止用修复后剩余数）：

| 场景 | 条件 | 输出 |
|------|------|------|
| 硬阻止 | p0 未清零（修复后仍 p0 > 0） | `[GATE_BLOCKED]` 强制语气 + 修复-重审循环 |
| 默认继续下一轮 | 下方 5 触发条件任一满足 | `[CONVERGENCE_CHECK]` action=continue + 摘要 + 干预窗口 |
| 用户终止 | 用户显式终止（触发条件满足） | `[CONVERGENCE_CHECK]` action=exit + exit_reason=用户终止理由 → 最终通读 → `[GATE_PASSED]` |
| 收敛退出 | 以上均不满足 | `[CONVERGENCE_CHECK]` action=exit + 最终通读 → `[GATE_PASSED]` |

**下一轮 5 触发条件**（任一满足即默认继续，全部基于原始发现数 p*_raw）：① p0_raw > 1；② p1_raw > 5；③ p0_raw+p1_raw+p2_raw > 10；④ p0_raw+p1_raw+p2_raw+p3_raw > 20；⑤ p1_raw − rounds[N-2].p1_raw > 3（轮间新增 P1 趋势；round 1 无上轮基准时⑤不参与判定，视为 n/a；此处 N 为轮次编号）。

> 条件 1（p0_raw > 1）与 `[GATE_BLOCKED]` 独立：本轮发现 ≥2 个 P0 时，即使已全部修复（Gate 通过），仍默认继续下一轮验证修复质量；p0_raw=1 且已修复时不因此强制下一轮。多条件同时触发时按编号升序列出全部。
>
> 条件 5 同样基于原始发现数：上轮修复引入的回归 P1 会被本轮 Step 1 重新发现并计入 p1_raw，⑤ 捕获"修复引入问题"的轮间恶化趋势。

> 用户显式裁决拒绝/跳过且后续轮次未再被发现的项，主 Agent 在触发条件③④计算时扣除该部分计数，并在 [CONVERGENCE_CHECK] 的 notes 中列明扣除明细（账本仍保留完整 p*_raw 原始值——扣除仅影响触发计算，不改写账本记录）。

### `[CONVERGENCE_CHECK]` 标记格式

```
[CONVERGENCE_CHECK] triggers=<编号列表|none>, action=<continue|exit>, p0_raw=<N>, p1_raw=<N>, p2_raw=<N>, p3_raw=<N>, exit_reason=<文本|n/a>
```

- `triggers`：满足的触发条件编号列表（如 `[1,3]`），none 表示无触发
- `action`：triggers 非空时默认 `continue`；triggers 为空时 `exit`（exit_reason=收敛达标）；用户显式终止时 `exit` + exit_reason
- `exit_reason`：仅 action=exit 时填写。用户显式终止须记录理由；无触发条件时填 `收敛达标`；P0 未清零（[GATE_BLOCKED] 循环进行中）的轮次如输出此标记，exit_reason 必须填 `p0 未清零，修复-重审循环继续`，禁止填 `收敛达标`

**无论是否触发，此标记必须输出。** 加强审查子路径（STEP5 被裁剪）在 STEP2 完成后输出此标记。

> **设计理由（writing-skills "Match the Form to the Failure"）**：收敛判定被跳过属于"omits a required element"——正确形式是 structural（REQUIRED field），而非 prohibition 或 prose reminder。`[CONVERGENCE_CHECK]` 是 structural form——必须输出的结构化字段，父技能验证链检查其存在性。

### 统一输出模板

```markdown
> **[GATE_BLOCKED] p0_count=<修复后剩余P0>**   ← 仅 P0 未全部修复时输出此行（p0_count=修复后剩余数，区别于下方原始发现数），否则删除
>
> 本轮原始发现 P0: <p0_raw>, P1: <p1_raw>, P2: <p2_raw>, P3: <p3_raw>（原始发现数——Step 2 汇总记录，非修复后剩余数）。
>
> [p0 未清零时] P0 未清零，审查 Gate 未通过，当前 Phase 被阻塞。specpowers-review 必须执行修复-重审循环（修复子 Agent 修 P0 → 主 Agent 逐条校验 → 重跑 Step 1-5），直到 P0（修复后剩余）清零——循环出口仅看 P0；P1 轮间趋势由触发条件⑤监控，不参与阻塞循环出口判定。本轮修复+重审中发现的 P1/P2 纳入累积计数。调用方将检查 [GATE_BLOCKED]，P0>0 时拒绝进入下一 Phase。
>
> [触发条件任一满足时]
> 📊 Round <N> 审查完成。原始发现 P0:<p0_raw> P1:<p1_raw> P2:<p2_raw> P3:<p3_raw>。
> 触发条件 <编号+描述> 满足，即将开始 Round <N+1>。
> 如需终止审查，请说明理由。无反馈则继续。
>
> [触发条件均不满足时]
> 本轮原始发现问题数未达下一轮触发阈值。审查收敛，可进入最终通读。
>
> **上轮对比**（如适用）：上轮 p0_raw:X p1_raw:Y p2_raw:Z p3_raw:W → 本轮 p0_raw:X' p1_raw:Y' p2_raw:Z' p3_raw:W'，趋势：收敛中 ↗ / 持平 → / 恶化 ↘
>
> **[DEGRADED]**（旧格式账本缺少 _raw 字段）：不展示上轮对比段，仅展示当轮原始发现数 + 声明"旧格式账本缺少原始发现数，回退独立判断"。
```

## 协议 8: UltraReview 详细协议（Steps A-F）

> 由 specpowers-review SKILL.md「UltraReview + 对齐审查」节按需引用。UltraReview = 代码类完整层大代码 bucket（中等(10-19)/复杂/大规模）的 6-agent recipe；recipe 表行、适用条件与 A-F→STEP 映射摘要在 SKILL.md，本协议承载 6-agent 团队定义与 Steps A-F 逐步细节。

### 创建审查团队

除现有 5 个审查 Agent 外，还有对齐审查 Agent（第 6 个维度）：

| 维度 | prompt 要点 |
|------|-----------|
| build-reviewer | 检查构建系统配置正确性 |
| code-reviewer | 检查源码修改、编码、include 路径 |
| specs-reviewer | 逐条对照 OpenSpec specs/ 检查合规性 |
| docs-reviewer | 检查文档和记忆一致性 |
| deps-reviewer | 检查依赖路径和库命名 |
| **对齐审查 Agent** | 逐条对照 plan + specs + design，输出 COVERED/MISSING/DRIFT 对照表 |

对齐审查 Agent 的对照方法复用多模型渐进式审查中"对齐 Agent 对照方法"协议（逐条提取→逐一查找→输出对照表）。COVERED=需求点有对应且语义一致；MISSING=完全无对应（P1）；DRIFT=有对应但语义偏离（P0）。

### 主 Agent 逐条分析协议

（收集完所有子 Agent 报告后执行）

**Step A — 确认全部子 Agent 已完成**
- 检查 6 个审查维度均有报告产出，如有缺失等待或重试

**Step B — 去重合并**
- 收集全部子 Agent 评审报告
- 相同问题（同一文件+同一符号+同一问题类型）→ 合并为一条，标注: 来源 = [code-reviewer, specs-reviewer]
- 冲突结论（如 code-reviewer 说 P0，specs-reviewer 说 P3）→ 标注冲突，不做自动裁决，提级用户判断

**Step C — 逐条判断**（不可批量——批量判断忽略问题间差异，每条问题的接受/拒绝依据不同，须独立评估）
- 对每条合并后的问题，主 Agent 判断: 接受 / 拒绝 / 部分接受
- 每条必须写原因（不能批量同意/拒绝）。原因需具体到问题本身，不可使用模板化措辞
- 严重度校准: 取所有来源中最高级

**Step D — 输出合并判断表**

| # | 问题 | 来源 | 严重度 | 判断 | disposition | 原因 | 修改方案 |
|---|------|------|--------|------|-------------|------|---------|
| 1 | ...  | code,specs | P0 | 接受 | agent_accepted | ... | ... |
| 2 | ...  | specs      | P2 | 拒绝 | agent_rejected | ... | 不适用 |
| 3 | ...  | code,specs | P0/P3 | 冲突 | user_adjudicated | ... | 待用户裁决 |

**Step E — 用户审批**（硬 Gate）
- 用户逐条确认合并判断表
- 冲突项由用户裁决
- 审批通过后方可执行修复

**Step F — 执行修复**（与多模型渐进式 Step 4 修复策略一致）
- 默认全量修复 P0/P1/P2/P3（修复范围见 SKILL.md「审查规则」节"Gate 通过标准 vs 修复范围"；用户可显式指定跳过）
- P0 项须人工确认后修改
- 启动独立修复子 Agent，逐条分析判断并执行修复
- 修复后运行全文 grep 验证残留
- 增量审查: 仅读取变更区域及上下文

## 协议 9: 最终通读 Gate 详细流程

> 由 specpowers-review SKILL.md「最终通读 Gate」节按需引用。触发时机简述与 PASS 四条件概要见 SKILL.md；执行方式、检查项与判定规则在本协议。

最终通读 Gate 是横切 Gate，不参与 Gate 0-4 编号体系，适用于所有审查（无论单轮还是多轮循环）。单轮审查在 Step 5 完成后立即执行最终通读；多轮审查在最后一轮 Step 5 完成后执行最终通读。适用对象含文档类 Gate 0/1/2 和代码类 Gate 3。代码类 Gate 3 的"通读全文"指通读所有变更文件的 diff 及关键文件的完整内容。关键文件的判定标准：被 diff 中引用但未完全展示的函数/类/模块的源文件，以及变更涉及的配置文件。由主 Agent 根据 diff 中的 import/reference 关系自动判断。

### 与 Step 5 的关系

Step 5 检查本轮修复质量（单轮范围），最终通读 Gate 检查跨轮累积一致性（全局范围）。在多轮审查的最后一轮，Step 5 和最终通读 Gate 先后执行，Step 5 先（本轮修复验证），最终通读 Gate 后（全局一致性检查）。单轮审查中，Step 5 完成后立即执行最终通读 Gate。

### 触发时机

当审查进入最终通读环节，**在进入下一环节（如下一 Phase、Gate 3 进入 Phase 4 等）之前**，必须执行最终通读。触发时机按 tier 分支：
- **加强审查子路径（STEP5 被裁剪）**：最终通读以主 Agent STEP2 合并判断后执行的轻量通读形式完成——即 SKILL.md 质量底线第④条所指的"轻量替代"。PASS 四条件相同，但通读范围为变更区域+关联上下文（非全文逐行）。仍须输出 STEP_FINAL_READTHROUGH 标记块（status 注明"轻量替代"）
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

最终通读报告 [PASS/FAIL] + 残余问题清单（如有）

### PASS 标准

（四条全部满足）：
- (a) 所有已确认修复均已正确应用
- (b) 无修复间冲突
- (c) 全文术语和格式一致
- (d) 无废弃引用或残留旧术语

### 判定

- PASS → 允许进入下一环节
- FAIL（存在残余问题）→ 修复后重新通读，直到 PASS
- 此 Gate 不可跳过，不设自动循环上限

目的：防止多轮修复累积后在文档中留下残余不一致（如术语两写、废弃引用残留、修复冲突）。多轮审查中每次修复只关注局部，最终通读提供全局一致性检查。
