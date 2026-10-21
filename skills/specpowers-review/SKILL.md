---
name: specpowers-review
description: >-
  Use when code or document review is triggered in a specpowers workflow — when
  implementation is complete and needs quality gate, when design/spec/plan documents
  need review, when user says "review this" or "run UltraReview",
  "关键审查" / "完整审查", or when a specpowers Gate requires formal review
  before proceeding to next phase.
---

# specpowers-review: 审查阶段

> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-review")`；`Skill({skill: "specpowers-review"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-review"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-review"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`。**`<SKILL_BASE>` = 入口技能基目录**（入口技能即 `skills/specpowers/`）；从子技能加载时它是本技能目录的兄弟目录——注意 DSH 的资源提示给出的是**本技能**目录，两者不同，勿按该提示解析。

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取全局规则。等待加载完成后继续。
> 2. 确认审查对象（文档/代码）和变更范围（文件数）已知。如未知，向用户确认后继续。

## 术语说明

- **主 Agent**：本技能内部的协调者（调度子 Agent、合并结果、执行修复），区别于入口技能 specpowers 的 Agent；**用户**：人类开发者，负责审批修复方案。

## 审查决策树

审查类型由本 skill 内部按「对象类型 → recipe（对象类型×tier 对应的 Agent 编排与 STEP 集合，见下方 recipe 表；代码类完整层按 bucket 分叉子路径）」查找，自动判定，用户可手动覆盖。

```text
审查对象类型?
├── 文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）
│   └── 两级 tier 路由（关键/完整）→ recipe（见下方 recipe 表文档类行）
│       用户可手动指定"UltraReview"→ 完整层 3-agent 多模型渐进式审查（6-agent 维度 build/code/specs/docs/deps 仅代码类，文档类映射到 3-agent）。
│       文档类 UltraReview 不走 tier 路由，但仍须经护栏 1（ledger 缺失 early-return 完整，见 refs/routing.md 协议 6（护栏 1））
│
└── 代码类（实现代码 / 项目结构 / 构建配置 / 项目创建或变更）
    └── 两级 tier 路由（关键/完整）→ recipe（见下方 recipe 表代码类行，按 bucket 分叉）
        用户可手动指定审查层级："关键审查" / "完整审查"
```

**路由矩阵摘要**（完整定义见 `refs/routing.md` 协议 6）：

| 规模 × 轮数 | 第 1 轮 | 第 2 轮 | 第 3 轮+ |
|------------|--------|--------|---------|
| 微小 | 关键 | 关键 | 关键 |
| 中等 | 完整 | 关键★ | 关键★ |
| 复杂 | 完整 | 完整 | 完整 |
| 大规模 | 完整 | 完整 | 完整 |

> **规模分桶度量（按对象类型区分）**：代码类按 `file_count`（变更文件数，直接反映变更范围）——微小 1-3（`file_count=0` 归入微小，见 refs/markers.md 协议 3「独立调用场景自检」）/ 中等 4-19 / 复杂 20-49 / 大规模 50+。文档类按 `line_count`（审查对象总行数，行数与内容复杂度正相关）——微小 ≤100 / 中等 101-300 / 复杂 301-600 / 大规模 >600。文档类的 file_count 无区分度（Gate 0/2 始终 1 文件，Gate 1 通常 4-6 文件），改用 line_count 度量内容复杂度。**`line_count` 口径按对象类型固定、不得互换**：文档类＝**审查对象总行数**（`wc -l`）；代码类＝**修改总行数**（git diff）——同一字段两种度量（如 700 行 design.md 只改 20 行：总行数口径判大规模/完整层、修改行数口径判微小）不得由执行者自选，否则分桶不可复现。详见 refs/routing.md 协议 6 `bucket_doc` 函数（口径来源注记见 refs/markers.md 协议 3「独立调用场景自检」）。

★ 触发收敛闸门（完整算法见 refs/routing.md 协议 6）。两道硬护栏（ledger 缺失→完整、行数地板）+ 收敛闸门。收敛闸门：关键层（中等规模）若上轮 p0_raw>0 → 升级完整（阵容保守加强——闸门用 **raw 口径**：验证强度类判定统一取保守值，见「问题数口径权威定义」；闸门口径 p0_raw>0 比收敛触发条件①的 merged 口径 >1 更严，为有意设计：闸门在下一轮实际发生时才生效，含 P0 历史即加强阵容）。

**手动覆盖关键词**：当前轮用户输入含"关键审查"/"完整审查"→ 手动覆盖设定基础 tier（后续护栏/矩阵/地板/闸门在此基础上只升不降）。匹配范围为当前轮用户输入，不含历史轮次指令；排除否定语境。"UltraReview"→ 文档类映射到完整层 3-agent 多模型渐进式（6-agent 维度 build/code/specs/docs/deps 仅代码类），代码类走 6-agent UltraReview recipe（→ 完整层增强）。 "项目创建或变更"指涉及项目配置文件（package.json / Cargo.toml / go.mod / CMakeLists.txt / Makefile / pom.xml / docker-compose.yml 等）、构建脚本、目录结构调整的变更。判断标准：变更涉及项目基础设施层面（而非仅业务代码），即归入此类。

### recipe 表

审查 Agent 编排按 `(对象类型 × tier × bucket 分支)` 决定。代码类完整层按 bucket 分叉子路径。`bucket 分支` 仅在代码类完整层用于区分子路径（文档类不分子路径）。

| 对象类型 × tier | 完整 Full | 关键 Critical |
|----------------|----------|---------------|
| **文档类** | **文档3Agent**：结构+落地+对齐(3 Agent) [STEP1-5] | **文档2Agent**：对齐 Agent + 监督 Agent（=`supervisor1`，Step 1 普通独立审查 Agent，职责见下方 `supervisor1` 统一定义） [STEP1-5] |
| **代码类（微小/中等(4-9) bucket）** | **加强审查**：code-review（由 specpowers-apply 执行）+ 对齐单审 [STEP1-2] | **3 独立视角**：code-review（由 specpowers-apply 执行）+ 对齐 Agent + 监督 Agent（=`supervisor1`，Step 1 普通独立审查 Agent） [STEP1-5] |
| **代码类（中等(10-19)/复杂/大规模 bucket）** | **UltraReview**(6 Agent: build/code/specs/docs/deps/对齐) [STEP1-5] | 同代码类（微小/中等）关键 |

> bucket_class 映射（与 `refs/routing.md` 协议 6 对齐）：{微小, 中等且file_count<10}→小代码（加强审查 recipe）；{中等且file_count≥10, 复杂, 大规模}→大代码（UltraReview recipe）

> **STEP 集合记法约定**：本表 `[STEP1-5]`/`[STEP1-2]` **仅为编排说明的简写**；`[TIER_ROUTING]` 标记的 `expected_steps` 字段**必须写离散 STEP 列表，禁止区间记法**——如 `expected_steps=[STEP1, STEP2]`（文档2Agent / 加强审查）与 `expected_steps=[STEP1, STEP2, STEP3, STEP4, STEP5]`（全 STEP recipe）。父技能按单个 STEP 逐项匹配，无法机械展开区间记法。

