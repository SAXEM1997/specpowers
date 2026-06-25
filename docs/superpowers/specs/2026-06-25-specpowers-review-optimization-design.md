# specpowers-review 效果优化

## 概述

本轮对 specpowers-review 做三个方向的优化：(1) 追加合理化表 + Red Flags 自检清单，直接作用于 discipline failure 根因；(2) 提取协议/数据结构到 refs/，利用 progressive disclosure 降低主文件行数；(3) 保守语言精简 + UltraPlan 术语消歧义。

**核心洞察**：四个独立子 Agent 的交叉分析收敛到同一结论——"合理化表"是唯一能实质性提升 Agent 行为正确性的改动。它直接作用于 Agent 跳过规则的真实心理路径（预先命名并反驳自我合理化借口），而非在当前文本协议边界内堆更多"必须/不可跳过"规则。

## 改动范围

| 文件 | 操作 | 预估行数变化 |
|------|------|-------------|
| `skills/specpowers-review/SKILL.md` | 修改 | 791 → ~540（新增合理化表 ~40 + 保守精简 ~50 - 提取 ~230 到 refs/，净减 ~250） |
| `skills/specpowers-review/refs/protocols.md` | **新建** | ~240 |
| `skills/specpowers/SKILL.md` | 修改 | UltraPlan 消歧义 ~3 行 |
| `skills/specpowers-plan/SKILL.md` | 修改 | UltraPlan 消歧义 ~1 行 |

## 不改的文件

- `skills/specpowers-apply/SKILL.md` — 本轮无改动

## 改动 1: 合理化表 + Red Flags 清单

### 插入位置

Step 0（准备审查经验）之后、Step 1（三 Agent 并行审查）之前。

插入时在合理化表之前加一句衔接语：
> 在启动审查 Agent 前，主 Agent 先完成以下自检——以下列出的每一项合理化都是实际审查中观察到的 Agent 跳过模式。

### 合理化表

| 如果你在想… | 为什么这是陷阱 | 正确做法 |
|------------|---------------|---------|
| "三个 Agent 结论一致 → 不需要监督验证" | 一致可能是共识偏见而非正确。本项目第三轮监督 Agent 曾在合并判断表中发现 12 项所有审查 Agent 都未注意到的遗漏 | Step 3 强制执行，无论 Agent 间结论是否一致 |
| "问题 < 5 → 太简单不需要完整监督" | 问题少意味着每条问题的误判成本更高。一个被误判为 P1 的 P0 在 3 个问题的集合中比在 20 个问题的集合中危害更大 | 仅缩小范围（溯源检查 + 遗漏检测），不跳过监督 |
| "这轮只是小修复，不需要 Quick Review" | 修复引入新问题是已知模式——"修复→引入问题→遗漏修复"是多轮审查中最常见的失败路径 | Step 5 强制执行，无论修复规模 |
| "用户会发现剩余问题" | 用户审查是后续环节——Gate 审查阶段跳过的偏差在下游 Phase 逐层放大 | 每个 Gate 独立完成全部审查步骤 |
| "退化声明太复杂，跳过" | 无退化声明 → 父技能按标记块缺失处理 → 阻塞 Phase。退化声明的存在性比措辞完美更重要 | 至少输出 (a) 缺失了什么能力 (b) 尝试过什么 |
| "零问题 → 不需要标记块" | 父技能将标记块缺失解释为"Step 未执行"（而非"Step 完成且无问题"）| `issues_found: 0` 的标记块同样必须输出 |

### Red Flags 自检清单

每个 Step 完成后，主 Agent 逐条自检：

```
□ Step 1: 三个 Agent 都启动了？任一未完成 → 不可进入 Step 2
□ Step 2: 每条问题写了具体原因？→ 有模板化措辞 → 重写
□ Step 3: 监督 Agent 输出了独立报告？→ 没有 → 不可进入 Step 4
□ Step 4: 所有 P0 修复均已逐条校验？→ 不清楚 → 先校验
□ Step 5: Quick Review Agent 非 Step 4 实施者？→ 是同一 Agent → 退化声明
□ 最终通读: 全文术语一致？无废弃引用？→ 不确定 → grep 验证
□ 本轮有退化场景？→ 有 → 退化声明含三要素（缺失能力|尝试记录|降级依据）且 status 非 complete？
```

