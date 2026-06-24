# specpowers-review 审查体系重构 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按设计文档 `docs/superpowers/specs/2026-06-24-review-system-refactor-design.md` 修改 4 个技能文件，实现审查体系重构。

**Architecture:** 审查决策树下沉到 specpowers-review；文档类走多模型渐进式（3 Agent，含新增对齐 Agent），代码类 ≥10 文件走 UltraReview；全流程 Gate 0-4 + 最终通读 Gate；每 Gate 输出收敛提醒。

**Tech Stack:** Claude Code SKILL.md（Markdown + YAML frontmatter）

---

## 文件结构

| 文件 | 操作 | 职责 |
|------|------|------|
| `skills/specpowers-review/SKILL.md` | 重写 | 审查决策树、三 Agent 结构、Gate 协议、收敛提醒、最终通读 Gate |
| `skills/specpowers/SKILL.md` | 修改 | 审查矩阵→路由规则、映射表同步、路由表调整 |
| `skills/specpowers-plan/SKILL.md` | 修改 | Phase 0/1 追加 Gate 说明、Phase 2 Plan 审查 Gate 替换 |
| `skills/specpowers-apply/SKILL.md` | 修改 | 双重审查→Gate 3 调用、spec-compliance-check 改为 prompt 注入说明 |

---

### Task 1: 重写 specpowers-review/SKILL.md

**文件:** 重写 `skills/specpowers-review/SKILL.md`

- [ ] **Step 1: 更新 YAML frontmatter**

将 description 更新为触发条件，不总结工作流：

```yaml
---
name: specpowers-review
description: Use when code or document review is triggered in a specpowers workflow — when implementation is complete and needs quality gate, when design/spec/plan documents need multi-angle progressive review, when user says "review this" or "run UltraReview", or when a specpowers Gate requires formal review before proceeding to next phase. The skill internally selects review type: document review → multi-model progressive (3 agents), code review ≥10 files → UltraReview (5 agents), code review <10 files → enhanced review.
---
```

- [ ] **Step 2: 写正文 — 前置检查 + 审查决策树**

```markdown
# specpowers-review: 审查阶段

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取全局规则。等待加载完成后继续。
> 2. 确认审查对象（文档/代码）和变更范围（文件数）已知。如未知，向用户确认后继续。

## 术语说明

- **主 Agent**：指 specpowers-review 技能内部的协调 Agent，负责调度子 Agent、合并审查结果、执行修复。与入口技能 specpowers 的 Agent 区分
- **用户**：指人类开发者，负责审批结构性修改和 P0 问题的修复方案
- **微小任务**：变更文件数 ≤ 3、单文件局部修改、不涉及接口变更、配置变更或跨文件重构。由入口 skill 决策树判定

## 审查决策树

审查类型由本 skill 内部按以下决策树自动判定，用户可手动覆盖。

```
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
- 文档类用户可通过手动切换选择其他审查方式：UltraReview / 加强审查 / 单 Agent 快速审查等

## 全流程逐层审查 Gate

### Gate ASCII 图

复制设计文档第 67-99 行的 ASCII Gate 流程图（Phase 0→Gate 0→Phase 1→Gate 1→Phase 2→Gate 2→Phase 3→Gate 3→Gate 4 的完整层级结构）。

### 各 Gate 详细定义表

| Gate | 触发时机 | 审查对象 | 对齐上游 | 审查方式 |
|------|---------|---------|---------|---------|
| **Gate 0** | Phase 0 用户审批通过后 | `design.md` | `clarifications/<name>.md` | 多模型渐进式 |
| **Gate 1** | Phase 1 用户审核通过后 | proposal/design/specs/tasks | Phase 0 `design.md` + `clarifications` | 多模型渐进式 |
| **Gate 2** | Phase 2 plan 生成后 | `plan/<name>.md` | Phase 1 OpenSpec specs + Phase 0 design | 多模型渐进式 |
| **Gate 3** | Phase 3 代码实现完成后 | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | UltraReview(≥10 文件) / 加强审查(<10 文件)（微小任务模式不走此 Gate，见执行规则） |
| **Gate 4** | Phase 4 归档前 | 归档完整性 | —（现有硬 Gate 链不变） | 现有 hard gate 链（specpowers-archive 内部），仅标记为 Gate 节点 |

