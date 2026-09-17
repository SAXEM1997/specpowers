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

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取全局规则。等待加载完成后继续。
> 2. 确认审查对象（文档/代码）和变更范围（文件数）已知。如未知，向用户确认后继续。

## 术语说明

- **主 Agent**：specpowers-review 技能内部的协调 Agent，调度子 Agent、合并审查结果、执行修复。与入口技能 specpowers 的 Agent 区分。
- **用户**：人类开发者（审批修复方案），非调用方 Agent。

## 审查决策树

审查类型由本 skill 内部按「对象类型 → recipe（对象类型×tier 对应的 Agent 编排与 STEP 集合，见下方 recipe 表；代码类完整层按 bucket 分叉子路径）」查找，自动判定，用户可手动覆盖。

```text
审查对象类型?
├── 文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）
│   └── 两级 tier 路由（关键/完整）→ recipe（见下方 recipe 表文档类行）
│       用户可手动指定"UltraReview"→ 完整层 3-agent 多模型渐进式审查（6-agent 维度 build/code/specs/docs/deps 仅代码类，文档类映射到 3-agent）。
│       文档类 UltraReview 不走 tier 路由，但仍须经护栏 1（ledger 缺失 early-return 完整，见 refs/protocols.md 协议 6（护栏 1））
│
└── 代码类（实现代码 / 项目结构 / 构建配置 / 项目创建或变更）
    └── 两级 tier 路由（关键/完整）→ recipe（见下方 recipe 表代码类行，按 bucket 分叉）
        用户可手动指定审查层级："关键审查" / "完整审查"
```

**路由矩阵摘要**（完整定义见 `refs/protocols.md` 协议 6）：

| 规模 × 轮数 | 第 1 轮 | 第 2 轮 | 第 3 轮+ |
|------------|--------|--------|---------|
| 微小 | 关键 | 关键 | 关键 |
| 中等 | 完整 | 关键★ | 关键★ |
| 复杂 | 完整 | 完整 | 完整 |
| 大规模 | 完整 | 完整 | 完整 |

> **规模分桶度量（按对象类型区分）**：代码类按 `file_count`（变更文件数，直接反映变更范围）——微小 1-3 / 中等 4-19 / 复杂 20-49 / 大规模 50+。文档类按 `line_count`（文档总行数，行数与内容复杂度正相关）——微小 ≤100 / 中等 101-300 / 复杂 301-600 / 大规模 >600。文档类的 file_count 无区分度（Gate 0/2 始终 1 文件，Gate 1 通常 4-6 文件），改用 line_count 度量内容复杂度。详见 refs/protocols.md 协议 6 `bucket_doc` 函数。

★ 触发收敛闸门（完整算法见 refs/protocols.md 协议 6）。两道硬护栏（ledger 缺失→完整、行数地板）+ 收敛闸门。收敛闸门：关键层（中等规模）若上轮 p0_raw>0 → 升级完整（阵容保守加强——闸门口径 p0_raw>0 比收敛触发条件①的 >1 更严，为有意设计：闸门在下一轮实际发生时才生效，含 P0 历史即加强阵容）。

**手动覆盖关键词**：当前轮用户输入含"关键审查"/"完整审查"→ 手动覆盖设定基础 tier（后续护栏/矩阵/地板/闸门在此基础上只升不降）。匹配范围为当前轮用户输入，不含历史轮次指令；排除否定语境。"UltraReview"→ 文档类映射到完整层 3-agent 多模型渐进式（6-agent 维度 build/code/specs/docs/deps 仅代码类），代码类走 6-agent UltraReview recipe（→ 完整层增强）。

"项目创建或变更"指涉及项目配置文件（package.json / Cargo.toml / go.mod / CMakeLists.txt / Makefile / pom.xml / docker-compose.yml 等）、构建脚本、目录结构调整的变更。判断标准：变更涉及项目基础设施层面（而非仅业务代码），即归入此类。

### recipe 表

审查 Agent 编排按 `(对象类型 × tier × bucket 分支)` 决定。代码类完整层按 bucket 分叉子路径。`bucket 分支` 仅在代码类完整层用于区分子路径（文档类不分子路径）。

| 对象类型 × tier | 完整 Full | 关键 Critical |
|----------------|----------|---------------|
| **文档类** | 结构+落地+对齐(3 Agent) [STEP1-5] | 对齐 Agent + 监督 Agent [STEP1-5] |
| **代码类（微小/中等(4-9) bucket）** | **加强审查**：code-review（由 specpowers-apply 执行）+ 对齐单审 [STEP1-2] | **3 独立视角**：code-review（由 specpowers-apply 执行）+ 对齐 Agent + 监督 Agent [STEP1-5] |
| **代码类（中等(10-19)/复杂/大规模 bucket）** | **UltraReview**(6 Agent: build/code/specs/docs/deps/对齐) [STEP1-5] | 同代码类（微小/中等）关键 |

> bucket_class 映射（与 protocols.md 协议 6 对齐）：{微小, 中等且file_count<10}→小代码（加强审查 recipe）；{中等且file_count≥10, 复杂, 大规模}→大代码（UltraReview recipe）

> **STEP→阶段映射（所有 tier 共用）**：
> - STEP1 = 审查 Agent 并行执行（数量由 tier recipe 决定）
> - STEP2 = 主 Agent 合并去重判断
> - STEP3 = 合并验证（按 N 部署：p0_raw≥3或N>15→独立Agent完整4维；N∈[1,15]且p0_raw≤2→转Step5兼并；N==0→trivial；加强审查子路径裁剪）
> - STEP4 = 修复 + 主 Agent 校验
> - STEP5 = Quick Review（加强审查子路径裁剪，并入 STEP2 主 Agent 合并判断）
>
> **完整层不对称（设计意图，非遗漏）**：代码类完整层按 bucket 分——微小/中等(4-9)=加强审查(STEP1-2，无监督，轻量路径，小变更无需监督即可控)；中等(10-19)/复杂/大规模=UltraReview(STEP1-5，含 6 维度审查)。关键层统一含监督，覆盖强度高于加强审查。
>
> **3 独立视角（代码类关键层）**= code-review（由 specpowers-apply 通过 `requesting-code-review` 执行，代码质量维度）+ 对齐 Agent（规范合规维度 COVERED/MISSING/DRIFT）+ 监督 Agent（交叉验证维度：溯源检查 + 遗漏检测 + 合并合理性 + 判断充分性）。监督 Agent 部署形式按原始发现总数 N（raw_count_sum 口径）动态决定——N∈[1,15] 且 p0_raw≤2 时合并验证 2 维（溯源+遗漏）转移至 Step 5 兼并执行，不启动独立 Agent（见 Step 3）。
>
> **code-review 执行主体（代码类全 tier）**：apply 先执行 code-review（`requesting-code-review`），结果注入 review 的对齐 Agent prompt；review 对齐 Agent 输出 STEP1_EXECUTED（含 code-review 结果引用）。文档类无 code-review。
>
> **加强审查**= 代码类完整层微小/中等(file_count<10) bucket 专用 recipe（STEP1-2，无监督），详见下方"加强审查"节。
>
> **质量底线（每级强制）**：①对齐 COVERED/MISSING/DRIFT 不可省；②代码类必含 code-review（全 tier）；③P0 修复不可省；④最终通读 Gate 横切不可省略——加强审查子路径以主 Agent STEP2 合并去重判断+变更区域轻量通读作为最终通读的轻量替代，不可裁（替代声明在 STEP_FINAL_READTHROUGH 标记块 status 中注明"轻量替代"，与协议 9 统一）；⑤层级裁剪声明块——格式见协议 6；⑥合并验证（溯源+遗漏）维度不可省——部署形式见 Step 3。
>
> 详细路由算法、层级裁剪声明块格式、典型场景示例见 `refs/protocols.md` 协议 6。

## 全流程逐层审查 Gate

