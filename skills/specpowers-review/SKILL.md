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

- **主 Agent**：specpowers-review 技能内部的协调 Agent，调度子 Agent、合并审查结果、执行修复。与入口技能 specpowers 的 Agent 区分
- **用户**：人类开发者（审批修复方案），非调用方 Agent。

## 审查决策树

审查类型由本 skill 内部按以下决策树自动判定，用户可手动覆盖。

```text
审查对象类型?
├── 文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）
│   └── 多模型渐进式审查（默认，通用）
│       用户可手动选择其他审查方式（UltraReview / 加强审查）
│
└── 代码类（实现代码 / 项目结构 / 构建配置 / 项目创建或变更）
    ├── 条件判定（级联，按顺序评估）：
    │   ├── 条件 1：文件数 ≤ 2 且 修改总行数 ≤ 200 → 加强审查
    │   │   （详见下方"加强审查（代码类，≤2 文件且 ≤200 行）"节）
    │   └── 条件 2：其他情况 → UltraReview + 对齐审查
    │       （6-agent 团队审查 + 多模型渐进式中的对齐Agent COVERED/MISSING/DRIFT 对照）
    └── 用户可手动切换审查路径
```
> 注：`修改总行数` = `git diff --stat` 的 additions + deletions，由调用方（specpowers-apply）在调用 specpowers-review 前计算（`<base>` = `git merge-base main HEAD`）并传入。

"项目创建或变更"指涉及项目配置文件（package.json / Cargo.toml / go.mod 等）、构建脚本、目录结构调整的变更。判断标准：变更涉及项目基础设施层面（而非仅业务代码），即归入此类。

### 手动切换审查路径

用户可通过以下方式覆盖自动判定：
- 自然语言关键词检测（当前轮用户输入）："UltraReview" / "渐进式审查" / "加强审查" / "快速审查"
- 检测到关键词 → 跳过决策树，按用户指定方式执行
- 多个关键词冲突 → 以第一个匹配的为准，并在审查报告中注明检测到的歧义
- 如用户选定的方式与产物类型不匹配（如对文档用 UltraReview），输出警告信息后直接按用户选择执行，无需等待确认（用户可能想用 6-agent 多角度审查大型设计文档如行数 > 200 行或 ≥ 5 个独立章节）
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
                                                                    加强审查（≤2文件且≤200行）
                                                                    / UltraReview+对齐审查（其他）
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
| **Gate 3** | Phase 3 代码实现完成后 | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | 加强审查（≤2文件且≤200行） / UltraReview+对齐审查（其他） |
| **Gate 4** | Phase 4 归档前 | 归档完整性 | —（现有硬 Gate 链不变） | 现有 hard gate 链（specpowers-archive 内部），仅标记为 Gate 节点 |

### 多文件 Gate 的审查粒度

Gate 1 审查对象包含多个独立文件（proposal.md / design.md / specs/ / tasks.md），审查策略：
- 合并为一次审查：三 Agent 分别读取所有文件，输出合并报告（一条问题可能跨文件关联）
- 对齐 Agent 的"逐条对照"以 `design.md` 为主线，对照 `clarifications` 中的需求点是否在 proposal/specs/tasks 中完整覆盖
- 结构 Agent 检查四件套之间的内部一致性（如 tasks.md 的任务是否覆盖了 specs/ 的所有 Requirement）
- 落地 Agent 检查每个文件独立的可执行性（对文档类：检查引用路径是否存在、命令示例是否可运行、配置示例语法是否正确、平台差异是否已标注；对代码类：检查编译/运行可行性、依赖完整性）

### Gate 执行规则