### 多文件 Gate 的审查粒度

Gate 1 审查对象包含多个独立文件，审查策略：
- 合并为一次审查：三 Agent 分别读取所有文件，输出合并报告（一条问题可能跨文件关联）
- 对齐 Agent 的"逐条对照"以 `design.md` 为主线，对照 `clarifications` 中的需求点是否在 proposal/specs/tasks 中完整覆盖
- 结构 Agent 检查四件套之间的内部一致性（如 tasks.md 的任务是否覆盖了 specs/ 的所有 Requirement）
- 落地 Agent 检查每个文件独立的可执行性（对文档类：检查引用路径是否存在、命令示例是否可运行、配置示例语法是否正确、平台差异是否已标注；对代码类：检查编译/运行可行性、依赖完整性）

### Gate 执行规则

- 每个 Gate 不可跳过（微小任务模式除外：微小任务不触发 specpowers-review，Gate 0-4 全部跳过）
- Gate 未通过（存在 P0）→ 禁止进入下一 Phase
- Gate 发现 P1/P2 → 记录后允许通过，但问题清单会写入 `.review-summary.json`，后续 Gate 加载 specpowers-review 时该 JSON 自动注入对齐 Agent 的审查上下文，由对齐 Agent 逐条验证遗留问题是否已修复
- 每个 Gate 审查完成后均输出收敛提醒
- **微小任务模式**：不触发 specpowers-review。代码审查由 specpowers-apply 的内部双重审查（code-review + spec-compliance-check）直接执行，不走 Gate 体系。Gate 0/1/2/3/4 全部跳过。
- **审查修改与审批的关系**：Gate 审查发现的修改分为两类——(a) 结构性修改（改变设计意图/架构/接口/数据模型/核心流程）→ 需重新走用户审批；(b) 澄清性修改（消除歧义、补充遗漏、修正措辞、修复格式，不改变设计意图、接口和数据流）→ 免二次审批，直接修改后由主 Agent 确认。判定标准：如果修改会导致下游产物的内容或结构发生变化，则为结构性修改。对齐 Agent 的审查报告需标注每项修改的类型及判定理由。P0 问题无论修改类型，均须先经用户确认问题判定和修复方案。确认后——澄清性修改免二次审批直接修改，结构性修改需在修改后重新走用户审批流程。
- **代码 <10 文件时**：Gate 3 拆分为两部分——(a) specpowers-apply 的 code-review（通过标准：无 P0 问题）；(b) specpowers-review 的对齐 Agent 单 Agent 审查（对齐检查，通过标准：无 MISSING 或 DRIFT 标记为 P0 的项）。两者均通过方可进入 Phase 4。
```

- [ ] **Step 3: 写正文 — UltraReview 重新定位**

```markdown
## UltraReview（代码类，≥ 10 文件）

**适用对象**: 代码类 + 变更文件数 ≥ 10。审查机制保持现有 5-agent TeamCreate 结构（build/code/specs/docs/deps 五维度），分级标准 P0/P1/P2/P3 不变。