全流程 Phase-Gate 管道（线性，无分支）：

1. **Phase 0** clarifications → **[Gate 0]**（文档类，多模型渐进式）→ design
2. **Phase 1** design → **[Gate 1]**（文档类，多模型渐进式）→ proposal/specs
3. **Phase 2** proposal/specs → **[Gate 2]**（文档类，多模型渐进式）→ plan
4. **Phase 3** plan → **[Gate 3]**（代码类，tier 路由）→ 代码
5. **Phase 4** 代码 → **[Gate 4]**（归档，现有 hard gate 链）

### 各 Gate 详细定义表

| Gate | 触发时机 | 触发者 | 审查对象 | 对齐上游 | 审查方式 |
|------|---------|--------|---------|---------|---------|
| **Gate 0** | Phase 0 用户审批通过后 | specpowers-design | `design.md` | `clarifications/<name>.md` | 文档类 tier 路由（默认 recipe=多模型渐进式） |
| **Gate 1** | Phase 1 用户审核通过后 | specpowers-design | proposal/design/specs/tasks | Phase 0 design + clarifications | 文档类 tier 路由（默认 recipe=多模型渐进式） |
| **Gate 2** | Phase 2 plan 生成后 | specpowers-plan | `docs/superpowers/plans/<name>.md` | Phase 1 specs + Phase 0 design | 文档类 tier 路由（默认 recipe=多模型渐进式） |
| **Gate 3** | Phase 3 代码实现完成后 | specpowers-apply | 代码变更 | Phase 2 plan + Phase 1 specs + Phase 0 design | 代码类 tier 路由（recipe 按 bucket 分叉） |
| **Gate 4** | Phase 4 归档前 | specpowers-archive 内部 | 归档完整性 | — | 现有 hard gate 链，仅标记为 Gate 节点 |
| **最终通读** | 每 Gate 审查修复完成后 | specpowers-review 内部 | 审查对象全文 | — | 独立 Agent 通读（PASS 四条件） |

### 多文件 Gate 的审查粒度

Gate 1 审查对象包含多个独立文件（proposal.md / design.md / specs/ / tasks.md），审查策略：
- 合并为一次审查：三 Agent 分别读取所有文件，输出合并报告（一条问题可能跨文件关联）
- 对齐 Agent 的"逐条对照"以 `design.md` 为主线，对照 `clarifications` 中的需求点是否在 proposal/specs/tasks 中完整覆盖
- 结构 Agent 检查四件套之间的内部一致性（如 tasks.md 的任务是否覆盖了 specs/ 的所有 Requirement）
- 落地 Agent 检查每个文件独立的可执行性（对文档类：检查引用路径是否存在、命令示例是否可运行、配置示例语法是否正确、平台差异是否已标注；对代码类：检查编译/运行可行性、依赖完整性）

### Gate 执行规则

- 每个 Gate 不可跳过
- Gate 未通过（存在 P0，见下方 UltraReview 审查规则节 P0 阻塞规则权威定义）→ 禁止进入下一 Phase
- Gate 发现 P1/P2 → 记录后允许通过
- 问题清单写入会话上下文账本（主 Agent 内存 dict，见 `refs/protocols.md` 协议 1（会话上下文账本）），跨 Gate 通过主 Agent 注入对齐 Agent prompt。
- 不再写入任何 .review 开头的文件产物
- 跨会话场景下，审查教训从 .specpowers/review-cache.json 读取（尽力而为缓存，丢失不影响正确性）
- 每个 Gate 审查完成后均输出收敛判定（`[CONVERGENCE_CHECK]` 标记）
- **审查修改与审批的关系**：Gate 审查发现的修改分为两类：
  - (a) **结构性修改**（改变设计意图/架构/接口/数据模型/核心流程）→ 需重新走用户审批
  - (b) **澄清性修改**（消除歧义、补充遗漏、修正措辞、修复格式，不改变设计意图、接口和数据流）→ 免二次审批，直接修改后由主 Agent 确认
  - **判定标准**：如果修改会导致下游产物的内容或结构发生变化，则为结构性修改。对齐 Agent 的审查报告需标注每项修改的类型及判定理由。
  - **P0 问题**：无论修改类型，均须先经用户确认问题判定和修复方案。确认后——澄清性修改免二次审批直接修改，结构性修改需在修改后重新走用户审批流程。
- **代码类 Gate 3**：分两部分——(a) specpowers-apply 的 code-review（通过标准：无 P0 问题），结果注入 review 对齐 Agent prompt；(b) specpowers-review 按 tier recipe 执行审查（对齐检查，通过标准：无 MISSING 或 DRIFT 标记为 P0 的项）。两者均通过方可进入 Phase 4。加强审查 recipe（STEP1-2）走轻量路径，UltraReview recipe 走完整 6-agent + 对齐。

---

## 审查层级边界（文档类防漂移）

> 以下边界表横切所有文档类审查（不分 tier），代码类 Gate 3 不受此边界限制。

> **两层边界原则**: 审查时区分两个边界——
> - **探索分析边界（不受限）**: 审查 Agent 可以深入分析代码/实现层面的细节来验证设计决策。例如：评判接口设计是否合理时，可以查阅目标平台的 API 文档、分析语言特性约束。深层分析是发现深层设计问题的前提。
> - **产物评论边界（受限制）**: 审查输出（问题描述 + 建议）必须表述为当前层级的语言。例如：发现接口与平台 API 不兼容 → 评论"接口设计与目标平台约束不兼容，需重新评估"（✅ design 层面），而非"应改用 `PlatformAPI.connect_async()`"（❌ 代码实现建议）。

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

**适用条件**：代码类完整层 + 中等(10-19)/复杂/大规模 bucket（文件数 ≥ 10），由 tier 路由自动判定（见上方 recipe 表）。

> **文档类注意事项**: 文档类手动指定 UltraReview 时映射到完整层 3-agent 多模型渐进式（6-agent 维度 build/code/specs/docs/deps 仅适用代码类，文档类无对应定义）。详见审查决策树和手动覆盖关键词说明。

> **详细协议移出（创建审查团队 + Steps A-F）**: 6-agent 审查团队定义（build/code/specs/docs/deps/对齐六维度 prompt 要点 + 对齐审查 Agent 对照方法与 COVERED/MISSING/DRIFT 语义）与主 Agent 逐条分析协议 Steps A-F（A 确认全部子 Agent 完成 → B 去重合并 → C 逐条判断 → D 输出合并判断表 → E 用户审批（硬 Gate）→ F 执行修复）详见 `refs/protocols.md` 协议 8。执行 UltraReview recipe 时 Read 协议 8 获取逐步细节；未路由到 UltraReview 时无需读取。

> **STEP 兼容性说明**: 对齐审查 Agent 在 Step A 与其他 5 个审查 Agent 并行启动，产出在 Step B-C 中与其他报告一同去重合并，不产生独立 STEP 标记块。STEP 标记块体系（STEP1-STEP5）不变，STEP1_EXECUTED 的 agents 列表含 6 个维度。
>
> **UltraReview Steps A-F → STEP 映射**：Steps A-B → STEP1（并行审查+报告汇总）/ Steps C-D → STEP2（逐条判断+合并判断表）/ Step D' = 通用 Step 3 在 UltraReview 流程的插入点（非 A-F 独立 Step，执行独立监督 Agent 交叉验证，输出 STEP3_EXECUTED）/ Step E → 用户审批（STEP4 前置环节）/ Step F → STEP4（执行修复+输出 STEP4_EXECUTED）。映射覆盖 STEP1-4（STEP5 Quick Review 由通用审查流程 Step 5 覆盖，非 A-F 协议）。

> **术语说明**: 加强审查中的"对齐 Agent 单审"与 UltraReview 中的"对齐审查 Agent"为同一审查维度，区别仅在于部署模式——加强审查中作为独立 Agent 产出 STEP1/STEP2 标记块，UltraReview 中作为 6-agent 团队成员在 Step A 并行产出、融入 Step B-C 去重合并。

