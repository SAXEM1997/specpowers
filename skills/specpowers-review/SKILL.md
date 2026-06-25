---
name: specpowers-review
description: >-
  Use when code or document review is triggered in a specpowers workflow — when
  implementation is complete and needs quality gate, when design/spec/plan documents
  need multi-angle progressive review, when user says "review this" or "run UltraReview",
  or when a specpowers Gate requires formal review before proceeding to next phase.
---

# specpowers-review: 审查阶段

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取全局规则。等待加载完成后继续。
> 2. 确认审查对象（文档/代码）和变更范围（文件数）已知。如未知，向用户确认后继续。

## 术语说明

- **主 Agent**：指 specpowers-review 技能内部的协调 Agent，负责调度子 Agent、合并审查结果、执行修复。与入口技能 specpowers 的 Agent 区分
- **用户**：指人类开发者，负责审批结构性修改和 P0 问题的修复方案
- **微小任务**：变更文件数 ≤ 3（入口 skill 判定）、单文件局部修改、< 50 行变更、单模块、不涉及接口变更、配置变更或跨文件重构。最终判定由入口 skill specpowers 决策树执行

## 审查决策树

审查类型由本 skill 内部按以下决策树自动判定，用户可手动覆盖。

```text
审查对象类型?
├── 文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）
│   └── 多模型渐进式审查（默认，通用）
│       用户可手动选择其他审查方式（UltraReview / 加强审查）
│
└── 代码类（实现代码 / 项目结构 / 构建配置 / 项目创建或变更）
    ├── 任务规模?
    │   ├── 微小任务 → 不触发 specpowers-review，由 specpowers-apply 双重审查执行
    │   └── 中等及以上 →
    │       ├── 变更文件数 ≥ 10 → UltraReview（5-agent 团队审查）
    │       └── 变更文件数 < 10 → 加强审查（见下方 Gate 3 详细说明）
    └── 用户可手动切换审查路径
```

"项目创建或变更"指涉及项目配置文件（package.json / Cargo.toml / go.mod 等）、构建脚本、目录结构调整的变更。判断标准：变更涉及项目基础设施层面（而非仅业务代码），即归入此类。

### 手动切换审查路径

用户可通过以下方式覆盖自动判定：
- 自然语言关键词检测（当前轮用户输入）："UltraReview" / "渐进式审查" / "加强审查" / "快速审查"
- 检测到关键词 → 跳过决策树，按用户指定方式执行
- 多个关键词冲突 → 以第一个匹配的为准，并在审查报告中注明检测到的歧义
- 如用户选定的方式与产物类型不匹配（如对文档用 UltraReview），输出警告信息后直接按用户选择执行，无需等待确认（用户可能想用 5-agent 多角度审查大型设计文档如行数 > 200 行或 ≥ 5 个独立章节）
- 文档类用户可通过手动切换选择其他审查方式：UltraReview / 加强审查 / 单 Agent 审查（即加强审查中的对齐 Agent 单 Agent 审查模式）等

## 全流程逐层审查 Gate

```text
Phase 0 产物                       Phase 1 产物                    Phase 2 产物
clarifications ──┬──→ design.md  ──┬──→ proposal.md  ──┬──→ plan ──┬──→ 代码
                 │                 │   design.md       │           │
                 │                 │   specs/          │           │
                 │                 │   tasks.md        │           │
                 └── [Gate 0]       └── [Gate 1]        └── [Gate 2]
                     对齐检查:          对齐检查:             对齐检查:
                     design vs          OpenSpec产物 vs        plan vs
                     clarifications     Phase 0 design         OpenSpec specs
                                          + clarifications      + Phase 0 design
                     审查方式:          审查方式:              审查方式:
                     多模型渐进式       多模型渐进式            多模型渐进式
                     (文档类)           (文档类)               (文档类)
                                                                          ↓
                                                                     Phase 3 产物
                                                                     代码
                                                                          │
                                                                     [Gate 3]
                                                                     对齐检查:
                                                                     代码 vs plan
                                                                     + specs + design
                                                                     审查方式:
                                                                     UltraReview(≥10文件)
                                                                     / 加强审查(<10文件)
                                                                          ↓
                                                                     [Gate 4]
                                                                     归档完整性
                                                                     审查方式:
                                                                     现有 hard gate 链
                                                                     （specpowers-archive 内部，
                                                                     仅标记为 Gate 节点）
```