与旧版差异：文件数阈值 20→10，不再按风险维度触发（改为按产物性质+文件数）。
```

> **从旧版提取并嵌入以下 UltraReview 内容**（来源：`skills/specpowers-review/SKILL.md` UltraReview 节，L32-82）：
>
> **TeamCreate 团队创建指令**：
> - `TeamCreate({team_name: "ultrareview-<change>"})`
> - 5-agent 分工表：
>
> | 维度 | prompt 要点 |
> |------|-----------|
> | build-reviewer | 检查构建系统配置正确性 |
> | code-reviewer | 检查源码修改、编码、include 路径 |
> | specs-reviewer | 逐条对照 OpenSpec specs/ 检查合规性 |
> | docs-reviewer | 检查文档和记忆一致性 |
> | deps-reviewer | 检查依赖路径和库命名 |
>
> **审查规则**（保留旧版）：
> - 只读不写：审查 Agent 禁止修改代码
> - P0/P1/P2/P3 分级规则：P0 必须修复、P1 选择性修复、P2/P3 记录待办
> - P0 须人工确认后修改
>
> **主 Agent Step A-F 逐条分析协议**（保留旧版完整流程）：
> - Step A: 确认全部子 Agent 已完成（检查 5 个审查维度均有报告产出，如有缺失等待或重试）
> - Step B: 去重合并（相同问题——同一文件+同一符号+同一问题类型→合并为一条，标注来源；冲突结论标注冲突，不做自动裁决，提级用户判断）
> - Step C: 逐条判断不可批量（每条必须写原因，不能批量同意/拒绝；严重度校准取所有来源中最高级）
> - Step D: 输出合并判断表（# | 问题 | 来源 | 判断 | 原因 | 修改方案 | 严重度）
> - Step E: 用户审批硬 Gate（用户逐条确认合并判断表，冲突项由用户裁决，审批通过后方可执行修复）
> - Step F: 执行修复（P0 项须人工确认后修改，批量修改后运行全文 grep 验证残留，增量审查仅读取变更区域及上下文）

- [ ] **Step 4: 写正文 — 多模型渐进式审查**

核心结构：

```markdown
## 多模型渐进式审查（文档类，默认）

### 三 Agent 结构

| Agent | 关注点 | 模型选择 |
|-------|--------|---------|
| 结构审查 Agent | 完整性/冗余/一致性/结构合理性 | 强推理能力模型（如 Claude Opus / GPT-5） |
| 落地审查 Agent | 可执行性/兼容性/边界/平台差异 | 快速模型（如 Claude Haiku / GPT-4o-mini）——快速模型在细节问题上常有意外发现 |
| 对齐审查 Agent（新增） | 对齐原始需求/设计；错漏项检测；模糊歧义识别 | 与前两者不同模型（如 Claude Sonnet / Gemini Pro） |

品牌名为示例，仅用于说明能力等级。实际执行时应使用当前环境实际可用的模型，不因品牌名不可用而报错。关键约束：三个 Agent 使用不同模型（不同 ID 或不同 provider）。

### 对齐审查 Agent 检查维度

□ 逐条对照: 文档内容与原始需求/设计方案逐条对照，标记偏差
□ 错漏检测: 原始需求中是否有未覆盖的点？是否有隐含假设被遗漏？
□ 歧义检测: 是否有可被两种方式解读的表述？术语定义是否一致？
□ 矛盾检测: 不同章节/段落间的结论是否自洽？
□ 引用完整性: 引用的外部资源/文档/接口是否存在且版本正确？

### 对齐 Agent 对照方法

1. 读取对标源文件
2. 逐条提取对标源中的需求点/决策/排除项
3. 在审查对象中逐一查找对应覆盖
4. 输出对照表：[COVERED/MISSING/DRIFT] 需求点 → 对应位置 → 证据
5. MISSING/DRIFT 项标注为 P1（遗漏）或 P0（偏离）

判定标准：
- MISSING: 对标源中的需求点/决策/排除项在审查对象中完全找不到任何对应内容
- DRIFT: 审查对象中能找到对应内容，但内容与对标源中的表述存在实质性差异（而非措辞差异）

边界情况判定：
- 部分覆盖但关键细节缺失 → DRIFT（P0）。关键细节定义：影响后续 Gate 执行或实现路径的细节（如接口签名、数据模型字段、流程步骤编号等）
- 非关键细节缺失 → COVERED + 标注"部分覆盖"（P2）。非关键细节示例：辅助性说明文字、示例代码中的可选注释、非决定性配置项
- 同一需求点在审查对象中分散在多处覆盖 → 标注"分散覆盖"，逐处检查后综合判定

