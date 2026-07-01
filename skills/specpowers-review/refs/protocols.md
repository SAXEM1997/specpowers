# specpowers-review 协议与数据结构参考

> 由 specpowers-review SKILL.md 按需引用。仅在需要查阅具体格式定义时读取。

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
                "p0": 0,            // 保留：修复后剩余 P0（向后兼容，Step 5 写入）
                "p1": 0,            // 保留：修复后剩余 P1
                "p2": 0,            // 保留：修复后剩余 P2
                "p0_raw": 1,        // 新增：原始发现 P0（Step 2 汇总时记录）
                "p1_raw": 4,        // 新增：原始发现 P1
                "p2_raw": 3,        // 新增：原始发现 P2
                "p3_raw": 2,        // 新增：原始发现 P3
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

> **向后兼容**: 旧格式账本仅有 p0/p1/p2（修复后剩余数），缺失 _raw 后缀字段。
> 读取旧格式时，该轮数据视为不可用（unknown），不参与收敛判断条件计算，
> 改用当轮数据做独立判断，输出 `[DEGRADED] 旧格式账本缺少原始发现数，回退独立判断`。

### 跨 Gate 传递

同一会话内跨 Gate（如 Gate 0 → Gate 1 → Gate 2）时，主 Agent 将前几个 Gate 的账本数据通过 prompt 参数注入下一 Gate 的审查 Agent。传递内容：lessons_learned + 上一 Gate 的 issues_summary（用于对齐 Agent 逐条验证遗留问题是否已修复）。

各 Gate 的账本数据以 gate_id 为独立 key 存储，互不覆盖。跨 Gate 传递时，主 Agent 将所有已执行 Gate 的 lessons_learned 合并去重后注入。如因会话压缩导致前 Gate 数据丢失，仅从当前可用的数据注入，不阻塞审查。合并去重规则：相同场景+相同根因+相同结论视为重复，由主 Agent 逐条比对判断（启发式指引，非精确计算）。

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
agents: [<agent_name>(<model>), ...]
issues_found: <N>
degradation: none|<具体原因>|<影响分析>|<替代措施>
ref: AgentId=<id>, tokens=<N>
\`\`\`
```

> **ref 行说明**: `ref: AgentId=<id>, tokens=<N>` 由**主 Agent 在汇总时追加**（非子 Agent 输出）。AgentId 从子 Agent 的 `Agent` 工具返回值中提取。AgentId 格式为 `a` + 16 位 hex（系统生成）。主 Agent 在遵循协议时从该路径获取真实 AgentId；但技术上可生成格式合法的虚假值——此为辅助真实度信号，非密码学验证。完整限制声明见标记块验证规则中的"验证能力与限制"表。

> **零问题标记块强制要求**: **无论 issues_found 是否为 0，每个执行的 Step 必须输出 STEP<N>_EXECUTED 标记块。** `issues_found: 0` = Step 正常完成且未发现新问题；标记块缺失 = Step 未执行。两者有本质区别。父技能的验证逻辑依赖标记块的存在性来判断审查是否完成，零问题 Step 省略标记块将导致父技能误判为审查未完成并阻塞当前 Phase。
>
> **完整性检查表的前提**: 完整性检查表中的"应存在的标记块"以此规则为前提——每个 Step 的标记块均应存在（无论 issues_found 是否为 0），缺失任一块即视为审查未完成。

### 各 Step 标记块定义

| Step | 输出者 | status 取值 | degradation 说明 |
|------|--------|------------|-------------------|
| Step 1 | 主 Agent（汇总三个子 Agent 完成状态） | complete / degraded | 某 Agent 未完成（原因+重试次数+替代措施） |
| Step 2 | 主 Agent（自执行，无子 Agent） | complete | none（主 Agent 执行，无降级路径）。source: self——标记块由主 Agent 为自己执行的 Step 输出，ref 行 AgentId 填 `self`，tokens 为主 Agent 执行 Step 2 的估算消耗 |
| Step 3 | 监督 Agent | complete / degraded | 单一模型时声明"缺少独立视角交叉验证"；合并后问题数 < 5 时声明"仅执行溯源+遗漏检查" |
| Step 4 | 修复子 Agent + 主 Agent | complete / degraded / failed | 子 Agent 不可用时声明"退回主 Agent 自行修复"；修复重试超限声明"修复失败" |
| Step 5 | Quick Review Agent | complete / degraded | 单一 Agent 时声明"缺少独立视角"；Step 4 退化时声明"执行两轮补偿验证" |
| 最终通读 | 独立子 Agent 或主 Agent（自执行） | complete / fail | 沿用通用标记块格式（STEP_FINAL_READTHROUGH）。agents 填子 Agent 模型名或 self（主 Agent 自执行）。issues_found 填残余问题数。子 Agent 工具不可用时由主 Agent 自执行，degradation 声明"单一模型，最终通读缺少独立视角" |