### 各 Gate 详细定义表

| Gate | 触发时机 | 审查对象 | 对齐上游 | 审查方式 |
|------|---------|---------|---------|---------|
| **Gate 0** | Phase 0 用户审批通过后 | `design.md` | `clarifications/<name>.md` | 多模型渐进式 |
| **Gate 1** | Phase 1 用户审核通过后 | proposal/design/specs/tasks | Phase 0 `design.md` + `clarifications` | 多模型渐进式 |
| **Gate 2** | Phase 2 plan 生成后 | `plan/<name>.md` | Phase 1 OpenSpec specs + Phase 0 design | 多模型渐进式 |
| **Gate 3** | Phase 3 代码实现完成后 | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | UltraReview(≥10 文件) / 加强审查(<10 文件)（微小任务模式不走此 Gate，见执行规则） |
| **Gate 4** | Phase 4 归档前 | 归档完整性 | —（现有硬 Gate 链不变） | 现有 hard gate 链（specpowers-archive 内部），仅标记为 Gate 节点 |

### 多文件 Gate 的审查粒度

Gate 1 审查对象包含多个独立文件（proposal.md / design.md / specs/ / tasks.md），审查策略：
- 合并为一次审查：三 Agent 分别读取所有文件，输出合并报告（一条问题可能跨文件关联）
- 对齐 Agent 的"逐条对照"以 `design.md` 为主线，对照 `clarifications` 中的需求点是否在 proposal/specs/tasks 中完整覆盖
- 结构 Agent 检查四件套之间的内部一致性（如 tasks.md 的任务是否覆盖了 specs/ 的所有 Requirement）
- 落地 Agent 检查每个文件独立的可执行性（对文档类：检查引用路径是否存在、命令示例是否可运行、配置示例语法是否正确、平台差异是否已标注；对代码类：检查编译/运行可行性、依赖完整性）

### Gate 执行规则

- 每个 Gate 不可跳过（微小任务模式除外：微小任务不触发 specpowers-review，Gate 0-4 全部跳过）
- Gate 未通过（存在 P0）→ 禁止进入下一 Phase
- Gate 发现 P1/P2 → 记录后允许通过。问题清单写入会话上下文账本（主 Agent 内存 dict，见"会话上下文账本协议"），跨 Gate 通过主 Agent 注入对齐 Agent prompt。不再写入任何 .review 开头的文件产物。跨会话场景下，审查教训从 .specpowers/review-cache.json 读取（尽力而为缓存，丢失不影响正确性）。
- 每个 Gate 审查完成后均输出收敛提醒
- **微小任务模式**：不触发 specpowers-review，Gate 0/1/2/3/4 全部跳过（见上方 Gate 执行规则第 1 条）。
- **审查修改与审批的关系**：Gate 审查发现的修改分为两类：
  - (a) **结构性修改**（改变设计意图/架构/接口/数据模型/核心流程）→ 需重新走用户审批
  - (b) **澄清性修改**（消除歧义、补充遗漏、修正措辞、修复格式，不改变设计意图、接口和数据流）→ 免二次审批，直接修改后由主 Agent 确认
  - **判定标准**：如果修改会导致下游产物的内容或结构发生变化，则为结构性修改。对齐 Agent 的审查报告需标注每项修改的类型及判定理由。
  - **P0 问题**：无论修改类型，均须先经用户确认问题判定和修复方案。确认后——澄清性修改免二次审批直接修改，结构性修改需在修改后重新走用户审批流程。
- **代码 <10 文件时**：Gate 3 拆分为两部分：
  1. specpowers-apply 的 code-review（通过标准：无 P0 问题）
  2. specpowers-review 的对齐 Agent 单 Agent 审查（对齐检查，通过标准：无 MISSING 或 DRIFT 标记为 P0 的项）
  两者均通过方可进入 Phase 4。

---

## UltraReview（代码类，≥10 文件）

**适用条件**：代码类 + 变更文件数 ≥ 10。

### 创建审查团队

使用 `TeamCreate({team_name: "ultrareview-<change>"})`，
然后为每个维度创建审查 Agent（只读，禁止修改代码）：