### 模型多样性规则

**模型选择规则**：
1. 结构审查 Agent：优先强推理能力模型，关注完整性/一致性分析
2. 落地审查 Agent：优先快速模型，关注边界/兼容性检查
3. 对齐审查 Agent：优先与前两者不同的模型，关注逐条对照+错漏检测
4. **降级策略**：仅两个模型可用时，结构+对齐使用不同模型，落地与对齐共用（落地审查先行，将落地 Agent 的完整审查报告作为对齐 Agent 的 user prompt 前缀，标注为"落地审查前置发现，供对齐审查参考"）。仅单一模型可用时，三个 Agent 串行执行（非并行，顺序：落地→对齐→结构——落地发现的具体问题为后续 Agent 提供上下文），审查报告中声明"单一模型，缺少独立视角交叉验证"
5. 如在 TeamCreate/子 Agent 环境中执行，优先使用不同子 Agent 分配不同模型

### 审查流程

**Step 0 — 准备审查经验**
主 Agent 收集本轮积累的审查教训，注入审查 Agent prompt。
- 来源 1: 全局通用原则（如"从 AI 执行视角评判，不以人类流畅性为标准""用实际项目名检查占位符是否泄漏"）
- 来源 2: 跨会话积累的审查教训——从审查对象同级目录下的 `.review-summary.json` 中的 `lessons_learned` 字段读取
- 来源 3: 当前会话中前几个 Gate 的审查报告——从 `.review-summary.json` 中读取 `rounds` 数组及 `issues_summary`，实现跨 Gate 经验传递（如 Gate 0 的教训注入 Gate 1 的审查 prompt）
- 来源 4: 用户在本轮审查中明确指出的偏好或纠正——从当前会话的对话历史中提取用户对审查方向/标准/优先级的显式指示
- 新发现的教训在每轮审查结束后追加写入 `.review-summary.json`

**Step 1 — 三 Agent 并行独立审查**
结构审查 Agent、落地审查 Agent、对齐审查 Agent 同时启动，互不感知对方的发现。每个 Agent 独立输出审查报告（问题 + 严重度分级 + 证据）。

**Step 2 — 主 Agent 逐条合并去重**
主 Agent 收集三份报告后：
- 去重合并：同一问题（同一文件的同一段落/章节/代码块内且问题描述指向同一处文本 + 同一类型）→ 合并为一条，标注来源。不同位置但指向同一概念缺陷的，标记为关联但不合并。
- 冲突标注：不同 Agent 给出不同严重度 → 不自动裁决，所有严重度冲突收集到合并判断表中作为一组。先批量展示全部冲突项（让用户纵览冲突全貌），再逐条以交互式问答请用户裁决（每条展示两个 Agent 的原始严重度及判定理由）
- 逐条判断：接受/拒绝/部分接受。主 Agent 对照原文档验证问题是否确实存在后再判断。无法自行判断的 P0 问题标记为"需用户裁决"
- 输出合并判断表（# | 问题 | 来源 | 严重度 | 判断 | 原因 | 修改方案）

**Step 3 — 独立监督 Agent 审核方案（推荐执行，以下情况可跳过）**
- 可跳过的情况：(a) 仅单一模型可用时；(b) 审查对象为简单文档（<50 行）且 P0/P1 总计 ≤ 2 时。跳过时在审查报告中声明原因。
- 独立监督 Agent（使用与主 Agent 不同的模型）审核合并判断表
- 检查维度：拒绝理由是否充分？部分接受范围是否恰当？合并去重是否遗漏或过度合并？
- 监督 Agent 输出审核意见，主 Agent 根据意见调整

