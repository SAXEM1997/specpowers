# specpowers-design 子技能拆分 + Review Gate 原始发现数判断

## 概述

两个独立需求的合并设计：
1. 将 specpowers-plan 中的 Phase 0+1（探索设计+propose）拆出为独立子技能 `specpowers-design`
2. Review Gate 每轮结束后的下一轮判断，改为基于本轮**原始发现问题数**（修复前）而非修复后剩余问题数

## 需求 1: 拆分 specpowers-design 子技能

### 目标

从 `specpowers-plan`（当前覆盖 Phase 0+1+2）中提取 Phase 0+1，形成独立的 `specpowers-design` 子技能。

### 技能组架构变更

**变更前**（1 入口 + 4 子技能）：

```
specpowers (入口, 路由)
  ├── specpowers-plan   (Phase 0+1+2)
  ├── specpowers-apply  (Phase 3)
  ├── specpowers-review (审查)
  └── specpowers-archive(Phase 4)
```

**变更后**（1 入口 + 5 子技能）：

```
specpowers (入口, 路由)
  ├── specpowers-design (Phase 0+1)  ← 新增
  ├── specpowers-plan   (Phase 2)    ← 缩窄
  ├── specpowers-apply  (Phase 3)
  ├── specpowers-review (审查)
  └── specpowers-archive(Phase 4)
```

### specpowers-design 职责

**YAML frontmatter**（草案）:

```yaml
name: specpowers-design
description: Use when the user says "brainstorm this feature", "write the design doc",
  "explore requirements", or when specpowers entry skill routes to Phase 0 or Phase 1.
```

**Body 规模估算**: Phase 0+1 原文约 180 行 + OpenSpec 跳过路径 ~10 行 + Gate 验证协议 ~40 行 ≈ **230 行**，远低于 500 行阈值，无需 refs/ bundled resources 分离。

- Phase 0: brainstorming 完整流程
  - Step 0.1: 探索项目上下文
  - Step 0.2: 连环提问澄清需求
  - Step 0.3: 持久化需求澄清（`docs/superpowers/clarifications/<name>.md`）
  - Step 0.4: 方案探讨+设计呈现（逐段审批）
  - Step 0.5: 写设计文档+自审（`docs/superpowers/specs/<name>-design.md`）
  - Step 0.6: 审批 Gate（硬 Gate）+ Gate 0 审查
- Phase 1: propose 格式转换+强制对照验证
  - Step 1.1: 格式转换（生成 OpenSpec 四件套）
  - Step 1.2: 强制对照验证（逐条 COVERED/MISSING/DRIFT）
  - Step 1.3: 人工审核 + Gate 1 审查
- Gate 验证协议（双层验证：验证 0/1/2 的协议定义和通用验证逻辑随 Phase 0/1 移入。specpowers-design 仅保留 Gate 0/1 的特化参数行，验证 2（Gate 2）保留在 specpowers-plan 中）
- **OpenSpec 跳过路径**：
  - 触发条件：用户要求跳过 或 `openspec --version` 不可用
  - 行为：跳过 Phase 1 全部步骤，输出 `[OPENSPEC_SKIPPED] Phase 1 已跳过，design doc 将直接作为 Phase 2 输入`，同时写入持久化标记文件 `.superpowers/.phase1-skipped`（内容为 `<name>`），用于跨会话恢复时区分"Phase 1 已跳过"与"Phase 1 尚未开始"
  - specpowers-plan Phase 2 衔接时需适配此场景：无 openspec/ 产物时，只以 design doc + clarifications 为输入

### specpowers-plan 职责变更

- 从 Phase 0+1+2 → **Phase 2 only**（writing-plans 衔接 + Gate 2）
- 删除全部 Phase 0/1 内容
- 前置检查：确认 Phase 0/1 产物存在（由 specpowers-design 产出），而非假设由本技能产出
- 衔接指令适配 OpenSpec 跳过场景：无 openspec/changes/ 产物时只读 design doc + clarifications
- 标题从"设计+衔接阶段"→"衔接阶段"
- **YAML description 更新**：删除 Phase 0 关键词（"brainstorm this feature"、"write the design doc"、"explore the codebase"），替换为 Phase 2 专属触发词。新 description 草案：
  ```yaml
  description: Use when the user says "plan the implementation", "bridge OpenSpec to
    Superpowers", or when specpowers entry skill routes to Phase 2. Handles writing-plans
    bridging from design/spec artifacts to TDD implementation plan.
  ```
