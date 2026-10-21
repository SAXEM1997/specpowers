# specpowers-review 协议参考：标记格式
> 含协议 3；加载时机见 SKILL.md「按需加载表」。

## 协议 3: 执行标记格式

### 标记块格式

specpowers-review 内部每个 Step 结束后，对应子 Agent 输出以下结构化标记块：

```markdown
\`\`\`STEP<N>_EXECUTED
status: complete|degraded|failed
mode: standard|transferred_to_step5|trivial   # 仅 Step 3 必填（描述合并验证部署形式），其他 Step 省略
raw_count_sum: p0=N p1=N p2=N p3=N   # 仅 Step 1 必填（各 Agent RAW_COUNT 求和，原始发现数——审计基线）
merged_count: p0=N p1=N p2=N p3=N, rejected=N, supplement=N   # 仅 Step 2 必填（合并判断表口径：p*_merged=合并判断表**行**数——行均为已采纳项（`disposition ∈ {agent_accepted, user_adjudicated}`），不含被拒项（被拒项在未纳入清单）；rejected=未纳入清单总条数；supplement=监督补充记账条数（p*_supplement 按 SKILL.md「问题数口径权威定义」的记账口径统计——发现型计入；更正型不计入；Step 2 时为 0））
conservation: pass|fail   # 仅 Step 2/3 必填（守恒等式自检/核对结果）
merged_count_final: p0=N p1=N p2=N p3=N, rejected=N, supplement=N   # 仅 Step 3 必填（mode=standard 时；transferred/trivial 可省略（终值等于 Step 2 值）；口径冻结后的终值，含监督补充行）
agents: [<agent_name>(<model>), ...]
issues_found: <N>
result: pass|fail   # 仅 STEP_FINAL_READTHROUGH 必填（通读结果，独立字段——status 仍取通用枚举 complete|degraded|failed，不承载通读结论；FAIL 时 status 取 degraded（修复后可重新通读）或 failed（不可继续），映射见 `refs/convergence.md` 协议 9「输出与 PASS 标准」）
degradation: none|<具体原因>|<影响分析>|<替代措施>
notes: <自由文本>   # 可选（如 Step 5 兼并合并验证声明、回退标注等）
ref: AgentId=<id>, tokens=<N>
\`\`\`
```

> **degradation 字段说明**: pipe 三段对应 `refs/dispatch.md` 协议 4 退化声明三要素：(a) 具体原因（缺失能力+模型名），(b) 影响分析（尝试过的调用方式+失败信息），(c) 替代措施（降级路径选择依据）。`none` 表示无退化。

> **mode 字段说明（仅 Step 3 必填）**: 取值 `standard`（独立监督 Agent，p0_raw≥3 或 N>15 完整 4 维）/ `transferred_to_step5`（不启动独立 Agent，合并验证转移 Step 5，degradation=none）/ `trivial`（N==0，主 Agent 自执行）。档位判据与覆盖规则见 SKILL.md Step 3（唯一权威）；本字段只描述部署形式，独立于 degradation。

> **merged_count_final 字段说明（仅 Step 3 必填，mode=standard 时）**: merged_count_final 是 Step 3 冻结后的判定口径终值；**mode=standard 时必填**（Step 3 可能调整合并表），**transferred/trivial 档位可省略**（终值等于 Step 2 的 merged_count；若填则应与 Step 2 值一致，差异须在 notes 说明）；未调整合并表时，**`p0`–`p3` 分量**等于 Step 2 的 `merged_count`，**`supplement` / `rejected` 分量仍按 Step 3 终值填写**（被否决的监督补充计入 `supplement` 与 `rejected`，不改变 merged 分量）。

