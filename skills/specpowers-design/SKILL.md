---
name: specpowers-design
description: Use when the user says "brainstorm this feature", "write the design doc",
  "explore requirements", or when specpowers entry skill routes to Phase 0 or Phase 1.
---

# specpowers-design: 设计+propose 阶段

> **前置检查（必须执行，不可跳过）**: 
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取决策树和全局规则（GitFlow/Checklist/Pitfalls）。等待加载完成后继续。
> 2. 确认当前任务模式（Plan: <mode>）。如为微小任务，仅做轻量上下文探索后终止本技能，不执行 Phase 0 完整流程。
> 3. **Gate 0 确认（仅从 Phase 0 进入 Phase 1 时执行）**：搜索会话上下文中 `[GATE_PASSED] gate=0` 标记，或检查 `.superpowers/.gate-passed-0` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 0 Gate 0 未执行，回 Phase 0 Step 0.6 完成 Gate 0 后再进入 Phase 1。Phase 0 起始不适用此项（Gate 0 在 Step 0.6 完成后才输出标记）。微小任务跳过此项（与验证 0 一致）。

---

## Phase 0: brainstorming 前置阶段

**定位**: 使用 `brainstorming` 技能，承担需求澄清+方案设计+用户审批。替代原 `/opsx:explore` + propose 前半部分。brainstorming 的上下文探索步骤完全覆盖 `/opsx:explore`，后者不再独立调用。

**REQUIRED SUB-SKILL:** Skill({skill: "brainstorming"})

### Step 0.1: 探索项目上下文

**目的**: 带着完整上下文进入提问，避免基于不完整信息做出假设。

```
□ 读取 CLAUDE.md（项目指令+架构）
□ 读取相关 memory（项目上下文、迁移决策、经验教训）
□ 读取相关 OpenSpec specs（了解已有规范约束）
□ 读取相关代码（了解现有实现状态，避免重复造轮子）
□ 读取 docs/experience/ 相关经验文档（如有）
□ 读取 docs/superpowers/specs/ 历史设计文档（如有）
```

### Step 0.2: 需求澄清

遵循 `brainstorming` 的澄清流程（一次一个问题、覆盖边界/错误路径/非功能需求/隐含假设、穷尽疑问、禁止假设——详见该 skill checklist）。基于 Step 0.1 探索结果 + memory + 历史 spec 逐条提问，所有疑问澄清完毕后进入 Step 0.3 持久化。

### Step 0.3: 持久化需求澄清 + 思路整理

**时机**: 提问全部结束后，开始组装设计之前。

**动作1 — 内化（会话内）**:
```
回顾全部对话历史，整理思路脉络：
□ 每个澄清的结论是什么？
□ 每个决策的依据是什么？
□ 是否有遗漏或曲解？
□ 输出思路整理摘要（供后续设计引用）
```

**动作2 — 外化（写文件）**:
```
写入 docs/superpowers/clarifications/<name>.md（`<name>` 格式: `YYYY-MM-DD-<topic>`，如 `2026-06-05-specpowers-v2`）:
□ 每个问题的问答（原始对话）
□ 用户的选择和偏好（明确说 vs 推断，标注来源）
□ 边界条件和隐含假设
□ 按主题分组

目的: 即使会话上下文被压缩/清空，澄清细节仍可恢复。
`<name>` 定义后，贯穿 Phase 0-4 全流程，与 Phase 1 的 OpenSpec `<name>` 为同一标识符。
```

**动作3 — 初始化状态机（中等+，微小跳过）**:
非微小任务执行（name/mode 实参：动作 2 的 `<name>` + 会话上下文 `Plan: <mode>`）：
node <SKILL_BASE>/scripts/workflow-state.mjs init --name <name> --mode <mode>
（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）
mode 取值：medium（中等）/ complex（复杂）/ large（大规模）

### Step 0.4: 方案探讨 + 设计呈现

**方案探讨**:
```
□ 基于 Step 0.3 的澄清文档，探讨 2-3 个替代方案
□ 每个方案说明: 思路、优势、劣势、适用场景
□ 给出推荐方案 + 理由
```

**设计呈现**（逐段审批）:
```
□ 架构（组件划分、层次关系）
□ 数据流（输入→处理→输出）
□ 接口（API/RPC/消息格式）
□ 错误处理（失败模式、回退策略）
□ 测试策略（场景→测试映射）

每段呈现后等待用户审批，引用 clarifications/<name>.md 确保设计对得上需求。
> 此阶段为交互式逐段确认（确保方向正确）。最终 design doc 写入后，Step 0.6 仍需整体审批（硬 Gate）。
```

### Step 0.5: 写设计文档 + 自审

**写设计文档**:
```
写入 docs/superpowers/specs/<name>-design.md（`<name>` 由 Step 0.3 定义）

包含: 概述、架构、组件、数据流、错误处理、测试策略
```

**自审**（brainstorming Spec Self-Review）:
```
□ 占位符扫描: TBD/TODO/不完整章节？
□ 内部一致性: 章节间矛盾？
□ 范围检查: 是否过大需拆解？
□ 模糊检查: 需求可被两种方式解读？
□ 引用检查: 引用的外部资源存在？
```

修复发现的问题后 `git commit`。

### Step 0.6: 审批 Gate（硬 Gate）

**此 Gate 不可跳过。**
- 用户审批 `docs/superpowers/specs/<name>-design.md`
- 修改 → 回到 Step 0.5
- 审批通过 → 进入 Phase 1

