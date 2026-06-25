# specpowers-review 强化修改方案（修订版 v2）

> **修订说明**: 本版基于三份审查报告（P0-1~P0-3, P1-4~P1-8, P2-9~P2-10）对所有发现问题的修复。核心变更：引入**双层验证**（执行标记 + 父技能检查）打破单一 Agent 自验证循环；引入**最小化文件缓存**覆盖跨会话场景；补充**协议定义**和**行级修改**消除模糊地带。

---

## 1. 修改概述

### 1.1 问题域

当前 specpowers-review 的强化措施（执行日志/退化声明/硬阻止）全部落在 SKILL.md 文本指令层面，与原有"强制不可跳过"指令处于同一信任域。执行者（specpowers-review 内部 Agent）和自我验证者（同一 SKILL.md 的文本指令）合一，无法形成有效制约。

### 1.2 核心策略

通过"**双层验证**（Dual-Phase Verification）"打破单一 Agent 自验证循环：

- **审查阶段**: specpowers-review 内部的各 Step Agent（子 Agent），在每个 Step 结束后输出结构化 `STEP<N>_EXECUTED` 标记块。此时 Agent 处于 specpowers-review Skill 上下文中，以审查者角色执行
- **验证阶段**: 父技能（specpowers-plan / specpowers-apply）在 Gate 调用返回后，**同一 Agent 切换回父技能 Skill 上下文**，以独立验证者角色检查标记块是否存在、状态是否完整。虽为同一 Agent 实例（Skill() 为内联加载），但两个阶段在不同 Skill 上下文中执行，构成**时序分离的双层验证**
- **硬阻止**: 父技能检查 `[GATE_BLOCKED] p0_count=N` 标记，P0>0 时拒绝进入下一 Phase
- **跨会话**: 引入 `.specpowers/review-cache.json`（尽力而为缓存，非 Gate 数据源）存储审查教训和最终通读状态

### 1.3 设计原则

1. **不做脚本化 Gate**: 所有机制纯 SKILL.md 文本协议实现，不引入 shell 脚本/外部 checker
2. **标记块需子 Agent 实际输出支撑**: 标记块由子 Agent 输出，主 Agent 汇总（指示性完整，非技术性防伪——详见"标记块验证规则"中的限制声明）
3. **缓存不影响 Gate pass/fail 的最低完整性要求**: review-cache.json 丢失时从零开始，P0/P1/P2 计数不存文件。Gate 仍会执行最终通读——缓存的语义是"避免不必要的重复工作"，非"保证结果不变"。LLM 审查的非确定性意味着重执行结果可能与缓存记录不同
4. **每个术语有操作化定义**: 硬阻止/退化/执行标记/收敛均有可检查的协议

---

## 2. 逐项修改清单

### 2.1 P0 问题

| 编号 | 问题 | 修改方案 | 涉及文件 | 涉及行 |
|------|------|---------|---------|--------|
| **P0-1** | 所有强化措施在同一信任域内 | 每个 Step 结束输出 `STEP<N>_EXECUTED` 标记块；父技能 Gate 调用后检查标记块完整性 | review L283-327 (Step 3-5), plan L128-129/L188-189/L235-237, apply L41-48 |
| **P0-2** | 纯会话上下文无法覆盖跨会话场景 | 引入 `.specpowers/review-cache.json`（仅存 lessons_learned + final_readthrough）；移除 `.review-summary.json` 和 `.specpowers/review-state/<gate_id>.json` | review L113, L386-418; 全局删除所有 `.review-summary.json` 引用 |
| **P0-3** | 修改范围不完整 | L383 分层表述；L392-411 替换为会话上下文账本+执行标记格式；L418 替换为 review-cache.json 逻辑；移除 review-state 路径；外部文档追加过期标注 | review L383, L392-411, L418; design.md/plan.md（如有） |

### 2.2 P1 问题

| 编号 | 问题 | 修改方案 | 涉及文件 | 涉及行 |
|------|------|---------|---------|--------|
| **P1-4** | "硬阻止"缺乏操作化定义 | 收敛提醒中输出 `[GATE_BLOCKED] p0_count=N` 标记；父技能检查该标记拒绝进入下一 Phase；区分修复-重审循环 vs 返回调用方 | review L340-384; plan L128-129/L188-189/L235-237; apply L41-48 |
| **P1-5** | 新概念缺乏协议定义 | 补充三个协议：(1) 会话上下文账本协议 (2) 执行日志模板 (3) 退化声明三要素 | review 新增"协议定义"章节 |
| **P1-6** | "额外 Step 5"范围蔓延 | 措辞改为"退化场景下 Step 5 Quick Review 增加一轮独立验证"；Step 4 退化时 Step 5 执行两轮 | review L320-327 |
| **P1-7** | 未覆盖"Agent 根本不触发审查"场景 | plan L128-129/L188-189/L235-237 和 apply L41-48 增加执行标记存在性检查 | plan + apply |
| **P1-8** | 收敛提醒模板措辞冲突 | P0>0 输出独立"硬阻止声明"模板（强制语气）；P1>3 保留"着重提醒"模板（建议语气） | review L340-384 |

### 2.3 P2 问题

| 编号 | 问题 | 修改方案 | 涉及文件 | 涉及行 |
|------|------|---------|---------|--------|
| **P2-9** | 退化声明 Gate 作用域不统一 | 退化声明提升为横切规则——覆盖 Step 3/4/5 全部降级场景，统一输出格式 | review L283-327 (Step 3-5 降级分支) |
| **P2-10** | design.md + plan.md 末尾追加过期标注 | 本轮修改未触及 design.md / plan.md（当前 specpowers 项目无此文件）；如未来产生，按模板追加 | 无（当前不存在） |

---

## 3. 行级修改对照表

### 3.1 specpowers-review/SKILL.md