**Step 4 — 执行修复 + 校验**
- 主 Agent 根据最终合并判断表逐条执行修复
- P0 问题无论修改类型，均须先经用户确认问题判定和修复方案
- 批量修改后运行全文 grep 验证无残留
- 增量审查：仅读取变更区域及其前后各 20 行的上下文，不重新审查全文。如变更涉及跨章节的术语替换或全局性修改（如全文替换术语、统一命名规范），则读取全文检查残留。

**Step 5 — Quick Review 收尾**
- 独立 Agent（非 Step 4 实施者）通读修复后的文档全文 + 逐条核对修改点
- 输出快速检查报告
- 仅单一 Agent 可用时，在审查报告中声明限制
- 注意：Step 5 检查本轮修复质量（本轮问题是否已彻底修复）；最终通读 Gate 检查跨轮累积一致性（全局范围）。两者触发时机不同，互补不重复

与旧版相比：Step 1 从双模型扩展为三 Agent（新增对齐审查 Agent）；Step 3-5 从隐式描述展开为显式定义。
```

- [ ] **Step 5: 写正文 — 收敛提醒机制**

```markdown
## 收敛提醒机制

### 每 Gate 审查+修复完成后输出

> ⚠️ **审查收敛提醒**
>
> 本轮审查发现 **P0: X 个，P1: Y 个，P2: Z 个** 问题。
>
> 问题较多的轮次修复后容易引入新问题或遗漏修复，建议**再启动一轮审查**验证修复效果。
> 重复审查直到问题收敛（P0=0, 且 P1 问题总数较上一轮不增加——即修复未引入新的 P1 问题），可有效避免：
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

### 提醒强度规则

- P0 > 0 或 P1 > 3 → **着重提醒**：输出完整提醒模板（含统计、循环价值说明、上轮对比、用户决策提示）
- P0 = 0, P1 ≤ 3, 较上轮有新增 P1 → **中等提醒**：
  > ⚠️ 本轮审查发现 P0: X, P1: Y, P2: Z。P1 较上轮新增 N 个（关注是否由修复引入）。是否继续下一轮审查？
- P0 = 0, P1 ≤ 3, 较上轮无新增 P1 → **轻量提醒**：
  > ✅ 本轮审查发现 P0: X, P1: Y, P2: Z，趋于收敛。是否继续下一轮审查？

**首轮审查（无上轮数据）时**：按 P0 > 0 或 P1 > 3 → 着重提醒；P0 = 0 且 P1 ≤ 3 → 轻量提醒（首轮默认视同"无新增 P1"）

仅提醒，不强制，不设自动循环和轮数上限，完全由用户决定。

### 收敛状态存储

收敛对比所需的上轮数据（P0/P1/P2 计数 + 问题清单摘要 + 审查教训）由 specpowers-review 在每轮审查报告末尾输出为 JSON 摘要块，存储于审查对象同级目录下的 `.review-summary.json`。

JSON 摘要结构：
```json
{
  "gate": "Gate N",
  "rounds": [
    {
      "round": 1,
      "p0": 3, "p1": 5, "p2": 2,
      "issues_summary": ["..."],
      "timestamp": "ISO8601"
    }
  ],
  "lessons_learned": ["..."],  // 计划层面扩展，设计文档未定义此字段，用于跨会话积累审查教训
  "final_readthrough": {
    "status": "pending|pass|fail",
    "timestamp": "ISO8601",
    "remaining_issues": []
  }
}
```

> 注：`lessons_learned` 字段是计划层面的合理扩展（设计文档未定义此字段），用于跨会话积累审查教训。

主 Agent 负责：(a) 每轮审查结束后更新 `.review-summary.json`，并将摘要内容注入下一轮审查的 Agent prompt；(b) 最终通读执行前读取 `final_readthrough` 状态判断是否需要执行；(c) 最终通读完成后更新 `final_readthrough` 字段。跨会话重启后如 JSON 摘要丢失，视为首轮审查（不显示上轮对比）。如 JSON 摘要存在且 `final_readthrough.status === "pass"`，视为最终通读已完成，不重复执行。
```

- [ ] **Step 6: 写正文 — 最终通读 Gate**

```markdown
## 最终通读 Gate（横切，全 Gate 适用）

