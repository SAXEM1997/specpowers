# specpowers-review 协议参考：UltraReview
> 含协议 8；加载时机见 SKILL.md「按需加载表」。

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
- 相同问题（同一文件+同一符号+同一问题类型）→ 合并为一条，**`sources` 列逐条引用被吸收的原始发现**（`<Agent名>#<编号>`）——格式与强制要求同 SKILL.md Step 2（来源映射、未纳入清单、守恒等式自检缺一不可）
- 冲突结论（如 code-reviewer 说 P0，specs-reviewer 说 P3）→ 标注冲突，不做自动裁决，提级用户判断
- **守恒等式自检（强制）**：`Σ(所有行的 sources 条数) + Σp*_rejected == Σp*_raw + Σp*_supplement`（Step 2 自检时监督尚未运行，`Σp*_supplement=0`），通过方可继续；不成立 → **一律标记 `[问题数存疑]`**（与通用流程 Step 2 同规定）→ 补齐后重新自检
- 记录 `p*_merged`（合并表行数，`disposition ∈ {agent_accepted, user_adjudicated}`）、`p*_rejected`（未纳入清单条数）与 `p*_supplement`（监督补充数——按 SKILL.md「问题数口径权威定义」的记账口径统计：发现型计入（采纳入 `sources`、被否决入未纳入清单；已采纳者不得产生无 sources 行）；更正型不计入（不参与守恒等式）；Step 3 完成后按终值记录）；`[拒绝异常]`（未纳入清单中**计入 `Σp*_raw` 的**被拒项（agent_rejected 与 user_rejected）合计 > 3 条，或占 Σp*_raw 比例 > 30%——被否决 `sup3` 项不占分子，由 `[补充否决异常]` 单独承接；user_rejected 部分仅核验「用户裁决记录是否存在且理由已如实记录」，不质疑用户判断）→ 强制走独立 Step 3（同 SKILL.md Step 2/3 规则）

**Step C — 逐条判断**（不可批量——批量判断忽略问题间差异，每条问题的接受/拒绝依据不同，须独立评估）
- 对每条合并后的问题，主 Agent 判断: 接受 / 拒绝 / 部分接受（「部分接受」按原始发现粒度拆记：采纳部分入合并行 `agent_accepted`、拒绝部分入未纳入清单，**不得发明新 `disposition` 值**——同 SKILL.md Step 2 记账规则）
- 每条必须写原因（不能批量同意/拒绝）。原因需具体到问题本身，不可使用模板化措辞。**拒绝项必须写明具体事实依据**——合并后问题数排除了被拒项，拒绝会直接压低收敛判定口径，故拒绝必须逐条有据可查
- 严重度校准: 取所有来源中最高级
- **冲突行的入桶规则**：`严重度` 列一律填 `max(sources)`，并据此计入 `p*_merged` 的对应桶；来源间的分歧写在 `[冲突: AgentA=P0, AgentB=P1]` 标注或原因列，**不写进严重度列**

**Step D — 输出合并判断表**

| # | 问题 | 来源（sources） | 严重度 | 判断 | disposition | 原因 | 修改方案 |
|---|------|------|--------|------|-------------|------|---------|
| 1 | ...  | code#3, specs#1 | P0 | 接受 | agent_accepted | ... | ... |
| 2 | ...  | code#2, specs#4 | P0 | 冲突 | 待裁决 | [冲突: code=P0, specs=P3] ... | 待用户裁决 |

> **示例行 2 的 `disposition=待裁决` 为占位值**（仅存在于 Step D → Step E 的裁决窗口）——**Step E 用户裁决通过后回填 `user_adjudicated`**（届时该行才落入 `disposition ∈ {agent_accepted, user_adjudicated}` 取值域）；不得在裁决前预填 `user_adjudicated`（该值语义为「用户裁决的冲突项」，裁决前填写即为伪造裁决记录）。

**未纳入清单（示例）**（被拒项登记于此，不构成上表表行）：

- `specs#5`（原始严重度 P2）——原因：……（具体事实依据）｜disposition: `agent_rejected`

> `sources` 格式为 `<Agent名>#<该 Agent 报告内的问题编号>`，供 Step 5 兼并验证逐条溯源 + 守恒等式核对。合并后问题数 `p*_merged` 以本表行数计（`disposition ∈ {agent_accepted, user_adjudicated}`）；**被拒绝项不构成合并判断表行**——未采纳项登记在未纳入清单（`p*_rejected`），`disposition=agent_rejected` / `user_rejected` 仅用于清单标注。

**Step E — 用户审批**（硬 Gate；**审批范围为整表**——用户逐条确认合并判断表的**全部行（P0-P3）**。与通用路径的差别：通用 Step 4 前置 Gate 默认**仅 P0** 需逐条用户确认、P1/P2/P3 直接纳入修复（见 SKILL.md Step 4 前置 Gate）；UltraReview 路径采用更严的整表逐条确认，两路径共享的只是修复策略（Step F），不是审批范围）
- 用户逐条确认合并判断表（全表：P0-P3 各行）
- 冲突项由用户裁决
- 审批通过后方可执行修复
- **用户裁决的计数规则（不重算 `p*_merged` 分桶）**：Step E 的用户裁决（含降级某冲突行严重度）**不改变 `p*_merged` 分桶**——分桶恒取 `max(sources)`（见 Step C 冲突行入桶规则）；用户裁决只决定**处置与修复范围**及 `disposition` 的最终标注（裁决通过回填 `user_adjudicated`；用户拒绝某 P0 按 SKILL.md Step 4 前置 Gate 记账规则处理——记 `user_exempt_p0`，不改 disposition）。**不重算 `p*_merged`**——与 SKILL.md Step 4 记账规则「冻结不因裁决类事由回改（Step 5 误合拆行是唯一例外）」一致（保守方向：该问题**确实被发现过**，保留在计数中）

**Step F — 执行修复**（与多模型渐进式 Step 4 修复策略一致）
- 默认全量修复 P0/P1/P2/P3（修复范围见 SKILL.md「P0 阻塞规则（权威定义）」节"Gate 通过标准 vs 修复范围"注；用户可显式指定跳过）
- P0 项须人工确认后修改
- 启动独立修复子 Agent，逐条分析判断并执行修复
- 修复后运行全文 grep 验证残留
- 增量审查: 仅读取变更区域及上下文