### 审查规则

- 只读不写：所有审查 Agent 仅输出审查报告，不修改任何文件
- P0（必须修复）：阻塞性问题——接口不匹配、数据丢失风险、安全漏洞、spec 严重偏离
- P1（不阻塞 Gate 通过）：重要问题——性能退化、代码异味、文档过时、错误处理缺失
- P2（记录待办）：改进建议——重构机会、可读性优化、测试覆盖增强
- P3（记录待办）：风格问题——命名规范、格式一致性、注释完善
- **P0 阻塞规则（权威定义，全文档唯一权威来源）**: P0 > 0（修复后剩余）→ Gate 未通过，禁止进入下一 Phase；P0 必须全部修复且通过重审方可放行（重审载体：触发条件①/⑤引起的下一轮完整审查，或 p0_raw∈[1,2] 单轮收敛时的 Step 5 严重度校准抽查——见 Step 5 兼并模式第 4 项）。P1/P2/P3 不阻塞 Gate 通过。其余各处 P0 阻塞引用均以此处为准（修复范围见下方"Gate 通过标准 vs 修复范围"）。

> **Gate 通过标准 vs 修复范围**: 以上为 Gate 通过标准（阻塞判定——什么情况下 Gate 不通过）。修复阶段的修复范围见 Step 4 "修复策略"（或 UltraReview Step F——两路径共享同一修复策略，A-F 协议见 `refs/protocols.md` 协议 8）——默认全量修复 P0-P3，不受此阻塞标准限制。例如：P2/P3 "不阻塞 Gate 通过" 意味着即使有未修复的 P2/P3 也可以进入下一 Phase，但修复阶段仍默认修复它们（用户可显式跳过）。

## 加强审查（代码类 recipe，微小/中等(file_count<10) bucket 完整层）

**适用条件**：代码类完整层 + 微小/中等(file_count<10) bucket（文件数 ≤ 9），由 tier 路由自动判定（见上方 recipe 表）。不启动 6-agent 团队，由 specpowers-review 构造对齐 Agent 单审：

1. **specpowers-apply 内部 code-review**：通过标准为无 P0 问题
2. **specpowers-review 对齐 Agent 单审**：对齐检查，通过标准为无 MISSING 或 DRIFT 标记为 P0 的项

主 Agent 构造对齐 Agent 的审查 prompt 时，注入 spec-compliance-check（OpenSpec 规范逐条对照协议，输出 COVERED/MISSING/DRIFT），确保对齐检查覆盖原双重审查的规范合规维度。

两者均通过方可进入 Phase 4。

**P0 修复机制**：本路径裁剪独立修复子 Agent（STEP4_TIER_SKIPPED），但对齐 Agent 发现 MISSING/DRIFT 标记为 P0 的项时，主 Agent 在 STEP2 合并后对接受的 P0 项**先经用户逐条确认（问题判定 + 修复方案），确认后直接执行修复**（主 Agent 内联，非独立子 Agent），修复后重新运行对齐检查直到 P0 清零——避免 [GATE_BLOCKED] 死循环。

> **P1/P2/P3 修复策略**：修复范围与 Step 4 修复策略一致（默认全量修复 P0-P3），执行主体为**主 Agent 在 STEP2 合并判断后内联修复**（本子路径裁剪独立修复子 Agent，无 STEP4 标记块）；收敛判定触发继续时由下一轮完整审查兜底验证。P1/P2/P3 不阻塞 Gate。

> STEP3/4/5 被层级裁剪：输出 STEP3_TIER_SKIPPED / STEP4_TIER_SKIPPED / STEP5_TIER_SKIPPED（格式见 refs/protocols.md 协议 6）。主 Agent STEP2 合并判断作为最终通读轻量替代（不可省略）。**收敛判定**：STEP2 完成后必须输出 `[CONVERGENCE_CHECK]` 标记（见下方「收敛判定与硬阻止机制」节），替代标准路径 STEP5 后的收敛判定位置。

---

## 多模型渐进式审查（文档类 recipe，3 Agent）

**适用对象**：所有文档类（proposal / design / plan / spec / skill / README / 架构文档 / clarifications）。

### 三 Agent 结构

| Agent | 关注点 | 模型建议 |
|-------|--------|---------|
| **结构审查 Agent** | 完整性/冗余/一致性/结构合理性 | 强推理模型 |
| **落地审查 Agent** | 可执行性/兼容性/边界/平台差异 | 快速模型 |
| **对齐审查 Agent** | 对齐原始需求/设计；错漏项检测；模糊歧义识别 | 与前两者不同模型 |

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
1. 模型选择原则：三 Agent 使用不同模型以最大化视角多样性。具体模型品牌取决于环境可用模型，以能力等级匹配为优先（强推理/快速/中等）。
2. 结构审查 Agent：优先使用强推理能力模型，关注完整性/一致性分析
3. 落地审查 Agent：优先使用快速模型，关注边界/兼容性检查——快速模型在细节问题（列对齐解析、转义字符、边界值处理）上常有意外发现
4. 对齐审查 Agent：优先使用与前两者不同的模型，关注逐条对照+错漏检测的中等推理任务
5. **降级策略**：仅两个模型/仅单一模型可用时的部署与串行顺序细则见 `refs/protocols.md` 协议 4「模型多样性降级细则」。
6. 如在 TeamCreate/子 Agent 环境中执行，优先使用不同子 Agent 分配不同模型。

### 与 UltraReview 的分工

| 维度 | 多模型渐进式 | UltraReview |
|------|------------|-------------|
| 审查对象 | 文档（设计/规范/计划等） | 代码（中等(10-19)/复杂/大规模 bucket） |
| Agent 数量 | 3（完整层）/ 2（关键层） | 6（仅完整层） |
| 对齐检查 | 对齐 Agent 专门负责 | 对齐审查 Agent 专门负责（COVERED/MISSING/DRIFT 对照） |
| 收敛判定 | 是 | 是 |

---

## 审查流程（全 tier 通用）

### Step 0 — 审查准备与路由

> 注：本节（Step 0-5）适用于所有 tier（关键/完整）和所有对象类型（文档/代码），不仅限于多模型渐进式。

主 Agent 执行以下准备步骤：

**0a. 收集审查经验**

从以下来源收集审查教训，注入审查 Agent prompt：
- 当前会话中前几个 Gate 的审查报告（如 Gate 0 的教训注入 Gate 1）
- 用户在本轮审查中明确指出的偏好或纠正
- 通用最佳实践（如"从 AI 执行视角评判，不以人类流畅性为标准"、"用实际项目名检查占位符是否泄漏"）
- 跨会话积累的审查教训从 .specpowers/review-cache.json 中读取（跨会话缓存）；会话内跨 Gate 教训从会话上下文账本中读取。新发现的教训在每轮审查结束后追加到会话上下文账本，Gate 退出时写入 review-cache.json。

**0b. 注入审查层级边界**

根据当前 Gate 的审查对象类型，从上方"审查层级边界"独立节中提取对应的审查范围和评论边界，注入每个审查 Agent 的 prompt：

| Gate | 审查对象 | 取值来源（见上方审查层级边界表） |
|------|---------|---------------------|
| Gate 0 | design.md | 取 design.md 行 |
| Gate 1 | proposal + design + specs + tasks | 取 proposal.md / design.md / specs/ / tasks.md 四行（含 tasks.md 行），合并后注入 |
| Gate 2 | `docs/superpowers/plans/<name>.md` | 取 `docs/superpowers/plans/<name>.md` 行 |
| Gate 3 | 代码变更 | 取"代码变更"行（评论边界=无） |

注入格式（附加到每个审查 Agent prompt 末尾）：