| 维度 | prompt 要点 |
|------|-----------|
| build-reviewer | 检查构建系统配置正确性 |
| code-reviewer | 检查源码修改、编码、include 路径 |
| specs-reviewer | 逐条对照 OpenSpec specs/ 检查合规性 |
| docs-reviewer | 检查文档和记忆一致性 |
| deps-reviewer | 检查依赖路径和库命名 |

### 审查规则

- 只读不写：所有审查 Agent 仅输出审查报告，不修改任何文件
- P0（必须修复）：阻塞性问题——接口不匹配、数据丢失风险、安全漏洞、spec 严重偏离
- P1（选择性修复）：重要问题——性能退化、代码异味、文档过时、错误处理缺失
- P2（记录待办）：改进建议——重构机会、可读性优化、测试覆盖增强
- P3（记录待办）：风格问题——命名规范、格式一致性、注释完善
- P0 必须修复后方可通过 Gate；P1 选择性修复；P2/P3 记录待办，不阻塞 Gate 通过

### 主 Agent 逐条分析协议

（收集完所有子 Agent 报告后执行）

```text
Step A: 确认全部子 Agent 已完成
  └── 检查 5 个审查维度均有报告产出，如有缺失等待或重试

Step B: 去重合并
  ├── 收集全部子 Agent 评审报告
  ├── 相同问题（同一文件+同一符号+同一问题类型） → 合并为一条
  │   标注: 来源 = [code-reviewer, specs-reviewer]
  └── 冲突结论（如 code-reviewer 说 P0，specs-reviewer 说 P3）
      → 标注冲突，不做自动裁决，提级用户判断

Step C: 逐条判断（不可批量）
  ├── 对每条合并后的问题，主 Agent 判断: 接受 / 拒绝 / 部分接受
  ├── 每条必须写原因（不能批量同意/拒绝）。原因需具体到问题本身，不可使用模板化措辞
  └── 严重度校准: 取所有来源中最高级

Step D: 输出合并判断表
  │ # │ 问题 │ 来源 │ 判断 │ 原因 │ 修改方案 │ 严重度 │
  │ 1 │ ...  │ code,specs │ 接受 │ ... │ ... │ P0 │
  │ 2 │ ...  │ specs      │ 拒绝 │ ... │ —   │ P2 │
  │ 3 │ ...  │ code,specs │ ⚠冲突│ ... │ 待用户裁决 │ P0/P3 │

Step E: 用户审批（硬 Gate）
  ├── 用户逐条确认合并判断表
  ├── 冲突项由用户裁决
  └── 审批通过后方可执行修复

Step F: 执行修复
  ├── P0 项须人工确认后修改
  ├── 批量修改后运行全文 grep 验证残留
  └── 增量审查: 仅读取变更区域及上下文
```

### 加强审查（代码类，<10 文件）

代码变更 <10 文件时，Gate 3 不启动 5-agent 团队，而是由 specpowers-review 构造对齐 Agent 单 Agent 审查：

1. **specpowers-apply 内部 code-review**：通过标准为无 P0 问题
2. **specpowers-review 对齐 Agent 单 Agent 审查**：对齐检查，通过标准为无 MISSING 或 DRIFT 标记为 P0 的项

主 Agent 构造对齐 Agent 的审查 prompt 时，注入 spec-compliance-check 的逐条对照协议（读取 specs/ → 逐条检查 Requirement → 输出 [COVERED/MISSING/DRIFT] 对照表），确保对齐检查覆盖原双重审查的规范合规维度。

两者均通过方可进入 Phase 4。

---

## 多模型渐进式审查（3 Agent 并行）

**适用对象**：所有文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）。

### 三 Agent 结构

| Agent | 关注点 | 模型建议 |
|-------|--------|---------|
| **结构审查 Agent** | 完整性/冗余/一致性/结构合理性 | 强推理模型 |
| **落地审查 Agent** | 可执行性/兼容性/边界/平台差异 | 快速模型 |
| **对齐审查 Agent**（新增） | 对齐原始需求/设计；错漏项检测；模糊歧义识别 | 与前两者不同模型 |

### 对齐审查 Agent 检查维度

```
□ 逐条对照: 文档内容与原始需求/设计方案逐条对照，标记偏差
□ 错漏检测: 原始需求中是否有未覆盖的点？是否有隐含假设被遗漏？
□ 歧义检测: 是否有可被两种方式解读的表述？术语定义是否一致？
□ 矛盾检测: 不同章节/段落间的结论是否自洽？
□ 引用完整性: 引用的外部资源/文档/接口是否存在且版本正确？
```