- 每个 Gate 不可跳过
- Gate 未通过（存在 P0）→ 禁止进入下一 Phase
- Gate 发现 P1/P2 → 记录后允许通过。问题清单写入会话上下文账本（主 Agent 内存 dict，见 `refs/protocols.md`），跨 Gate 通过主 Agent 注入对齐 Agent prompt。不再写入任何 .review 开头的文件产物。跨会话场景下，审查教训从 .specpowers/review-cache.json 读取（尽力而为缓存，丢失不影响正确性）。
- 每个 Gate 审查完成后均输出收敛提醒
- **审查修改与审批的关系**：Gate 审查发现的修改分为两类：
  - (a) **结构性修改**（改变设计意图/架构/接口/数据模型/核心流程）→ 需重新走用户审批
  - (b) **澄清性修改**（消除歧义、补充遗漏、修正措辞、修复格式，不改变设计意图、接口和数据流）→ 免二次审批，直接修改后由主 Agent 确认
  - **判定标准**：如果修改会导致下游产物的内容或结构发生变化，则为结构性修改。对齐 Agent 的审查报告需标注每项修改的类型及判定理由。
  - **P0 问题**：无论修改类型，均须先经用户确认问题判定和修复方案。确认后——澄清性修改免二次审批直接修改，结构性修改需在修改后重新走用户审批流程。
- **加强审查（代码 ≤2 文件且 ≤200 行）时**：Gate 3 拆分为两部分：
  1. specpowers-apply 的 code-review（通过标准：无 P0 问题）
  2. specpowers-review 的对齐 Agent 单 Agent 审查（对齐检查，通过标准：无 MISSING 或 DRIFT 标记为 P0 的项）
  两者均通过方可进入 Phase 4。
- **UltraReview + 对齐审查（其他情况）时**：执行完整 Gate 3 UltraReview（6-agent 团队审查），并在审查维度中新增对齐审查 Agent，执行 COVERED/MISSING/DRIFT 对照（同多模型渐进式审查中的对齐 Agent 对照方法）。

---

## UltraReview + 对齐审查（代码类，其他情况）

**适用条件**：代码类 + 不满足条件 1（即文件数 > 2 或修改总行数 > 200）。

### 创建审查团队

除现有 5 个审查 Agent 外，新增第 6 个维度——对齐审查 Agent：

| 维度 | prompt 要点 |
|------|-----------|
| build-reviewer | 检查构建系统配置正确性 |
| code-reviewer | 检查源码修改、编码、include 路径 |
| specs-reviewer | 逐条对照 OpenSpec specs/ 检查合规性 |
| docs-reviewer | 检查文档和记忆一致性 |
| deps-reviewer | 检查依赖路径和库命名 |
| **对齐审查 Agent**（新增） | 逐条对照 plan + specs + design，输出 COVERED/MISSING/DRIFT 对照表 |

对齐审查 Agent 的对照方法复用多模型渐进式审查中"对齐 Agent 对照方法"协议（逐条提取→逐一查找→输出对照表）。COVERED=需求点有对应且语义一致；MISSING=完全无对应（P1）；DRIFT=有对应但语义偏离（P0）。

> **STEP 兼容性说明**: 对齐审查 Agent 在 Step A 与其他 5 个审查 Agent 并行启动，产出在 Step B-C 中与其他报告一同去重合并，不产生独立 STEP 标记块。STEP 标记块体系（STEP1-STEP5）不变，STEP1_EXECUTED 的 agents 列表从 5 个扩展为 6 个。

> **术语说明**: 加强审查中的"对齐 Agent 单审"与 UltraReview 中的"对齐审查 Agent"为同一审查维度，区别仅在于部署模式——加强审查中作为独立 Agent 产出 STEP1/STEP2 标记块，UltraReview 中作为 6-agent 团队成员在 Step A 并行产出、融入 Step B-C 去重合并。

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
  └── 检查 6 个审查维度均有报告产出，如有缺失等待或重试

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

## 加强审查（代码类，≤2 文件且 ≤200 行）

代码变更满足文件数 ≤ 2 且修改总行数 ≤ 200 时，Gate 3 不启动 6-agent 团队，而是由 specpowers-review 构造对齐 Agent 单 Agent 审查：

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

> 在启动审查 Agent 前，主 Agent 先完成以下自检——以下列出的每一项合理化都是实际审查中观察到的 Agent 跳过模式。

### 审查纪律自检

#### 合理化表