```markdown
## 审查层级边界（强制）

本轮审查对象类型: <design.md / plan / proposal / specs / 代码>
审查范围（你应关注的）: <从边界表中提取的审查范围>
评论边界（审查输出不应越界到）: <从边界表中提取的评论边界，代码类填"无">

两层边界规则:
- 分析不受限: 你可以深入代码/实现层面做分析——深层分析是发现深层设计问题的前提
- 评论受限制: 审查输出必须表述为当前层级的语言——发现问题后，以设计/规划层面的术语描述问题和建议，不以代码实现建议的形式输出
```

**0c-pre. 解析调用参数（args）**

父技能（specpowers-apply/design/plan）调用 specpowers-review 时通过 `args` 传递参数。主 Agent 从 args 提取：`gate_id`（Gate 0-3 / standalone）、`file_count`（待审查文件数）、`line_count`（修改总行数）、code-review 结果（代码类 Gate 3 由 apply 注入，作为对齐 Agent 的代码质量维度输入）。这些值用于下方 0c gate_id 确定 + 0d tier 路由（file_count/line_count 是路由算法输入）。无 args 时（独立调用）由主 Agent 自行计算 file_count/line_count（见 `refs/protocols.md` 协议 3「独立调用场景自检」）。

**0c. 确定 gate_id（轮次隔离）**

按当前触发的 Gate 确定 gate_id（优先用 args 传入的 gate_id）——Gate 0→`gate_0`、Gate 1→`gate_1`、Gate 2→`gate_2`、Gate 3→`gate_3`、独立调用→`standalone`。round 计算基于当前 gate_id 的 rounds（见协议 6），不同 Gate 轮次独立计数。⚠️ 不可对不同 Gate 复用同一 gate_id（会导致轮次跨 Gate 累加、路由错误降级）。

**0d. 执行 tier 路由**

按 `refs/protocols.md` 协议 6 路由算法执行 tier 路由决策（完整算法见 refs/protocols.md 协议 6）。计算完成后，在审查报告开头输出 `[TIER_ROUTING]` 标记，格式：

```
[TIER_ROUTING] tier=<critical|full>, round=<N>, file_count=<N>, bucket=<微小|中等|复杂|大规模>, line_count=<N>, floor=<tier>, convergence=<passed|failed|n/a>, recipe=<加强审查|UltraReview|3视角|文档3Agent>, reason=<路由路径简述>, expected_steps=[...]
```

`expected_steps` 由 tier recipe 决定，见上方 recipe 表。路由完成后，按 expected_steps 执行对应 Step。

> expected_steps 仅含 tier recipe 的 STEP（STEP1-5）；STEP_FINAL_READTHROUGH 为横切 Gate，独立于 expected_steps 检查（父技能**不**跨边界验证此横切 Gate；由 review 内部主 Agent 自执行 + 独立调用场景 [SELF_VERIFY] 兜底，自检细则见 `refs/protocols.md` 协议 3「独立调用场景自检」）。

> 在启动审查 Agent 前，主 Agent 先完成以下自检——以下列出的每一项合理化都是实际审查中观察到的 Agent 跳过模式。

### 审查纪律自检

#### 合理化表

| 如果你在想… | 为什么这是陷阱 | 正确做法 |
|------------|---------------|---------|
| "三个 Agent 结论一致 → 不需要监督验证" | 一致可能是共识偏见而非正确。监督 Agent 常见在合并判断表中发现审查 Agent 未注意到的遗漏（历史记录中单轮最多发现 12 项） | Step 3 强制执行，无论 Agent 间结论是否一致 |
| "问题少 → 完全跳过合并验证" | 合并验证的溯源+遗漏维度无论问题多少都须执行——问题少（N∈[1,15] 且 p0_raw≤2）只意味着可由 Step 5 兼并（不启动独立 Agent），不意味着可省略维度；且"问题少"是主 Agent 自统计，压低问题数或把 P0 降级 P1/P3 逃避独立监督是已知偷懒模式（Step 1 RAW_COUNT + Step 5 合计比对问题数核对 + p0_raw≥1 时严重度校准抽查，三层捕获） | N∈[1,15] 且 p0_raw≤2：合并验证 2 维转移至 Step 5（mode=transferred_to_step5，省独立 Agent 不省维度）；p0_raw≥3 或 N>15：独立监督完整 4 维 |
| "这轮只是小修复，不需要 Quick Review" | 修复引入新问题是已知模式——"修复→引入问题→遗漏修复"是多轮审查中最常见的失败路径 | Step 5 强制执行，无论修复规模 |
| "用户会发现剩余问题" | 用户审查是后续环节——Gate 审查阶段跳过的偏差在下游 Phase 逐层放大 | 每个 Gate 独立完成全部审查步骤 |
| "退化声明太复杂，跳过" | 无退化声明 → 父技能按标记块缺失处理 → 阻塞 Phase。退化声明的存在性比措辞完美更重要 | 至少输出 (a) 缺失了什么能力 (b) 尝试过什么 |
| "零问题 → 不需要标记块" | 父技能将标记块缺失解释为"Step 未执行"（而非"Step 完成且无问题"）| `issues_found: 0` 的标记块同样必须输出 |
| "Step 3 和 Step 4 可以同时启动以节省时间" | Step 4 修复 prompt 依赖 Step 3 审核报告调整后的最终合并判断表。并行执行 = 修复 Agent 拿到过期数据 | Step 4 必须在 Step 3 完成且主 Agent 已更新合并判断表后启动 |
| "[多轮] 这是第N轮审查，只需快速过一遍 / 只查修改部分" | 修改可能引入跨章节副作用且审查盲区在多轮中累积；不同模型在不同轮次可能发现不同问题 | 每轮独立完整审查全部内容，审查深度与第 1 轮相同。主 Agent 执行"多轮审查防偷懒协议（主 Agent 自检）" |
| "[多轮] 尽快进入收敛状态，少一轮是一轮" | 过早收敛 = 隐藏问题进入下游 Phase，修复成本指数增长 | 收敛速度由问题实际减少趋势决定，不由轮次数量决定。每轮审查独立完整执行 |
| "[多轮] 问题已修复，本轮剩余问题很少 → 不需要下一轮" | 阈值判断依据是**本轮原始发现问题数**（p0_raw/p1_raw/p2_raw/p3_raw），不是修复后剩余数。原始发现数大说明本轮变更面广、风险高 | 从账本读取 p*_raw 字段计算触发条件，禁止使用修复后剩余数（p0/p1/p2）替代 |
| "上下文太长了，简化流程省 token" | 跳过步骤的代价远远大于 token 节省——一个被跳过的 Step 可能导致 P0 遗漏进入下游 Phase，修复成本指数增长 | Token 消耗不是跳过审查步骤的理由——每个 Step 仍需独立完整执行 |
| "tier 路由降级了，顺便多裁一点" | 搭便车偷懒——tier 路由只裁剪指定 STEP，裁剪超出 recipe 声明范围将导致审查覆盖不足 | 裁剪范围 = recipe 声明的 expected_steps。超出声明范围的裁剪 = 偷懒，按违规处理 |

#### Red Flags 自检清单

每个 Step 完成后，主 Agent 逐条自检：