最终通读 Gate 是横切 Gate，不参与 Gate 0-4 编号体系，适用于所有审查类型的审查完成后（含文档类 Gate 0/1/2 和代码类 Gate 3）。代码类 Gate 3 的"通读全文"指通读所有变更文件的 diff 及关键文件（接口定义/配置文件/入口文件）的完整内容。

与 Step 5 的关系：Step 5 检查本轮修复质量（单轮范围），最终通读 Gate 检查跨轮累积一致性（全局范围）。两者触发时机不同，互补不重复。

适用于所有审查（无论单轮还是多轮循环）。单轮审查在 Step 5 完成后立即执行最终通读；多轮审查在最后一轮 Step 5 完成后执行最终通读。

**在进入下一环节（如下一 Phase、Gate 3 进入 Phase 4 等）之前**，必须执行最终通读：

- 启动独立子 Agent（非实施者，使用可用模型），通读审查对象全文。由 specpowers-review 主 Agent 在 Step 5 完成后、向父技能返回结果前启动。仅单一模型可用时：由主 Agent 自行执行最终通读（无法获取独立视角），在最终通读报告中声明"单一模型，最终通读缺少独立视角交叉验证"。
- 检查：所有已确认修复是否正确应用？修复之间是否存在冲突？全文术语和格式是否一致？有无废弃引用或残留旧术语？
- 输出最终通读报告：[PASS/FAIL] + 残余问题清单（如有）
- PASS 标准：(a) 所有已确认修复均已正确应用；(b) 无修复间冲突；(c) 全文术语和格式一致；(d) 无废弃引用或残留旧术语
- FAIL：任一 PASS 标准未满足，列出具体残余问题
- PASS → 允许进入下一环节
- FAIL（存在残余问题）→ 修复后重新通读，直到 PASS
- 此 Gate 不可跳过，不设自动循环上限

目的：防止多轮修复累积后在文档中留下残余不一致（如术语两写、废弃引用残留、修复冲突）。多轮审查中每次修复只关注局部，最终通读提供全局一致性检查。
```

- [ ] **Step 7: 写正文 — Gate 触发协议（汇总各 Gate 如何触发本 skill）**

```markdown
## Gate 触发协议

specpowers-review 由以下场景触发，调用方无需自行判断审查类型：

| Gate | 调用方 | 触发时机 | 审查对象 | 对齐上游 |
|------|-------|---------|---------|---------|
| Gate 0 | specpowers-plan | Phase 0 审批通过后 | `design.md` | `clarifications` |
| Gate 1 | specpowers-plan | Phase 1 人工审核通过后 | proposal/design/specs/tasks | Phase 0 design + clarifications |
| Gate 2 | specpowers-plan | Phase 2 plan 生成后 | `plan/<name>.md` | Phase 1 specs + Phase 0 design |
| Gate 3 | specpowers-apply | Phase 3 代码实现完成后 | 代码变更 | Phase 2 plan + specs + design |
| 用户触发 | 任意 | 用户主动请求 | 用户指定 | 用户指定 |
```

- [ ] **Step 8: 清理旧版已废弃的机制**

以下旧版 specpowers-review SKILL.md 中的机制在新设计中已废弃，重写时**不保留**：

| 废弃机制 | 旧版位置 | 废弃原因 |
|---------|---------|---------|
| CSO 规则注入（skill-creator CSO + writing-skills 检查清单） | L101-102 | 新设计 Step 0 采用更通用的审查经验注入机制，不再硬编码特定规则的提示 |
| 审查 Agent 在新会话或 /clear 后启动 | L122-123 | 新设计采用三 Agent 并行架构 + JSON 状态持久化，不再依赖会话隔离 |

- [ ] **Step 9: Run self-review on the full file — check for internal consistency, placeholder scan, type consistency**

自审后修复发现的问题。

---

### Task 2: 同步修改 specpowers/SKILL.md

> **执行顺序**: Task 2/3/4 修改三个独立文件（specpowers/SKILL.md、specpowers-plan/SKILL.md、specpowers-apply/SKILL.md），可在 Task 1 完成后并行执行。

**文件:** 修改 `skills/specpowers/SKILL.md`

- [ ] **Step 1: 删除审查级别判断矩阵（L116-150）**

删除从"## 审查级别判断"到"### 各模式映射"之前（不含该标题及下方的映射表 L151-158）。即：只删除审查级别判断矩阵内容，保留"### 各模式映射"标题及其下方的映射表。

- [ ] **Step 2: 替换为路由规则**

在删除位置插入：

```markdown
## 审查路由