#### L113 — Gate 执行规则中的产物路径

| 项目 | 内容 |
|------|------|
| **当前文本** | `Gate 发现 P1/P2 → 记录后允许通过，但问题清单会写入 .review-summary.json，后续 Gate 加载 specpowers-review 时该 JSON 自动注入对齐 Agent 的审查上下文...从项目根目录 .specpowers/review-state/<gate_id>.json 读取（代码类审查场景）` |
| **修改后** | `Gate 发现 P1/P2 → 记录后允许通过。问题清单写入会话上下文账本（主 Agent 内存 dict，见"会话上下文账本协议"），跨 Gate 通过主 Agent 注入对齐 Agent prompt。不再写入任何 .review 开头的文件产物。跨会话场景下，审查教训从 .specpowers/review-cache.json 读取（尽力而为缓存，丢失不影响正确性）。` |
| **理由** | 移除 `.review-summary.json` 和 `.specpowers/review-state/<gate_id>.json`，替换为会话上下文账本 + review-cache.json |

#### L340-384 — 收敛提醒机制（全节替换）

| 项目 | 内容 |
|------|------|
| **当前文本** | 收敛提醒模板三种（着重提醒/中等提醒/轻量提醒），L383 "仅提醒，不强制，不设自动循环和轮数上限，完全由用户决定" |
| **修改后** | 拆分为两种独立模板，加入硬阻止标记输出 |

**修改后完整文本**:

````markdown
## 收敛提醒与硬阻止机制

### 每 Gate 审查+修复完成后输出

审查完成后，依据本轮 P0/P1 计数输出对应声明：

#### 场景 A: P0 > 0 — 硬阻止声明（强制语气）

```markdown
> **[GATE_BLOCKED] p0_count=<N>**
>
> 本轮审查发现 **P0: <N> 个** 必须修复的阻塞性问题。
>
> P0 > 0，审查 Gate 未通过。当前 Phase 被阻塞。
> **specpowers-review 必须执行修复-重审循环**，直到 P0 清零后方可向调用方返回。
>
> 修复-重审循环规则:
> 1. 修复子 Agent 修复所有 P0 项
> 2. 修复完成后主 Agent 逐条校验
> 3. 校验通过后，重新执行 Step 1-5 完整审查流程
> 4. 循环直到 P0 = 0，且 P1 总数较上轮不增加
>
> 本轮修复+重审中发现的 P1/P2 同样纳入累积计数。
> 调用方（父技能）将检查 [GATE_BLOCKED] 标记，P0>0 时拒绝进入下一 Phase。
```

#### 场景 B: P0 = 0, P1 > 3 — 着重提醒（建议语气）

```markdown
> **审查收敛提醒**
>
> 本轮审查发现 P0: 0, **P1: <Y> 个**, P2: <Z> 个。
>
> P1 > 3，修复后容易引入新问题或遗漏修复，**强烈建议再启动一轮审查**验证修复效果。
> 重复审查直到问题收敛（P0=0, P1≤3 且较上轮无新增 P1），可有效避免：
> - 修复引入的回归问题
> - 多轮沟通中需求的漂移
> - 审查盲区的累积
>
> **上轮对比**（如适用）：
> - 上轮：P0: X, P1: Y, P2: Z → 本轮：P0: X', P1: Y', P2: Z'
> - P1 变化：Y' - Y（正值表示新增问题，需关注是否由修复引入）
> - 趋势：收敛中 ↗ / 持平 → / 恶化 ↘
>
> 是否继续下一轮审查？（由用户决定）
```

#### 场景 C: P0 = 0, P1 ≤ 3, 较上轮有新增 P1 — 中等提醒

```markdown
> **审查收敛提醒**
>
> 本轮审查发现 P0: 0, P1: <Y>, P2: <Z>。P1 较上轮新增 <N> 个（关注是否由修复引入）。是否继续下一轮审查？
```

#### 场景 D: P0 = 0, P1 ≤ 3, 较上轮无新增 P1 — 轻量提醒

```markdown
> **审查收敛提醒**
>
> 本轮审查发现 P0: 0, P1: <Y>, P2: <Z>，趋于收敛。是否继续下一轮审查？
```

#### 硬阻止与着重提醒的区分

| 维度 | 硬阻止声明 (P0>0) | 着重提醒 (P0=0, P1>3) |
|------|-------------------|----------------------|
| 语气 | 强制 | 建议 |
| 标记 | `[GATE_BLOCKED] p0_count=N` | 无特别标记 |
| 调用方行为 | 检查标记，拒绝进入下一 Phase | 允许通过，提醒用户 |
| 审查内部行为 | 强制执行修复-重审循环 | 建议但由用户决定 |
| 返回条件 | P0 清零后返回 | 用户决定后即可返回 |

趋势判定标准（基于 P0+P1 总数较上轮的变化）：
- 收敛中: P0+P1 总数减少，且无新增 P0
- 持平: P0+P1 总数不变，或减少但新增了 P0
- 恶化: P0+P1 总数增加

> **注**: 场景 B/C/D 中 P0=0，P0+P1 简化为 P1。场景 A（硬阻止声明）不展示趋势对比（P0>0 时直接阻塞，趋势对比无意义）。

首轮审查（无上轮数据）时：P0>0 → 硬阻止声明；P0=0 且 P1>3 → 着重提醒；P0=0 且 P1≤3 → 轻量提醒。
````

#### L386-418 — 收敛状态存储（全节替换）

| 项目 | 内容 |
|------|------|
| **当前文本** | `.review-summary.json` 存储 + JSON schema 定义 + 跨会话重启行为 |
| **修改后** | 替换为会话上下文账本协议 + 执行标记格式定义 + review-cache.json 读取逻辑 |

**修改后完整文本**:

```markdown
### 会话上下文账本协议

P0/P1/P2 计数和问题清单不写入文件，由主 Agent 在内存中维护会话上下文账本（dict 结构）。此举确保：(a) 数据存续受限于会话生命周期；(b) 不会因文件残留导致 Gate 误判；(c) 无法被其他进程/会话篡改。

#### 账本结构

```
session_ledger = {
    "<gate_id>": {
        "gate": "Gate 0",
        "rounds": [
            {
                "round": 1,
                "p0": 0,
                "p1": 0,
                "p2": 0,
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

#### 读写时机

| 操作 | 时机 | 执行者 |
|------|------|--------|
| 写入 rounds | 每轮审查 Step 5 完成后 | 主 Agent |
| 写入 lessons_learned | 每轮审查 Step 5 完成后，追加本轮新教训 | 主 Agent |
| 读取 rounds | 下一轮审查开始前（Step 0），构建上轮对比数据 | 主 Agent |
| 读取 lessons_learned | 下一 Gate 加载时，注入对齐 Agent prompt（Step 0） | 主 Agent |
| 写入 final_readthrough | 最终通读完成后 | 主 Agent |
| 读取 final_readthrough | 最终通读执行前，判断是否需要执行 | 主 Agent |

#### 跨 Gate 传递

同一会话内跨 Gate（如 Gate 0 → Gate 1 → Gate 2）时，主 Agent 将前几个 Gate 的账本数据通过 prompt 参数注入下一 Gate 的审查 Agent。传递内容：lessons_learned + 上一 Gate 的 issues_summary（用于对齐 Agent 逐条验证遗留问题是否已修复）。

各 Gate 的账本数据以 gate_id 为独立 key 存储，互不覆盖。跨 Gate 传递时，主 Agent 将所有已执行 Gate 的 lessons_learned 合并去重后注入。如因会话压缩导致前 Gate 数据丢失，仅从当前可用的数据注入，不阻塞审查。合并去重规则：相同场景+相同根因+相同结论视为重复，由主 Agent 逐条比对判断（启发式指引，非精确计算）。

> **账本与缓存写入时机差异**: 账本写入时机为每轮 Step 5 后（会话内即时持久化到内存 dict）；review-cache.json 写入时机为每 Gate 退出前（跨会话持久化到文件）。两者存在时间差——如会话在 Step 5 后、Gate 退出前崩溃，缓存可能丢失本轮 lessons_learned。差异总结如下表:
>
```

> | 数据存储 | 写入时机 | 持久化范围 | 崩溃丢失风险 |
> |---------|---------|-----------|------------|
> | 会话上下文账本 | 每轮 Step 5 后 | 会话内（内存） | 会话崩溃/压缩 → 全部丢失 |
> | review-cache.json | 每 Gate 退出前 | 跨会话（文件） | Step 5 后+退出前崩溃 → 本轮丢失 |

### 跨会话缓存: .specpowers/review-cache.json

#### 设计定位

**尽力而为缓存，非 Gate 数据源**。文件丢失 → 从零开始，不影响审查正确性。文件存在 → 注入历史经验，提升审查质量。

#### 位置与格式

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

#### 读写规则

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

#### 与旧产物的关系

| 旧产物 | 处理方式 |
|--------|---------|
| `.review-summary.json` | 移除所有引用，不再创建或读取 |
| `.specpowers/review-state/<gate_id>.json` | 移除所有引用，不再创建或读取 |
| `.specpowers/review-cache.json` | **新增**，语义为"尽力而为缓存"，非"Gate 数据源" |

### 执行标记格式定义

#### 标记块格式

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

#### 各 Step 标记块定义

| Step | 输出者 | status 取值 | degradation 说明 |
|------|--------|------------|-------------------|
| Step 1 | 主 Agent（汇总三个子 Agent 完成状态） | complete / degraded | 某 Agent 未完成（原因+重试次数+替代措施） |
| Step 2 | 主 Agent（自执行，无子 Agent） | complete | none（主 Agent 执行，无降级路径）。source: self——标记块由主 Agent 为自己执行的 Step 输出，ref 行 AgentId 填 `self`，tokens 为主 Agent 执行 Step 2 的估算消耗 |
| Step 3 | 监督 Agent | complete / degraded | 单一模型时声明"缺少独立视角交叉验证"；合并后问题数 < 5 时声明"仅执行溯源+遗漏检查" |
| Step 4 | 修复子 Agent + 主 Agent | complete / degraded / failed | 子 Agent 不可用时声明"退回主 Agent 自行修复"；修复重试超限声明"修复失败" |
| Step 5 | Quick Review Agent | complete / degraded | 单一 Agent 时声明"缺少独立视角"；Step 4 退化时声明"执行两轮补偿验证" |
| 最终通读 | 独立子 Agent 或主 Agent（自执行） | complete / fail | 沿用通用标记块格式（STEP_FINAL_READTHROUGH）。agents 填子 Agent 模型名或 self（主 Agent 自执行）。issues_found 填残余问题数。子 Agent 工具不可用时由主 Agent 自执行，degradation 声明"单一模型，最终通读缺少独立视角" |

**多修复子 Agent 合并规则（Step 4）**: 当修复项 > 5 条拆分为多个修复子 Agent 时，主 Agent 收集所有修复子 Agent 的输出后，合并为**单个** STEP4_EXECUTED 标记块。issues_found 汇总所有修复子 Agent 发现的新问题数。agents 列表包含所有修复子 Agent 的名称和模型。degradation 取所有修复子 Agent 中最严重的退化状态。

#### 标记块验证规则

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
| Gate 3（UltraReview, >=10 文件） | STEP1(对应 Step A), STEP2(Step B-C), STEP3(Step D-E), STEP4(Step F), STEP5 |
| Gate 3（加强审查, <10 文件） | STEP1(对齐 Agent 审查，含 code-review 结果引用), STEP2(主 Agent 判断) |
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

#### 双层验证原理

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

#### L320-327 — Step 5 Quick Review（增加退化补偿）

| 项目 | 内容 |
|------|------|
| **当前文本** | Step 5 Quick Review 收尾，单一 Agent 时声明限制 |
| **修改后** | 增加退化场景补偿规则 |

**修改后文本**:

```markdown
**Step 5 — Quick Review 收尾**

- 独立 Agent（非 Step 4 实施者）通读修复子 Agent 的输出 + 主 Agent 的校验记录
- 输出快速检查报告：是否所有问题均已修复？修复是否引入新问题？文档整体一致性是否保持？
- 仅单一 Agent 可用时，在审查报告中声明限制（缺少独立视角）
- Quick Review 通过后输出收敛提醒
- **退化补偿规则**: 如果 Step 4 发生退化（status: degraded 或 failed），Step 5 的 Quick Review Agent 执行**两轮独立验证**（第一轮: 检查修复质量；第二轮: 独立重新验证修复项）。在两轮之间主 Agent 不干预，以补偿修复视角独立性的损失。两轮验证均在 Step 5 标记块中记录，degradation 字段注明"Step 4 退化 → Step 5 执行两轮补偿验证"

注意：Step 5 在本轮审查层面检查修复质量（本轮问题是否已彻底修复）；最终通读 Gate 在跨轮累积层面检查全局一致性（多轮修复之间是否有冲突）。两者触发时机不同，检查维度互补，不重复。
```

#### 独立调用自检（新增节，Step 5 之后、收敛提醒之前）

| 项目 | 内容 |
|------|------|
| **当前文本** | （无，新增内容） |
| **修改后** | 在 specpowers-review SKILL.md 的审查流程末尾（Step 5 之后、收敛提醒之前）增加"独立调用自检"小节 |

**修改后文本**:

```markdown
### 独立调用场景自检

当 specpowers-review 被用户直接调用（非通过 specpowers-plan/apply 的 Gate 路由）时，不存在父技能执行双层验证。此时主 Agent 在 Step 5 完成后自行执行标记块完整性检查：

1. 搜索 `STEP<N>_EXECUTED` 标记块（STEP1 至 STEP5 + STEP_FINAL_READTHROUGH）
2. 确认全部应存在的标记块均已输出（含最终通读标记块，缺失时标注"最终通读可能未执行"）
3. 以 `[SELF_VERIFY]` 标记输出检查结果

**自检结果格式**:

\`\`\`[SELF_VERIFY]
verified_steps: [STEP1, STEP2, STEP3, STEP4, STEP5, STEP_FINAL_READTHROUGH]
missing_steps: []
all_present: true|false
\`\`\`

此自检与父技能验证处于同一信任域（同一 Agent），但至少确保标记块在独立调用场景下不会被完全忽略。独立调用场景下 `[GATE_BLOCKED]` 标记不触发外部阻塞（无父技能读取），仅作为信息性声明。
```

#### L283-327 (Step 3/4/5 降级分支) — 退化声明标准化

在每个 Step 的降级分支末尾追加统一格式的退化声明。

**退化声明三要素协议**（追加到"上下文传递机制"节之后、"Step 3"之前）:

```markdown
### 退化声明标准协议

当任何 Step 无法按标准路径执行时（模型不足/Agent 工具不可用/并行不可用/修复重试超限），对应 Agent 必须在 `STEP<N>_EXECUTED` 标记块的 `degradation` 字段中输出退化声明，包含以下三要素：

| 要素 | 内容 | 示例 |
|------|------|------|
| (a) 具体缺失能力 + 模型名 | 标准路径要求什么、当前缺什么 | "标准路径要求 3 个不同模型，当前仅 Haiku 可用" |
| (b) 尝试过的调用方式 + 失败信息 | 尝试了什么、为什么失败 | "尝试调用 Opus 作为结构 Agent → 返回模型不可用" |
| (c) 降级路径选择依据 | 为什么选此降级路径而非其他 | "降级到串行单模型（落地→对齐→结构），此路径最小化交叉验证损失" |

#### 各 Step 退化声明位置

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

> **实施注意**: Step 3 降级段（原 L298）和 Step 4 降级段（原 L318）的修改后完整文本需在实施时根据退化声明三要素协议逐分支改写，将原有自由文本降级声明替换为结构化 `degradation: <原因>|<影响>|<替代>` 格式。各降级分支的退化声明内容参考"各 Step 退化声明位置"表。
```

#### L257 — Step 0 准备审查经验中的 .review-summary.json 引用

| 项目 | 内容 |
|------|------|
| **当前文本** | 跨会话积累的审查教训从 .review-summary.json 中读取并注入 |
| **修改后** | 跨会话积累的审查教训从 .specpowers/review-cache.json 中读取（跨会话缓存）；会话内跨 Gate 教训从会话上下文账本中读取。新发现的教训在每轮审查结束后追加到会话上下文账本，Gate 退出时写入 review-cache.json |
| **理由** | .review-summary.json 即将被删除，L257 引用须同步更新。此修改与 L113、L386-418 的产物替换逻辑一致 |

#### L271-281 — 上下文传递机制（增加子 Agent 注入指令）

| 项目 | 内容 |
|------|------|
| **当前文本** | 上下文传递机制表定义注入内容（模型配置/规范上下文/上轮经验），但不含子 Agent 输出标记块的要求 |
| **修改后** | 为上下文传递机制表的每行增加"附加指令"列，统一注入标记块输出要求 |

**修改后文本**:

原 SKILL.md 的上下文传递机制表（L271-281）重构——从 3 列×3 行（Step | 注入内容 | 接收方）改为 5 列×4 行（注入项 | 注入内容 | 注入方式 | 注入时机 | 附加指令），新增模型配置/规范上下文/上轮审查经验三个注入项。每行增加"附加指令"列，内容如下：

| 注入项 | 注入内容 | 注入方式 | 注入时机 | **附加指令（新增）** |
|--------|---------|---------|---------|---------------------|
| 模型配置 | 每个 Step 使用的模型列表 | 主 Agent 通过 prompt 参数传递 | Step 启动前 | 无（模型选择由主 Agent 决定） |
| 规范上下文 | 当前 Gate 的对齐检查目标（design/specs/plan/code） | 主 Agent 通过 prompt 参数传递 | Step 启动前 | 无（规范内容为审查输入） |
| 上轮审查经验 | lessons_learned（来自账本或 review-cache.json） | 主 Agent 通过 prompt 参数传递 | Step 0 / 对齐 Agent 注入 | 无（经验为辅助输入） |
| **标记块输出指令（新增行）** | 每个子 Agent 完成审查/修复/检查后，必须在输出末尾附加结构化标记块 | 主 Agent 通过 prompt 参数注入子 Agent | 每个 Step 启动前 | **强制**: 子 Agent 不得省略此输出 |

**子 Agent prompt 注入模板**（主 Agent 在启动每个子 Agent 时，将以下指令附加到 prompt 参数末尾）:

```markdown
## 输出要求（强制）

完成本 Step 的审查/修复/检查后，你必须在输出的最后附加以下格式的结构化标记块：

\`\`\`STEP<N>_EXECUTED
status: complete|degraded|failed
agents: [<name>(<model>)]
issues_found: <N>
degradation: none|<原因>|<影响>|<替代>
\`\`\`

字段说明:
- status: complete（正常完成）/ degraded（降级执行）/ failed（执行失败）
- agents: 本 Step 使用的 Agent 列表，格式 [名称(模型)]
- issues_found: 本 Step 新发现的问题数量（P0+P1+P2 合计）
- degradation: 无降级时填 none；有降级时按"退化声明三要素协议"填写 <原因>|<影响>|<替代>

> **注意**: `ref: AgentId=<id>, tokens=<N>` 行由**主 Agent 在汇总时追加**（非子 Agent 输出）。子 Agent 看不到自己的 AgentId（Agent 工具返回值对调用方可见，对被调用方不可见），因此子 Agent 只需输出以上四个字段。AgentId 和 tokens 由主 Agent 从 `Agent` 工具返回值中提取后追加到每个标记块末尾。

**无论 issues_found 是否为 0，每个执行的 Step 必须输出此标记块。**
标记块缺失将被父技能视为 Step 未执行，导致当前 Phase 被阻塞。
```

**设计理由**: 子 Agent 只读取 prompt 参数，不读取 specpowers-review SKILL.md 全文。标记块输出要求必须显式注入每个子 Agent 的 prompt 中，否则子 Agent 不知道需要输出此标记块，导致父技能的双层验证（执行标记完整性检查）无法执行。

> **以上详细规范汇总为以下协议索引**。3.2 节定位为**协议索引**（非独立定义源）——各协议的完整定义见 3.1 节对应小节，本节提供统一检索入口和交叉引用。

### 3.2 新增"协议定义"章节

在 specpowers-review SKILL.md 中增加独立章节（位置：收敛状态存储节之后、最终通读 Gate 之前），作为协议统一检索入口。内容为以下 5 项的简短索引（每项 1-2 行 + "详见 3.1 节"交叉引用）：

1. **协议 1: 会话上下文账本结构** — 主 Agent 内存 dict，维护跨轮次收敛对比。详见 [3.1 节"会话上下文账本协议"]
2. **协议 2: 执行标记格式规范** — STEP<N>_EXECUTED fenced code block 格式 + 验证规则。详见 [3.1 节"执行标记格式定义" + "标记块验证规则"]
3. **数据结构: 执行日志表格** — 审查报告末尾的 Markdown 汇总表，派生自 STEP<N>_EXECUTED 标记块。详见 [3.1 节"各 Step 标记块定义"]
4. **数据结构: 退化声明三要素** — degradation 字段的 (a)缺失能力 (b)尝试记录 (c)降级依据 格式规范。详见 [3.1 节"退化声明标准协议"]
5. **协议 3: 跨会话缓存协议** — .specpowers/review-cache.json 尽力而为缓存，存 lessons_learned + final_readthrough。详见 [3.1 节"跨会话缓存"]

> **实施注意**: 本节最终篇幅控制在 ~15 行以内。完整定义均在 3.1 节，本节仅做索引。命名约定——"协议"仅指涉及双方交互的规范（账本跨 Gate 传递、标记块输出-验证交互、缓存读写协作），纯格式规范（执行日志表结构、退化声明字段格式）归类为"数据结构定义"。

### 3.3 specpowers-plan/SKILL.md 联动修改

#### 通用：Gate 返回后验证协议（所有 Gate 通用）

对于 Gate <N>（对应 Phase <N>），specpowers-review 返回后执行以下统一验证流程：

**验证 0 — 执行模式检查**:
读取会话上下文中的 `Plan: <mode>`（由 specpowers 入口 skill 写入）:
- mode === "tiny" → 跳过全部验证（specpowers-review 在微小任务模式下不被调用，标记块不存在为预期行为）
- mode !== "tiny" 或 Plan mode 不存在 → 继续验证 1 + 验证 2
降级: 若 Plan mode 不存在，默认视为非 tiny，输出 `[WARNING] Plan mode 未设置` 后继续完整验证。

**验证 1 — 执行标记完整性检查**:
在 specpowers-review 返回的审查报告中搜索对应标记块（搜索以 `STEP<N>_EXECUTED` 开头的 fenced code block）。
缺失任一块 → `[VERIFY_FAIL] Gate <N> 审查执行不完整，阻塞 Phase <N>`。
搜索未命中任何标记块 → `[VERIFY_FAIL] Gate <N> 审查 Agent 未正常执行（无任何执行标记），阻塞 Phase <N>`。

**验证 2 — P0 硬阻止检查**:
搜索 `[GATE_BLOCKED] p0_count=N`:
- N > 0 → `[VERIFY_FAIL] Gate <N> 未通过（P0=N），阻塞 Phase <N>`
- N = 0 且验证 1 通过 → Gate <N> 通过

**各 Gate 特化参数**:

| Gate | Phase | 调用点 | 应存在标记块 |
|------|-------|--------|-------------|
| Gate 0 | Phase 0 | specpowers-plan Phase 0 审批通过后 | STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 1 | Phase 1 | specpowers-plan Phase 1 人工审核通过后 | STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 2 | Phase 2 | specpowers-plan Phase 2 plan 生成后 | STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 3 | Phase 3 | specpowers-apply 实现完成后 | UltraReview(>=10文件): STEP1-5 / 加强审查(<10文件): STEP1-2 |

#### L128-129 — Gate 0 调用

| 项目 | 内容 |
|------|------|
| **当前文本** | `审批通过后，执行 Gate 0 审查：Skill({skill: "specpowers-review"}) — 对齐检查：design.md vs clarifications/<name>.md。Gate 0 通过后进入 Phase 1。如 Gate 未通过（存在 P0），阻塞当前 Phase，等待 specpowers-review 修复循环完成且 P0 清零后继续。` |
| **修改后** | 替换为带验证协议引用的精简调用，验证逻辑统一由"Gate 返回后验证协议"定义 |

**修改后文本**:

```markdown
**审批通过后，执行 Gate 0 审查**:
`Skill({skill: "specpowers-review"})` — 对齐检查：design.md vs clarifications/<name>.md。
Gate 0 返回后，执行 Gate 返回后验证协议（参数: Gate=0, Phase=0, 标记块=STEP1-5）。
```

#### L188-189 — Gate 1 调用

| 项目 | 内容 |
|------|------|
| **当前文本** | `人工审核通过后，执行 Gate 1 审查：Skill({skill: "specpowers-review"}) — 对齐检查：OpenSpec 四件套 vs Phase 0 design.md + clarifications。Gate 1 通过后进入 Phase 2。如 Gate 未通过（存在 P0），阻塞当前 Phase，等待 specpowers-review 修复循环完成且 P0 清零后继续。` |
| **修改后** | 替换为带验证协议引用的精简调用 |

**修改后文本**:

```markdown
**人工审核通过后，执行 Gate 1 审查**:
`Skill({skill: "specpowers-review"})` — 对齐检查：OpenSpec 四件套（proposal/design/specs/tasks）vs Phase 0 design.md + clarifications。
Gate 1 返回后，执行 Gate 返回后验证协议（参数: Gate=1, Phase=1, 标记块=STEP1-5）。
```

#### L235-237 — Gate 2 调用

| 项目 | 内容 |
|------|------|
| **当前文本** | `Skill({skill: "specpowers-review"}) — 对齐检查：plan vs Phase 1 OpenSpec specs + Phase 0 design。Gate 2 通过后进入 Phase 3。如 Gate 未通过（存在 P0），阻塞当前 Phase，等待 specpowers-review 修复循环完成且 P0 清零后继续。` |
| **修改后** | 替换为带验证协议引用的精简调用 |

**修改后文本**:

```markdown
`Skill({skill: "specpowers-review"})` — 对齐检查：plan vs Phase 1 OpenSpec specs + Phase 0 design。
Gate 2 返回后，执行 Gate 返回后验证协议（参数: Gate=2, Phase=2, 标记块=STEP1-5）。
```

### 3.4 specpowers-apply/SKILL.md 联动修改

#### L41-48 — Gate 3 调用后增加执行标记检查

| 项目 | 内容 |
|------|------|
| **当前文本** | `Skill({skill: "specpowers-review"}) — 对齐检查：代码 vs Phase 2 plan + Phase 1 specs + Phase 0 design。审查类型由 specpowers-review 内部决策树自动判定...Gate 3 通过后进入 Phase 4。` |
| **修改后** | 增加执行标记检查和 P0 硬阻止检查，且标记块检查根据审查类型差异化 |

**修改后文本**:

```markdown
实现完成后，执行 Gate 3 审查：

`Skill({skill: "specpowers-review"})` — 对齐检查：代码 vs Phase 2 plan + Phase 1 specs + Phase 0 design。

审查类型由 specpowers-review 内部决策树自动判定：
- 微小任务：不触发 specpowers-review，由本技能内部审查协议（spec-compliance-check）执行
- 中等及以上 + 代码 < 10 文件：加强审查（code-review 由本技能执行 + 对齐检查由 specpowers-review 对齐 Agent 单 Agent 执行）
- 中等及以上 + 代码 ≥ 10 文件：完整 Gate 3 UltraReview（specpowers-review 的 5-agent 团队审查）

Gate 3 返回后，执行 Gate 返回后验证协议（参数: Gate=3, Phase=3, 标记块=UltraReview:STEP1-5 / 加强审查:STEP1-2（根据审查类型选择））。
```

---

## 4. 新增协议定义汇总

所有协议定义统一写入 specpowers-review/SKILL.md 的新增"协议与数据结构定义"章节（见 3.2 节）。

> **协议编号说明**: 协议 3（执行日志模板）和协议 4（退化声明内容要求）已合并为协议 2 的子条款（2.1 和 2.2），不再独立编号。协议编号体系：1（账本结构）、2（标记格式，含 2.1 执行日志汇总表、2.2 degradation 字段规范）、3（缓存协议，原协议 5 重编号）。

| 协议编号 | 名称 | 性质 | 存储形式 | 语义 |
|---------|------|------|---------|------|
| 协议 1 | 会话上下文账本 | 结构定义 | 主 Agent 内存 dict | 会话内收敛对比 + 跨 Gate 经验传递 |
| 协议 2 | 执行标记 (STEP<N>_EXECUTED) | 格式规范 | 审查报告内嵌 fenced code block | 双层验证：审查 Agent 输出标记块 + AgentId 引用，父技能 Agent 独立检查 |
| 协议 2.1 | 执行日志表格（协议 2 子条款） | 格式规范（子条款） | 审查报告末尾 Markdown 表格 | 协议 2 子条款：执行标记汇总表格格式——统一格式的审查执行摘要 |
| 协议 2.2 | 退化声明三要素（协议 2 子条款） | 格式规范（子条款） | STEP<N>_EXECUTED.degradation 字段 | 协议 2 子条款：degradation 字段格式规范——降级场景的标准化声明 |
| 协议 3 | 跨会话缓存 (.specpowers/review-cache.json) | 交互协议 | 文件（尽力而为） | 审查教训 + 最终通读状态的跨会话持久化 |

---

## 5. 父技能联动修改汇总

### 5.1 specpowers-plan 修改点

| 位置 | 修改内容 | 新增逻辑 |
|------|---------|---------|
| L128-129 (Gate 0 调用点) | 替换为带验证协议引用的精简调用 | 调用后引用"Gate 返回后验证协议"（参数: Gate=0, Phase=0, 标记块=STEP1-5） |
| L188-189 (Gate 1 调用点) | 同上 | 参数: Gate=1, Phase=1, 标记块=STEP1-5 |
| L235-237 (Gate 2 调用点) | 同上 | 参数: Gate=2, Phase=2, 标记块=STEP1-5 |
| 新增：通用协议节 | 新增"Gate 返回后验证协议"通用节 | 定义验证 0/1/2 统一流程 + 各 Gate 特化参数表（含 Gate 3） |

### 5.2 specpowers-apply 修改点

| 位置 | 修改内容 | 新增逻辑 |
|------|---------|---------|
| L41-48 (Gate 3 调用点) | 替换为带验证协议引用的精简调用 | 调用后引用"Gate 返回后验证协议"（参数: Gate=3, Phase=3, 标记块=UltraReview:STEP1-5 / 加强审查:STEP1-2） |

### 5.3 验证流程图

```
specpowers-review 执行
  └── 子 Agent 输出 STEP<N>_EXECUTED 标记块
        └── 主 Agent 汇总到审查报告末尾
              └── 审查报告返回父技能
                    │
                    ├── [父技能] 验证 1: 搜索 STEP<N>_EXECUTED
                    │     ├── 全部存在 → 通过
                    │     ├── 部分缺失 → [VERIFY_FAIL] 阻塞 Phase
                    │     └── 零标记 → [VERIFY_FAIL] Agent 未触发
                    │
                    └── [父技能] 验证 2: 搜索 [GATE_BLOCKED] p0_count=N
                          ├── N=0 或无标记 → P0 通过
                          └── N>0 → [VERIFY_FAIL] 阻塞 Phase
```

---

## 6. 修改范围汇总

### 6.1 文件级修改清单

| 文件 | 修改类型 | 修改行 | 说明 |
|------|---------|--------|------|
| `skills/specpowers-review/SKILL.md` | **主要修改** | L113, L283-327, L320-327, L340-418 | 移除 .review 产物；增加执行标记/账本/退化声明/缓存；拆分硬阻止+收敛提醒模板；Step 5 退化补偿 |
| `skills/specpowers-plan/SKILL.md` | **联动修改** | L128-129, L188-189, L235-237 + 新增通用协议节 | 三处 Gate 调用点替换为参数化引用 + 新增"Gate 返回后验证协议"通用节；验证逻辑统一模板化 |
| `skills/specpowers-apply/SKILL.md` | **联动修改** | L41-48 | Gate 3 调用点替换为参数化引用（参数: Gate=3, Phase=3, 标记块按审查类型选择） |

### 6.2 产物变更

| 产物 | 变更 | 说明 |
|------|------|------|
| `.review-summary.json` | **删除** | 所有引用移除，不再创建或读取 |
| `.specpowers/review-state/<gate_id>.json` | **删除** | 所有引用移除，不再创建或读取 |
| `.specpowers/review-cache.json` | **新增** | 尽力而为缓存，仅存 lessons_learned + final_readthrough |

### 6.3 新增章节

| 章节 | 位置 | 内容 |
|------|------|------|
| 退化声明标准协议 | specpowers-review 上下文传递机制后、Step 3 前 | 三要素 + 横切覆盖规则 + 各 Step 退化声明位置表 |
| 协议与数据结构定义 | specpowers-review 收敛状态存储后、最终通读 Gate 前 | 5 个协议的完整定义 |
| 执行标记格式定义 | specpowers-review 收敛状态存储节内 | 标记块格式 + 各 Step 定义 + 验证规则 |
| 会话上下文账本协议 | specpowers-review 收敛状态存储节内 | 账本结构 + 读写时机 + 跨 Gate 传递 |

### 6.4 删除内容

| 内容 | 原位置 | 原因 |
|------|--------|------|
| `.review-summary.json` 引用 | L113, L386-418 | 替换为会话上下文账本 |
| `.specpowers/review-state/<gate_id>.json` 引用 | L113, L388 | 替换为 review-cache.json |
| JSON 摘要 schema 定义 | L390-411 | 移除（数据不再存文件） |
| "仅提醒不强制"单句 | L383 | 拆分为硬阻止声明 + 着重提醒模板 |
| 跨会话重启 JSON 行为 | L418 | 替换为 review-cache.json 读取逻辑 |

### 6.5 不变内容

以下内容不受本轮修改影响：

- specpowers-review 审查决策树（L25-42）
- Gate 0-4 详细定义表（L93-99）
- UltraReview 5-agent 团队结构（L128-195）
- 多模型渐进式三 Agent 结构（L204-249）
- 上下文传递机制（L271-281）
- 最终通读 Gate（L422-464，不变——所有跨会话逻辑已在 review-cache.json 读写规则中定义，见 3.1 节"跨会话缓存"中的 final_readthrough 读写规则）
- specpowers-archive 硬 Gate 链（不变）
- specpowers 入口 skill（不变）

**文件长度说明**: 修改后 specpowers-review SKILL.md 预计约 740 行（~12,000 tokens），为技能组中最大文件。协议定义（约 150 行）如后续需要精简可抽取为 `refs/protocols.md` 通过 bundled resources 加载。当前版本保持单文件以便于维护。

---

## 7. 附录：术语操作化定义

| 术语 | 操作化定义 | 性质 | 验证方式 |
|------|-----------|------|---------|
| **硬阻止（Hard Block）** | 审查报告包含 `[GATE_BLOCKED] p0_count=N` 标记，父技能检查 N>0 后输出 `[VERIFY_FAIL]` 并拒绝进入下一 Phase。非用户可跳过的建议——父技能强制执行，用户不可手动降级 | 强制性 Gate 判定 | 搜索字符串 |
| **必须（Mandatory / 硬性要求）** | specpowers-review 内部必须执行的步骤或必须满足的条件（如修复-重审循环）。违反"必须"的效果由对应 Gate 的硬阻止规则定义，不直接等同于硬阻止 | 指令级要求 | 由父技能 Gate 判定间接验证 |
| **硬阻止 vs 必须** | "硬阻止"是对父技能 Gate 返回后的行为描述（拒绝进入下一 Phase）；"必须"是对审查内部 Agent 的指令强度描述。两者作用于不同层面：必须 = 审查内部纪律要求，硬阻止 = 跨技能 Gate 控制机制。P0 问题修复是"必须"的，P0>0 触发"硬阻止" | 概念区分 | 层面区分 |
| **退化（Degradation）** | STEP<N>_EXECUTED.degradation 字段非 none，包含三要素声明 | 格式规范定义 | 检查 degradation 字段 |
| **执行标记（Execution Marker）** | 审查报告中的 `STEP<N>_EXECUTED` fenced code block，末尾附带 `ref: AgentId=<id>, tokens=<N>` 引用行（AgentId 从子 Agent 的 `Agent` 工具返回值提取，格式 `a` + 16 hex） | 格式规范定义 | 搜索字符串 + AgentId 格式校验 |
| **双层验证（Dual-Phase Verification）** | 审查阶段（specpowers-review Skill 上下文）输出标记块 + AgentId 引用 → 验证阶段（父技能 Skill 上下文，同一 Agent 切换回父技能后以独立验证者角色）检查标记块完整性 + AgentId 格式。两阶段在同一 Agent 不同 Skill 上下文中执行，构成时序分离的双层验证（非进程级技术隔离） | 架构模式 | 两个时序分离的验证阶段协作，通过 Skill() 内联加载实现上下文切换 |
| **会话上下文账本（Session Ledger）** | 主 Agent 内存 dict 结构，跨 Gate 通过 prompt 参数传递 | 结构定义 | 会话内可用 |
| **review-cache.json** | 文件缓存，丢失不影响正确性，仅加速跨会话经验积累 | 交互协议定义 | 文件存在检查 |
| **P0 清零（P0 Clearance）** | p0_count = 0，即 [GATE_BLOCKED] 标记不存在或 N=0 | 状态定义 | 搜索 [GATE_BLOCKED] |
| **收敛（Convergence）** | P0=0, P1≤3, 且较上轮无新增 P1 | 状态定义 | 账本对比 |

---

## 8. 实施阶段注意事项

以下优化点经分析判断，适合在实施阶段（编辑 SKILL.md 时）处理，不在 v2 方案中展开：

### 8.1 Description 修剪
修改 SKILL.md 时，同步修剪 description 字段末尾的流程摘要句（"The skill internally selects review type..."），仅保留触发条件描述，对齐 writing-skills 的 Description = When to Use 原则。

### 8.2 合理化表 + Red Flags 清单
在审查流程 Step 0 后、Step 1 前可追加"跳过 Step 常见借口及预先反驳"表（合理化表）和"Red Flags 自我检查清单"。注意：v2 方案的"验证能力与限制"表已等价覆盖 Red Flags 的核心功能；合理化表在子 Agent prompt 注入模板中价值更大（子 Agent 不读 SKILL.md 全文），实施时按需决定放置位置。

### 8.3 SKILL.md 长度控制
实施后如最终行数 > 700，将协议定义（协议 1/2/3 + 数据结构定义）整体抽取到 `skills/specpowers-review/refs/protocols.md`，SKILL.md 中以 bundled resource 引用加载。v2 方案 L800 已有此评估。

### 8.4 重复定义的上下文保留
SKILL.md 中 ref 行说明、标记块格式、双层验证原理各出现 2-3 次——这些服务于不同读者（主 Agent 参考 / 子 Agent 注入 / 父技能验证），实施时保留必要上下文，不强制去重。子 Agent prompt 注入模板中的格式定义必须独立完整（子 Agent 不读 SKILL.md 全文）。

### 8.5 刚性措辞审查
实施时逐条审查每个"必须/强制/不可跳过"：(a) 有对应结构化后果（如"标记块缺失 → [VERIFY_FAIL]"）→ 保留；(b) 仅有语气刚性而无检查手段 → 替换为可验证的规则表述或 WHY 解释。

### 8.6 验证流程图精简
实施时将 v2 方案的验证流程图（ASCII art）精简为一句话："父技能在 specpowers-review 返回后搜索 STEP<N>_EXECUTED（验证 1）和 [GATE_BLOCKED]（验证 2）标记"。