```
□ Step 1: 三个 Agent 都启动了？任一未完成 → 不可标 complete，不可进入 Step 2
□ Step 2: 每条问题写了具体原因（非模板化措辞）？→ 有模板化措辞 → 重写
□ Step 3: 满足下列任一形式？→ 都不满足 → 不可进入 Step 4：(a) p0_raw≥3 或 N>15 → 独立监督 Agent 输出了报告（mode=standard）；(b) N∈[1,15] 且 p0_raw≤2 → 主 Agent 输出了 STEP3_EXECUTED（mode=transferred_to_step5）；(c) N==0 → 主 Agent 输出了 mode=trivial
□ Step 4: 所有 P0 修复均已逐条校验？→ 不清楚 → 先校验
□ Step 5: Quick Review Agent 非 Step 4 实施者？→ 是同一 Agent → 退化声明
□ 最终通读: 全文术语一致？无废弃引用？→ 不确定 → 全文 grep 验证（详见 Step 4 逐条校验）
□ 本轮判定过测试/命令结果？→ 必须核查原始输出（非摘要代理输出）——摘要工具（如 rtk）可能吞掉尾部 `, N errors`/`FAILED` 后缀；输出尾部含 `N errors`/`FAILED` 或非零退出码即视为失败，不确定时用原始命令重跑或读完整输出文件
□ 本轮有退化场景？→ 有 → 退化声明含三要素（缺失能力|尝试记录|降级依据）且 status 非 complete？
□ 本轮是第 ≥2 轮审查？→ 主 Agent 是否已完成多轮防偷懒自检（合理化表逐条确认 + 自检提醒注入 + Red Flags 全量核对）？检查审查报告中是否有 `[ANTI_LAZINESS_SELF_CHECK] round=<N>, passed=true` 记录
□ 审查 Agent 的报告覆盖了全部章节/文件？→ 执行违规检测（详见下方"多轮审查防偷懒协议 → 违规检测"）——逐章/逐文件核对，不可粗略估计
```

### 多轮审查防偷懒协议（主 Agent 自检）

> **⚠️ 本协议针对主 Agent 自身，非子 Agent。** 子 Agent 每次启动拥有干净上下文——它不知道前面进行了几轮审查、不会因为"已审过多轮"而偷懒。真正会偷懒的是已完成多轮审查、上下文已腐化的**主 Agent**——它积累了大量会话上下文，经历过多次"审查→修复→重审"循环，自然倾向于"快速过一遍"或"跳过一些步骤草草结束"。
> 
> 以下协议在审查进入第 2 轮及以后时适用。主 Agent 在每轮开始前逐条自检。
> 
> **第 1 轮的主 Agent 自检**由上方"审查纪律自检"节（合理化表 + Red Flags 自检清单）覆盖——第 1 轮使用合理化表中不依赖"已审过多轮"前提的通用条目（如"三个 Agent 结论一致→不需要监督验证""问题少→完全跳过合并验证""退化声明太复杂跳过"等）+ Red Flags 全部条目。从第 2 轮起追加"多轮审查防偷懒协议"专用自检（含多轮特有陷阱条目）。

**核心原则**: 每一轮审查是独立完整的审查——不以轮次为由缩减审查范围，不以"已审过"为由跳过章节，不以"快收敛了"为由加速流程。

**主 Agent 每轮开始前自检（第 ≥2 轮强制执行）**:

1. 确定当前轮次编号 N（取会话上下文账本 `rounds` 数组长度 + 1 作为 N——`rounds` 记录已完成轮次，当前轮次 = 已完成轮次数 + 1）（此处 N 为轮次编号，区别于 Step 3 的问题总数 N——同名不同义）
2. 当 N ≥ 2 时，主 Agent 在开始调度子 Agent 之前，先在当前输出中打印以下提醒并逐条确认：

> ⚠️ **主 Agent 自检提醒 — 第 <N> 轮**
> 
> 这是我执行的第 <N> 轮审查。逐项核对上方合理化表左列——确认自己当前没有匹配任何偷懒合理化模式。特别警惕：
> - 以轮次为由缩减范围（合理化表行"这是第N轮审查…"）
> - 以收敛为由加速流程（合理化表行"尽快进入收敛状态…"）
> - 以上下文为由跳过步骤（合理化表行"上下文太长了…"）
> 
> 如匹配任一行 → 立即按右列纠正。每个 Step 独立完整执行。

3. **逐项核对合理化表左列**（上方"审查纪律自检 → 合理化表"）——检查自己是否计划跳过某步骤、是否计划缩减审查范围、是否计划以轮次为由加速。如匹配任一行 → 立即按右列纠正。
4. **逐项核对 Red Flags 自检清单**（上方"审查纪律自检 → Red Flags 自检清单"），确认每个 Step 的执行前提条件满足。
5. **子 Agent prompt 完整性**：每个审查 Agent prompt 含 Step 1 完整性指令？→ 不含 → 补注后启动
6. 自检完成后，在审查报告中记录: `[ANTI_LAZINESS_SELF_CHECK] round=<N>, passed=true`

**违规检测（主 Agent 检查子 Agent 报告完整性）**: 主 Agent 在 Step 2 合并时，逐章/逐文件检查每个审查 Agent 的报告是否覆盖了审查对象的全部内容。发现章节/文件遗漏 → 该 Agent 的报告标记为不完整，要求该 Agent 补充审查遗漏部分后再进入合并流程。**注意**：子 Agent 不会故意偷懒（干净上下文），但可能因 prompt 中审查对象描述不完整而遗漏章节——主 Agent 的违规检测是捕获这类遗漏的最后防线。

**Step 1 — 审查 Agent 并行执行**（按 tier recipe 启动：关键层=对齐+监督 2 个；文档类完整层=结构+落地+对齐 3 个；代码类完整层=加强审查(code-review+对齐, 2 个) 或 UltraReview(6 个)。代码类具体 recipe 见上方 recipe 表）

结构审查 Agent、落地审查 Agent、对齐审查 Agent 按 tier recipe 启动，互不感知对方的发现。每个 Agent 独立输出审查报告（问题 + 严重度分级 + 证据）。

**子 Agent prompt 完整性硬约束**：每个审查 Agent 的 prompt 必须包含以下完整性指令（不可省略，多轮审查中尤其关键）：

> 请完整评审以下全部内容，逐章/逐节/逐文件审查，不要跳过任何章节、段落或文件，不要省略待评审内容。无论这是第几轮审查，都必须以第 1 轮的标准独立完整评审全部内容。

**RAW_COUNT 强制（反偷懒）**：每个审查 Agent 输出末尾必须带一行结构化计数 `RAW_COUNT: p0=N p1=N p2=N p3=N`（该 Agent 本轮发现的问题数）。主 Agent 在 STEP1_EXECUTED 标记块中汇总为 `raw_count_sum: p0=N p1=N p2=N p3=N`（所有 Agent 计数求和）（此处的 p0/p1/p2/p3 均为**原始发现数**，对应账本 p*_raw 语义，非修复后剩余的 p0/p1/p2）。此结构化计数供 Step 5 兼并合并验证时对照（见 Step 3 转移规则）——降低主 Agent 在自由文本报告中压低问题数的空间。

**Step 2 — 主 Agent 逐条合并去重**

主 Agent 收集所有审查 Agent 报告后：
- 去重合并：同一问题（同一位置+同一类型）→ 合并为一条，标注来源（如 [结构, 对齐]）。"同一位置"判定：指同一文件的同一段落/章节/代码块内，且问题描述指向同一处文本。不同位置但指向同一概念缺陷的，标记为关联但不合并。
- 冲突标注：不同 Agent 给出不同严重度 → 标注冲突，在合并判断表中以 [冲突: AgentA=P0, AgentB=P1] 标注，汇总所有冲突项后在审查报告中统一提请用户裁决（批量列出，逐条等待用户判定）
- 逐条判断：接受 / 拒绝 / 部分接受，每条写原因（不可批量同意/拒绝——每项问题的判定依赖其具体上下文，批量处理忽略差异导致误判）。判断依据：(a) 问题是否确实存在（事实判断）；(b) 修复成本与收益（设计文档级 vs 实现细节级）；(c) 是否违背文档设计意图。原因需具体到问题本身，不可使用模板化措辞。
- 输出合并判断表（# | 问题 | 来源 | 严重度 | 判断 | disposition | 原因 | 修改方案）。`disposition` 标注每条问题的处置来源：`user_adjudicated`（用户裁决的冲突项）/ `agent_accepted`（主 Agent 接受）/ `agent_rejected`（主 Agent 拒绝）。此列供 Step 5 兼并合并验证时区分用户裁决项（非压数）vs 主 Agent 自行拒绝项（潜在压数）。