### 对齐 Agent 对照方法

1. 读取对标源文件（如 Gate 0 读取 `clarifications/<name>.md`，Gate 2 读取 `specs/` + `design.md`）
2. 逐条提取对标源中的需求点/决策/排除项
3. 在审查对象中逐一查找对应覆盖
4. 输出对照表：[COVERED/MISSING/DRIFT] 需求点 → 对应位置 → 证据
   - COVERED：需求点在审查对象中有明确对应内容，且语义一致
   - MISSING：需求点在审查对象中完全无对应内容（遗漏），标注为 P1
   - DRIFT：需求点在审查对象中有对应内容但语义偏离（矛盾/降级/范围变化），标注为 P0
5. 边界情况：部分覆盖但关键细节缺失 → DRIFT（P0）；非关键细节缺失 → COVERED + 标注"部分覆盖"（P2）

### 模型多样性规则

**模型选择规则**：
1. 结构审查 Agent：优先使用强推理能力模型（如 Claude Opus / GPT-5 / Gemini Ultra），关注完整性/一致性分析
2. 落地审查 Agent：优先使用快速模型（如 Claude Haiku / GPT-4o-mini / Gemini Flash），关注边界/兼容性检查——快速模型在细节问题（列对齐解析、转义字符、边界值处理）上常有意外发现
3. 对齐审查 Agent：优先使用与前两者不同的模型（如 Claude Sonnet / GPT-4o），关注逐条对照+错漏检测的中等推理任务
4. 模型选择原则：三 Agent 使用不同模型以最大化视角多样性。跨品牌选择时以能力等级匹配为优先（强推理/快速/中等），品牌名为示例，实际取决于环境可用模型。
5. **降级策略**：
   - 仅两个模型可用时：结构 + 对齐使用不同模型，落地与对齐共用模型。落地审查先行执行，其完整审查报告（问题列表 + 严重度 + 证据 + 边界条件检查结果）作为对齐 Agent 的额外输入（追加到对齐 Agent 的审查 prompt 中），以补偿模型重叠带来的视角损失。
   - 仅单一模型可用时：三个 Agent 串行执行（非并行），顺序为 落地 → 对齐 → 结构（落地发现的具体问题为后续 Agent 提供上下文），在审查报告中声明"单一模型，缺少独立视角交叉验证"。
6. 如在 TeamCreate/子 Agent 环境中执行，优先使用不同子 Agent 分配不同模型。

### 审查流程

**Step 0 — 准备审查经验**

主 Agent 从以下来源收集审查教训，注入审查 Agent prompt：
- 当前会话中前几个 Gate 的审查报告（如 Gate 0 的教训注入 Gate 1）
- 用户在本轮审查中明确指出的偏好或纠正
- 通用最佳实践（如"从 AI 执行视角评判，不以人类流畅性为标准"、"用实际项目名检查占位符是否泄漏"）
- 跨会话积累的审查教训从 .specpowers/review-cache.json 中读取（跨会话缓存）；会话内跨 Gate 教训从会话上下文账本中读取。新发现的教训在每轮审查结束后追加到会话上下文账本，Gate 退出时写入 review-cache.json。

**Step 1 — 三 Agent 并行独立审查**

结构审查 Agent、落地审查 Agent、对齐审查 Agent 同时启动，互不感知对方的发现。每个 Agent 独立输出审查报告（问题 + 严重度分级 + 证据）。

**Step 2 — 主 Agent 逐条合并去重**

主 Agent 收集三份报告后：
- 去重合并：同一问题（同一位置+同一类型）→ 合并为一条，标注来源（如 [结构, 对齐]）。"同一位置"判定：指同一文件的同一段落/章节/代码块内，且问题描述指向同一处文本。不同位置但指向同一概念缺陷的，标记为关联但不合并。
- 冲突标注：不同 Agent 给出不同严重度 → 标注冲突，在合并判断表中以 [冲突: AgentA=P0, AgentB=P1] 标注，汇总所有冲突项后在审查报告中统一提请用户裁决（批量列出，逐条等待用户判定）
- 逐条判断：接受 / 拒绝 / 部分接受，每条写原因（不可批量同意/拒绝）。判断依据：(a) 问题是否确实存在（事实判断）；(b) 修复成本与收益（设计文档级 vs 实现细节级）；(c) 是否违背文档设计意图。原因需具体到问题本身，不可使用模板化措辞。
- 输出合并判断表（# | 问题 | 来源 | 严重度 | 判断 | 原因 | 修改方案）