- Gate 验证协议仅保留 Gate 2 行

### 跨技能过渡协议

**入口技能 Phase 自动检测步骤**（实施时需在 specpowers/SKILL.md 的阶段路由表之前新增）：

当前入口技能（specpowers/SKILL.md L100-101）的"完成模式选择后，按当前 Phase 加载对应子技能"假设 Phase 已知（通常由会话上下文持久化），但跨会话恢复时 Phase 未知。需将故障排查表（L234）的产物存在性判断逻辑提升为正式路由前提：

| 产物状态 | Phase 判定 | 加载技能 |
|---------|-----------|---------|
| `clarifications/` 存在，`design.md` 不存在 | Phase 0 中途 | specpowers-design |
| `.phase1-skipped` 存在 | Phase 1 已跳过 | specpowers-plan (Phase 2) |
| `clarifications/` + `design.md` 存在，`openspec/` 不存在 | Phase 0 完成 | specpowers-design |
| `openspec/changes/<name>/` 存在 | Phase 1 完成 | specpowers-plan (Phase 2) |
| `plans/<name>.md` 存在 | Phase 2 完成 | specpowers-apply (Phase 3) |

> 此逻辑同时解决中间状态路由问题——如仅 clarifications 存在时（Step 0.3 完成后中断），入口技能应路由到 specpowers-design 继续 Phase 0，而非 specpowers-plan Phase 2。

拆分前，Phase 0→1→2 均在 specpowers-plan 单次 `Skill()` 加载内自然流转。拆分后需定义过渡协议：

**specpowers-design → specpowers-plan 过渡信号**：
- specpowers-design 完成 Phase 0+1（含 Gate 0/1 审查通过）后，其产物 `docs/superpowers/specs/<name>-design.md` 已存在于磁盘
- 入口技能（specpowers）按**产物存在性**判断 Phase 推进：`design.md` 存在 + `clarifications` 存在 → Phase 0/1 已完成 → 路由到 specpowers-plan Phase 2
- OpenSpec 跳过路径下，`openspec/changes/<name>/` 不存在也视为正常（Phase 1 已跳过）

**入口技能路由更新**：当前阶段路由表将 Phase 0 和 Phase 1-2 均路由到 specpowers-plan（共两行），拆为三行：

| 当前 Phase | 模式 | 加载 | 命令 |
|-----------|------|------|------|
| Phase 0 | 中等+ | specpowers-design | `Skill({skill: "specpowers-design"})` |
| Phase 1 | 中等+ | specpowers-design | `Skill({skill: "specpowers-design"})` |
| Phase 2 | 中等+ | specpowers-plan | `Skill({skill: "specpowers-plan"})` |

**跨会话恢复适配**：入口技能故障排查表（specpowers/SKILL.md 故障排查节）的跨会话恢复点检查逻辑保持不变——按产物存在性判断恢复点。但路由映射需更新：Phase 0/1 产物存在时加载 specpowers-design（非 specpowers-plan）。

### 受影响文件（需求 1）

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `skills/specpowers-design/SKILL.md` | **新建** | 从 specpowers-plan 提取 Phase 0+1 全部内容 + OpenSpec 跳过路径 |
| `skills/specpowers-plan/SKILL.md` | 修改 | 删除 Phase 0/1，缩窄为 Phase 2 only |
| `skills/specpowers/SKILL.md` | 修改 | 技能组结构表、阶段路由表拆分（Phase 0→design, Phase 1→design, Phase 2→plan）、各模式映射表更新、架构数量声明更新（4子技能→5子技能）、快速上手映射表更新 |
| `skills/specpowers-review/SKILL.md` | 修改 | Gate 触发协议汇总表 L580-581 触发者列 Gate 0/1 → specpowers-design，L411 独立调用自检注释追加 specpowers-design |
| `CLAUDE.md` | 修改 | 目录结构表新增 specpowers-design |
| `README.md` | 修改 | 技能组架构图/描述更新 |