> 上下文传递机制和子 Agent prompt 注入模板详见 `refs/protocols.md` 协议 5。

**Step 3 — 合并验证**（部署形式按原始发现总数 N=p0_raw+p1_raw+p2_raw 决定，N 取 Step 1 raw_count_sum 口径【去重前求和】——不取 Step 2 合并表计数，防合法去重导致档位漂移；加强审查子路径输出 `STEP3_TIER_SKIPPED`，本规则不介入）

阈值判定（N 基于原始发现数 raw_count_sum，非修复后剩余数；P0 即使被用户裁决为非问题，p0_raw 仍计原始发现值；不计 p3_raw）：

- **p0_raw≥3 或 N>15 → 独立监督 Agent（完整 4 维）**：主 Agent 将所有审查 Agent 原始审查报告全文 + 最终合并判断表注入监督 Agent prompt，执行交叉比对：①溯源检查（每条问题能否在原始报告找到来源）②遗漏检测（原始报告有但合并表缺失的发现）③合并去重合理性（该合未合/误合）④判断充分性（接受/拒绝理由是否充分+严重度校准）。输出独立审核报告（每项 [维持/修正/补充] + 理由），主 Agent 据此调整合并判断表输出最终版。输出 `STEP3_EXECUTED`（mode=standard）。仅单一模型可用时同模型执行监督，声明"缺少独立视角"。

- **N∈[1,15] 且 p0_raw≤2（未达独立监督阈值——Step 5 兼并验证 + p0_raw≥1 时严重度校准抽查 + 收敛续轮兜底）→ 转移至 Step 5**：**不启动独立监督 Agent**。合并验证的「溯源+遗漏」2 维转移到 Step 5 的 Quick Review Agent 兼并执行（见 Step 5）。主 Agent 输出 `STEP3_EXECUTED`（agents=self，mode=transferred_to_step5，degradation=none——结构重组非能力损失）。合并判断表为 Step 2 版本。

- **N==0 → trivial**：主 Agent 输出 `STEP3_EXECUTED`（agents=self，mode=trivial）。p3_raw==0 时 Step 4/5 均由主 Agent 自执行输出零问题标记块；**p3_raw>0 时 Step 4 由主 Agent 自执行修复全部 P3**（STEP4_EXECUTED 如实计 issues_found=p3_raw——默认全量修复策略覆盖 P3），Step 5 常规修复验证——防止"trivial 零修复 + 触发条件④每轮重触发"的零进展循环。

> **反偷懒**：阈值基于 Step 2 原始汇总数 p*_raw（禁止用修复后剩余数替代）。Step 5 兼并验证时对照 Step 1 的 `raw_count_sum` 求和——若原始报告实际 ≥16 条但合并表记录 ≤15，或重算各 Agent RAW_COUNT 的 p0 合计 > 合并表 p0_raw 且主 Agent 无书面去重/降级依据（涵盖 P0 降级 P1/P3、集中压报 2→1、分散压报 3→1 等全部压数形态）→ 标记 [问题数存疑]，触发重审：补独立 Step3（mode=standard）交叉验证 → 对新发现问题重修复（Step4）→ 重 Step5。不重跑 Step1-2（审查报告不变）。

> **标记块格式**：mode 字段（standard|transferred_to_step5|trivial）独立于 degradation，定义见 `refs/protocols.md` 协议 3。转移/trivial 路径由主 Agent 自执行输出（agents=self），属协议 3 主 Agent 规则的合法例外。

**⚠️ 时序硬约束: Step 4 必须在 Step 3 完成后才能启动。** Step 3 完成 = ①mode=standard → 监督 Agent 完成交叉验证 + 主 Agent 已输出最终版合并判断表；②mode=transferred_to_step5 → 主 Agent 已输出转移声明；③mode=trivial → 主 Agent 已输出 STEP3_EXECUTED。对应档位 Step 3 完成前，禁止启动任何修复子 Agent——并行启动将导致修复 Agent 拿到未经监督审核或合并验证延后的合并判断表。

**Step 4 — 子 Agent 执行修复 + 主 Agent 校验**（加强审查子路径裁剪：输出 STEP4_TIER_SKIPPED）

> **⚠️ 时序硬约束**: Step 3 与 Step 4 禁止同一 turn 启动。须等待 Step 3 完成信号（task-notification 或标记块）后，方可启动 Step 4。

**前置条件（硬约束，逐条确认后方可进入）**:
- [ ] Step 3 已按档位完成（输出 `STEP3_EXECUTED` 标记块，含 mode 字段）：mode=standard → 独立监督 Agent 已完成交叉验证 + 主 Agent 已将审核调整应用到合并判断表（最终版已输出）；mode=transferred_to_step5 → 主 Agent 已输出转移声明，合并表为 Step 2 版本；mode=trivial → 主 Agent 已输出
- [ ] 修复由独立子 Agent 执行（非主 Agent 内联）
- [ ] 修复 prompt 中的修复项来源于合并判断表（mode=standard 路径=Step 3 最终版；mode=transferred_to_step5 路径=Step 2 版本）
- [ ] 【转移路径 mode=transferred_to_step5 独有】修复 prompt 中明确声明"合并验证尚未执行，修复基于 Step 2 合并结果，Step 5 将做合并验证+修复验证双重检查"——让修复子 Agent 知情，若修复过程中发现合并遗漏可主动上报（额外横向检测点）

**修复策略（默认全量修复）**:

> **默认行为**: 启动独立修复子 Agent，逐条分析判断并全量修复所有级别问题（P0/P1/P2/P3）。
> - **P0**: 须先经用户逐条确认（问题判定 + 修复方案），确认后纳入修复 prompt
> - **P1/P2/P3**: 默认全量修复，无需逐条用户确认——但需注意：澄清性修改（消除歧义、修正措辞等）直接修复；结构性修改（改变设计意图/架构/接口/数据模型/核心流程）仍需用户审批，与上方「Gate 执行规则」节中「审查修改与审批的关系」保持一致
> - **用户可显式指定跳过**: 如"只修复 P0/P1"、"跳过 P3 风格问题"——以用户显式指令为准。**Agent 不得在未获得用户显式指令的情况下自行跳过任何级别的修复项**
> - **修复方式**: 启动独立修复子 Agent（非主 Agent 内联修复）——主 Agent 在长上下文下内联修复质量不可靠，容易遗漏边界情况和引入新问题
> - **逐条分析**: 修复子 Agent 对每条修复项独立执行 分析→判断→修改 三步，不可批量处理多条修复项——批量修复在长上下文中容易漏修边界情况和引入交叉错误

**前置 Gate — P0 用户确认**（见上方 UltraReview 审查规则节 P0 阻塞规则权威定义）：合并判断表中标记为"接受"的 P0 项，先提请用户逐条确认（问题判定 + 修复方案）。用户确认后纳入修复 prompt。P1/P2/P3 项直接纳入修复，无需逐条确认（用户可显式指定跳过某些级别）。用户拒绝某项 P0 → 标注"用户拒绝"，保留但不修复。

