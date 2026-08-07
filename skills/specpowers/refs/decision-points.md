# specpowers 用户停顿点与决策分类（PP-01..PP-08 定义正本）

本文件定义 specpowers 全流程（Phase 0-4）中必须由用户决策的位置（PP-01..PP-08），以及自动处理、停止条件的边界。**分类原则**（自动处理/停止条件/手动衔接的判定逻辑）见入口 SKILL.md「决策分类表」节——本文件不重复定义分类原则，只列停顿点与 protocol.json 的 pausePoints 分配依据。

## 停顿点 × Phase 映射（protocol.json pausePoints 字段分配依据）

| Phase | 节点 skill | pausePoints |
|-------|-----------|-------------|
| phase0（需求澄清与设计） | specpowers-design | PP-01, PP-02 |
| phase1（OpenSpec 格式转换） | specpowers-design | PP-03, PP-04 |
| phase2（衔接计划） | specpowers-plan | PP-05 |
| phase3（子代理 TDD 实现） | specpowers-apply | PP-06, PP-07, PP-08 |
| phase4（验证与归档） | specpowers-archive | （无——硬 Gate 链失败是停止条件，非决策点） |

## 用户停顿点定义

### PP-01（phase0）：方案选择

- **触发条件**：需求澄清完毕后，呈现 2-3 个替代方案（每个含思路/优势/劣势/适用场景）与推荐方案之后。
- **用户可选择项**：①采用推荐方案 ②选择其他方案 ③提出调整（合并方案要素/缩小范围 → 回 Step 0.2/0.3 补充澄清后重新探讨）。
- **证据写入位置**：`docs/superpowers/clarifications/<name>.md`（方案选择结论与理由）+ `.superpowers/state.json` evidence（`{"phase0": {"PP-01": {"decision": "selected", "option": "<方案名>"}}}`）。
- **不可绕过**：推荐不能代替用户选择；未记录所选方案不得进入设计呈现。

### PP-02（phase0）：设计逐段审批 + design.md 整体审批（硬 Gate）

- **触发条件**（两个实例，同一决策类型）：①每个设计段落呈现后（架构/数据流/接口/错误处理/测试策略）等待审批；②design.md 写入并自审完成后（Step 0.6 整体审批硬 Gate）。
- **用户可选择项**：①通过 → 下一段/整体 → Gate 0 审查；②修改（提出意见）→ 回 Step 0.5 修订 → 重新自审 → 再次 Step 0.6 审批。
- **证据写入位置**：`.superpowers/state.json` evidence（`{"phase0": {"PP-02": {"decision": "approved"}}}`）；整体通过 + Gate 0 后由 review 写 `.superpowers/.gate-passed-0`（`name=<name>`）。
- **不可绕过**：Step 0.6 硬 Gate 不可跳过，未审批不得进入 Phase 1；逐段审批不可合并成一次整体汇报。

### PP-03（phase1）：OpenSpec 跳过（用户主动要求）

- **触发条件**：用户在 Phase 1 主动要求跳过 OpenSpec 转换（或要求不生成 openspec/changes/ 产物）。注意：openspec CLI 不可用属自动 fallback（入口决策分类表），不触发本停顿点。
- **用户可选择项**：①确认跳过 → 输出 `[OPENSPEC_SKIPPED]` + 写 `.superpowers/.phase1-skipped`（内容 `<name>`）→ 进入 phase2（简化输入，Gate 1 豁免）；②继续转换 → 执行 Phase 1 格式转换 → 对照验证 → Gate 1 审查。
- **证据写入位置**：`.superpowers/.phase1-skipped`（内容 `<name>`）+ state.json evidence（`{"phase1": {"PP-03": {"decision": "skip"}}}`）。
- **不可绕过**：跳过一旦确认即影响 openspec-change.v1 校验（skip 豁免），必须持久化标记，不得仅在会话内口头跳过。

### PP-04（phase1）：MISSING/DRIFT 确认 + 人工审核