需要审查时，加载 `specpowers-review`，由 specpowers-review 内部按文档/代码分类 + 文件数自动判定审查类型，用户可手动覆盖。

> 原审查级别判断矩阵（文件数 × 风险维度）已废弃。审查类型判定逻辑完整移入 specpowers-review 内部决策树。
```

- [ ] **Step 3: 更新执行模式映射表（L153 行 "审查"列）（Step 1 执行后，此行号偏移约 -43 行，实际约 L110）**

将审查列的"普通/二维判断/UltraReview/UltraReview"全部替换为"→ specpowers-review 内部判定"。

- [ ] **Step 4: 更新阶段路由表（L105-113）（Step 1 执行后，此行号偏移约 -43 行，实际约 L62-70）**

specpowers-review 行的触发条件从"复杂+"改为"代码 ≥10 文件 或 文档类 或 用户手动触发"。

- [ ] **Step 5: 更新快速参考表（L268-277）中"审查"行（Step 1 执行后，此行号偏移约 -43 行，实际约 L225-234）**

将"审查 | Skill({skill: "specpowers-review"})（如需 UltraReview）"改为"审查 | Skill({skill: "specpowers-review"})（自动判定审查类型）"

- [ ] **Step 6: 删除故障排查表中过时引用（Step 1 执行后，此行号偏移约 -43 行，实际约 L212-220）**

检查故障排查表（L255-263）中是否有引用旧审查矩阵的内容，如有则更新。

---

### Task 3: 更新 specpowers-plan/SKILL.md

**文件:** 修改 `skills/specpowers-plan/SKILL.md`

- [ ] **Step 1: Phase 0 Step 0.6 末尾追加 Gate 0**

在"审批通过 → 进入 Phase 1"（L126）之后，追加：

```markdown

**审批通过后，执行 Gate 0 审查**：
`Skill({skill: "specpowers-review"})` — 对齐检查：design.md vs clarifications/<name>.md。Gate 通过后进入 Phase 1。
```

- [ ] **Step 2: Phase 1 Step 1.3 末尾追加 Gate 1（Step 1 执行后，此行号将偏移 +N，需重新定位 L183）**

在"□ tasks.md 遗漏了步骤？"（L183）之后，追加：

```markdown

**人工审核通过后，执行 Gate 1 审查**：
`Skill({skill: "specpowers-review"})` — 对齐检查：OpenSpec 四件套 vs Phase 0 design.md + clarifications。Gate 通过后进入 Phase 2。
```

- [ ] **Step 3: 替换 Phase 2 Plan 审查 Gate**

删除第 225-253 行（"Plan 审查 Gate"到"Plan 审查执行"整段），替换为：

```markdown
### Plan 审查 Gate（Gate 2）

**衔接阶段完成后，强制执行 Gate 2 审查**：

`Skill({skill: "specpowers-review"})` — 对齐检查：plan vs Phase 1 OpenSpec specs + Phase 0 design。