> **补充否决的复核（监督 `[补充]` 项被主 Agent 否决时）**: 主 Agent 否决监督 `[补充]` 项时须逐条写明事实依据（同拒绝项的要求）。若**否决比例 ≥ 50% 或否决条数 ≥ 3**，标记 `[补充否决异常]`，并将否决清单回传监督 Agent 复议一次；复议后监督维持原意见而主 Agent 仍否决的，须把双方理由一并写入报告，且该轮**强制注入 Step 5 复核**（无论 Step 3 为何 mode；**例外——加强审查子路径检出 `[拒绝异常]` 且 N>0 时**：Step 5 保持裁剪、不注入 Step 5 字段组，该复核转移为 Step 3 复议留痕——监督复议结论与双方理由写入 `STEP3_EXECUTED` 的 `notes`（或审计说明），并同步写入 `[CONVERGENCE_CHECK]` 的 `notes`，见 SKILL.md「加强审查」节例外条）。

> **ref 行说明**: `ref: AgentId=<id>[, tokens=<N>]` 由**主 Agent 在汇总时追加**（非子 Agent 输出）。AgentId 从子 Agent 的 `Agent` 工具返回值提取（必填）；tokens 为主 Agent 估算的消耗（可选字段，不可用时省略或填 `null`）。AgentId 格式为 `a` + 16 位 hex（系统生成）。主 Agent 在遵循协议时从该路径获取真实 AgentId；但技术上可生成格式合法的虚假值——此为辅助真实度信号，非密码学验证。完整限制声明见标记块验证规则中的"验证能力与限制"表。

> **零问题标记块强制要求**: **无论 issues_found 是否为 0，每个执行的 Step 必须输出 STEP<N>_EXECUTED 标记块。** `issues_found: 0` = Step 正常完成且未发现新问题；标记块缺失 = Step 未执行。两者有本质区别。父技能的验证逻辑依赖标记块的存在性来判断审查是否完成，零问题 Step 省略标记块将导致父技能误判为审查未完成并阻塞当前 Phase。
>
> **完整性检查表的前提**: 完整性检查表中的"应存在的标记块"以此规则为前提——每个 Step 的标记块均应存在（无论 issues_found 是否为 0），缺失任一块即视为审查未完成。

### 各 Step 标记块定义

| Step | 输出者 | status 取值 | degradation 说明 |
|------|--------|------------|-------------------|
| Step 1 | 主 Agent（汇总**recipe 声明的全部**子 Agent 完成状态——文档3Agent=3 / 文档2Agent=2 / 3视角=3 / 加强审查=2 / UltraReview=6） | complete / degraded | 某 Agent 未完成（原因+重试次数+替代措施）；汇总 raw_count_sum（含各 Agent 问题编号区间，供 Step 2 `sources` 引用与守恒等式核对） |
| Step 2 | 主 Agent（自执行，无子 Agent） | complete | none（主 Agent 执行，无降级路径）——标记块由主 Agent 为自己执行的 Step 输出，ref 行 AgentId 填 `self`，tokens 为主 Agent 执行 Step 2 的估算消耗；输出 merged_count（`p*_merged` + rejected + supplement）与守恒等式自检结果 `conservation: pass/fail` |
| Step 3 | 按 mode 分叉（见上方 mode 字段说明）：standard=必须启动独立监督 Agent；transferred_to_step5=主Agent自执行(转移至Step5)；trivial=主Agent自执行(N==0) | complete / degraded | mode=standard（p0_raw≥3 或 N>15 启动独立监督 Agent 完整4维，含守恒等式核对；单一模型时声明缺少独立视角）；mode=transferred_to_step5（主 Agent 自执行，agents=self，degradation=none，合并验证转移至 Step 5；p0_raw≥1 或 p0_rejected≥1 或 agent_rejected≥1 或 user_rejected≥1 时 Step 5 追加严重度校准抽查）；mode=trivial（N==0，主 Agent 自执行；p3_raw>0 时自修 P3 后走 Step 5）（例外：Step 2 检出 `[拒绝异常]` → 档位判定不适用，按覆盖规则处理）；输出 merged_count_final（终值，mode=standard 时） |
| Step 4 | 修复子 Agent + 主 Agent | complete / degraded / failed | 子 Agent 不可用时声明"退回主 Agent 自行修复"；修复重试超限声明"修复失败" |
| Step 5 | Quick Review Agent | complete / degraded | 单一 Agent 时声明"缺少独立视角"；Step 4 退化时声明"执行两轮补偿验证"；mode=transferred_to_step5 **或检出 `[拒绝异常]`（含加强审查子路径 N==0 例外启动的独立 Step 5）**时经 notes 字段输出"兼并 Step 3 合并验证（溯源+遗漏+守恒等式核对+误合抽查；p0_raw≥1 或 p0_rejected≥1 或 agent_rejected≥1 或 user_rejected≥1 时含严重度校准抽查）"（非 degradation——与 SKILL.md Step 5 统一） |
| 最终通读 | 独立子 Agent 或主 Agent（自执行） | complete / degraded / failed（**通读结果另由 `result: pass\|fail` 字段表达**——`status` 不承载通读结论，仍取通用枚举；`PASS → result: pass`（status: complete）；`FAIL → result: fail`，status 取 `degraded`（修复后可重新通读）或 `failed`（不可继续），映射见 `refs/convergence.md` 协议 9「输出与 PASS 标准」节） | 沿用通用标记块格式（STEP_FINAL_READTHROUGH）。agents 填子 Agent 模型名或 self（主 Agent 自执行）。issues_found 填残余问题数。子 Agent 工具不可用时由主 Agent 自执行，degradation 声明"单一模型，最终通读缺少独立视角" |