### 不改的文件

- `specpowers-apply/SKILL.md` — 不引用 specpowers-plan 内部结构，不受影响
- `specpowers-archive/SKILL.md` — 不涉及设计/plan 阶段
- `commands/specpowers.md` — 描述足够抽象，不需要更新

---

## 需求 2: Review Gate 基于原始发现数的下一轮判断

### 问题

当前收敛提醒的判断依据是**修复后的剩余问题数**（Step 5 完成后还剩多少问题）。这导致一个漏洞：一轮审查发现大量问题，全部修复后剩余=0，系统判定"趋于收敛"——但发现大量问题本身就说明复杂度高、风险大，需要额外一轮审查。

> **注**：条件 4（P0+P1+P2+P3 ≥ 10）要求追踪 P3 计数。当前审查流程已定义 P3 严重度级别但账本未记录 P3。本次变更一并补齐 P3 追踪能力。

### 目标逻辑

判断依据改为**本轮审查原始发现的问题数**（Step 2 汇总后/修复前审查发现了多少问题）。

4 个触发条件，**任一满足即强烈提醒进行下一轮**：

| # | 条件 | 含义 |
|---|------|------|
| 1 | 存在 P0（P0 > 0） | 本轮有阻塞性问题 |
| 2 | P1 ≥ 3 | 重要问题较多 |
| 3 | P0+P1+P2 ≥ 5 | 总问题数达到中等规模 |
| 4 | P0+P1+P2+P3 ≥ 10 | 含风格问题总数很多 |

> **注**: 条件 1（存在 P0）与现有 `[GATE_BLOCKED]` 硬阻止是两个独立机制：
> - `[GATE_BLOCKED]`：P0>0 → Gate 未通过，**强制**修复-重审循环（审查内部行为）
> - 条件 1：本轮发现过 P0 → 即使已全部修复，也**强烈建议**下一轮（提醒用户不要直接进入下一步骤）

### 场景重写

**场景 A（原始 P0 > 0 或触发其他条件）— 强烈提醒**：

```
> **审查下一轮提醒**
>
> 本轮原始发现 P0: <N> 个, P1: <Y> 个, P2: <Z> 个, P3: <W> 个。
>
> ⚠️ **触发条件：<条件编号+描述>**（触发即强烈建议下一轮）
> 本轮审查原始发现的问题数已达到需要额外审查的级别，即使当前问题已全部修复，仍**强烈建议启动下一轮审查**，避免以下风险：
> - 修复引入的回归问题未被发现
> - 高复杂度变更中的隐藏缺陷
> - 审查盲区的累积
>
> **上轮对比**（如适用）：
> - 上轮原始发现：P0: X, P1: Y, P2: Z, P3: W → 本轮：P0: X', P1: Y', P2: Z', P3: W'
> - 趋势：收敛中 ↗ / 持平 → / 恶化 ↘
>
> 请确认：是否进行下一轮审查？
>
> **[DEGRADED] 模式**（旧格式账本场景）：不展示上轮对比段（数据不可用），仅展示当轮原始发现数 + 声明 "旧格式账本缺少原始发现数，回退独立判断"。
```

> **优先级规则**：当多条件同时触发时，按条件编号升序显示（条件 1 > 条件 2 > 条件 3 > 条件 4），列出所有触发条件的编号和描述。

**场景 B（原始 P0=0，不触发任何条件）— 轻量提醒**：

```
> **审查收敛提醒**
>
> 本轮原始发现 P0: 0, P1: <Y>, P2: <Z>, P3: <W>，未触发下一轮审查阈值，趋于收敛。是否继续下一轮审查？
```

> **注**: 各场景的上轮对比数据仍然展示（帮助用户了解趋势），但不改变触发条件判定。

### 数据记录变更

需要在会话上下文账本中区分两类数据：

- `p0/p1/p2`（现有）→ 新增 _raw 后缀字段表示原始发现数（现有 p0/p1/p2 保留用于向后兼容，但不参与收敛判断条件计算）
- 新增 `p3` 字段（账本目前未记录 P3）

账本轮次结构更新为：

