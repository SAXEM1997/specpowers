---
name: specpowers-plan
description: Use when the user says "plan the implementation", "write the design doc", "brainstorm this feature", "explore the codebase", "bridge OpenSpec to Superpowers", or requests design+planning for an OpenSpec change.
---

# specpowers-plan: 设计+衔接阶段

> **前置检查（必须执行，不可跳过）**: 
> 1. 确认 specpowers 入口 skill 的全局规则（GitFlow/Checklist/Pitfalls）已在当前会话上下文中可用。如未加载，先 `Skill({skill: "specpowers"})` 获取决策树和全局规则。等待加载完成后继续。
> 2. 确认当前任务模式（Plan: <mode>）。如为微小任务，仅做轻量上下文探索后终止本技能，不执行 Phase 0 完整流程。
> 3. 如为中等任务，必须完成 Phase 0 → Phase 1 → Phase 2（本 skill）。如为复杂/大规模任务，Phase 2 由 UltraPlan/Workflow 外部承载，本 skill 在 Phase 1 完成后交接。

---

## Phase 0: brainstorming 前置阶段（新增）

**定位**: 使用 `superpowers:brainstorming` 技能，承担需求澄清+方案设计+用户审批。替代原 `/opsx:explore` + propose 前半部分。brainstorming 的上下文探索步骤完全覆盖 `/opsx:explore`，后者不再独立调用。

**REQUIRED SUB-SKILL:** Skill({skill: "superpowers:brainstorming"})

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

### Step 0.2: 连环提问澄清需求

**目的**: 通过多轮对话逐条澄清所有需求细节，不留模糊地带。

**强制规则**:
1. **一次只问一个问题** — 不批量提问
2. **参考上下文** — 基于 Step 0.1 的探索结果 + 已有经验文档 + memory + 历史 spec，逐条提出疑问
3. **覆盖所有细节** — 边界情况、错误路径、非功能需求、隐含假设必须覆盖
4. **穷尽疑问** — 所有疑问一一提出，直到没有新问题可问才进入下一步
5. **禁止假设** — 仅以用户明确确认的信息为准；禁止推测或假设用户意图

**提问维度检查表**:
```
□ 功能范围: 做什么、不做什么？
□ 边界情况: 空输入、极端值、并发？
□ 错误路径: 失败模式、回退策略？
□ 非功能需求: 性能、兼容性、安全性？
□ 依赖关系: 影响哪些模块、被哪些模块依赖？
□ 用户偏好: 风格、优先级、权衡取舍？
```

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
`<name>` 定义后，贯穿 Phase 0-4 全流程，与 Phase 1 的 OpenSpec `<change-name>` 为同一标识符。
```

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
`Skill({skill: "specpowers-review"})` — 对齐检查：design.md vs clarifications/<name>.md。
Gate 0 返回后，执行 Gate 返回后验证协议（参数: Gate=0, Phase=0, 标记块=STEP1-5）。

---

## Phase 1: propose 格式转换+强制对照（改造）

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
| `tasks.md` | 任务清单 ← design doc 组件拆解为实现任务（参考粒度转换表） |

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

### Step 1.3: 人工审核（强化）

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
`Skill({skill: "specpowers-review"})` — 对齐检查：OpenSpec 四件套（proposal/design/specs/tasks）vs Phase 0 design.md + clarifications。
Gate 1 返回后，执行 Gate 返回后验证协议（参数: Gate=1, Phase=1, 标记块=STEP1-5）。

---

## Phase 2: 衔接阶段

> `<name>` 由 Phase 0 Step 0.3 定义，贯穿 Phase 0-4 全流程。Phase 2 中 OpenSpec change 目录名复用同一 `<name>`。

**REQUIRED SUB-SKILL:** Skill({skill: "superpowers:writing-plans"})

### 核心原则

1. Phase 0 brainstorming + Phase 1 propose 已完成 → 跳过 Superpowers brainstorming
2. 跳过 OpenSpec apply → Superpowers TDD 更完整
3. 将 Phase 0 设计文档 + Phase 1 OpenSpec 产物全部加载为 Superpowers 上下文

### 衔接指令

```
读取以下文档，基于这些规范使用 Superpowers writing-plans 拆分实现计划：