**审批通过后，执行 Gate 0 审查**:
`Skill({skill: "specpowers-review"})` — 对齐检查：design.md vs clarifications/<name>.md。审查层级边界由 specpowers-review 横切注入（design 层面，不涉代码实现）。
Gate 0 返回后，执行 Gate 返回后验证协议（参数: Gate=0, Phase=0）。

验证链通过后（token 已由 review 写入 `.superpowers/.gate-passed-0`），执行节点出口守卫（中等+；微小无 state.json，不调用）：
node <SKILL_BASE>/scripts/workflow-guard.mjs exit phase0 --apply
（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）

---

## Phase 1: propose 格式转换+强制对照

**定位**: Phase 1 从"需求澄清+方案设计+生成规范"收窄为"**格式转换+强制对照验证**"。读取 Phase 0 审批通过的设计文档，转换为 OpenSpec 结构化格式。

### Step 1.1: 格式转换

**输入**:
- `docs/superpowers/specs/<name>-design.md`（Phase 0 审批通过）
- `docs/superpowers/clarifications/<name>.md`（需求澄清真相源）

**手动生成 OpenSpec 四件套**到 `openspec/changes/<name>/`（不使用 `/opsx:propose`——propose 命令会自行做需求分析，与 Phase 0 已完成的需求澄清冲突。改为直接按模板生成）：

| 文档 | 内容来源 |
|------|---------|
| `proposal.md` | 动机 ← design doc 概述；范围 ← design doc 架构+组件；排除范围 ← design doc 排除范围 + 审批 Gate 确定 |
| `design.md` | 技术方案 ← design doc 架构+数据流（补充实现细节）；架构决策 ← design doc 关键决策（补充替代方案+理由） |
| `specs/*/spec.md` | 增量规范 ← design doc 场景转换为 `### Requirement:` SHALL/MUST 格式；每个 Requirement 包含至少一个"假设/当/则"场景 |
| `tasks.md` | 任务清单 ← design doc 组件拆解为实现任务（见 specpowers-plan「粒度转换」节） |

**不做**: 需求澄清、方案对比、连环提问（Phase 0 已完成）。

### Step 1.2: 强制对照验证

**逐条对照** `docs/superpowers/clarifications/<name>.md`（原始需求真相源）与生成的 spec，检查:

```
□ 每个澄清的需求点是否有对应 Requirement？
□ 每个边界情况是否有对应场景？
□ 每个排除项是否在 proposal.md 中声明？
□ 多轮沟通中用户的选择是否被正确反映？
```

**输出对照表**（逐条，不可省略）:

```
[COVERED] 需求点 A → spec/xxx.md: Requirement Y
[COVERED] 需求点 B → spec/xxx.md: Requirement Z
[MISSING]  需求点 C → 补充到 spec/xxx.md（说明补充内容）
[DRIFT]    需求点 D → 偏离原因（需用户确认后修复）
```

**规则**: MISSING/DRIFT 项修复后重新对照，直到全部 COVERED。

### Step 1.3: 人工审核

```
□ design.md 与 brainstorming 审批的设计一致？
□ 对照表全部 COVERED？
□ 每个 Requirement 包含 SHALL/MUST？
□ 多轮沟通的需求没有遗漏？（回顾 docs/superpowers/clarifications/<name>.md）
□ proposal.md 排除范围完整？
□ specs 场景覆盖了边界情况？
□ tasks.md 遗漏了步骤？
```

**人工审核通过后，执行 Gate 1 审查**:
`Skill({skill: "specpowers-review"})` — 对齐检查：OpenSpec 四件套（proposal/design/specs/tasks）vs Phase 0 design.md + clarifications。审查层级边界由 specpowers-review 横切注入（各文档对应抽象层级，不涉代码实现）。
Gate 1 返回后，执行 Gate 返回后验证协议（参数: Gate=1, Phase=1）。

验证链通过后（token 已写入 `.superpowers/.gate-passed-1`，或 `.superpowers/.phase1-skipped` 内容==name 豁免），执行节点出口守卫（中等+）：
node <SKILL_BASE>/scripts/workflow-guard.mjs exit phase1 --apply
（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）

---

## OpenSpec 跳过路径

**触发条件**: 用户要求跳过 或 `openspec --version` 不可用。

**行为**:
1. 输出 `[OPENSPEC_SKIPPED] Phase 1 已跳过，design doc 将直接作为 Phase 2 输入`
2. 写入持久化标记文件 `.superpowers/.phase1-skipped`，内容为 `<name>`
3. 跳过 Phase 1 Step 1.1-1.3，不生成 openspec/changes/ 产物

specpowers-plan Phase 2 衔接时需适配此场景：无 openspec/ 产物时，只以 design doc + clarifications 为输入。

---

## Gate 验证协议

### Gate 返回后验证协议（Phase 0-1 Gate 通用）

> 执行入口 `specpowers` SKILL.md「Gate 返回后验证协议（横切）」节（参数：Gate=<N>, Phase=<N>）。本 Gate 特化：Gate 0/1, Phase 0/1, tiny 跳过全部验证（验证 0 返回跳过）。

| Gate | Phase | 标记块检查方式 |
|------|-------|-------------|
| Gate 0 | Phase 0 | 按 `[TIER_ROUTING] expected_steps` 动态检查；无 TIER_ROUTING 回退 STEP1-5 |
| Gate 1 | Phase 1 | 同上 |

> **下一步**: 设计+propose 阶段完成后，加载 `specpowers-plan` 进入 Phase 2（衔接阶段）。