> **STEP→阶段映射（所有 tier 共用）**：
> - STEP1 = 审查 Agent 并行执行（数量由 tier recipe 决定）
> - STEP2 = 主 Agent 合并去重判断（产出 `sources` 来源映射列 + 未纳入清单 → 合并后问题数 `p*_merged`（仅计已采纳行：`disposition ∈ {agent_accepted, user_adjudicated}`） / 未纳入数 `p*_rejected`；守恒等式自检通过方可进入 STEP3）
> - STEP3 = 合并验证（按 **raw 口径** N 部署【验证强度类判定取保守值，见「问题数口径权威定义」】：p0_raw≥3或N>15→独立Agent完整4维；N∈[1,15]且p0_raw≤2→转Step5兼并；N==0→trivial；加强审查子路径裁剪）
> - STEP4 = 修复 + 主 Agent 校验
> - STEP5 = Quick Review（加强审查子路径裁剪，并入 STEP2 主 Agent 合并判断）
>
> **完整层不对称（设计意图，非遗漏）**：代码类完整层按 bucket 分——微小/中等(4-9)=加强审查(STEP1-2，无监督，轻量路径，小变更无需监督即可控)；中等(10-19)/复杂/大规模=UltraReview(STEP1-5，含 6 维度审查)。关键层统一含监督（=`supervisor1`，Step 1 普通独立审查 Agent——统一定义见下方注），覆盖强度高于加强审查。
> **3 独立视角（代码类关键层）**= code-review（由 specpowers-apply 通过 `requesting-code-review` 执行，代码质量维度）+ 对齐 Agent（规范合规维度 COVERED/MISSING/DRIFT）+ **监督 Agent（`supervisor1`）**——**Step 1 的普通独立审查 Agent**：与另两个视角并行启动、互不感知，只对**审查对象**产出自己的 `supervisor1#k` 发现（计入 `Σp*_raw`，走 `sources: supervisor1#k`），视角定位为交叉验证另两个视角的原始报告（覆盖/遗漏/重复倾向——实际比对发生在 Step 2 合并阶段）。**「溯源检查 / 遗漏检测 / 合并合理性 / 判断充分性」四维全部归属 Step 3 部署的监督 Agent**（独立于 `supervisor1`，见 Step 2「编号空间隔离」），其部署形式按原始发现总数 N（raw_count_sum 口径——验证强度类判定统一取 raw 保守值，见「问题数口径权威定义」）动态决定——N∈[1,15] 且 p0_raw≤2 时合并验证（溯源+遗漏+守恒等式核对+误合抽查）转移至 Step 5 兼并执行，不启动独立 Agent（见 Step 3）。
>
> **`supervisor1` 统一定义（关键层 Step 1 监督审查 Agent）**：Step 1 **普通独立审查 Agent**——按 tier recipe 在 Step 1 并行启动、与其他视角互不感知，只对**审查对象**产出自己的 `supervisor1#k` 发现（计入 `Σp*_raw`，走 `sources: supervisor1#k`；编号空间见 Step 2「编号空间隔离」），视角定位为**交叉验证另两个视角的原始报告**（覆盖/遗漏/重复倾向）。代码类关键层的另两视角 = code-review + 对齐；**文档类关键层**（recipe 表「对齐 Agent + 监督 Agent」中的监督即此 `supervisor1`）的交叉验证对象为对齐 Agent 视角（文档类无 code-review），同样只对文档审查对象产出发现（如需求点覆盖核对、章节遗漏、术语矛盾——以文档语言表述）。四维监督（溯源/遗漏/合并合理性/判断充分性）不在 Step 1 部署——全部归属 Step 3 监督 Agent。
> **code-review 执行主体（代码类全 tier）**：apply 先执行 code-review（`requesting-code-review`），结果注入 review 的对齐 Agent prompt；review 对齐 Agent 输出 STEP1_EXECUTED（含 code-review 结果引用）。文档类无 code-review。
>
> **加强审查**= 代码类完整层微小/中等(file_count<10) bucket 专用 recipe（STEP1-2，无监督），详见下方"加强审查"节。
> **质量底线（每级强制）**：①对齐 COVERED/MISSING/DRIFT 不可省；②代码类必含 code-review（全 tier）；③P0 修复不可省；④最终通读 Gate 横切不可省略——加强审查子路径以主 Agent STEP2 合并去重判断+变更区域轻量通读作为最终通读的轻量替代，不可裁（替代声明在 STEP_FINAL_READTHROUGH 标记块 **`notes`** 中注明"轻量替代"——`status` 一律取通用枚举 complete|degraded|failed，通读结果由独立字段 `result: pass|fail` 表达，与协议 9 统一）；⑤层级裁剪声明块——格式见协议 6；⑥合并验证（溯源+遗漏）维度不可省——部署形式见 Step 3。
>
> 详细路由算法、层级裁剪声明块格式、典型场景示例见 `refs/routing.md` 协议 6。

## 全流程逐层审查 Gate

管道（线性，无分支）：Phase 0 clarifications → **Gate 0**（文档类）→ design → **Gate 1**（文档类）→ proposal/specs → **Gate 2**（文档类）→ plan → **Gate 3**（代码类，tier 路由）→ 代码 → **Gate 4**（归档 hard gate 链）。

| Gate | 触发时机 | 触发者 | 审查对象 | 对齐上游 |
|------|---------|--------|---------|---------|
| Gate 0 | Phase 0 用户审批通过后 | specpowers-design | design.md | clarifications/<name>.md |
| Gate 1 | Phase 1 用户审核通过后 | specpowers-design | proposal/design/specs/tasks | Phase 0 design + clarifications |
| Gate 2 | Phase 2 plan 生成后 | specpowers-plan | docs/superpowers/plans/<name>.md | Phase 1 specs + Phase 0 design |
| Gate 3 | Phase 3 代码实现完成后 | specpowers-apply | 代码变更 | plan + specs + design |
| Gate 4 | Phase 4 归档前 | specpowers-archive | 归档完整性 | — |

> **审查方式**：Gate 0-2 文档类 tier 路由（默认多模型渐进式）；Gate 3 代码类 tier 路由（recipe 按 bucket 分叉）；Gate 4 为现有 hard gate 链；每 Gate 修复完成后均执行最终通读。

**多文件 Gate（Gate 1）**：三 Agent 分别读取全部文件并输出合并报告；对齐 Agent 以 design.md 为主线逐条对照 clarifications；结构 Agent 检查四件套内部一致性；落地 Agent 检查每个文件独立可执行性（引用路径/命令/配置语法/平台差异）。关键层 2Agent 时上述职责并入对齐视角与 `supervisor1`。

**Gate 执行规则**：每个 Gate 不可跳过；存在 P0（见下方权威定义）→ 禁止进入下一 Phase；P1/P2 记录后放行；问题清单写入会话上下文账本（`refs/ledger.md` 协议 1）；不再写 .review 文件产物；跨会话教训从 .specpowers/review-cache.json 读取（尽力而为缓存）；每 Gate 完成后必须输出 `[CONVERGENCE_CHECK]`。**审查修改与审批**：结构性修改（改变设计意图/架构/接口/数据模型/核心流程）需重新审批；澄清性修改（歧义/遗漏/措辞/格式）免二次审批但由主 Agent 确认；P0 无论类型均须先经用户确认。**代码类 Gate 3** = apply 的 code-review（无 P0 通过）+ review 按 tier recipe 审查（无 P0 级 MISSING/DRIFT 通过），两者均过方可进入 Phase 4。


### P0 阻塞规则（权威定义）

> 本节为 P0 阻塞判定的**全文档唯一权威来源**，作用于**所有对象类型、所有 tier、所有 Gate**（普适规则，非 UltraReview 专属——原寄居于「UltraReview + 对齐审查」节的定义已移入本节，原位置留有指针）。

- **P0 阻塞规则（权威定义，全文档唯一权威来源）**: P0 > 0（修复后剩余）→ Gate 未通过，禁止进入下一 Phase；P0 必须全部修复且通过重审方可放行（重审载体：触发条件①/⑤引起的下一轮完整审查，或 `p0_raw∈[1,2]` **且 N∈[1,15]**（transferred 档位）单轮收敛时的 Step 5 严重度校准抽查——见 Step 5 兼并模式第 5 项；**mode=standard 时（`p0_raw≥3` 或 `N>15`）由独立监督 Agent 的第④维（判断充分性 + 严重度校准）承担**；此处用 raw 口径保守判定，见「问题数口径权威定义」）。P1/P2/P3 不阻塞 Gate 通过。其余各处 P0 阻塞引用均以此处为准（修复范围见下方"Gate 通过标准 vs 修复范围"）。

> **Gate 通过标准 vs 修复范围**: 以上为 Gate 通过标准（阻塞判定——什么情况下 Gate 不通过）。修复阶段的修复范围见 Step 4 "修复策略"（或 UltraReview Step F——两路径**共享同一修复策略**（默认全量修复 P0-P3），但**不共享审批范围**：UltraReview Step E 为整表逐条审批（P0-P3），通用路径 Step 4 前置 Gate 默认仅 P0 逐条确认，见「UltraReview + 对齐审查」节 A-F→STEP 映射注与协议 8 Step E；A-F 协议见 `refs/ultrareview.md` 协议 8）——默认全量修复 P0-P3，不受此阻塞标准限制。例如：P2/P3 "不阻塞 Gate 通过" 意味着即使有未修复的 P2/P3 也可以进入下一 Phase，但修复阶段仍默认修复它们（用户可显式跳过）。

---

## 审查层级边界（文档类防漂移）

> 以下边界表横切所有文档类审查（不分 tier），代码类 Gate 3 不受此边界限制。

> **两层边界原则**: **探索分析不受限**（可深入代码/API 验证设计决策，深层分析是发现深层问题的前提）；**产物评论受限制**（输出必须用当前层级语言——"接口设计与平台约束不兼容，需重新评估"，而非"应改用某 API"）。