### 上下文传递机制

独立子 Agent 无法访问主 Agent 会话上下文。通过 Agent 工具的 `prompt` 参数直接注入所需上下文：

| 注入项 | 注入内容 | 注入方式 | 注入时机 | 附加指令 |
|--------|---------|---------|---------|----------|
| 模型配置 | 每个 Step 使用的模型列表 | 主 Agent 通过 prompt 参数传递 | Step 启动前 | 无（模型选择由主 Agent 决定） |
| 规范上下文 | 当前 Gate 的对齐检查目标（design/specs/plan/code） | 主 Agent 通过 prompt 参数传递 | Step 启动前 | 无（规范内容为审查输入） |
| 上轮审查经验 | lessons_learned（来自账本或 review-cache.json） | 主 Agent 通过 prompt 参数传递 | Step 0 / 对齐 Agent 注入 | 无（经验为辅助输入） |
| 标记块输出指令 | 每个子 Agent 完成审查/修复/检查后，必须在输出末尾附加结构化标记块 | 主 Agent 通过 prompt 参数注入子 Agent | 每个 Step 启动前 | **强制**: 子 Agent 需输出 STEP<N>_EXECUTED 标记块 |

截断策略：注入内容总长度超过 Agent prompt 限制时（通常 > 8000 字），优先保留"问题清单 + 严重度 + 证据"部分，截断"分析过程"和"冗余上下文"，截断处标注 `[... 已截断，完整报告已由主 Agent 在合并阶段审查 ...]`。合并判断表不截断。

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

**Step 3 — 独立监督 Agent 交叉验证（强制，不可跳过）**

主 Agent 将三路 Agent 的原始审查报告全文 + 最终合并判断表注入监督 Agent prompt。

监督 Agent 执行交叉比对：

1. 溯源检查：合并判断表中的每条问题是否都能在原始报告中找到对应来源？无法溯源 → 标注 [无法溯源]
2. 遗漏检测：原始报告中有但合并表中缺失的发现？逐条标注遗漏原因（被合并/被拒绝/被遗漏）
3. 合并去重合理性：该合并未合并 → [合并遗漏]；不该合并被误合并 → [过度合并]
4. 判断充分性：主 Agent 的接受/拒绝/部分接受理由是否充分？不充分 → [判断存疑] + 建议。严重度校准——Step 2 按"取最高级"规则统一严重度时，检查是否有过度升级/降级

输出独立审核报告：每项标注 [维持/修正/补充] + 理由 + 建议。

主 Agent 根据审核报告调整合并判断表，输出最终版。

降级：仅单一模型可用时，使用与主 Agent 相同模型执行监督，报告中声明"单一模型，缺少独立视角交叉验证"，但不可跳过。合并后问题数 < 5 → 仅执行溯源检查 + 遗漏检测（维度 1-2）；≥ 5 → 完整四维度。降级时 degradation 字段须含退化声明三要素：(a)具体缺失能力+模型名 (b)尝试过的调用方式+失败信息 (c)降级路径选择依据。

监督 Agent 完成后必须输出 `STEP3_EXECUTED` 标记块（格式见"上下文传递机制"中的注入模板）。

**Step 4 — 子 Agent 执行修复 + 主 Agent 校验**

0. P0 用户确认 Gate：合并判断表中标记为"接受"的 P0 项，先提请用户逐条确认（问题判定 + 修复方案）。用户确认后纳入修复 prompt。P1/P2 项直接纳入，无需确认。用户拒绝某项 P0 → 标注"用户拒绝"，保留但不修复。

1. 指派修复子 Agent：
   - 模型选择：优先与审查 Agent 不同模型（确保修复视角独立）；仅单一模型时用同模型
   - Prompt 注入：最终合并判断表中标记为"接受"的修复项（精确修改指令 + 原文片段 + 新文本 + 修改位置）
   - 职责：修复子 Agent 只执行文件修改，不审查、不输出判断
   - 并行规则：修复项 > 5 条时拆分为多个修复子 Agent 并行执行。分组前检查跨文件语义依赖（如同一术语在不同文件中的统一替换、跨文件交叉引用的同步更新）→ 存在依赖的修复项分配给同一子 Agent → 无依赖的按修改文件分组，确保不同子 Agent 不修改同一文件