```
"rounds": [
    {
        "round": 1,
        "p0_raw": 1,       // 原始发现 P0（Step 2 汇总时记录）
        "p1_raw": 4,       // 原始发现 P1
        "p2_raw": 3,       // 原始发现 P2
        "p3_raw": 2,       // 原始发现 P3
        "issues_summary": ["问题简述1", ...],
        "timestamp": "..."
    }
]
```

记录时机：Step 2 主 Agent 汇总完成后立即写入 `p0_raw/p1_raw/p2_raw/p3_raw`。Step 5 完成后不再重复写入（仅追加 lessons_learned）。

### 受影响文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `skills/specpowers-review/SKILL.md` | 修改 | "收敛提醒与硬阻止机制"节重写 4 个场景 |
| `skills/specpowers-review/refs/protocols.md` | 修改 | (a) 账本结构新增 p0_raw/p1_raw/p2_raw/p3_raw + P3 字段；(b) 读写时机表新增 Step 2 行"写入 rounds（原始发现数）"，原 Step 5 行改为"写入 lessons_learned" |

### 不改的文件

- 父技能（specpowers-plan / specpowers-apply / specpowers-design）：Gate 验证协议读取的是 `[GATE_BLOCKED] p0_count=N` 标记块（审查报告输出），不读取账本字段，不受影响
- 审查流程（Step 1-5）：不受影响，仅 Step 5 完成后的收敛提醒文案和判断逻辑变更

---

## 改动汇总

| 文件 | 需求 1 | 需求 2 | 总改动数 |
|------|--------|--------|---------|
| `skills/specpowers-design/SKILL.md` | **新建** | — | 1 |
| `skills/specpowers-plan/SKILL.md` | 删除 Phase 0/1 + 缩窄为 Phase 2 only | — | 1 |
| `skills/specpowers/SKILL.md` | 路由拆分 + 架构数量 + 映射表 + 快速上手 | — | 1 |
| `skills/specpowers-review/SKILL.md` | Gate 0/1 触发者列更新 + L411 自检注释 | 收敛提醒节重写 | 1 |
| `skills/specpowers-review/refs/protocols.md` | — | (a) 账本结构新增 p0-3_raw + P3 字段；(b) 读写时机表新增 Step 2 行 + Step 5 行改为 lessons_learned | 1 |
| `CLAUDE.md` | 目录结构表新增 specpowers-design | — | 1 |
| `README.md` | 技能组架构描述更新 | — | 1 |
| **总计** | | | **7 文件** |

---

## 关键设计决策

1. **Why 合并两个需求到一个 design**：两者独立但在同一轮实施中，合并减少 Gate 审查开销。改动范围无交集（specpowers-design 新建 vs review 内部逻辑修改），互不冲突。
2. **Why specpowers-design 覆盖 Phase 0+1 而非仅 Phase 0**：用户选择 C 方案。Phase 1 propose 本质是格式转换——将设计文档转为 OpenSpec 结构化格式——与设计紧密相关，单独拆出到 plan 会打断设计→规范的连贯性。
3. **Why 原始发现数用独立字段 `p0_raw`**：不复用现有 `p0` 字段，避免与旧逻辑（修复后剩余数）混淆。新增字段语义明确，向后兼容（父技能不读账本字段）。
4. **Why 条件 4 包含 P3**：P3 是风格问题，大量 P3（≥10）说明代码或文档质量有问题、需要更多轮打磨，即使单个 P3 不阻塞 Gate。4 条件全覆盖（严重→轻微）避免任何维度的遗漏。
5. **Why specpowers-design 不新增审查步骤**：用户确认 Phase 0 的 Gate 0（多模型渐进式审查 design vs clarifications）和 Phase 1 的 Gate 1（多模型渐进式审查 OpenSpec 四件套 vs design + clarifications）已有完整对齐审查，从 specpowers-plan 搬移到 specpowers-design 即可，无需增强。
6. **Why 账本写入改为两阶段（Step 2 + Step 5）**：原始发现数必须在 Step 2 汇总完成后立即记录（修复后原始数据不可恢复）。Step 5 仅追加 lessons_learned。这是协议级别变更——当前 protocols.md 定义单一写入点（Step 5 完成后），变更为 Step 2 写入原始计数 + Step 5 追加教训。需同步更新 protocols.md 读写时机表。

## 约束条件