> **`issues_found` 逐 Step 语义（同字段多义的正名；父技能按标记块存在性检查、不解析该字段，本注仅供审计与人类阅读）**：
> - **Step 1** = 审查发现总数（= `raw_count_sum` 四值合计）
> - **Step 2** = 合并表行数（= Σ`p*_merged`）
> - **Step 3** = 监督 `[补充]` 项数（= Σ`p*_supplement` 记账条数；mode=transferred/trivial 时为 0）
> - **Step 4** = 修复过程中**新发现**的问题数（`issues_found: 0` = 未发现新问题，Step 正常完成）
> - **Step 5** = 复核后**残余**问题数
> - **最终通读** = 残余问题数
> **trivial 档位显式例外**：`N==0` 且 `p3_raw>0` 时 Step 4 由主 Agent 自执行修复全部 P3，其 `issues_found` = 本轮**修复的 P3 项数**（= `p3_raw`，默认全量修复）——这是 Step 4 语义定义域上的**显式例外**（该档位无独立修复子 Agent、无「修复中新发现」的来源，修复数是该标记块唯一有意义的内容），非与「新发现问题数」语义矛盾（见 SKILL.md Step 3 trivial 档）。

**多修复子 Agent 合并规则（Step 4）**: 当修复项涉及 ≥ 2 个无依赖文件时，拆分为多个修复子 Agent 并行执行（以文件为分组维度，无修复项数量阈值）；单文件内 > 10 条时分批顺序执行（见 SKILL.md Step 4 "同文件不并发"硬约束），主 Agent 收集所有修复子 Agent 的输出后，合并为**单个** STEP4_EXECUTED 标记块。issues_found 汇总所有修复子 Agent 发现的新问题数。agents 列表包含所有修复子 Agent 的名称和模型。degradation 取所有修复子 Agent 中最严重的退化状态（严重度序: `failed` > `degraded` > `complete`；多个 `degraded` 时保留覆盖范围最广的一条，如同时有 '子Agent不可用' 和 '环境不支持并行'，保留前者因其覆盖范围更广）。

> 字段语义与判定规则的唯一权威：SKILL.md「问题数口径权威定义」与 Step 3/5。

### 标记块验证规则