Gate 2 由 specpowers-review 承载（多模型渐进式审查）。审查通过后进入 Phase 3。
```

- [ ] **Step 4: 更新"下一步"引用**

检查文中所有"下一步"指向是否因 Gate 插入而变化，确保引用正确。

---

### Task 4: 更新 specpowers-apply/SKILL.md

**文件:** 修改 `skills/specpowers-apply/SKILL.md`

- [ ] **Step 1: 替换双重审查节（L37-54）**

将整个"## 双重审查"节替换为：

```markdown
## 审查（Gate 3）

实现完成后，执行 Gate 3 审查：

`Skill({skill: "specpowers-review"})` — 对齐检查：代码 vs Phase 2 plan + Phase 1 specs + Phase 0 design。

审查类型由 specpowers-review 内部决策树自动判定：
- 微小任务：不触发 specpowers-review，由本技能内部双重审查（见下方）执行
- 中等及以上 + 代码 < 10 文件：加强审查（code-review 由本技能执行 + 对齐检查由 specpowers-review 对齐 Agent 单 Agent 执行）
- 中等及以上 + 代码 ≥ 10 文件：完整 Gate 3 UltraReview（specpowers-review 的 5-agent 团队审查）

Gate 3 通过后进入 Phase 4。
```

- [ ] **Step 2: 更新 spec-compliance-check 节（L56-74）**

将"输出格式（逐条输出，不可省略）：`[PASS/FAIL]`" 改为：

```markdown
输出格式（逐条输出，不可省略）：
[COVERED/MISSING/DRIFT] Requirement: <title> — <evidence>

> 注：本协议的核心检查逻辑已注入为 specpowers-review 对齐审查 Agent 的 prompt 模板。
> 在 Gate 3 加强审查路径中由对齐 Agent 自动执行，不再由本技能手动执行。
> 微小任务模式下，本协议仍由本技能手动执行。
```

> **保留旧版执行流程（微小任务模式手动执行时使用）**：
> 1. 逐条读取 `specs/` 目录下所有 Requirement
> 2. 逐条在代码变更中检查是否有对应实现（函数/类型/配置/校验逻辑）
> 3. 输出对照表：`[COVERED/MISSING/DRIFT] Requirement: <title> — <evidence>`
> 4. COVERED → 标注对应代码位置（文件名 + 行号 + 关键符号名）；MISSING/DRIFT → 列出缺失的具体内容
> 5. 对照完成后，汇总所有 MISSING/DRIFT 项，按严重度分级（遗漏核心功能 = P0，遗漏辅助功能 = P1）
>
> 在 Gate 3 加强审查路径中，上述步骤 1-5 由 specpowers-review 的对齐 Agent 自动执行（主 Agent 在构造对齐 Agent 的 prompt 时注入此流程）。微小任务模式下，由本技能（specpowers-apply）手动执行。

- [ ] **Step 3: 更新"下一步"行（L74）**

将"下一步: 完成后加载 specpowers-review（如需 UltraReview，由入口 skill 二维矩阵判定）或 specpowers-archive"
改为"下一步: Gate 3 通过后加载 specpowers-archive（Phase 4 硬 Gate 链归档）"

---

### Task 5: 全文一致性校验

- [ ] **Step 1: 交叉引用检查**

用 grep 检查四个文件中：
- `specpowers-review` 引用是否指向正确的子技能名称
- Gate 编号（0/1/2/3/4）是否一致
- 术语是否统一（多模型渐进式 / UltraReview / 加强审查 / 最终通读 Gate）

- [ ] **Step 2: 最终通读**

按设计文档自身的最终通读 Gate 要求：独立子 Agent 通读四个修改后的文件全文，检查残余不一致。

- [ ] **Step 3: YAML frontmatter 验证**

检查四个文件的 YAML frontmatter：
- `name` 字段：仅含字母、数字、连字符
- `description` 字段：存在且非空
- 缩进一致（2 空格）
- 无 TAB 字符
- 三连破折号 `---` 正确闭合