| 如果你在想… | 为什么这是陷阱 | 正确做法 |
|------------|---------------|---------|
| "三个 Agent 结论一致 → 不需要监督验证" | 一致可能是共识偏见而非正确。本项目第三轮监督 Agent 曾在合并判断表中发现 12 项所有审查 Agent 都未注意到的遗漏 | Step 3 强制执行，无论 Agent 间结论是否一致 |
| "问题 < 5 → 太简单不需要完整监督" | 问题少意味着每条问题的误判成本更高。一个被误判为 P1 的 P0 在 3 个问题的集合中比在 20 个问题的集合中危害更大 | 仅缩小范围（溯源检查 + 遗漏检测），不跳过监督 |
| "这轮只是小修复，不需要 Quick Review" | 修复引入新问题是已知模式——"修复→引入问题→遗漏修复"是多轮审查中最常见的失败路径 | Step 5 强制执行，无论修复规模 |
| "用户会发现剩余问题" | 用户审查是后续环节——Gate 审查阶段跳过的偏差在下游 Phase 逐层放大 | 每个 Gate 独立完成全部审查步骤 |
| "退化声明太复杂，跳过" | 无退化声明 → 父技能按标记块缺失处理 → 阻塞 Phase。退化声明的存在性比措辞完美更重要 | 至少输出 (a) 缺失了什么能力 (b) 尝试过什么 |
| "零问题 → 不需要标记块" | 父技能将标记块缺失解释为"Step 未执行"（而非"Step 完成且无问题"）| `issues_found: 0` 的标记块同样必须输出 |

#### Red Flags 自检清单

每个 Step 完成后，主 Agent 逐条自检：

```
□ Step 1: 三个 Agent 都启动了？任一未完成 → 不可标 complete，不可进入 Step 2
□ Step 2: 每条问题写了具体原因（非模板化措辞）？→ 有模板化措辞 → 重写
□ Step 3: 监督 Agent 输出了独立报告？→ 没有 → 不可进入 Step 4
□ Step 4: 所有 P0 修复均已逐条校验？→ 不清楚 → 先校验
□ Step 5: Quick Review Agent 非 Step 4 实施者？→ 是同一 Agent → 退化声明
□ 最终通读: 全文术语一致？无废弃引用？→ 不确定 → grep 验证
□ 本轮有退化场景？→ 有 → 退化声明含三要素（缺失能力|尝试记录|降级依据）且 status 非 complete？
```

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
agents: [<agent_name>(<model>)]
issues_found: <N>
degradation: none|<具体原因>|<影响分析>|<替代措施>
\`\`\`

字段说明:
- status: complete（正常完成）/ degraded（降级执行）/ failed（执行失败）
- agents: 本 Step 使用的 Agent 列表，格式 [名称(模型)]
- issues_found: 本 Step 新发现的问题数量（P0+P1+P2 合计）
- degradation: 无降级时填 none；有降级时按退化声明格式要求填写 <具体原因>|<影响分析>|<替代措施>（完整定义见 `refs/protocols.md`）

> **注意**: `ref: AgentId=<id>, tokens=<N>` 行由**主 Agent 在汇总时追加**（非子 Agent 输出）。子 Agent 看不到自己的 AgentId（Agent 工具返回值对调用方可见，对被调用方不可见），因此子 Agent 只需输出以上四个字段。AgentId 和 tokens 由主 Agent 从 `Agent` 工具返回值中提取后追加到每个标记块末尾。

**无论 issues_found 是否为 0，每个执行的 Step 必须输出此标记块。**
标记块缺失将被父技能视为 Step 未执行，导致当前 Phase 被阻塞。
```