**主 Agent 规则**:
- 只能汇总子 Agent 的实际输出，不能凭空生成标记块
- **例外**: Step 2（主 Agent 自执行）、Step 3 转移/trivial 路径（mode=transferred_to_step5|trivial，主 Agent 自执行）、最终通读（主 Agent 自执行路径）除外——主 Agent 为自己执行的 Step 输出标记块，ref 行 AgentId 填 `self`
- 汇总方式: 将子 Agent 输出中的 `STEP<N>_EXECUTED` 块原样附加到审查报告中。标记块附加在审查报告的执行日志表格之后，统一以 `## 执行标记原始记录` 标题开头，按 Step 编号排序
- 如果某 Step 的子 Agent 未输出标记块 → 主 Agent 标注 `STEP<N>_EXECUTED: missing`（不可补写内容）
- 汇总时必须在每个标记块末尾追加 `ref` 行（AgentId 必填，从子 Agent 的 `Agent`/`subagent` 工具返回值中提取，**格式由当前平台决定**：Claude Code 为 `a` 开头 + 16 位 hex、DSH 为 `subagent` 返回的 session 风格 id，均由系统生成、主 Agent 不得自造；**上方「例外」列出的主 Agent 自执行路径（Step 2 / Step 3 transferred·trivial / 最终通读自执行）填字面量 `self`**——属规范允许的合法值，见下方父技能校验规则的例外子句）；tokens 为可选估算值，不可用时省略或填 `null`。格式: `ref: AgentId=<id>[, tokens=<N>]`

**父技能（验证者）规则**:
- specpowers-review 返回后，父技能在 specpowers-review 的输出中检查每个应执行的 Step 的标记块是否存在
- 标记块完整性检查表:

| Gate | 应存在的标记块 |
|------|-------------|
| Gate 0/1/2（文档类） | 按 [TIER_ROUTING] expected_steps 动态检查（非固定 STEP 集）。无 TIER_ROUTING 标记时回退旧逻辑：STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 3（代码类） | 按 [TIER_ROUTING] expected_steps 动态检查（非固定 STEP 集）。无 TIER_ROUTING 标记时回退旧逻辑——2 文件且 ≤200 行：STEP1, STEP2；其他：STEP1, STEP2, STEP3, STEP4, STEP5 |
| 最终通读 | STEP_FINAL_READTHROUGH（独立调用场景由 SELF_VERIFY 检查，非父技能验证范围） |

> **动态检查规则**: 父技能（验证者）搜索 `[TIER_ROUTING]` 标记，提取 `expected_steps` 数组，以此作为应存在的 STEP 列表。`expected_steps` 必须为**离散 STEP 列表**（如 `[STEP1, STEP2]`（加强审查）、`[STEP1, STEP2, STEP3, STEP4, STEP5]`（全 STEP recipe，**含文档2Agent**））——**禁止区间记法**（recipe 表的 `[STEP1-5]`/`[STEP1-2]` 仅为编排简写，父技能按单个 STEP 机械匹配、无法展开区间，见 SKILL.md「STEP 集合记法约定」）。**多轮审查时以最后一个 `[TIER_ROUTING]` 的 `expected_steps` 为准**（每轮 Step 0d 均输出该标记，轮间 tier/recipe 可变；与 `[CONVERGENCE_CHECK]` 的「最后一个」规则、「多轮循环标记块保留策略」的仅检查最后一轮规则一致——取首轮会多要求/少要求 STEP）。无 TIER_ROUTING 标记时回退旧逻辑（上表"回退旧逻辑"列）以保证向前兼容。
>
> **TIER_SKIPPED 块识别规则**: `STEP<N>_TIER_SKIPPED` 块（见 `refs/routing.md` 协议 6）表示 tier 裁剪主动跳过的 Step。**识别方法与 `STEP<N>_EXECUTED` 相同**：搜索以 `` ```STEP<N>_TIER_SKIPPED `` 开头的 fenced code block（行首 `` ``` `` 后紧跟 `STEP<N>_TIER_SKIPPED` 作为围栏起始标记，见下方检查方法；审查报告使用了非标准 code fence 如 `~~~` 时同规则搜索）——`refs/routing.md` 协议 6 的层级裁剪声明块必须以该围栏形式输出。**正文中以否定式/引述形式出现的裸串不构成标记块**：不在行首围栏起始标记位置的 `STEP<N>_TIER_SKIPPED` / `STEP<N>_EXECUTED` 字符串（如 SKILL.md 加强审查节「**且不输出 `STEP3_TIER_SKIPPED`**」这类否定句）仅为规则说明，字符串搜索不得误判为「已输出裁剪声明」。计数规则：(a) 该块既不计入已执行的 STEP，也不计入缺失；(b) 仅当对应 STEP 号在 expected_steps 中且未找到 STEP<N>_EXECUTED 时，才视为缺失；(c) TIER_SKIPPED 块本身不参与完整性判断——父技能在 expected_steps 检查之外可忽略之。