2. 主 Agent 逐条校验：
   - 每条修复是否按修改方案正确应用？（原文→新文对比）
   - 修复是否引入了新问题？（残留旧术语、格式破坏、Markdown 语法错误）
   - 全文 grep 验证：废弃概念/术语已清除，无残留占位符

3. 校验不通过 → 标注失败项 → 修复子 Agent 重新修复 → 主 Agent 再次校验（最多重试 3 轮，超过则标注"修复失败"并提请用户裁决）
4. 全部通过 → 进入 Step 5

降级：子 Agent 工具不可用时（极端环境），退回主 Agent 自行修复，报告中声明限制。环境不支持并行 Agent 时，修复子 Agent 改为串行执行，拆分规则不变，报告中声明"串行执行（环境限制）"。降级时 degradation 字段须含退化声明三要素：(a)具体缺失能力+模型名 (b)尝试过的调用方式+失败信息 (c)降级路径选择依据。

修复子 Agent 完成后输出 `STEP4_EXECUTED` 标记块。多修复子 Agent 时，主 Agent 收集所有修复子 Agent 的输出后合并为**单个** STEP4_EXECUTED 标记块：issues_found 汇总所有修复子 Agent 发现的新问题数，agents 列表包含所有修复子 Agent 的名称和模型，degradation 取所有修复子 Agent 中最严重的退化状态。

**Step 4 退化补偿规则**：当 Step 4 发生退化（status: degraded 或 failed）时，Step 5 的 Quick Review Agent 将执行两轮独立验证（见 Step 5 退化补偿规则），以补偿修复视角独立性的损失。

**Step 5 — Quick Review 收尾**

- 独立 Agent（非 Step 4 实施者）通读修复子 Agent 的输出 + 主 Agent 的校验记录
- 输出快速检查报告：是否所有问题均已修复？修复是否引入新问题？文档整体一致性是否保持？
- 仅单一 Agent 可用时，在审查报告中声明限制（缺少独立视角）。降级时 degradation 字段须含退化声明三要素
- Quick Review 通过后输出收敛提醒
- 完成后输出 `STEP5_EXECUTED` 标记块
- **退化补偿规则**: 如果 Step 4 发生退化（status: degraded 或 failed），Step 5 的 Quick Review Agent 执行**两轮独立验证**（第一轮: 检查修复质量；第二轮: 独立重新验证修复项）。在两轮之间主 Agent 不干预，以补偿修复视角独立性的损失。两轮验证均在 Step 5 标记块中记录，degradation 字段注明"Step 4 退化 → Step 5 执行两轮补偿验证"

注意：Step 5 在本轮审查层面检查修复质量（本轮问题是否已彻底修复）；最终通读 Gate 在跨轮累积层面检查全局一致性（多轮修复之间是否有冲突）。两者触发时机不同，检查维度互补，不重复。

### 与 UltraReview 的分工

| 维度 | 多模型渐进式 | UltraReview |
|------|------------|-------------|
| 审查对象 | 文档（设计/规范/计划等） | 代码实现/项目结构/构建配置 |
| Agent 数量 | 3 | 5 |
| 对齐检查 | 对齐 Agent 专门负责 | 由 specs-reviewer Agent 承担 |
| 收敛提醒 | 是 | 是 |

---

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

---

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

---

### 协议与数据结构索引

以下为 specpowers-review 涉及的协议与数据结构统一检索入口（每项 1-2 行摘要）。完整定义见上述对应小节：

1. **协议 1: 会话上下文账本结构** — 主 Agent 内存 dict，维护跨轮次收敛对比与跨 Gate 经验传递。详见上方"会话上下文账本协议"节
2. **协议 2: 执行标记格式规范** — `STEP<N>_EXECUTED` fenced code block 格式 + 验证规则 + 双层验证原理。详见上方"执行标记格式定义"节（含标记块验证规则 + 各 Step 定义 + 双层验证原理）
3. **数据结构: 执行日志表格** — 审查报告末尾的 Markdown 汇总表，派生自 STEP<N>_EXECUTED 标记块。详见上方"各 Step 标记块定义"表
4. **数据结构: 退化声明三要素** — degradation 字段的 (a)缺失能力 (b)尝试记录 (c)降级依据 格式规范。详见上方"退化声明标准协议"节
5. **协议 3: 跨会话缓存协议** — `.specpowers/review-cache.json` 尽力而为缓存，存 lessons_learned + final_readthrough。详见上方"跨会话缓存"节