**多修复子 Agent 合并规则（Step 4）**: 当修复项 > 5 条拆分为多个修复子 Agent 时，主 Agent 收集所有修复子 Agent 的输出后，合并为**单个** STEP4_EXECUTED 标记块。issues_found 汇总所有修复子 Agent 发现的新问题数。agents 列表包含所有修复子 Agent 的名称和模型。degradation 取所有修复子 Agent 中最严重的退化状态。

### 标记块验证规则

**主 Agent 规则**:
- 只能汇总子 Agent 的实际输出，不能凭空生成标记块
- **例外**: Step 2（主 Agent 自执行）和最终通读（主 Agent 自执行路径）除外——主 Agent 为自己执行的 Step 输出标记块，ref 行 AgentId 填 `self`
- 汇总方式: 将子 Agent 输出中的 `STEP<N>_EXECUTED` 块原样附加到审查报告中。标记块附加在审查报告的执行日志表格之后，统一以 `## 执行标记原始记录` 标题开头，按 Step 编号排序
- 如果某 Step 的子 Agent 未输出标记块 → 主 Agent 标注 `STEP<N>_EXECUTED: missing`（不可补写内容）
- 汇总时必须在每个标记块末尾追加 `ref: AgentId=<id>, tokens=<N>` 行，其中 AgentId 和 tokens 从子 Agent 的 `Agent` 工具返回值中提取（AgentId 格式: `a` 开头 + 16 位 hex，由系统生成。主 Agent 在遵循协议时从该路径获取真实 AgentId，但技术上可生成格式合法的虚假值——此为辅助真实度信号，非密码学验证）

**父技能（验证者）规则**:
- specpowers-review 返回后，父技能在 specpowers-review 的输出中检查每个应执行的 Step 的标记块是否存在
- 标记块完整性检查表:

| Gate | 应存在的标记块 |
|------|-------------|
| Gate 0/1/2（多模型渐进式） | STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 3（UltraReview+对齐审查, 其他情况） | STEP1(对应 Step A), STEP2(Step B-C), STEP3(Step D-E), STEP4(Step F), STEP5 |
| Gate 3（加强审查, ≤2 文件且 ≤200 行） | STEP1(对齐 Agent 审查，含 code-review 结果引用), STEP2(主 Agent 判断) |
| 最终通读 | STEP_FINAL_READTHROUGH |

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
| 主 Agent 恶意跳过 Step 后伪造标记块 | 不能 | 主 Agent 可输出虚假的 `STEP<N>_EXECUTED` 块，父技能的字符串搜索无法区分真伪 |
| 主 Agent 伪造 AgentId | 不能（但有门槛） | AgentId 格式可验证（`a` + 16 hex），但无法验证是否为系统真实分配——主 Agent 可生成格式合法的虚假 AgentId。此信号提升伪造门槛但非技术性防伪 |

**这是纯 SKILL.md 文本协议的固有边界**: 所有指令均为文本指令，无进程隔离、无代码强制。Agent 若选择忽略指令，无技术手段阻止。双层验证的设计目标是将"静默跳过审查"从单 Agent 的疏忽/违规升级为需要在审查阶段和验证阶段中做出不一致行为（同一 Agent 的两个时序分离角色），显著提升跳过门槛，但不声称技术性不可伪造。

**多轮循环标记块保留策略**: 多轮修复-重审循环产生多套标记块时，主 Agent 按轮次分组（`## Round N 执行标记`）。父技能在搜索标记块时，如存在多轮标记块，仅检查**最后一轮**（以最大的 Round N 标题为准）的标记块完整性。前轮标记块因修复重审已过时，不参与完整性判断。

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

## 协议 4: 退化声明标准协议

> **导航提示**: 本节为横切协议，定义所有 Step 共用的退化声明格式与规则。**多模型渐进式审查的 Step 3 在本节之后继续**（见下方 "Step 3 — 独立监督 Agent 交叉验证"）。读者如需跟随线性审查流程，可跳过本节先阅读 Step 3-5，再回到此处查阅退化声明的具体格式要求。

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
| Step 3 | 合并后问题 < 5 | 仅溯源+遗漏检查（维度 1-2） | 监督 Agent |
| Step 4 | 子 Agent 工具不可用 | 退回主 Agent 自行修复 | 主 Agent |
| Step 4 | 环境不支持并行 | 修复子 Agent 串行执行 | 主 Agent |
| Step 5 | 仅 1 个 Agent 可用 | 声明"缺少独立视角" | Quick Review Agent |
| Step 5 | Step 4 退化 | 执行两轮补偿验证 | Quick Review Agent |
| 最终通读 | 子 Agent 工具不可用 | 由主 Agent 自行执行 | 主 Agent |

退化声明对所有降级场景强制要求，不可省略。这构成**横切规则**，覆盖 Step 3/4/5 的全部降级分支。