> **加强审查标记块均在 specpowers-review 内部产出，非跨 skill**: specpowers-apply 的 code-review 结果作为上下文**注入** specpowers-review 的对齐 Agent prompt。对齐 Agent 接收 code-review 结果后执行对齐检查，输出 `STEP1_EXECUTED`（标记块中记录 code-review 结果引用）；主 Agent 综合判断后输出 `STEP2_EXECUTED`。两个标记块均由 specpowers-review 内部 Agent 产出，父技能（specpowers-apply）在 Gate 3 返回后统一检查。

- 缺失任一块 → 视为审查未完成，阻塞当前 Phase，要求重新执行 specpowers-review
- 检查方法: 搜索以 `` ```STEP<N>_EXECUTED `` 开头的 fenced code block（即匹配行首的 `` ``` `` 后紧跟 `STEP<N>_EXECUTED`，作为 fenced code block 的起始标记）。此匹配方式利用标记块固定为 fenced code block 的事实，排除审查报告正文中的示例引用或讨论提及。如果审查报告使用了非标准 code fence（如 `~~~`），同时搜索 `~~~STEP<N>_EXECUTED`
- 辅助真实度信号: 检查每个标记块末尾的 `ref: AgentId=<id>, tokens=<N>` 行——AgentId **必须非空，且与父技能实际启动该子 Agent 时拿到的 id 一致**（**不校验格式**：Claude Code 为 `^a[0-9a-f]{16}$`、DSH 为 `session-*` 这类平台自有格式，硬编码任一平台的正则会在另一平台误报），**或为字面量 `self`（仅限上方「主 Agent 规则」例外列出的自执行路径：Step 2 / Step 3 transferred·trivial / 最终通读自执行——`self` 为协议合法值，不记警告）**；缺失 → 记录警告但仍以标记块存在性为主要判断依据

**验证能力与限制**：能检测——主 Agent 遗忘标记块、子 Agent 未执行且主 Agent 不伪造（标注 `missing`）；**不能检测**——主 Agent 故意跳过并伪造标记块、伪造格式合法的 AgentId（`a`+16 hex 校验只提升门槛）。这是纯文本协议的固有边界：无进程隔离、无代码强制；双层验证只把"静默跳过"升级为需在两个时序分离角色中做出不一致行为，不声称技术性不可伪造。

**多轮循环标记块保留策略**: 多轮修复-重审循环产生多套标记块时，主 Agent 按轮次分组（`## Round N 执行标记`）。父技能在搜索标记块时，如存在多轮标记块，仅检查**最后一轮**（以最大的 Round N 标题为准）的标记块完整性。前轮标记块因修复重审已过时，不参与完整性判断。

**同轮内多标记块权威规则**: 同轮内同一 STEP 输出多个标记块时，以最后输出为权威（后续标记块可能是回退/重试后的最终状态）。适用场景：Step 4 退化补偿回退路径——在原 STEP3_EXECUTED（transferred_to_step5）后追加新的 STEP3_EXECUTED（mode=standard，标注"回退自 transferred_to_step5"），父技能以最后输出的标记块判定该 Step 状态。与多轮保留策略互补：跨轮以最后一轮为准，同轮内以最后一个标记块为准。

### 双层验证原理

审查阶段由子 Agent 产出 `STEP<N>_EXECUTED`（主 Agent 汇总并追加 `ref: AgentId=...`），验证阶段由父技能在 Skill 边界另一侧检查标记块完整性与 AgentId 格式。两者是同一 Agent 的两个时序分离角色（非进程隔离），审查 Agent 无法自我声明"已完成"。

### Gate Token 输出（Gate 通过后）

Gate 审查最终通过（收敛判定 action=exit + 最终通读 PASS）后，review 主 Agent **必须**输出 Gate Token——两层保障：