## 改动 2: 提取 refs/protocols.md

### 提取内容

从 specpowers-review SKILL.md 提取 4 个节到新文件 `refs/protocols.md`：

| 节 | 内容 | 行数（约） |
|---|------|----------|
| 会话上下文账本协议 | 结构 + 读写时机 + 跨 Gate 传递 | 55 |
| 跨会话缓存 | review-cache.json 格式 + 操作化定义 + 去重 | 58 |
| 执行标记格式定义 | 标记块格式 + Step 定义 + 验证规则 + 双层验证 | 90 |
| 退化声明标准协议 | 三要素 + 各 Step 退化位置表 | 28 |

### refs/protocols.md 结构

```
# specpowers-review 协议与数据结构参考

> 由 specpowers-review SKILL.md 按需引用。仅在需要查阅具体格式定义时读取。

## 协议 1: 会话上下文账本
## 协议 2: 跨会话缓存 (review-cache.json)  
## 协议 3: 执行标记格式
## 协议 4: 退化声明标准协议
```

文件无 YAML frontmatter（非独立 Skill，是 bundled resource）。

### 保留在 SKILL.md 的内容

- 审查决策树 + Gate 体系 + 执行规则
- UltraReview / 加强审查 / 多模型渐进式审查（Step 0-5 完整流程）
- 上下文传递机制 + 注入模板 + 截断策略
- 收敛提醒与硬阻止机制（4 场景模板）
- 最终通读 Gate
- 独立调用场景自检
- Gate 触发协议汇总表
- **新增**: 合理化表 + Red Flags 清单

### SKILL.md 中的索引替换

"协议与数据结构索引" 节改为文件指针：

```markdown
### 协议与数据结构参考

以下协议和数据结构的完整定义见 `refs/protocols.md`：
- 会话上下文账本（结构 + 读写时机 + 跨 Gate 传递）
- review-cache.json（格式 + 读写规则 + 尽力而为操作化定义）
- 执行标记格式（`STEP<N>_EXECUTED` + 验证规则 + 双层验证原理）
- 退化声明三要素（格式 + 各 Step 退化位置表）

> 审查流程中对这些协议的引用（"按退化声明标准协议输出"、"从 review-cache.json 读取"）在流程描述中保留上下文。审查流程中任何协议细节不确定时，Read `refs/protocols.md` 获取完整定义。
```

### 提取后原位置的残留内容

退化声明标准协议当前位于审查流程中间（Step 2 之后、Step 3 之前），提取后在原位置保留精简内联摘要：
```
> **退化声明格式**: degradation 字段含三要素——<缺失能力>|<影响分析>|<替代措施>。完整定义见 refs/protocols.md。
```
其余 3 个被提取的协议（账本、缓存、执行标记）位于 "审查基础设施与协议" 区，不存在 mid-flow 空缺——索引替换节中的文件指针已覆盖。

### 预估效果

| 文件 | 行数 |
|------|------|
| `skills/specpowers-review/SKILL.md` | 791 → ~540 |
| `skills/specpowers-review/refs/protocols.md` | ~240 |

## 改动 3: 保守语言精简 + UltraPlan 消歧义

### 只改这些

| 位置 | 改动 | ~节省 |
|------|------|------|
| 术语说明节 | "用户"定义压缩为一行：`**用户**：人类开发者（审批修复方案），非调用方 Agent`；"主 Agent"/"微小任务"各压缩为一行 | 5 行 |
| 退化声明标准协议节导航提示 | 已由改动 2 提取到 refs/protocols.md 覆盖，不计入改动 3 | — |
| Step 3/4/5 降级段 | 退化声明三要素重复 → "退化声明按标准协议输出" | 12 行 |
| Step 4 补偿规则段 | 退化声明引用改为"按标准协议输出"，退化状态判定见 refs/protocols.md | — |
| Step 1/3/4/5 标题行 | 正文第一句与标题重复（各 Step ~2 行） | 8 行 |
| review-cache.json 写入时机说明 | 与账本缓存差异表的耐久性模型重复段 | 5 行 |
| 执行标记验证规则节 | 验证能力表与协议边界说明合并为一段 | 8 行 |
| 全文 `> **注意**:` / `> **设计说明**:` | 补充性内容的引用块（核心保留为正文，说明性删除） | 10 行 |
| `skills/specpowers/SKILL.md` 决策树 | UltraPlan 消歧义（"使用本 Skill 绑定的 refs/ultraplan-*.md，非 Claude Code 原生 /ultraplan"） | 3 行 |
| `skills/specpowers-plan/SKILL.md` Phase 2 交接 | UltraPlan 消歧义 | 1 行 |