1. docs/superpowers/specs/<name>-design.md → Phase 0 审批通过的设计
2. docs/superpowers/clarifications/<name>.md → 需求澄清真相源
3. openspec/changes/<name>/design.md → 技术方案
4. openspec/changes/<name>/specs/ → 测试依据
5. openspec/changes/<name>/tasks.md → 任务列表
6. openspec/changes/<name>/proposal.md → 审查边界

产物写入: docs/superpowers/plans/<name>.md
每个 task 拆为 TDD 步骤（4 阶段 6 子步）：
1. 写失败测试(RED) 2. 运行确认失败 3. 写最小实现(GREEN)
4. 运行确认通过 5. 重构(REFACTOR) 6. 提交(COMMIT)
```

### 粒度转换

| OpenSpec task | Superpowers plan task |
|--------------|----------------------|
| "实现 <feature> 核心函数" | 1 个 plan task, 6 个 TDD 步骤 |
| "添加依赖"+"定义结构" | 合并为 1 个（相邻小 task 可合并） |
| "实现 <multi-file-feature>"（多文件） | 拆为 2-3 个（粗粒度需拆分） |

### Plan 审查 Gate（Gate 2）

**衔接阶段完成后，强制执行 Gate 2 审查**：

`Skill({skill: "specpowers-review"})` — 对齐检查：plan vs Phase 1 OpenSpec specs + Phase 0 design。
Gate 2 返回后，执行 Gate 返回后验证协议（参数: Gate=2, Phase=2, 标记块=STEP1-5）。

### 场景→测试转换

| 场景类型 | 测试 |
|---------|------|
| 正常路径 | Given 有效输入 When 执行 Then 期望输出 |
| 错误路径 | Given 异常输入 When 执行 Then 期望错误 |
| 边界值 | Given 边界条件 When 执行 Then 期望行为 |

---

## Gate 验证协议

### Gate 返回后验证协议（所有 Gate 通用）

对于 Gate <N>（对应 Phase <N>），specpowers-review 返回后执行以下验证：

**验证 0 — 执行模式检查**:
读取会话上下文中的 `Plan: <mode>`:
- mode === "tiny" → 跳过全部验证
- mode !== "tiny" 或 Plan mode 不存在 → 继续验证 1 + 验证 2
降级: 若 Plan mode 不存在，默认视为非 tiny，输出 `[WARNING] Plan mode 未设置` 后继续完整验证。

**验证 1 — 执行标记完整性检查**:
在 specpowers-review 返回的审查报告中搜索以 ```STEP<N>_EXECUTED 开头的 fenced code block。
缺失任一块 → `[VERIFY_FAIL] Gate <N> 审查执行不完整，阻塞 Phase <N>`。
搜索未命中任何标记块 → `[VERIFY_FAIL] Gate <N> 审查 Agent 未正常执行（无任何执行标记），阻塞 Phase <N>`。

**验证 2 — P0 硬阻止检查**:
搜索 `[GATE_BLOCKED] p0_count=N`:
- N > 0 → `[VERIFY_FAIL] Gate <N> 未通过（P0=N），阻塞 Phase <N>`
- N = 0 且验证 1 通过 → Gate <N> 通过

**各 Gate 特化参数**:

| Gate | Phase | 应存在标记块 |
|------|-------|-------------|
| Gate 0 | Phase 0 | STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 1 | Phase 1 | STEP1, STEP2, STEP3, STEP4, STEP5 |
| Gate 2 | Phase 2 | STEP1, STEP2, STEP3, STEP4, STEP5 |

> **下一步**: 完成后，加载 `specpowers-apply` 进入 Phase 3（实现阶段）。