> **注入时注意**: 上述模板中 `\<N>` 需替换为实际 Step 编号（如 `1`、`2`、`FINAL_READTHROUGH`）。模板内的 `\`\`\`` 为 Markdown 转义表示（用于在此外层 fenced code block 中正确渲染），注入子 Agent prompt 时须还原为普通三反引号 `` ``` ``（即去掉反斜杠）。若不还原，子 Agent 将输出带反斜杠的 `\`\`\`STEP<N>_EXECUTED`，导致父技能按 `` ```STEP<N>_EXECUTED `` 搜索 fenced code block 时无法匹配，误判为 Step 未执行。

**Step 3 — 独立监督 Agent 交叉验证（强制，不可跳过）**

主 Agent 将三路 Agent 的原始审查报告全文 + 最终合并判断表注入监督 Agent prompt。

监督 Agent 执行交叉比对：

1. 溯源检查：合并判断表中的每条问题是否都能在原始报告中找到对应来源？无法溯源 → 标注 [无法溯源]
2. 遗漏检测：原始报告中有但合并表中缺失的发现？逐条标注遗漏原因（被合并/被拒绝/被遗漏）
3. 合并去重合理性：该合并未合并 → [合并遗漏]；不该合并被误合并 → [过度合并]
4. 判断充分性：主 Agent 的接受/拒绝/部分接受理由是否充分？不充分 → [判断存疑] + 建议。严重度校准——Step 2 按"取最高级"规则统一严重度时，检查是否有过度升级/降级

输出独立审核报告：每项标注 [维持/修正/补充] + 理由 + 建议。

主 Agent 根据审核报告调整合并判断表，输出最终版。

降级：仅单一模型可用时，使用与主 Agent 相同模型执行监督，报告中声明"单一模型，缺少独立视角交叉验证"，但不可跳过。合并后问题数 < 5 → 仅执行溯源检查 + 遗漏检测（维度 1-2）；≥ 5 → 完整四维度。降级时 degradation 字段按标准协议输出退化声明。

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

降级：子 Agent 工具不可用时（极端环境），退回主 Agent 自行修复，报告中声明限制。环境不支持并行 Agent 时，修复子 Agent 改为串行执行，拆分规则不变，报告中声明"串行执行（环境限制）"。降级时 degradation 字段按标准协议输出退化声明。

修复子 Agent 完成后输出 `STEP4_EXECUTED` 标记块。多修复子 Agent 时，主 Agent 收集所有修复子 Agent 的输出后合并为**单个** STEP4_EXECUTED 标记块：issues_found 汇总所有修复子 Agent 发现的新问题数，agents 列表包含所有修复子 Agent 的名称和模型，degradation 取所有修复子 Agent 中最严重的退化状态。

**Step 4 退化补偿规则**：当 Step 4 发生退化时（退化声明按标准协议输出，状态判定见 `refs/protocols.md`），Step 5 的 Quick Review Agent 将执行两轮独立验证（见 Step 5 退化补偿规则），以补偿修复视角独立性的损失。

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
| 审查对象 | 文档（设计/规范/计划等） | 大规模代码（其他情况） |
| Agent 数量 | 3 | 6 |
| 对齐检查 | 对齐 Agent 专门负责 | 对齐审查 Agent 专门负责（COVERED/MISSING/DRIFT 对照） |
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

---

## 审查基础设施与协议

> 以下各节定义的协议与数据结构作用于整个审查流程（所有 Gate、所有 Step），非仅收敛提醒场景。此处集中放置以便检索。

### 协议与数据结构参考

以下协议和数据结构的完整定义见 `refs/protocols.md`：
- 会话上下文账本（结构 + 读写时机 + 跨 Gate 传递）
- review-cache.json（格式 + 读写规则 + 尽力而为操作化定义）
- 执行标记格式（`STEP<N>_EXECUTED` + 验证规则 + 双层验证原理）
- 退化声明三要素（格式 + 各 Step 退化位置表）

> 审查流程中对这些协议的引用（"按退化声明标准协议输出"、"从 review-cache.json 读取"）在流程描述中保留上下文。审查流程中任何协议细节不确定时，Read `refs/protocols.md` 获取完整定义。

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
- **跨会话状态**: 跨会话重启后，主 Agent 从 `.specpowers/review-cache.json` 的 `final_readthrough` 字段读取状态：status === "pass" 时检查 `file_hashes`（如存在）判断 staleness——当前审查对象文件 hash 与缓存不一致 → 缓存过期，重置为 pending 并重新执行。hash 不可用时仅输出警告，继续使用缓存状态。缓存读取的完整规则见 `refs/protocols.md` 中跨会话缓存的 `final_readthrough` 读写规则。

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
| **Gate 3** | Phase 3 代码实现完成后 | specpowers-apply 调用 | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | 加强审查（≤2文件且≤200行） / UltraReview+对齐审查（其他） | 无 P0 |
| **Gate 4** | Phase 4 归档前 | specpowers-archive 内部 | 归档完整性 | — | 现有 hard gate 链 | 现有标准 |
| **最终通读** | 每 Gate 审查修复完成后 | specpowers-review 内部 | 审查对象全文 | — | 独立 Agent 通读 | PASS（四条件） |