1. 指派修复子 Agent：
   - 模型选择：优先与审查 Agent 不同模型（确保修复视角独立）；仅单一模型时用同模型
   - Prompt 注入：最终合并判断表中标记为"接受"的修复项（精确修改指令 + 原文片段 + 新文本 + 修改位置）
   - 职责：修复子 Agent 只执行文件修改，不审查、不输出判断
   - **⚠️ 硬约束 — 同文件不并发**: 不同修复子 Agent **禁止**修改同一文件。即使修改项分布在文件的不同章节/行号，并发写入同一文件将导致编辑冲突和内容丢失。分组时以文件为最小粒度——同一文件的所有修复项必须分配给**同一个**修复子 Agent。具体规则：
     - 单文件变更 → 仅启动 1 个修复子 Agent（无论修复项多少）
     - 单文件修复项 > 10 条时 → 单个修复子 Agent 仍负责该文件，但按批次（每批 ≤10 条）顺序执行，每批完成后主 Agent 校验，确认无误后再执行下一批
     - 多文件变更 → 按文件分组，每文件 1 个修复子 Agent
     - 跨文件语义依赖（如同一术语替换、交叉引用同步）→ 将依赖文件合并到同一修复子 Agent
     - 仅当修复项涉及 ≥2 个无依赖文件时方可并行启动多个修复子 Agent
     - **"无依赖"判定标准**: 两个文件满足以下全部条件视为无依赖，可分配给不同修复子 Agent 并行执行：
       - 无共享符号/术语替换（如同一函数/变量/类名需要同步改名）
       - 无交叉引用（如文件 A 的修改引用了文件 B 的新增/删除内容）
       - 无共享配置值（如两个文件使用同一常量/配置项，需同步修改）
       - 不属同一 import/include 链（如文件 A import 文件 B，修改 B 的导出会影响 A）
       任一条件不满足 → 合并为同一修复子 Agent

2. 主 Agent 逐条校验：
   - 每条修复是否按修改方案正确应用？（原文→新文对比）
   - 修复是否引入了新问题？（残留旧术语、格式破坏、Markdown 语法错误）
   - 全文 grep 验证：废弃概念/术语已清除，无残留占位符
   - 增量审查: 仅检查变更区域及上下文，确认修复未在邻近区域引入新问题

3. 校验不通过 → 标注失败项 → 修复子 Agent 重新修复 → 主 Agent 再次校验（最多重试 3 轮，超过则标注"修复失败"并提请用户裁决）
4. 全部通过 → 进入 Step 5

降级：子 Agent 工具不可用时（极端环境），退回主 Agent 自行修复，报告中声明限制。环境不支持并行 Agent 时，修复子 Agent 改为串行执行，拆分规则不变，报告中声明"串行执行（环境限制）"。降级时 degradation 字段按标准协议输出退化声明。

修复子 Agent 完成后输出 `STEP4_EXECUTED` 标记块。多修复子 Agent 时，主 Agent 收集所有修复子 Agent 的输出后合并为**单个** STEP4_EXECUTED 标记块：issues_found 汇总所有修复子 Agent 发现的新问题数，agents 列表包含所有修复子 Agent 的名称和模型，degradation 取所有修复子 Agent 中最严重的退化状态。

**Step 4 退化补偿规则**：当 Step 4 发生退化时（退化声明按标准协议输出，状态判定见 `refs/protocols.md`），Step 5 的 Quick Review Agent 将执行两轮独立验证（见 Step 5 退化补偿规则），以补偿修复视角独立性的损失。**转移路径（mode=transferred_to_step5）下若 Step 4 退化 → 回退为独立 Step 3**：修复不可靠时合并验证必须在修复前完成（不可延迟到 Step 5），此时放弃转移，重新启动独立监督 Agent 交叉验证后再修复。具体：①不回退已修复文件；②基于已修复产物 + Step2 合并判断表启动独立 Step3（mode=standard）交叉验证；③Step3 输出后对'已修复 + Step3 新发现'合并重新执行 Step4；④标记块处理：在原 STEP3_EXECUTED（transferred_to_step5）后追加新的 STEP3_EXECUTED（mode=standard，标注'回退自 transferred_to_step5'），父技能按 protocols 协议3 多标记块规则识别同轮内最后输出为权威

**Step 5 — Quick Review 收尾**（关键层/完整层强制执行——完整层中的加强审查子路径除外：该子路径 recipe=[STEP1-2]，输出 `STEP5_TIER_SKIPPED`）

- 独立 Agent（非 Step 4 实施者）通读修复子 Agent 的输出 + 主 Agent 的校验记录
- **兼并 Step 3 合并验证模式**（当主 Agent 读取到 STEP3_EXECUTED 的 mode=transferred_to_step5 时触发本兼并模式）：Quick Review Agent 的 prompt 额外注入「所有审查 Agent 原始报告全文 + 最终合并判断表（含 disposition 列）+ 账本 rounds[N-2].p*_raw + Step 1 的 raw_count_sum」（注入模板见 `refs/protocols.md` 协议 5）。在修复验证之外，兼并执行 2 维合并验证（溯源+遗漏）+ 1 项问题数核对（共 3 项；p0_raw≥1 时追加第 4 项严重度校准抽查，防 P0 降级压报逃逸）：
  1. 溯源检查：合并表每条问题能否在原始报告找到来源？无法溯源 → [无法溯源]
  2. 遗漏检测：原始报告有但合并表缺失的发现？逐条标注（区分 disposition=user_adjudicated 的用户裁决项 vs agent_rejected 的主 Agent 拒绝项（agent_rejected 项 >3 条或占比 >30% 时标记 [拒绝异常]，并入问题数存疑检查）
  3. **问题数核对（反偷懒）**：对照 raw_count_sum 求和（p0+p1+p2 总和）vs 合并表 p*_raw——若原始报告实际 ≥16 条但合并表记录 ≤15，或重算各 Agent RAW_COUNT 的 p0 合计 > 合并表 p0_raw 且无书面去重/降级依据（涵盖 P0 降级 P1/P3 与集中/分散压报全部形态）→ 标记 [问题数存疑]，触发重审：补独立 Step3（mode=standard）交叉验证 → 对新发现问题重修复（Step4）→ 重 Step5。不重跑 Step1-2（审查报告不变）
  4. **严重度校准抽查（p0_raw≥1 时强制执行）**：合并表中每条 P1 与原始报告严重度逐条对照——原始报告标 P0、合并表降级为 P1 的项须有书面降级理由（用户裁决记录或具体事实依据）；发现无理由降级 → 标记 [问题数存疑]，按第 3 项重审升级路径处理。此项构成「P0 阻塞规则」中"P0 通过重审放行"的重审载体之一
  STEP5_EXECUTED 中新增 `notes: 兼并 Step 3 合并验证（溯源+遗漏+问题数核对；p0_raw≥1 时含严重度校准抽查）` 字段（独立于 degradation）
- 输出快速检查报告：是否所有问题均已修复？修复是否引入新问题？文档整体一致性是否保持？
- 仅单一 Agent 可用时，在审查报告中声明限制（缺少独立视角）。降级时 degradation 字段须含退化声明三要素
- **收敛判定（强制步骤，不可跳过）**: Step 5 完成后，主 Agent **必须**计算 5 个触发条件（见下方「收敛判定与硬阻止机制」节）并输出 `[CONVERGENCE_CHECK]` 标记。**加强审查子路径**（STEP5 被裁剪）在 **STEP2 完成后**输出此标记（基于 Step 2 汇总时记录的 p*_raw，即账本本轮原始发现数）。无论是否触发，标记必须输出——缺失 = 收敛判定被跳过 = 审查未完成，父技能验证 3 将阻塞。
- 完成后输出 `STEP5_EXECUTED` 标记块
- **退化补偿规则**: 如果 Step 4 发生退化（status: degraded 或 failed），Step 5 的 Quick Review Agent 执行**两轮独立验证**（第一轮: 检查修复质量；第二轮: 独立重新验证修复项）。在两轮之间主 Agent 不干预，以补偿修复视角独立性的损失。两轮验证均在 Step 5 标记块中记录，degradation 字段注明"Step 4 退化 → Step 5 执行两轮补偿验证"。**注意**：转移路径下 Step 4 退化已回退为独立 Step 3（见 Step 4 退化补偿规则），故本两轮补偿不与兼并合并验证叠加

Step 5 在本轮审查层面检查修复质量（本轮问题是否已彻底修复）；最终通读 Gate 在跨轮累积层面检查全局一致性（多轮修复之间是否有冲突）。

### Gate Token 输出（Gate 通过后）