- Phase 0/1 内容从 specpowers-plan 迁移到 specpowers-design 时保持原文不变（仅添加 OpenSpec 跳过路径）
- OpenSpec 跳过路径下需写入持久化标记文件 `.superpowers/.phase1-skipped`，入口技能在 Phase 检测时读取以区分"已跳过"与"未开始"（两者文件系统状态相同：design.md + clarifications 存在但 openspec/ 不存在）
- specpowers-plan 缩窄后所有引用它的地方（specpowers/SKILL.md 路由表、CLAUDE.md、README.md）必须更新
- 账本字段新增后，读取旧格式缓存时需兼容处理：缺失 `p0_raw/p1_raw/p2_raw/p3_raw` 时不使用旧 `p0/p1/p2` 伪装（旧格式的 `p0` 是修复后剩余数，用它替代 `p0_raw` 会精确复现需求 2 要修复的漏洞）。回退策略：旧格式轮次的数据视为不可用（unknown），该轮不参与收敛判断条件计算，改用当轮数据做独立判断，输出 `[DEGRADED] 旧格式账本缺少原始发现数，回退独立判断`
- 审查流程 Step 1-5 不变，仅 Step 5 后的收敛提醒逻辑变更
- 父技能 Gate 验证协议（验证 0/1/2）不变——双层验证读取 `[GATE_BLOCKED]` 和 `STEP<N>_EXECUTED`，不依赖账本

## 验证方法

1. 确认 `skills/specpowers-design/SKILL.md` 文件存在且 YAML frontmatter 的 `name` 字段为 `specpowers-design`
2. 通读新建的 `specpowers-design/SKILL.md`，确认 Phase 0+1 内容完整 + OpenSpec 跳过路径正确
3. 通读缩窄后的 `specpowers-plan/SKILL.md`，确认仅保留 Phase 2 + Gate 2
4. 通读入口 skill 路由表，确认 Phase 0→specpowers-design, Phase 2→specpowers-plan
5. 通读 specpowers-review 收敛提醒节，确认 4 条件逻辑正确、文案区分清晰
6. grep `skills/specpowers-plan/SKILL.md` 正文确认无 Phase 0/1 流程步骤残留（如 "Step 0.1"、"Phase 0"、"Step 1.1"）
7. grep 确认所有文件中对 specpowers-plan 的"设计+衔接"描述已更新
8. grep `skills/specpowers-review/SKILL.md` 中的 `specpowers-plan 调用`，确认 Gate 0/1 已改为 specpowers-design，Gate 2 保持 specpowers-plan
9. grep 活跃技能文件（skills/、CLAUDE.md、README.md，排除 docs/superpowers/specs/ 和 docs/superpowers/plans/ 历史文档）中残留的旧引用

## 测试策略

遵循 writing-skills Iron Law（"NO SKILL WITHOUT A FAILING TEST FIRST"），关键测试场景：

1. **specpowers-design 加载验证**：`Skill({skill: "specpowers-design"})` 能被正确加载，Phase 0 brainstorming 流程完整执行
2. **入口路由验证**：入口技能 specpowers 在 Phase 0 正确路由到 specpowers-design（非 specpowers-plan）
3. **跨技能过渡验证**：specpowers-design 完成 Phase 0+1 → 入口技能检测产物存在性 → 路由到 specpowers-plan Phase 2
4. **OpenSpec 跳过路径验证**：`openspec --version` 不可用时 specpowers-design 正确跳过 Phase 1，输出 `[OPENSPEC_SKIPPED]`
5. **Gate 0/1 审查验证**：specpowers-design 内的 Gate 0（design vs clarifications）和 Gate 1（OpenSpec 四件套 vs design）正常执行，标记块正确输出
6. **收敛提醒验证**：原始发现数触发条件（P0>0/P1≥3/总≥5/含P3≥10）正确输出强烈提醒
7. **旧格式账本兼容验证**：读取仅有 p0/p1/p2（无 _raw 后缀）的旧格式账本，确认系统输出 [DEGRADED] 声明并回退独立判断
8. **跨会话恢复验证**：specpowers-design 完成 Phase 0+1 后模拟会话重启，确认入口技能正确检测产物并路由到 specpowers-plan Phase 2