**第 1 层：会话标记**
```
[GATE_PASSED] gate=<N>, round=<N>, tier=<tier>, p0_merged=<N>, p1_merged=<N>, p2_merged=<N>, p3_merged=<N>, p0_raw=<N>, p1_raw=<N>, p2_raw=<N>, p3_raw=<N>, supplement=<N>, rejected=<N>, agent_rejected=<N>, user_rejected=<N>, user_exempt_p0=<N>, convergence_triggers=<编号列表|none>
```
与现有的 `[TIER_ROUTING]`、`STEP<N>_EXECUTED` 同类机制。`[GATE_PASSED]` 仅在 Gate 确实通过后输出；P0 未清零时输出 `[GATE_BLOCKED]`（现有机制不变）。`p*_merged` 为判定口径、`p*_raw` 为审计基线、`supplement` 为监督补充数（守恒等式核对用）（定义见 SKILL.md「问题数口径权威定义」）——**`p0`–`p3` 全级四字段对 merged 与 raw 都完整列出**（只加不删：审计者须能据本标记单独核验触发条件③④（依赖 `p2_merged`/`p3_merged`）与全级合计的判定输入，而不必回读账本），供父技能与人类审计分辨"真的问题少"与"被合并/拒绝压下去的"。

> **字段说明（补充）**：
- `rejected` / `agent_rejected`：未纳入总数 / 其中主 Agent 拒绝数——**仅供审计 `[拒绝异常]` 是否触发**（不参与判定，也不影响 5 触发条件的计算）；`rejected = agent_rejected + user_rejected`，**不含** `user_exempt_p0`
- `user_rejected`：**用户**裁决拒绝的项数（**仅** Step 2 阶段记入未纳入清单的条目；区别于主 Agent 拒绝的 `agent_rejected`）——与 `agent_rejected` 共同构成 `rejected` 的两个来源
- `user_exempt_p0`：Step 4 前置 Gate 后的**用户豁免 P0 数**（独立计数字段，单列；**不计入 `rejected`**）——用于审计「用户豁免 P0」声明，须在用户提示中一并单列体现

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

1. 从 `[TIER_ROUTING]` 标记中提取 `expected_steps`，动态确定应存在的 STEP 集合（无 `[TIER_ROUTING]` 标记时回退为全集 `[STEP1, STEP2, STEP3, STEP4, STEP5]`——**不含 `STEP_FINAL_READTHROUGH`**：最终通读是横切 Gate，独立于 `expected_steps` 检查，其存在性由下方 `readthrough_present` 单列承载）
2. 搜索 `STEP<N>_EXECUTED` 和 `STEP<N>_TIER_SKIPPED` 标记块，确认 `expected_steps` 中的每个 STEP 要么已输出 `_EXECUTED` 标记块，要么已输出 `_TIER_SKIPPED` 标记块
3. 确认最终通读标记块已输出（缺失时在 `[SELF_VERIFY]` 的 `readthrough_present` 字段填 `false`——即旧措辞"最终通读可能未执行"的承载字段）
4. 确认 `[CONVERGENCE_CHECK]` 标记已输出（缺失时在 `[SELF_VERIFY]` 的 `convergence_present` 字段填 `false`——即旧措辞"收敛判定可能未执行"的承载字段）
5. 以 `[SELF_VERIFY]` 标记输出检查结果

**自检结果格式**:

```[SELF_VERIFY]
verified_steps: <动态取值——从 [TIER_ROUTING] expected_steps，无 TIER_ROUTING 时回退全集>
missing_steps: <expected_steps 中既无 _EXECUTED 也无 _TIER_SKIPPED 的 STEP>
skipped_steps: <被 tier 裁剪的 STEP 列表——由 STEP<N>_TIER_SKIPPED 标记识别，识别规则见本协议「标记块验证规则」的 TIER_SKIPPED 块识别规则>
all_present: true|false
readthrough_present: true|false
convergence_present: true|false
```