- **触发条件**：强制对照验证输出 [DRIFT] 项（偏离需用户确认），或 [MISSING] 项修复方案超出机械补充范围；Step 1.3 人工审核发现问题（对照表未全 COVERED / 设计不一致 / 需求遗漏）。
- **用户可选择项**：①确认修复方案 → 修复后重新对照直到全部 COVERED → Gate 1 审查；②修正 Phase 0 design（根因在 design.md）→ 回 phase0 修订 → 重新转换；③放弃转换、要求跳过 OpenSpec（仅当用户提出）→ 同 PP-03 选项 ①。
- **证据写入位置**：对照表输出 + state.json evidence（`{"phase1": {"PP-04": {"decision": "confirmed", "items": "<对照项>"}}}`）；Gate 1 通过后写 `.gate-passed-1`（或 `.phase1-skipped` 豁免）。
- **不可绕过**：DRIFT 未确认不得修复；对照表未全部 COVERED 不得进入 Gate 1。

### PP-05（phase2）：plan 已存在——重新生成 vs 使用现有

- **触发条件**：`docs/superpowers/plans/<name>.md` 已存在（防御 Phase 自动检测行序错误的纵深保护，技能明示必须询问）。
- **用户可选择项**：①跳过（使用现有 plan，默认，避免覆盖）；②重新生成（重跑 writing-plans 覆盖）。
- **证据写入位置**：state.json evidence（`{"phase2": {"PP-05": {"decision": "skip"}}}`）。
- **不可绕过**：无论默认值如何，必须询问后决定；不得静默覆盖或静默跳过。

### PP-06（phase3）：隔离工作区同意（主分支执行）

- **触发条件**：没有可用的 git worktree / 隔离工作区，且任务将直接在 main/master 分支执行（subagent-driven-development 要求：未经用户明确同意不得在主分支开始实现）。
- **用户可选择项**：①创建/使用 git worktree（推荐）；②明确同意在主分支执行。
- **证据写入位置**：state.json evidence（`{"phase3": {"PP-06": {"decision": "worktree"}}}`）。
- **不可绕过**：未记录同意不得启动第一个实现子代理。

### PP-07（phase3）：计划冲突裁决（plan 文本 vs 审查发现）

- **触发条件**：任务预扫描（dispatch 前 batched 问题）或任务审查/修复循环发现 finding 与 plan 文本冲突（which governs）。
- **用户可选择项**：①plan 文本优先 → 按 plan 执行（finding 标注 plan-mandated）；②finding 优先 → 修订 plan 并修复；③保持现状并记录 ruling → 该 finding 记入 ledger 不再进入修复循环。
- **证据写入位置**：SDD ledger（`.superpowers/sdd/<plan>/progress.md`）+ state.json evidence（`{"phase3": {"PP-07": {"decision": "plan-first"}}}`）。
- **不可绕过**：禁止自行丢弃 plan 冲突型 finding；每个裁决必须有 ledger 记录。

### PP-08（phase3）：Gate 3 合并判断表逐条审批 + P0 修复方案确认

- **触发条件**：Gate 3 审查（code-review + 对齐检查）返回后，合并判断表呈现（逐条裁决），且存在 P0 修复方案需确认。
- **用户可选择项**：①逐条行裁决（修复默认全量 P0-P3 / 接受记录理由 / 驳回记录 ruling）；②P0 修复方案确认（执行方案 → 派发修复子 Agent；调整方案 → 用户修改后派发）。
- **证据写入位置**：审查报告 + state.json evidence（`{"phase3": {"PP-08": {"decisions": "<逐行>", "p0PlanConfirmed": true}}}`）；Gate 3 通过后写 `.superpowers/.gate-passed-3` + 会话 `[GATE_PASSED] gate=3`。
- **不可绕过**：合并判断表不得由主 Agent 代批；P0 修复方案未经确认不得派发。

## 自动处理与停止条件摘要

- **自动处理（直接推进，不询问）**：上下文探索、澄清问答、自审修复、格式转换、MISSING 机械补充、Gate 前置检查失败回退、Gate 0-3 审查收敛（默认继续制，通知而非询问）、执行模式路由、子代理任务循环、任务修复循环 R≤5、breaker 裁决（非 load-bearing）、Phase 4 硬 Gate 链推进、finishing。
- **停止条件（只报告恢复条件，不发明选项）**：implementer BLOCKED（load-bearing）、R=5 后 load-bearing finding、全量测试失败（恢复=回 Phase 3 systematic-debugging）、validate 失败（恢复=回 Phase 1 或 Phase 3）、/opsx:archive 失败（恢复=根因修复后从 archive 重试）、归档完整性 FAIL（人工介入）、state.json 缺失/损坏（恢复=init --force --resume-artifacts 重建）。