### 不碰的硬约束

- `[GATE_BLOCKED] p0_count=<N>` 精确格式（跨 Skill grep 依赖）
- 模型降级补偿协议（"落地先行执行，报告注入对齐 prompt"）
- 收敛场景区分逻辑（4 个场景的阈值差异）
- `STEP<N>_EXECUTED` 格式定义
- 退化声明三要素表
- YAML frontmatter
- 所有表格
- 退化声明三要素 core format（degradation 一行兜底格式 `<缺失能力>|<影响>|<替代措施>` 保留在 SKILL.md 中）

### "说明性内容"判定规则

- 删除该内容后，Agent 能否仍然正确理解并执行当前 Gate/Step？→ 能 = 可删；不能 = 保留
- 该内容是否在文件其他位置有等价定义？→ 有 = 可删；没有 = 保留
- 该内容是给人读的路径指引（如"读者可跳过本节"）→ 可删
- 该内容涉及跨 Skill grep 匹配的精确格式字符串（如 [GATE_BLOCKED]）→ 不可删

## 明确搁置（本轮不实施）

| 搁置项 | 理由 | 后续 |
|--------|------|------|
| `/goal` 命令集成 | 需解决 3 个 CRITICAL 问题后独立设计迭代 | 下次独立议题 |
| 收敛场景模板激进压缩 | 4 模板 80→25 行压缩风险 ≥ 收益 | 基线测试建立后评估 |
| 模型多样性规则表格化 | 丢失 2-model 补偿协议的操作指令 | refs/ 提取后评估 |
| specpowers-plan/apply 文件改动 | 除改动范围表中已列的 specpowers-plan +1 行 UltraPlan 消歧义外，不涉及其他改动 | — |

## 约束条件

- 所有现有协议行为保持不变（双层验证、硬阻止、标记块验证、退化声明三要素）
- 跨 Skill 的 grep 匹配模式（`[GATE_BLOCKED]`、`STEP<N>_EXECUTED`）精确格式不变
- refs/protocols.md 是 SKILL.md 的被引用文件，不改变加载行为（Agent 按需读取）

### 实施顺序

1. **先执行改动 2**（提取 refs/protocols.md + SKILL.md 索引替换）——确保协议内容原样复制到 refs/，未被精简修改
2. **再执行改动 3**（保守语言精简）——仅作用于提取后 SKILL.md 的保留内容
3. **最后执行改动 1**（插入合理化表 + Red Flags）——在精简后的文件中定位 Step 0 和 Step 1 之间的插入位置

建议分 3 次 commit，确保每次 commit 后文件处于功能可用状态。

### 实施后文档同步

实施完成后更新以下文件：
- `specpowers-review-deferred-items.md`: 同步搁置表中的 3 个新搁置项
- `specpowers-review-lessons-learned.md`: 同步本轮新增的 4 条教训（如尚未完成）
- `MEMORY.md`: 确认所有引用指向最新版本

---

> **2026-06-26 实施完成**: 3 次 commit 实施完毕——
> 1. `6c43d1f` 提取协议到 refs/protocols.md（SKILL.md 791→552）
> 2. `54ba69c` 保守语言精简 + UltraPlan 消歧义（SKILL.md 552→550）
> 3. `95e8c33` 插入审查纪律自检——合理化表 + Red Flags 清单（SKILL.md 550→578）
> 
> 实施后 SKILL.md 578 行（原 791 行，净减 213 行 / -27%）。
> 搁置项（/goal 集成、模板压缩、表格化）已同步至 `specpowers-review-deferred-items.md`。