> `missing_steps` 排除已输出 `STEP<N>_TIER_SKIPPED` 的 STEP（tier 裁剪是预期行为，非缺失）。`skipped_steps` 记录因 tier 裁剪而未执行的 STEP，用于诊断 tier 路由是否按预期工作。**`all_present` 仅覆盖 `expected_steps` 内的 STEP**（= `missing_steps` 为空）；**最终通读与收敛判定为横切项，不在 `expected_steps` 内、不计入 `all_present`**——其存在性由 `readthrough_present` / `convergence_present` 两个布尔字段单独承载（`false` 即对应标记缺失的显式告警，人类审计据此追查）。

此自检与父技能验证处于同一信任域（同一 Agent），但至少确保标记块在独立调用场景下不会被完全忽略。独立调用场景下 `[GATE_BLOCKED]` 标记不触发外部阻塞（无父技能读取），仅作为信息性声明。

> **注**: 独立调用 specpowers-review 时，`file_count`（变更文件数）与 `line_count` 由主 Agent 自行计算（一次性输出 files + lines 两条值）。**`line_count` 口径按对象类型固定（与 SKILL.md 0c-pre、`refs/routing.md` 协议 6 `bucket_doc` 一致，不得互换）**：文档类＝**审查对象总行数**（`wc -l`，多文件取合计——不依赖 git diff，空 diff 不影响其取值）；代码类＝**修改总行数**（git diff，下方命令）。**命令兜底（强制）**：任何情形下都必须输出数字，**不得输出空串**——当 `HEAD == merge-base(BASE, HEAD)`（在本分支 tip 上审查已提交的工作，最常见情形）时 `git diff --shortstat` 无输出，awk 无输入行故主块不执行，原 `if(s=="") s=0` 是死代码；且 `diff base..HEAD` 不含未提交改动：
> ```bash
> BASE=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|origin/||'); BASE=${BASE:-master}
> MB=$(git merge-base "$BASE" HEAD 2>/dev/null) || MB=""
> OUT=$([ -n "$MB" ] && git diff --shortstat "$MB"..HEAD)
> FILES=$(printf '%s\n' "$OUT" | awk 'NR==1{f=$1} END{print f+0}')       # file_count＝变更文件数（shortstat 首字段）
> LINES=$(printf '%s\n' "$OUT" | awk 'NR==1{s=$4+$6} END{print s+0}')   # line_count＝修改总行数；END 兜底：无输入行时输出 0
> echo "file_count=$FILES line_count=$LINES"; [ -z "$OUT" ] && echo "[DEGRADED] 空diff回退:git 无法推断审查范围（HEAD==merge-base），file_count 须按审查对象手工清点"
> ```
> - **`file_count` 算法**：`git diff --shortstat` 输出的首字段（"N files changed" 的 N；单文件时 git 输出 "1 file changed" 同样取首字段）。空 diff 回退见下条。
> - **Windows 载体**：本块是 bash（`$(...)`/`sed`/`awk`）。Windows 上须用 **Git Bash** 执行；只有 PowerShell 时改用 `git diff --shortstat <base>..HEAD` 并手工解析 `N files changed, X insertions(+), Y deletions(-)`，或按审查对象手工清点并输出 `[DEGRADED] 空diff回退:手动清点`。
> - **空 diff 的回退算法**（`OUT` 为空时）：**文档类** → `line_count` 主算法即 `wc -l`（不受空 diff 影响），仅需补 `file_count`——按审查对象文件数直接清点（不依赖 git diff）；**代码类** → `file_count` 回退为 `git status --porcelain | wc -l` 计数（覆盖未提交改动），`line_count` 记 0。
> - **file_count=0 的分桶归属**：所有回退执行后仍为 0 时，**归入微小**（`refs/routing.md` 协议 6 代码类 bucket 的下界延拓；不判为「不可判定」，tier 路由正常进行）。
> - **[DEGRADED] 声明（强制）**：任一回退发生时，在 `[TIER_ROUTING]` 的 notes 与审查报告中输出 `[DEGRADED] 空diff回退:<所用回退算法>`，注明所用回退算法（`wc-l-total`＝文档类 wc -l / `porcelain-count`＝代码类 porcelain 计数）。
> （与 specpowers-apply Step 0 同款逻辑——其「降级声明」中的"与 review 独立调用同款降级策略"即指此处；若无 git 历史可用（如新项目），回退为手动估算文件行数）