Gate 审查最终通过（收敛判定 action=exit + 最终通读 PASS）后，review 主 Agent **必须**输出 Gate Token（两层保障）：第 1 层会话标记 `[GATE_PASSED] gate=<N>, round=<N>, tier=<tier>, p0_raw=<N>, p1_raw=<N>, convergence_triggers=<编号列表|none>`（P0 未清零时输出 `[GATE_BLOCKED]`，现有机制不变）；第 2 层文件标记 `.superpowers/.gate-passed-<N>`（`name=<任务标识符>` 绑定 + round + timestamp + tier，跨 Skill 边界/跨上下文压缩后备，首次写入前 `mkdir -p .superpowers`）。完整格式定义、与 `[CONVERGENCE_CHECK]` 的时序关系、guard 调用衔接注释（token 先写、guard 后调）见 `refs/protocols.md` 协议 3「Gate Token 输出」。独立调用（gate_id=standalone）不输出 Gate Token。

### 独立调用场景自检

用户直接调用 specpowers-review（非通过 specpowers-design/plan/apply/archive 的 Gate 路由）时无父技能双层验证，主 Agent 在最后一个 STEP 完成后（加强审查为 STEP2，其他为 STEP5）自行执行标记块完整性检查——按 `[TIER_ROUTING]`.expected_steps 核对每个 STEP 的 `STEP<N>_EXECUTED`/`STEP<N>_TIER_SKIPPED` 标记块 + 最终通读标记块 + `[CONVERGENCE_CHECK]` 标记，以 `[SELF_VERIFY]` 标记输出结果。自检结果格式、无 args 时 `file_count`/`line_count`（修改总行数）的 git 计算方法与降级回退见 `refs/protocols.md` 协议 3「独立调用场景自检」。

---

## 收敛判定与硬阻止机制

### 每 Gate 审查+修复完成后输出

审查完成后，依据本轮 P0/P1 计数输出对应声明。输出模板见 `refs/protocols.md` 协议 7。

### 收敛判定（强制输出 + 默认继续制）

Step 5（加强审查子路径为 Step 2）完成后，主 Agent **必须**计算 5 个触发条件并输出 `[CONVERGENCE_CHECK]` 标记。

> **⚠️ 防偷懒硬约束**: 触发条件**必须**使用 Step 2 汇总的原始发现数（`p*_raw`），**禁止**使用修复后剩余计数（`p0`/`p1`/`p2`）——使用修复后剩余数是最常见的偷懒模式之一（详见合理化表对应行）。

5 个触发条件（任一满足即默认继续下一轮）：① p0_raw > 1；② p1_raw > 5；③ p0_raw+p1_raw+p2_raw > 10；④ p0_raw+p1_raw+p2_raw+p3_raw > 20；⑤ p1_raw − 上轮 p1_raw > 3（轮间新增 P1 趋势闸门，全 raw 口径；首轮无上轮基准时⑤不参与判定）。完整输出判定、标记格式及输出模板见 `refs/protocols.md` 协议 7。

#### `[CONVERGENCE_CHECK]` 标记格式

格式定义见 `refs/protocols.md` 协议 7（`[CONVERGENCE_CHECK]` 标记格式节）。字段：triggers（触发条件编号列表|none）、action（continue|exit）、p0_raw/p1_raw/p2_raw/p3_raw（原始发现数）、exit_reason（exit 时填写）。

**无论是否触发，此标记必须输出。** 缺失 = 收敛判定被跳过 = 审查未完成。

> **加强审查子路径覆盖**：加强审查子路径裁剪 STEP5（recipe=[STEP1-2]，输出 STEP5_TIER_SKIPPED）。此子路径的 `[CONVERGENCE_CHECK]` 在 **STEP2 完成后**输出（替代 STEP5 后位置）。验证 3 的搜索逻辑不依赖 STEP5 存在——只要找到 `[CONVERGENCE_CHECK]` 标记即可。

#### 默认继续制（action=continue 时）

触发条件满足时，**默认进入下一轮审查**——不询问"是否继续"，而是通知即将继续并提供干预窗口。

**执行主体**：review 主 Agent 在同一 Skill 调用内部自动循环——action=continue 时回到 Step 0 启动下一轮（Round N+1）。父技能 Gate 调用仅一次返回：
- 返回 `[GATE_PASSED]` → 循环退出（收敛达标或用户终止），Gate 通过
- 返回 `[GATE_BLOCKED]` → P0 未清零，Gate 阻塞

父技能无需实现循环逻辑——循环完全封装在 review 内部（父技能验证 3 仅检查最终返回的标记存在性与语义）。

**用户交互（知情权 + 干预窗口）**：action=continue 时，review 主 Agent 在开始下一轮前向用户输出：

```
📊 Round <N> 审查完成。原始发现 P0:<p0_raw> P1:<p1_raw> P2:<p2_raw> P3:<p3_raw>。
触发条件 <编号+描述> 满足，即将开始 Round <N+1>。
如需终止审查，请说明理由。无反馈则继续。
```

这不是"询问是否继续"（退回到原来的问题），而是"通知即将继续 + 给用户干预窗口"——默认行为是继续，用户需主动干预才能终止。

#### action=exit 时

触发条件不满足（收敛达标）或用户显式终止后，输出 action=exit + exit_reason，然后执行最终通读 Gate，通过后输出 `[GATE_PASSED]` 标记（格式见 `refs/protocols.md` 协议 3「Gate Token 输出」）。

> **优先级规则**：多条件同时触发时，按条件编号升序显示（1 → 2 → 3 → 4 → 5），列出所有触发条件的编号和描述。

---

## 审查基础设施与协议

> 以下各节定义的协议与数据结构作用于整个审查流程（所有 Gate、所有 Step），非仅收敛判定场景。此处集中放置以便检索。

### 协议与数据结构参考

以下协议和数据结构的完整定义见 `refs/protocols.md`：
- 协议 1：会话上下文账本（结构 + 读写时机 + 跨 Gate 传递）
- 协议 2：跨会话缓存 review-cache.json（格式 + 读写规则 + 尽力而为操作化定义）
- 协议 3：执行标记格式（`STEP<N>_EXECUTED` + 验证规则 + 双层验证原理；含 Gate Token 输出与独立调用场景自检——`[GATE_PASSED]` 标记 + `.gate-passed-<N>` 文件格式 + `[SELF_VERIFY]` 自检）
- 协议 4：退化声明标准协议（三要素格式 + 各 Step 退化位置表 + 模型多样性降级细则）
- 协议 5：上下文传递与注入模板
- 协议 6：两级路由算法（tier routing）
- 协议 7：收敛判定与硬阻止输出模板
- 协议 8：UltraReview 详细协议（Steps A-F + 6-agent 团队定义）
- 协议 9：最终通读 Gate 详细流程

> 审查流程中对这些协议的引用（"按退化声明标准协议输出"、"从 review-cache.json 读取"）在流程描述中保留上下文。审查流程中任何协议细节不确定时，Read `refs/protocols.md` 获取完整定义。

---

## 最终通读 Gate（横切，全 Gate 适用）

最终通读 Gate 是横切 Gate，不参与 Gate 0-4 编号体系，适用于所有审查（文档类 Gate 0/1/2 与代码类 Gate 3），不可跳过、不设自动循环上限。触发时机：单轮审查在 Step 5 完成后立即执行（加强审查子路径在 STEP2 合并后以轻量通读替代）；多轮审查在最后一轮 Step 5 完成后执行。执行后输出 `STEP_FINAL_READTHROUGH` 标记块，PASS 方可进入下一环节（Gate 0-4 编号体系之外的横切 Gate，父技能不跨边界验证，由 review 内部主 Agent 自执行）。执行方式（独立子 Agent 通读 / 单模型降级声明 / 跨会话缓存 staleness 检查）、检查项、PASS 四条件（正确应用/无冲突/术语格式一致/无废弃引用）与 FAIL 重通读规则详见 `refs/protocols.md` 协议 9。