> 命名约定："协议"指涉及双方交互的规范（账本跨 Gate 传递、标记块输出-验证交互、缓存读写协作），纯格式规范（执行日志表结构、退化声明字段格式）归类为"数据结构定义"。

---

## 最终通读 Gate（横切，全 Gate 适用）

最终通读 Gate 是横切 Gate，不参与 Gate 0-4 编号体系，适用于所有审查（无论单轮还是多轮循环）。单轮审查在 Step 5 完成后立即执行最终通读；多轮审查在最后一轮 Step 5 完成后执行最终通读。适用对象含文档类 Gate 0/1/2 和代码类 Gate 3。代码类 Gate 3 的"通读全文"指通读所有变更文件的 diff 及关键文件的完整内容。关键文件的判定标准：被 diff 中引用但未完全展示的函数/类/模块的源文件，以及变更涉及的配置文件。由主 Agent 根据 diff 中的 import/reference 关系自动判断。

### 与 Step 5 的关系

Step 5 检查本轮修复质量（单轮范围），最终通读 Gate 检查跨轮累积一致性（全局范围）。在多轮审查的最后一轮，Step 5 和最终通读 Gate 先后执行，Step 5 先（本轮修复验证），最终通读 Gate 后（全局一致性检查）。单轮审查中，Step 5 完成后立即执行最终通读 Gate，两者的检查维度互补（Step 5 检查问题修复情况，最终通读检查全文一致性）。

### 触发时机

当审查进入最终通读环节（单轮：Step 5 完成后；多轮：用户决定不再继续下一轮，或问题已收敛到 P0=0 且 P1≤3 且较上轮无新增 P1，且 Step 5 完成后），**在进入下一环节（如下一 Phase、Gate 3 进入 Phase 4 等）之前**，必须执行最终通读。

### 执行方式

- 启动独立子 Agent（非实施者，使用可用模型），通读审查对象全文。由 specpowers-review 主 Agent 在 Step 5 完成后、向父技能返回结果前启动。
- 仅单一模型可用时：由主 Agent 自行执行最终通读（无法获取独立视角），在最终通读报告中声明"单一模型，最终通读缺少独立视角交叉验证"。
- **跨会话状态**: 跨会话重启后，主 Agent 从 `.specpowers/review-cache.json` 的 `final_readthrough` 字段读取状态：status === "pass" 时检查 `file_hashes`（如存在）判断 staleness——当前审查对象文件 hash 与缓存不一致 → 缓存过期，重置为 pending 并重新执行。hash 不可用时仅输出警告，继续使用缓存状态。缓存读取的完整规则见"跨会话缓存"节中的 `final_readthrough` 读写规则。

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

---

## Gate 触发协议汇总表

| Gate | 触发条件 | 触发者 | 审查对象 | 对齐源 | 审查方式 | 通过标准 |
|------|---------|--------|---------|--------|---------|---------|
| **Gate 0** | Phase 0 用户审批通过后 | specpowers-plan 调用 | `design.md` | `clarifications/<name>.md` | 多模型渐进式 | 无 P0 |
| **Gate 1** | Phase 1 用户审核通过后 | specpowers-plan 调用 | proposal/design/specs/tasks | Phase 0 design + clarifications | 多模型渐进式 | 无 P0 |
| **Gate 2** | Phase 2 plan 生成后 | specpowers-plan 调用 | `plan/<name>.md` | Phase 1 specs + Phase 0 design | 多模型渐进式 | 无 P0 |
| **Gate 3** | Phase 3 代码实现完成后 | specpowers-apply 调用 | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | UltraReview(≥10 文件) / 加强审查(<10 文件) | 无 P0 |
| **Gate 4** | Phase 4 归档前 | specpowers-archive 内部 | 归档完整性 | — | 现有 hard gate 链 | 现有标准 |
| **最终通读** | 每 Gate 审查修复完成后 | specpowers-review 内部 | 审查对象全文 | — | 独立 Agent 通读 | PASS（四条件） |