| 审查对象 | Gate | 审查范围（应关注） | 评论边界（审查输出不应越界到…） |
|---------|------|-----------------|---------------------------|
| **design.md** | Gate 0 | 架构合理性、组件划分、数据流设计、接口设计、错误处理策略、测试策略 | ❌ 具体代码实现方式、代码风格、变量命名、API 具体参数格式 |
| **proposal.md** | Gate 1 | 动机清晰性、范围完整性、排除范围明确性 | ❌ 实现方案（属于 design.md 范围） |
| **specs/** | Gate 1 | Requirement 覆盖完整性、场景可测试性、SHALL/MUST 规范性 | ❌ 实现方式（属于 code 范围） |
| **tasks.md** | Gate 1 | 任务拆解合理性、依赖关系完整性、可执行性（粒度适中/描述清晰/状态明确） | ❌ 具体代码实现细节、代码优化建议（参照 plan 行） |
| **`docs/superpowers/plans/<name>.md`** | Gate 2 | 任务拆解合理性、TDD 步骤完整性、依赖关系正确性、实现策略可行性 | ❌ 具体代码写法、函数实现细节、代码优化建议 |
| **代码变更** | Gate 3 | 代码正确性、spec 合规性、构建/依赖/文档一致性 | 无（代码级审查允许评论实现细节） |

> **通用原则**: 用代码层面的知识做分析，用设计/规划层面的语言写评论。审查意见应表述为"某个设计决策可能存在问题，因为…（深层分析结论）"，而非"应该这样写代码"。评论边界过窄则遗漏深层问题，过宽则输出对当前 Phase 无价值的实现建议。

## UltraReview + 对齐审查（代码类 recipe，中等(10-19)/复杂/大规模 bucket 完整层）

**适用条件**：代码类完整层且文件数 ≥10，由 tier 路由自动判定（见 recipe 表）。文档类手动指定 UltraReview 时映射到完整层 3-agent 多模型渐进式（6 维仅代码类）。

6-agent 团队定义（build/code/specs/docs/deps/对齐）与 Steps A-F 详见 `refs/ultrareview.md` 协议 8——路由到本 recipe 时必须先读。**STEP 映射**：A-B→STEP1、C-D→STEP2、D'=通用 Step 3 插入点、E=用户审批（**整表 P0-P3 逐条**，区别于通用路径仅 P0）、F→STEP4；STEP5 由通用流程覆盖。标记块体系不变，`STEP1_EXECUTED` 的 agents 含 6 维。


### 审查规则

- 只读不写：所有审查 Agent 仅输出审查报告，不修改任何文件
- P0（必须修复）：阻塞性问题——接口不匹配、数据丢失风险、安全漏洞、spec 严重偏离
- P1（不阻塞 Gate 通过）：重要问题——性能退化、代码异味、文档过时、错误处理缺失
- P2（记录待办）：改进建议——重构机会、可读性优化、测试覆盖增强
- P3（记录待办）：风格问题——命名规范、格式一致性、注释完善
- **P0 阻塞**：权威定义见〈**P0 阻塞规则（权威定义）**〉节（上方「Gate 执行规则」之后——全 tier/全对象类型通用，非本节专属）；本节的 P0-P3 分级定义（严重度语义）不变

## 加强审查（代码类 recipe，微小/中等(file_count<10) bucket 完整层）

**适用条件**：代码类完整层 + 微小/中等(file_count<10) bucket（文件数 ≤ 9），由 tier 路由自动判定（见上方 recipe 表）。不启动 6-agent 团队，由 specpowers-review 构造对齐 Agent 单审：

1. **specpowers-apply 内部 code-review**：通过标准为无 P0 问题
2. **specpowers-review 对齐 Agent 单审**：注入 spec-compliance-check（OPENSpec 逐条对照，输出 COVERED/MISSING/DRIFT），通过标准为无 MISSING 或 DRIFT 标记为 P0 的项

两者均通过方可进入 Phase 4。

**P0 修复机制**：本路径裁剪独立修复子 Agent（STEP4_TIER_SKIPPED）；P0 须先经用户逐条确认（问题判定 + 修复方案），确认后由**主 Agent 内联修复**，修复后重跑对齐检查直到 P0 清零。循环上限 3 轮，超限标注「修复失败」提请用户裁决。**本子路径不接受「用户拒绝 P0」**——用户拒绝即转 mode=standard 完整层（见下表）。

> **P1/P2/P3 修复策略**：默认全量修复，执行主体为主 Agent 内联（无 STEP4 标记块）；不阻塞 Gate。

#### 加强审查例外表（完整叙述见 refs/routing.md「细则 F」）

| 触发 | 动作 | 输出标记 |
|---|---|---|
| 默认轮（无 `[拒绝异常]`） | 内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token；收敛按 **raw** 口径 | STEP3/4/5_TIER_SKIPPED |
| `[拒绝异常]` 且 N>0 | 不裁剪 Step 3：独立监督完整 4 维（拒绝理由由第④维复核）；Step 4/5 仍裁剪；`[补充否决异常]` 改为 Step 3 复议留痕（写入 notes 与 `[CONVERGENCE_CHECK]` 的 notes），不注入 Step 5 字段组 | STEP3_EXECUTED（**不输出** STEP3_TIER_SKIPPED） |
| `[拒绝异常]` 且 N==0 | 不启动 Step 3；例外启动独立 Step 5 复核拒绝理由与守恒等式 | STEP5_EXECUTED（**不输出** STEP5_TIER_SKIPPED） |
| 用户拒绝某项 P0 | 放弃子路径，升级完整层：Step 3/4/5 全执行；报告声明「用户拒绝 P0，加强审查子路径升级完整层」（`[TIER_ROUTING]` 不重出） | STEP3/4/5_EXECUTED（不输出 TIER_SKIPPED） |

**执行顺序（写死）**：`STEP2 合并 → [例外 Step 3] → 内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token`；轻量通读的 PASS 条件 (a)「所有已确认修复均已正确应用」（`refs/convergence.md` 协议 9）要求修复先行。

**收敛判定（按分支锚定）**：① 默认轮在**轻量通读完成后**输出 `[CONVERGENCE_CHECK]`（raw 口径）；② 有 Step 3 的轮在**口径冻结后**输出（同标准路径）；③ N==0 例外在独立 Step 5 复核输出后。

---

## 多模型渐进式审查（文档类 recipe，3 Agent）

**适用对象**：所有文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）。

| Agent | 关注点 | 模型建议 |
|-------|--------|---------|
| **结构审查 Agent** | 完整性/冗余/一致性/结构合理性 | 强推理模型 |
| **落地审查 Agent** | 可执行性/兼容性/边界/平台差异 | 快速模型 |
| **对齐审查 Agent** | 对齐原始需求/设计；错漏项检测；模糊歧义识别 | 与前两者不同模型 |

**模型多样性**：三 Agent 用不同模型以最大化视角差异（品牌取决于环境，按能力等级匹配；支持子 Agent 的环境优先分配不同模型，平台对照见 `<SKILL_BASE>/refs/platform-tools.md`）。单一/双模型降级细则见 `refs/dispatch.md` 协议 4。对齐 Agent 的检查维度、对照方法与 COVERED/MISSING/DRIFT 语义见 `refs/dispatch.md` 细则 E。

---


## 问题数口径权威定义（全文档唯一权威来源）

> 本节是全文档问题数口径的**唯一权威来源**。Step 1-5、「收敛判定与硬阻止机制」节、Gate Token 与各 refs 文件（ledger/markers/dispatch/routing/convergence/ultrareview）的计数引用均以本节为准。一个数只有一种口径、一种用途——**禁止跨口径替代**（用修复后剩余数算收敛触发、用合并后数决定验证强度，都是错误用法）。

| 口径 | 符号 | 产出 | 含义 |
|------|------|------|------|
| **原始发现数** | `p0_raw`~`p3_raw` | Step 1（各审查 Agent 的 `RAW_COUNT` 求和） | **去重前**的全部发现，含多 Agent 重复报告与噪声，**在不含监督补充、未经用户裁决升级严重度、且未发生书面降级时，总量必然 ≥ 合并后数（逐级比较不保证）** |
| **合并后问题数** | `p0_merged`~`p3_merged` | Step 2（合并判断表行数；Step 3 结束后冻结终值） | 去重 + 去噪后的真实问题数：合并判断表**行**均为已采纳项（`disposition ∈ {agent_accepted, user_adjudicated}`） |
| **未纳入数** | `p0_rejected`~`p3_rejected` | Step 2（未纳入清单条数） | **不进入**合并判断表的发现：`disposition ∈ {agent_rejected, user_rejected}` 的项——含来源于 Step 1 原始发现的拒绝与被否决的监督发现型补充（`sup3#`，见下行）。判为重复而被合并行吸收的项**不计入**（它们已由该行的 `sources` 列承载）。**`[拒绝异常]` 分子仅计其中来源于原始发现（计入 `Σp*_raw`）的被拒项**；被否决 `sup3` 项不占分子（由 `[补充否决异常]` 单独承接） |
| **监督补充数** | `p0_supplement`~`p3_supplement` | Step 3（监督 Agent 的 `[补充]` 项中**被记账**的条数） | 监督 Agent 交叉验证时**新增**的、Step 1 各审查 Agent 未报告的发现。**`p*_supplement` = 监督 `[补充]` 项中被记账的条数**，两类计入：① **发现型**——作为新发现采纳（以 `sources: sup3#<编号>` 记入合并表并计入 `p*_merged`）或被否决（登记入未纳入清单并计入 `p*_rejected`；**不计入 `[拒绝异常]` 分子**——分子仅计计入 `Σp*_raw` 的被拒项，`sup3` 否决由 `[补充否决异常]` 单独承接）；② **更正型**（不新增发现、也不构成拒绝，如删除无效引用、修订行描述）——**记入审计说明，不计入 `p*_supplement`**（它不产生 `sup3#` 编号条目） |
| **修复后剩余数** | `p0`/`p1`/`p2` | Step 5（**加强审查子路径为轻量通读 + 收敛判定后**） | 修复完成后仍存在（或未修复）的问题数；**用户豁免的 P0（Step 4 前置 Gate，记 `user_exempt_p0`）不计入此数**（用户已裁决为非问题/跳过） |

**守恒等式（Step 2 强制自检，Step 3/Step 5 强制核对）**：

```
Σ(所有行的 sources 条数) + Σp*_rejected == Σp*_raw + Σp*_supplement
```

> **口径边界**：`Σp*_raw` 仅含 Step 1 各审查 Agent 报告的发现（其 `RAW_COUNT` 求和），**不含**监督补充项（`sup3#` 只出现在 `p*_supplement` 与 `sources` 的补充条目中，绝不计入 `raw`）。
即**每条原始发现都必须有去向**——要么被某个合并行的 `sources` 列收录，要么进未纳入清单并写明原因。这条等式是"合并后问题数"可信的唯一依据：它把合并从主 Agent 的自由裁量变成**可算术校验的导出量**。等式不成立 → 合并表不完整 → **一律标记 `[问题数存疑]`**（Step 2/3/5 同名同义）→ 禁止进入 Step 3。**分级漂移不由等式负责**——等式只校验总量守恒；严重度降级/升级由 Step 5 的严重度校准抽查（第 5 项）拦截。Step 2 自检时监督尚未运行，`Σp*_supplement=0`；Step 3 完成后若监督有 `[补充]` 项，按含该项的完整等式复核。**`p*_supplement` = 监督 `[补充]` 项中被记账的条数**，两类计入：① **发现型**——作为新发现采纳（以 `sources: sup3#<编号>` 记入合并表并计入 `p*_merged`）或被否决（登记入未纳入清单并计入 `p*_rejected`）；② **更正型**（不新增发现、也不构成拒绝，如删除无效引用、修订行描述）——**记入审计说明，不计入 `p*_supplement`**（它不产生 `sup3#` 编号条目）。等式右侧的 `Σp*_supplement` 只含"两类去向各有承载"的**发现型**补充——采纳者入合并行 `sources`、被否决者入未纳入清单，主 Agent 否决补充项不会破坏等式平衡；**更正型不进 `sources` 也不进未纳入清单，不参与等式**（若计入会使等式右侧凭空多算、造成假失败）。

> **行与清单互斥**：每条原始发现只能出现在一处——要么被某个合并行的 `sources` 列收录（该行必为已采纳行），要么进入未纳入清单（计入 `p*_rejected`）。**被拒绝项不构成合并判断表行**；`disposition` 的取值 `agent_rejected` / `user_rejected` 仅用于**未纳入清单的标注**，不出现为表行。合并表行数即 `p*_merged` 的唯一来源，未纳入清单条数即 `p*_rejected` 的唯一来源。（特例：`判断` 列标注「用户拒绝（计数保留）」的行，视为**已采纳行**参与计数——见 Step 4 记账规则。）

**口径分配表（哪个判定用哪个数）**：

| 判定 / 用途 | 口径 | 理由 |
|------------|------|------|
| **收敛触发条件 ①–⑤**（是否再跑一轮） | **merged** | 重复计数会凭空顶到阈值、白跑一整轮（一轮 = Step1 全 Agent + Step3 + Step4 + Step5，是本流程最贵的一项成本）——这是口径分离要解决的核心问题 |
| **Step 3 部署形式**（独立监督 / 转移 Step 5 / trivial） | **raw** | 验证强度类判定一律取保守值。且 merged 由主 Agent 自己合并得出——若用它决定"要不要请独立监督"，过度合并（误合）即可逃逸掉唯一能查"误合"的监督第③维，构成循环漏洞 |
| **tier 收敛闸门**（上轮含 P0 → 关键升完整） | **raw** | 同上：阵容加强取保守值（闸门 `p0_raw>0` 比触发条件①的 merged 口径更严，为有意设计） |
| **加强审查子路径的收敛触发**（recipe=[STEP1-2]） | **raw** | 该子路径 STEP3/4/5 全裁，**没有任何独立验证者**复核合并表（**`[拒绝异常]` 子分支除外**——N>0 有例外 Step 3 独立监督、N==0 有例外独立 Step 5，该分支合并表有独立复核）→ merged 无人审计。此处保留 raw **不构成额外防护**（`RAW_COUNT` 仍是主 Agent 自报），只是选择一个**不依赖合并表**的保守默认口径；该路径的真实防护来源是**守恒等式自检（锚点为"通过方可输出 `[CONVERGENCE_CHECK]`"，不通过一律标记 `[问题数存疑]`"）+ 最终通读的轻量替代** |
| **P0 阻塞判定** | 修复后剩余 `p0` | 阻塞看的是"修没修完"，与发现数无关（权威定义见「P0 阻塞规则（权威定义）」节） |
| **Step 5 严重度校准/拒绝理由抽查的触发条件** | raw + 清单计数的混合面（`p0_raw` / `p0_rejected` / `agent_rejected` / `user_rejected`） | 被拒项是压低合并口径的唯一直接通道，触发面须覆盖其最宽范围（任一轴非零即复核）。**各档实际载体**（独立 bullet，见 Step 5）：mode=standard（`p0_raw≥3` 或 `N>15`，含 `[拒绝异常]` 强制）→ **Step 3 监督第④维承担**；transferred/trivial（含 `[拒绝异常]` N==0 独立 Step 5）→ **Step 5 第 5 项执行**；加强审查子路径未被 `[拒绝异常]`/N==0 例外覆盖时**无载体**——已知残留（见 ③）。**跨阈值严重度降级不由该触发面负责——由第 4 项误合抽查的恒查部分承载**（兼并模式下无论触发面四轴是否为零都执行降级理由存在性核对，见 Step 5 第 4 项与协议 5） |
| **`[拒绝异常]` 判定** | 分子 `agent_rejected + user_rejected`（**仅计未纳入清单中计入 `Σp*_raw` 的被拒项**——被否决 `sup3` 项不占分子，由 `[补充否决异常]` 单独承接）；分母 `Σp*_raw`（四项合计，含 `p3_raw`） | 分子分母同锚 raw 口径（占比不会 >100%）；拒绝审计基线不随判定口径变化；分母含 p3 以反映"全部原始发现"的规模 |
| **账本 / `[CONVERGENCE_CHECK]` / `[GATE_PASSED]` / 用户提示** | **四个统计口径都记录**（`p*_raw` / `p*_merged` / `p*_rejected` / `p*_supplement`）；Step 4 前置 Gate 的用户豁免 P0 数以独立字段 **`user_exempt_p0`** 单列（`rejected = agent_rejected + user_rejected`，**不含**豁免数；`user_rejected` 仅保留「Step 2 未纳入清单中的用户裁决拒绝数」语义） | 审计需要 raw（基线）与 merged（判定）同时可见，否则无法分辨"真的问题少"与"被合并/拒绝压下去的"；supplement 也须可见，否则无法分辨"监督补了多少"；豁免数单列避免覆盖 Step 2 清单拒绝数、保证 `rejected` 自洽 |

> **⚠️ 反偷懒硬约束（merged 排除被拒项的代价与补偿）**：合并后问题数排除了被拒绝项，因此"多拒绝几条"就能直接压低收敛判定口径。补偿机制有三（①② + ④ 分母不可得时代触发），残余风险显式声明（③）：
> ① **逐条书面理由**——每条 `agent_rejected` / `user_rejected` 必须写明具体事实依据（禁止模板化措辞、禁止批量拒绝）；
> ② **[拒绝异常] 强制升级**——未纳入清单中**计入 `Σp*_raw` 的**被拒项（`agent_rejected` 与 `user_rejected`）合计 > 3 条，或占 `Σp*_raw` 比例 > 30% 时标记 `[拒绝异常]`（被否决的监督 `sup3` 项不在 `Σp*_raw` 内、不占分子——由 `[补充否决异常]` 单独承接；其中 `user_rejected` 部分仅核验「用户裁决记录是否存在且理由已如实记录」，不质疑用户判断），**无视合并后档位强制补独立 Step 3（mode=standard）交叉验证**（覆盖规则见 Step 3）。压低口径 ≠ 可以绕过独立验证。
> ③ **已知残余风险**：未达阈值的 1–3 条「有书面理由」的拒绝，其理由成立性由 Step 5 第 5 项严重度校准抽查复核——该复核**仅在 `p0_raw≥1` 或 `p0_rejected≥1` 或 `agent_rejected≥1` 或 `user_rejected≥1` 时执行，且覆盖全部严重度的被拒项**；**加强审查子路径（recipe=[STEP1-2]）无此复核**——该区间不保证独立验证，接受此残余风险以换取**该轻量子路径（STEP3/4/5 全裁）的成本设计**——注意区别于 transferred 档位：`mode=transferred_to_step5` **有** Step 5 第 5 项复核，不在本残余风险区间内。**trivial 档位的例外**：`N==0` 且未纳入清单存在被拒项（`agent_rejected + user_rejected ≥ 1`）时，Step 5 **必须由独立 Quick Review Agent** 复核拒绝理由与守恒等式（不输出零问题自执行块）；该档位的**误合风险**由最终通读的轻量替代承担（无独立复核，属已知残留）——trivial 档位与加强审查子路径在此并列增列。
> ④ **分母不可得时**：`Σp*_raw` 无法计算（如原始报告被截断）→ 占比判据失效，**视同 `[拒绝异常]` 处理**：以「`agent_rejected` 与 `user_rejected` 合计 ≥ 1」**代触发**强制独立 Step 3（mode=standard）复核拒绝理由，并在报告中标注分母不可得。同时 `N` 与 `Σp*_raw` 同源、亦不可得 ⇒ 档位判定（standard/transferred/trivial）无定义——**无论被拒项是否 ≥1（被拒项=0 时代触发不兜底），一律保守回退 mode=standard**；守恒等式核对按协议 5「截断策略」降级为抽样比对 + 显式记录抽样范围，并输出 `[DEGRADED]`。

> **常见合理化对照**：「多拒绝几条就能压低问题数」见 ①②④；「按原始条数更保险」见口径分配表。二者均不构成放行理由。

---

## 审查流程（全 tier 通用）

### Step 0 — 审查准备与路由

> 注：本节（Step 0-5）适用于所有 tier（关键/完整）和所有对象类型（文档/代码），不仅限于多模型渐进式。

主 Agent 执行以下准备步骤：

**0a. 收集审查经验**：从本会话前序 Gate 报告、用户偏好与纠正、通用最佳实践、`.specpowers/review-cache.json`（跨会话）与会话上下文账本（会话内）收集教训，注入审查 Agent prompt；新教训每轮追加，Gate 退出时写回缓存。

**0b. 注入审查层级边界**

按当前 Gate 的审查对象类型，从上方「审查层级边界」表取对应行，把「审查范围 + 评论边界 + 两层边界规则」追加到每个审查 Agent 的 prompt 末尾。Gate→行映射与注入模板见 `refs/dispatch.md` 细则 E。


**0c-pre. 解析调用参数（args）**

父技能（specpowers-apply/design/plan）调用 specpowers-review 时通过 `args` 传递参数。主 Agent 从 args 提取：`gate_id`（Gate 0-3 / standalone）、`file_count`（待审查文件数）、`line_count`（**口径按对象类型固定**：文档类＝审查对象总行数 `wc -l`；代码类＝修改总行数 git diff——与协议 6 `bucket_doc` 及协议 3「独立调用场景自检」一致，父技能按同一口径传入）、code-review 结果（代码类 Gate 3 由 apply 注入，作为对齐 Agent 的代码质量维度输入）。这些值用于下方 0c gate_id 确定 + 0d tier 路由（file_count/line_count 是路由算法输入）。无 args 时（独立调用）由主 Agent 自行计算 file_count/line_count（files + lines 一次性输出算法、空 diff 回退与 file_count=0 的分桶归属，见 `refs/markers.md` 协议 3「独立调用场景自检」）。

**0c. 确定 gate_id（轮次隔离）**

按当前触发的 Gate 确定 gate_id（优先 args）：Gate 0→`gate_0`、1→`gate_1`、2→`gate_2`、3→`gate_3`、独立调用→`standalone`。round 基于该 gate_id 的 rounds 独立计数；⚠️ 禁止跨 Gate 复用同一 gate_id（会导致轮次累加、路由错误降级）。

**0d. 执行 tier 路由**

按 `refs/routing.md` 协议 6 执行路由，并在审查报告开头输出：

```
[TIER_ROUTING] tier=<critical|full>, round=<N>, file_count=<N>, bucket=<微小|中等|复杂|大规模>, line_count=<N>, floor=<tier>, convergence=<passed|failed|n/a>, recipe=<加强审查|UltraReview|3视角|文档3Agent|文档2Agent>, reason=<路由路径简述>, expected_steps=[...]
```

`expected_steps` 由 recipe 决定，**必须写离散 STEP 列表**（禁区间记法）：`[STEP1, STEP2]`（加强审查）、`[STEP1, STEP2, STEP3, STEP4, STEP5]`（全 STEP）。注意 `文档2Agent` 属**全 STEP**（recipe 表标 `[STEP1-5]`，关键层 Step 5 同样强制），不得写成两步。
> expected_steps 仅含 tier recipe 的 STEP（STEP1-5）；STEP_FINAL_READTHROUGH 为横切 Gate，独立于 expected_steps 检查（父技能**不**跨边界验证此横切 Gate；由 review 内部主 Agent 自执行 + 独立调用场景 [SELF_VERIFY] 兜底，自检细则见 `refs/markers.md` 协议 3「独立调用场景自检」）。

> 在启动审查 Agent 前，主 Agent 先完成以下自检——以下列出的每一项合理化都是实际审查中观察到的 Agent 跳过模式。

### 审查纪律自检

#### 合理化表

| 如果你在想… | 为什么这是陷阱 | 正确做法 |
|------------|---------------|---------|
| "三个 Agent 结论一致 → 不需要监督验证" | 一致可能是共识偏见而非正确。监督 Agent 常见在合并判断表中发现审查 Agent 未注意到的遗漏 | Step 3 强制执行，无论 Agent 间结论是否一致 |
| "问题少 → 完全跳过合并验证" | 合并验证的溯源+遗漏维度无论问题多少都须执行——问题少（N∈[1,15] 且 p0_raw≤2，raw 口径）只意味着可由 Step 5 兼并（不启动独立 Agent），不意味着可省略维度；且"问题少"是主 Agent 自统计，压低问题数或把 P0 降级 P1/P3 逃避独立监督是已知偷懒模式（Step 1 RAW_COUNT + 合并表 `sources` 守恒等式核对 + [拒绝异常] 强制升级 + p0_raw≥1 或 p0_rejected≥1 或 agent_rejected≥1 或 user_rejected≥1 时严重度校准抽查，四层捕获） | N∈[1,15] 且 p0_raw≤2：合并验证转移到 Step 5（mode=transferred_to_step5，省独立 Agent 不省维度：溯源+遗漏+守恒等式核对+误合抽查）；p0_raw≥3 或 N>15：独立监督完整 4 维 |
| "这轮只是小修复，不需要 Quick Review" | 修复引入新问题是已知模式——"修复→引入问题→遗漏修复"是多轮审查中最常见的失败路径 | Step 5 强制执行，无论修复规模 |
| "用户会发现剩余问题" | 用户审查是后续环节——Gate 审查阶段跳过的偏差在下游 Phase 逐层放大 | 每个 Gate 独立完成全部审查步骤 |
| "退化声明太复杂，跳过" | 无退化声明 → 父技能按标记块缺失处理 → 阻塞 Phase。退化声明的存在性比措辞完美更重要 | 至少输出 (a) 缺失了什么能力 (b) 尝试过什么 |
| "零问题 → 不需要标记块" | 父技能将标记块缺失解释为"Step 未执行"（而非"Step 完成且无问题"）| `issues_found: 0` 的标记块同样必须输出 |
| "Step 3 和 Step 4 可以同时启动以节省时间" | Step 4 修复 prompt 依赖 Step 3 审核报告调整后的最终合并判断表。并行执行 = 修复 Agent 拿到过期数据 | Step 4 必须在 Step 3 完成且主 Agent 已更新合并判断表后启动 |
| "[多轮] 问题已修复，本轮剩余问题很少 → 不需要下一轮" | 阈值判断依据是**本轮合并后问题数**（p0_merged/p1_merged/p2_merged/p3_merged，Step 2 合并判断表口径），既不是修复后剩余数，也不是未去重的原始发现数。合并后问题数大说明本轮变更面广、风险高 | 从账本读取 `p*_merged` 字段计算触发条件，禁止用修复后剩余数（p0/p1/p2）替代；也禁止用未去重的 p*_raw 替代——多 Agent 重复报告会凭空顶到阈值、白跑一整轮（raw 仅作审计基线）（**加强审查子路径例外**：该路径按 raw 口径触发——账本轮次条目记 `caliber=raw`，供下一轮⑤判定口径，见「问题数口径权威定义」） |
| "[新口径] 这些发现多是噪声/重复，我合并时多拒绝几条 → 问题数就下来了 → 不用下一轮" | 合并后问题数排除了被拒绝项，"多拒绝"确实能压低收敛判定——这是该口径的**已知代价**，因此配了两道补偿机制（逐条书面理由 + [拒绝异常] 强制独立验证） | 每条拒绝必须写明具体事实依据（禁批量拒绝、禁模板化措辞）；未纳入清单中**计入 `Σp*_raw` 的**被拒项（`agent_rejected` 与 `user_rejected`）合计 > 3 条，或占 `Σp*_raw` > 30%（被否决 `sup3` 项不占分子，由 `[补充否决异常]` 承接）→ 标记 `[拒绝异常]`（`user_rejected` 部分仅核验用户裁决记录的存在性，不质疑用户判断），**无视档位强制补独立 Step 3（mode=standard）**。压低口径 ≠ 绕过独立验证 |
| "tier 路由降级了，顺便多裁一点" | 搭便车偷懒——tier 路由只裁剪指定 STEP，裁剪超出 recipe 声明范围将导致审查覆盖不足 | 裁剪范围 = recipe 声明的 expected_steps。超出声明范围的裁剪 = 偷懒，按违规处理 |

#### 自检清单

**每轮（每个 Step 完成后逐条核对）**

```
□ Step 1: recipe 声明的全部审查 Agent 都启动了？（数量按 tier recipe：文档3Agent=3 / 文档2Agent=2 / 3视角=3（含 apply 侧 code-review）/ 加强审查=2 / UltraReview=6）任一未完成 → 不可标 complete，不可进入 Step 2
□ Step 2: 每条问题写了具体原因（非模板化措辞）？→ 有模板化措辞 → 重写
□ Step 2: 合并判断表含 `sources` 来源映射列 + 未纳入清单？守恒等式 Σ(所有行的 sources 条数) + Σp*_rejected == Σp*_raw + Σp*_supplement 成立（Step 2 时 Σp*_supplement=0）？→ 不成立 → 标记 [问题数存疑]，补齐后重新自检，不可进入 Step 3
□ Step 2: 拒绝项均写明具体事实依据？计入 Σp*_raw 的被拒项（agent_rejected 与 user_rejected，不含被否决 sup3 项）合计 > 3 条或占 Σp*_raw > 30%？→ 是 → 标记 [拒绝异常] 并强制补独立 Step 3（无视档位）
□ Step 3: 满足下列任一形式？→ 都不满足 → 不可进入 Step 4：(a) p0_raw≥3 或 N>15【raw 口径】→ 独立监督 Agent 输出了报告（mode=standard）；(b) N∈[1,15] 且 p0_raw≤2【raw 口径】→ 主 Agent 输出了 STEP3_EXECUTED（mode=transferred_to_step5）；(c) N==0 → 主 Agent 输出了 mode=trivial；(d) **任意档位**触发 `[拒绝异常]` → 独立监督 Agent 输出 mode=standard（**N==0 时为独立 Step 5 复核**，见 Step 3 覆盖规则）——(b)(c) 在触发 `[拒绝异常]` 时**失效**
□ Step 4: 所有 P0 修复均已逐条校验？→ 不清楚 → 先校验
□ Step 5: Quick Review Agent 非 Step 4 实施者？→ 是同一 Agent → 退化声明
□ 最终通读: 全文术语一致？无废弃引用？→ 不确定 → 全文 grep 验证（详见 Step 4 逐条校验）
□ 本轮判定过测试/命令结果？→ 必须核查原始输出（非摘要代理输出）——摘要工具（如 rtk）可能吞掉尾部 `, N errors`/`FAILED` 后缀；输出尾部含 `N errors`/`FAILED` 或非零退出码即视为失败，不确定时用原始命令重跑或读完整输出文件
□ 本轮有退化场景？→ 有 → 退化声明含三要素（缺失能力|尝试记录|降级依据）且 status 非 complete？
□ 本轮是第 ≥2 轮审查？→ 主 Agent 是否已完成下方「第≥2轮追加」自检，且报告含 `[ANTI_LAZINESS_SELF_CHECK] round=<N>, passed=true`？
□ 审查 Agent 的报告覆盖了全部章节/文件？→ 执行下方违规检测——逐章/逐文件核对，不可粗略估计
```

**第 ≥2 轮追加（主 Agent 在调度子 Agent 前执行）**

> 本组针对**主 Agent 自身**：子 Agent 每次启动拥有干净上下文，真正会偷懒的是已完成多轮审查、上下文已腐化的主 Agent。**核心原则**：每一轮都是独立完整的审查——不以轮次为由缩减审查范围，不以"已审过"为由跳过章节，不以"快收敛了"为由加速流程。

1. 确定当前轮次编号 N（取会话上下文账本中**非 aborted** 轮次的数量 + 1——与 `refs/routing.md` 协议 6 的 `effective` 定义一致；`rounds` 数组中被中止的轮次不计入已完成轮次。此处 N 为轮次编号，区别于 Step 3 的问题总数 N——同名不同义）
2. 打印自检提醒并逐条确认：

> ⚠️ **主 Agent 自检提醒 — 第 <N> 轮**
>
> 这是我执行的第 <N> 轮审查。逐项核对上方合理化表左列——确认自己当前没有匹配任何偷懒合理化模式。特别警惕：
> - 以轮次为由缩减范围（"这是第N轮审查…"）
> - 以收敛为由加速流程（"尽快进入收敛状态…"）
> - 以上下文为由跳过步骤（"上下文太长了…"）
>
> 如匹配任一行 → 立即按右列纠正。每个 Step 独立完整执行。

3. 逐项核对上方「合理化表」左列
4. 逐项核对本清单「每轮」组
5. 子 Agent prompt 含 Step 1 完整性指令？→ 不含 → 补注后启动
6. 自检完成后在审查报告中记录：`[ANTI_LAZINESS_SELF_CHECK] round=<N>, passed=true`

**违规检测（主 Agent 检查子 Agent 报告完整性）**: 主 Agent 在 Step 2 合并时，逐章/逐文件检查每个审查 Agent 的报告是否覆盖了审查对象的全部内容。发现章节/文件遗漏 → 该 Agent 的报告标记为不完整，要求补充审查后再进入合并流程。**注意**：子 Agent 不会故意偷懒（干净上下文），但可能因 prompt 中审查对象描述不完整而遗漏章节——主 Agent 的违规检测是捕获这类遗漏的最后防线。


**Step 1 — 审查 Agent 并行执行**（按 tier recipe 启动，见上方 recipe 表；各 Agent 互不感知，独立输出报告：问题 + 严重度 + 证据）

**子 Agent prompt 完整性硬约束**：每个审查 Agent 的 prompt 必须包含：「请完整评审以下全部内容，逐章/逐节/逐文件审查，不要跳过任何章节、段落或文件，不要省略待评审内容。无论这是第几轮审查，都必须以第 1 轮的标准独立完整评审全部内容。」

**RAW_COUNT 强制（反偷懒）**：每个审查 Agent 输出末尾必须带 `RAW_COUNT: p0=N p1=N p2=N p3=N`，问题连续编号且总数等于四值之和；主 Agent 汇总为 `raw_count_sum`。细则（含加强审查路径的 code-review 并入约定）见 `refs/dispatch.md` 细则 B。

**Step 2 — 主 Agent 逐条合并去重**

收集全部审查 Agent 报告后：
- **去重**：同一位置 + 同一类型 → 合并；不同位置指向同一概念缺陷 → 标记关联但**不合并**（各占一行）。
- **来源映射（强制）**：每条合并行必须有 `sources` 列（`<Agent名>#<编号>`），条数 = 吸收的原始发现数；**禁止无 sources 的行**。短名规范与编号空间隔离见 `refs/dispatch.md` 细则 A。
- **未纳入清单（强制）**：不构成表行的发现逐条登记（原始严重度 + 具体事实依据 + `disposition: agent_rejected|user_rejected`），构成 `p*_rejected`；严重度取 Agent 原始报告值；被判重复吸收的项不进清单。
- **守恒等式自检（强制，通过方可进入 Step 3）**：`Σ(所有行的 sources 条数) + Σp*_rejected == Σp*_raw + Σp*_supplement`（Step 2 时 supplement=0）。不成立 → 合并表不完整 → **一律标记 `[问题数存疑]`**，补齐后重检，不得以"大致相符"放行。加强审查子路径（无 Step 3）的锚点：自检通过**方可输出 `[CONVERGENCE_CHECK]`**。原始报告被截断致 `Σp*_raw` 不可得 → 按 `refs/dispatch.md` 协议 5「截断策略」抽样比对 + 记录 `[DEGRADED]`，且 N 不可得 ⇒ Step 3 保守回退 mode=standard。
- **冲突与逐条判断**：不同严重度标 `[冲突: AgentA=P0, AgentB=P1]`，汇总提请用户裁决；逐条判断接受/拒绝/部分接受，**拒绝项必须写明具体事实依据**（禁模板化、禁批量）。「部分接受」按原始发现粒度拆记（采纳部分成行、拒绝部分入清单），**不得发明新 disposition 值**。
- 输出合并判断表（# | 问题 | sources | 严重度 | 判断 | disposition | 原因 | 修改方案），`#` 从 1 连续编号；被拒项不构成表行。记录 `p*_raw`/`p*_merged`/`p*_rejected` 于 Step 2，`p*_supplement` 记 0（Step 3 后更新）。
- **[拒绝异常] 检测（强制）**：未纳入清单中**计入 `Σp*_raw` 的**被拒项（`agent_rejected` 与 `user_rejected`）合计 > 3 条，或占 `Σp*_raw`（四项合计）比例 > 30% → 标记 `[拒绝异常]`（被否决的 `sup3` 项不在 `Σp*_raw` 内、不占分子，由 `[补充否决异常]` 单独承接；`user_rejected` 仅核验裁决记录存在性），**无视档位强制补独立 Step 3（mode=standard）**。`Σp*_raw` 不可得时：被拒项 ≥1 即视同触发；且 N 与 `Σp*_raw` 同源不可得 ⇒ 档位无定义 ⇒ 无论被拒项是否为 0，一律保守回退 mode=standard，并记录 `[DEGRADED]`。

**Step 3 — 合并验证**（部署按原始发现总数 N=p0_raw+p1_raw+p2_raw，取 Step 1 raw_count_sum 口径；**验证强度类判定一律用 raw 保守口径**；加强审查子路径裁剪本步）

**前置条件（硬约束）**：Step 2 守恒等式已成立；不成立 → 回 Step 2 补齐，禁止启动 Step 3。

阈值判定（N 基于原始发现数，不计 p3_raw）：
- **p0_raw≥3 或 N>15 → 独立监督 Agent（完整 4 维）**：注入全部原始报告 + 最终合并判断表，执行 ①溯源 ②遗漏 ③合并合理性 ④判断充分性+严重度校准 ⑤守恒等式核对；输出每项 [维持/修正/补充] + 理由，主 Agent 据此出最终版。输出 `STEP3_EXECUTED`（mode=standard）。单一模型时声明"缺少独立视角"。监督 `[补充]` 记账：发现型计入（采纳走 `sources: sup3#k`，否决入未纳入清单且**不计入 `[拒绝异常]` 分子**）；更正型仅记审计说明。**补充否决异常**：否决比例 ≥50% 或条数 ≥3 → 标记 `[补充否决异常]` 并回传复议一次；复议后仍否决 → 双方理由入 `STEP3_EXECUTED` 的 notes，且**强制注入 Step 5 复核**（加强审查且 `[拒绝异常]` N>0 时改为 Step 3 复议留痕，同步写入 `[CONVERGENCE_CHECK]` 的 notes）。
- **N∈[1,15] 且 p0_raw≤2 → 转移至 Step 5**：不启动独立监督；「溯源+遗漏」2 维 + 守恒核对 + 误合抽查由 Step 5 兼并执行。输出 `STEP3_EXECUTED`（agents=self，mode=transferred_to_step5，degradation=none）。
- **N==0 → trivial**：输出 `STEP3_EXECUTED`（agents=self，mode=trivial）。p3_raw>0 时 Step 4 由主 Agent 自修全部 P3（`issues_found`=修复的 P3 项数），Step 5 常规验证——防"零修复 + 条件④重触发"循环。`N==0` 且存在被拒项（agent_rejected + user_rejected ≥1）时，Step 5 **必须由独立 Quick Review Agent** 复核拒绝理由与守恒等式。
- **[拒绝异常] 覆盖规则（无视档位）**：未纳入清单中**计入 `Σp*_raw` 的**被拒项（`agent_rejected` 与 `user_rejected`）合计 > 3 条，或占 `Σp*_raw` 比例 > 30%（sup3 不占分子）→ **强制 mode=standard 完整 4 维**，**不得转移至 Step 5**；`N==0` 时改为独立 Step 5 复核。检出 `[拒绝异常]` 或存在 `user_rejected≥1` 时，Step 5 必须注入 `refs/dispatch.md` 协议 5「合并验证模式」字段组。加强审查子路径：用户拒绝 P0 → 转 mode=standard 完整层。

**口径冻结（gate 输入）**：Step 3 后若监督调整了合并表，必须把 `p*_merged` 更新为终值（含补充行）并写入账本；收敛判定只允许用冻结终值（加强审查默认轮除外，用 Step 2 值且按 raw 口径）。mode=standard 调整过合并表时须在 `STEP3_EXECUTED` 的 `merged_count_final` 重述终值。

> **反偷懒**：部署阈值用 raw 汇总数；Step 5 核对守恒等式（精确算术，无 0.6 类容差）——任何原始发现无去向即 `[问题数存疑]`，触发「补独立 Step 3 → 重修复 → 重 Step 5」（不重跑 Step 1-2）。守恒等式不覆盖误合与严重度降级，二者由 Step 5 第 4/5 项拦截。

**⚠️ 时序硬约束**：Step 4 必须在 Step 3 完成后启动（standard=监督完成且最终表已出；transferred=转移声明已出；trivial=标记块已出），且禁止与 Step 3 同一 turn 启动。

**Step 4 — 子 Agent 执行修复 + 主 Agent 校验**（加强审查子路径裁剪，输出 STEP4_TIER_SKIPPED）

**前置条件（逐条确认）**：① Step 3 已按档位完成并输出 `STEP3_EXECUTED`（含 mode）；② 修复由独立子 Agent 执行（例外：加强审查子路径与 trivial 档由主 Agent 内联）；③ 修复项来源为对应版本的合并判断表；④ 转移路径的修复 prompt 须声明"合并验证尚未执行，Step 5 将做双重检查"，修复中发现合并遗漏可上报 `[疑似合并遗漏]`（消费规则见协议 5）。

**修复策略（默认全量修复 P0-P3）**：P0 须先经用户逐条确认（问题判定 + 修复方案）；P1/P2/P3 直接修复，但结构性修改仍需用户审批；用户可显式指定跳过某级别，**Agent 不得自行跳过**。启动独立修复子 Agent（非主 Agent 内联），逐条执行 分析→判断→修改，禁批量。**同文件不并发**：不同修复子 Agent 禁止改同一文件；以文件为最小分组粒度，判定细则见 `refs/dispatch.md` 细则 C。

**P0 前置 Gate 与记账**：用户拒绝某项 P0 → 标注"用户拒绝"，保留但不修复，**不计入修复后剩余 p0**；在账本 `user_exempt_p0` 单列（独立字段，`rejected = agent_rejected + user_rejected` **不含**此数），并在 `[GATE_PASSED]`/`[CONVERGENCE_CHECK]` 与用户提示中体现「用户豁免 P0」。**不回改 `disposition`、不重算 `p*_merged`**（口径已冻结；Step 5 误合拆行是唯一例外）。加强审查子路径不接受用户拒绝 P0（转 mode=standard 完整层）。

**校验**：逐条对比原文→新文；检查新增问题（残留术语/格式/语法）；全文 grep 废弃概念；增量检查邻近区域。不通过 → 重新修复（最多 3 轮，超限提请用户裁决）。子 Agent 不可用 → 退回主 Agent 并声明；并行不可用 → 串行并声明。多修复子 Agent 合并为**单个** `STEP4_EXECUTED`（issues_found 汇总、agents 全列、degradation 取最严）。

**Step 4 退化补偿**：Step 4 退化 → Step 5 执行两轮独立验证。**转移路径下退化 → 回退为独立 Step 3**：基于已修复产物 + Step 2 合并表启动（mode=standard），之后对"已修复 + 新发现"重跑 Step 4；标记块按"同轮内最后输出为权威"处理（见 `refs/markers.md` 协议 3）。

**Step 5 — Quick Review 收尾**（关键层/完整层强制；加强审查子路径裁剪。例外：用户拒绝 P0 → 转完整层；`[拒绝异常]` 且 N==0 → 例外启动独立 Step 5）

- **独立 Agent（非 Step 4 实施者）**通读修复子 Agent 输出 + 主 Agent 校验记录。
- **严重度校准/拒绝理由抽查（独立触发条件）**：触发面 `p0_raw≥1` 或 `p0_rejected≥1` 或 `agent_rejected≥1` 或 `user_rejected≥1`（任一轴非零即复核；`user_rejected` 仅核验裁决记录存在性）。载体：① transferred/trivial（含 `[拒绝异常]` N==0 例外）→ 本 Step 兼并模式第 5 项（细则见 `refs/dispatch.md` 细则 D）；② standard → Step 3 监督第④维承担，Step 5 不单独注入；③ 加强审查子路径未被例外覆盖时无载体——已知残留，由守恒自检 + 轻量通读补偿。
- **兼并 Step 3 合并验证模式**（当 STEP3_EXECUTED 的 mode=transferred_to_step5，**或**本轮检出 `[拒绝异常]`，**或**存在 `user_rejected≥1`）：注入原始报告全文 + 最终合并表 + 上轮 `p*_merged`/`p*_raw` + `raw_count_sum`（模板见 `refs/dispatch.md` 协议 5），执行 **2 维合并验证（溯源+遗漏）+ 守恒等式核对 + 误合抽查**（共 4 项；四轴任一非零时追加**第 5 项严重度校准抽查**）。五项细则见 `refs/dispatch.md` 细则 D。`STEP5_EXECUTED` 的 notes 注明兼并范围（独立于 degradation）。
- 输出快速检查报告（是否全部修复？是否引入新问题？整体一致性？）；单一 Agent 时声明"缺少独立视角"。
- **收敛判定（强制）**：计算 5 个触发条件并输出 `[CONVERGENCE_CHECK]`（见下方「收敛判定与硬阻止机制」）。加强审查子路径按分支锚定：默认轮在轻量通读后、`[拒绝异常]` N>0 在口径冻结后、N==0 在例外 Step 5 后；计数按 raw 口径。缺失标记 = 审查未完成，父技能验证 3 阻塞。
- 完成后输出 `STEP5_EXECUTED`。**退化补偿**：Step 4 退化时执行两轮独立验证（两轮间主 Agent 不干预），并记录于标记块（转移路径下已回退独立 Step 3，不叠加）。

Step 5 检查本轮修复质量；最终通读 Gate 检查跨轮累积的全局一致性。

**STEP 标记块最小格式（完整字段与验证规则见 `refs/markers.md` 协议 3）**

```STEP<N>_EXECUTED
status: complete|degraded|failed
mode: standard|transferred_to_step5|trivial          # 仅 Step 3
raw_count_sum: p0=N p1=N p2=N p3=N                  # 仅 Step 1
merged_count: p0=N p1=N p2=N p3=N, rejected=N, supplement=N   # 仅 Step 2
conservation: pass|fail                             # Step 2/3
merged_count_final: ...                             # 仅 Step 3 mode=standard
agents: [...]; issues_found: N; degradation: none|<原因>|<影响>|<替代>
notes: <文本>; ref: AgentId=<id|self>
```

> **缺失任一应执行的标记块 = 该 Step 未执行** → 父技能按缺失处理并阻塞 Phase；`issues_found: 0` 的标记块同样必须输出。


### Gate Token 输出（Gate 通过后）

Gate 审查最终通过（收敛判定 action=exit + 最终通读 PASS）后，review 主 Agent **必须**输出 Gate Token（两层保障；加强审查子路径时序为：内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token，见「加强审查」节执行顺序）：第 1 层会话标记 `[GATE_PASSED] gate=<N>, round=<N>, tier=<tier>, p0_merged=<N>, p1_merged=<N>, p2_merged=<N>, p3_merged=<N>, p0_raw=<N>, p1_raw=<N>, p2_raw=<N>, p3_raw=<N>, supplement=<N>, rejected=<N>, agent_rejected=<N>, user_rejected=<N>, user_exempt_p0=<N>, convergence_triggers=<编号列表|none>`（merged 为判定口径、raw 为审计基线，见「问题数口径权威定义」；完整字段以 `refs/markers.md` 协议 3 为正本；P0 未清零时输出 `[GATE_BLOCKED]`，现有机制不变）；第 2 层文件标记 `.superpowers/.gate-passed-<N>`（`name=<任务标识符>` 绑定 + round + timestamp + tier，跨 Skill 边界/跨上下文压缩后备，首次写入前 `mkdir -p .superpowers`）。完整格式定义、与 `[CONVERGENCE_CHECK]` 的时序关系、guard 调用衔接注释（token 先写、guard 后调）见 `refs/markers.md` 协议 3「Gate Token 输出」。独立调用（gate_id=standalone）不输出 Gate Token。

### 独立调用场景自检

用户直接调用 specpowers-review（非通过 specpowers-design/plan/apply/archive 的 Gate 路由）时无父技能双层验证，主 Agent 在最后一个 STEP 完成后（加强审查为 STEP2，其他为 STEP5）自行执行标记块完整性检查——按 `[TIER_ROUTING]`.expected_steps 核对每个 STEP 的 `STEP<N>_EXECUTED`/`STEP<N>_TIER_SKIPPED` 标记块 + 最终通读标记块 + `[CONVERGENCE_CHECK]` 标记，以 `[SELF_VERIFY]` 标记输出结果。自检结果格式、无 args 时 `file_count`/`line_count` 的计算方法（口径按对象类型：文档类＝审查对象总行数 `wc -l`；代码类＝修改总行数 git diff）与降级回退见 `refs/markers.md` 协议 3「独立调用场景自检」。

---

## 收敛判定与硬阻止机制

### 收敛判定（强制输出 + 默认继续制）

审查完成后依据本轮计数输出声明，模板见 `refs/convergence.md` 协议 7。

Step 5 完成后（加强审查子路径按分支：默认轮为轻量通读完成后；检出 `[拒绝异常]` 的轮为口径冻结后（N>0）或例外独立 Step 5 复核输出后（N==0）——见「加强审查」节），主 Agent **必须**计算 5 个触发条件并输出 `[CONVERGENCE_CHECK]` 标记。

> **⚠️ 口径硬约束（防偷懒）**: 触发条件**必须**使用**合并后问题数 `p*_merged`**（Step 2 合并判断表口径，Step 3 结束后冻结终值；加强审查子路径例外——该路径用 `p*_raw`，理由见「问题数口径权威定义」）。**禁止**使用修复后剩余计数（`p0`/`p1`/`p2`）——那是最常见的偷懒模式之一；**也禁止**使用未去重的原始发现数（`p*_raw`）——多 Agent 重复报告会凭空顶到阈值、白跑一整轮（一轮成本 = Step1 全 Agent + Step3 + Step4 + Step5）。各口径的权威定义见「问题数口径权威定义」。

5 个触发条件（任一满足即默认继续下一轮，全部基于**合并后问题数**）：① p0_merged > 1；② p1_merged > 5；③ p0_merged+p1_merged+p2_merged > 10；④ p0_merged+p1_merged+p2_merged+p3_merged > 20；⑤ p1_merged − 上轮 p1_merged > 3（轮间新增 P1 趋势闸门；两轮必须同口径比对——同口径与否按账本轮次条目的 `caliber` 字段判定，任一轮 `caliber=raw`（加强审查子路径轮）时⑤对两轮同取 `p1_raw` 并在 notes 标注「触发口径切换（merged→raw）」；任一轮缺 `p*_merged` 时按 `refs/ledger.md` 协议 1「⑤（差值型条件）特殊处理」的三差值规则计算（`A = p1_raw(R) − p1_raw(R−1)`、`B = p1_merged(R) − p1_raw(R−1)`、`C = p1_raw(R) − p1_merged(R−1)`，任一 > 3 即触发），不再简单回退取 raw；首轮无上轮基准时⑤不参与判定）。完整输出判定、标记格式及输出模板见 `refs/convergence.md` 协议 7。

#### `[CONVERGENCE_CHECK]` 标记格式

格式定义见 `refs/convergence.md` 协议 7（`[CONVERGENCE_CHECK]` 标记格式节）。字段：triggers（触发条件编号列表|none）、action（continue|exit）、`p0_merged`/`p1_merged`/`p2_merged`/`p3_merged`（合并后问题数——**判定口径**）、`p0_raw`/`p1_raw`/`p2_raw`/`p3_raw`（原始发现数——**审计基线**）、supplement（监督补充数——审计字段，Step 2 时为 0）、rejected=<N> / agent_rejected=<N> / user_rejected=<N> / user_exempt_p0=<N>（未纳入总数 / 其中主 Agent 拒绝数 / 其中 Step 2 清单用户裁决拒绝数 / Step 4 前置 Gate 用户豁免 P0 数——`rejected = agent_rejected + user_rejected`，**不含** `user_exempt_p0`；**仅供审计 `[拒绝异常]` 是否触发**与「用户豁免 P0」声明，与协议 7 一致）、conservation=<pass|fail>（守恒等式核对结果——fail 时不得输出 action=exit，与协议 7 一致）、exit_reason（exit 时填写）、notes=<文本|n/a>（触发口径切换（merged→raw）、回退口径、口径外扣除明细等的标注处）。完整字段以 `refs/convergence.md` 协议 7 为正本。判定与审计口径都必须列出，供审计分辨"真的问题少"与"被合并/拒绝压下去的"。

**无论是否触发，此标记必须输出。** 缺失 = 收敛判定被跳过 = 审查未完成。

> **加强审查子路径覆盖**：加强审查子路径裁剪 STEP5（recipe=[STEP1-2]，输出 STEP5_TIER_SKIPPED）。此子路径的 `[CONVERGENCE_CHECK]` **按分支锚定**（见「加强审查」节「收敛判定（按分支锚定）」）：**默认轮（无 Step 3）在轻量通读完成后**输出（替代 STEP5 后位置；完整顺序：STEP2 合并 → 内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token）；**检出 `[拒绝异常]` 的轮**——N>0（有例外 Step 3）在**口径冻结后**输出（同标准路径，`supplement/rejected/conservation` 须用终值），N==0 在**例外独立 Step 5 复核输出后**输出。且计数**用 raw 口径**（该路径没有任何独立验证者复核合并表——**`[拒绝异常]` 子分支除外**：N>0 有例外 Step 3 独立监督、N==0 有例外独立 Step 5，该子分支合并表有独立复核，见「加强审查」节例外条——merged 无人审计；保留 raw **不构成额外防护**——`RAW_COUNT` 仍是主 Agent 自报——仅为不依赖合并表的保守默认口径，真实防护来源是守恒等式自检+最终通读的轻量替代，见「问题数口径权威定义」）。验证 3 的搜索逻辑不依赖 STEP5 存在——只要找到 `[CONVERGENCE_CHECK]` 标记即可。

#### 默认继续制（action=continue 时）

触发条件满足时，**默认进入下一轮审查**——不询问"是否继续"，而是通知即将继续并提供干预窗口。

**执行主体**：review 主 Agent 在同一 Skill 调用内部自动循环——action=continue 时回到 Step 0 启动下一轮（Round N+1）；父技能 Gate 调用仅一次返回：`[GATE_PASSED]` → 循环退出（Gate 通过）；`[GATE_BLOCKED]` → P0 未清零（Gate 阻塞）。父技能无需实现循环逻辑（验证 3 仅检查最终返回的标记存在性与语义）。

**用户交互（知情权 + 干预窗口）**：action=continue 时先输出下述通知再开始下一轮；用户需主动干预才能终止（不是"询问是否继续"）。

```
📊 Round <N> 审查完成。合并后问题数 P0:<p0_merged> P1:<p1_merged> P2:<p2_merged> P3:<p3_merged>（原始发现 P0:<p0_raw> P1:<p1_raw> P2:<p2_raw> P3:<p3_raw>，去重前基线）。
触发条件 <编号+描述> 满足，即将开始 Round <N+1>。
如需终止审查，请说明理由。无反馈则继续。
```


#### action=exit 时

触发条件不满足（收敛达标）或用户显式终止后，输出 action=exit + exit_reason，然后执行最终通读 Gate，通过后输出 `[GATE_PASSED]` 标记（格式见 `refs/markers.md` 协议 3「Gate Token 输出」）。

> **优先级规则**：多条件同时触发时，按条件编号升序显示（1 → 2 → 3 → 4 → 5），列出所有触发条件的编号和描述。

---

## 按需加载表（执行前必读对应 refs）

> 下表为**硬指令**：标注时机到达时必须先读取对应文件再执行，不得凭记忆操作。

| 时机 | 必读 | 内容 |
|---|---|---|
| Step 0 路由 / 加强审查轮全程 | refs/routing.md | 协议 6、加强审查例外全集 |
| 派发任何子 Agent 前 / Step 1 汇总 raw_count 前（含会话恢复续跑）/ Step 2 构建 sources 列前 / Step 4 修复前（含主 Agent 自执行）/ Step 5 兼并判定与复核前 | refs/dispatch.md | 协议 4+5、短名规范、RAW_COUNT、同文件不并发、兼并五项、注入模板 |
| 每 Step 收尾输出标记块前 | refs/markers.md | 协议 3 字段注记与验证细则（格式模板在主体） |
| 读写账本 / review-cache | refs/ledger.md | 协议 1+2 |
| 每轮收敛判定前 / 最终通读前 | refs/convergence.md | 协议 7+9 |
| 路由到 UltraReview recipe | refs/ultrareview.md | 协议 8 |

---

## 最终通读 Gate（横切，全 Gate 适用）

最终通读 Gate 是横切 Gate，不参与 Gate 0-4 编号体系，适用于所有审查（文档类 Gate 0/1/2 与代码类 Gate 3），不可跳过、不设自动循环上限。触发时机：单轮审查在 Step 5 完成后立即执行（加强审查子路径在内联修复 + 对齐复检（P0 清零）后以轻量通读替代——非 STEP2 合并后立即，顺序见「加强审查」节）；多轮审查在最后一轮 Step 5 完成后执行。执行后输出 `STEP_FINAL_READTHROUGH` 标记块（`status` 一律取通用枚举 complete|degraded|failed，通读结果由独立字段 `result: pass|fail` 表达——映射见协议 9「输出」节），PASS 方可进入下一环节（Gate 0-4 编号体系之外的横切 Gate，父技能不跨边界验证，由 review 内部主 Agent 自执行）。执行方式（独立子 Agent 通读 / 单模型降级声明 / 跨会话缓存 staleness 检查）、检查项、PASS 四条件（正确应用/无冲突/术语格式一致/无废弃引用）与 FAIL 重通读规则详见 `refs/convergence.md` 协议 9。
