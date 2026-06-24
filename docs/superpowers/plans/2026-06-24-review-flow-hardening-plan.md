# 审查流程强化 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 强化 specpowers-review 多模型渐进式审查流程 Steps 3-5：Step 3 监督 Agent 强制化 + Step 4 子 Agent 修复。

**Architecture:** 仅修改 `skills/specpowers-review/SKILL.md` 审查流程节（L271-291），替换 Steps 3/4/5 + 新增上下文传递机制说明。

**Tech Stack:** Claude Code SKILL.md（Markdown）

---

### Task 1: 替换审查流程 Steps 3-5

**文件:** 修改 `skills/specpowers-review/SKILL.md:271-291`

- [ ] **Step 1: 删除旧版 Steps 3/4/5（L271-291）**

删除从 `**Step 3 — 独立监督 Agent 审核方案（推荐，以下情况可跳过）**`（L271）到 `注意：Step 5 在本轮审查层面检查修复质量...`（L291）的全部内容。

- [ ] **Step 2: 写入新版上下文传递机制 + Steps 3/4/5**

在删除位置插入以下内容：

````markdown
### 上下文传递机制

独立子 Agent 无法访问主 Agent 会话上下文。通过 Agent 工具的 `prompt` 参数直接注入所需上下文：

| Step | 注入内容 | 接收方 |
|------|---------|--------|
| Step 3 | 三份原始审查报告全文 + 最终合并判断表 | 监督 Agent |
| Step 4 | 最终合并判断表中标记为"接受"的修复项（修改指令 + 原文 + 新文本 + 位置） | 修复子 Agent |
| Step 5 | 修复子 Agent 的输出 + 主 Agent 的校验记录 | Quick Review Agent |

截断策略：注入内容总长度超过 Agent prompt 限制时（通常 > 8000 字），优先保留"问题清单 + 严重度 + 证据"部分，截断"分析过程"和"冗余上下文"，截断处标注 `[... 已截断，完整报告已由主 Agent 在合并阶段审查 ...]`。合并判断表不截断。

**Step 3 — 独立监督 Agent 交叉验证（强制，不可跳过）**

主 Agent 将三路 Agent 的原始审查报告全文 + 最终合并判断表注入监督 Agent prompt。

监督 Agent 执行交叉比对：

1. 溯源检查：合并判断表中的每条问题是否都能在原始报告中找到对应来源？无法溯源 → 标注 [无法溯源]
2. 遗漏检测：原始报告中有但合并表中缺失的发现？逐条标注遗漏原因（被合并/被拒绝/被遗漏）
3. 合并去重合理性：该合并未合并 → [合并遗漏]；不该合并被误合并 → [过度合并]
4. 判断充分性：主 Agent 的接受/拒绝/部分接受理由是否充分？不充分 → [判断存疑] + 建议。严重度校准——Step 2 按"取最高级"规则统一严重度时，检查是否有过度升级/降级

输出独立审核报告：每项标注 [维持/修正/补充] + 理由 + 建议。

主 Agent 根据审核报告调整合并判断表，输出最终版。

降级：仅单一模型可用时，使用与主 Agent 相同模型执行监督，报告中声明"单一模型，缺少独立视角交叉验证"，但不可跳过。合并后问题数 < 5 → 仅执行溯源检查 + 遗漏检测（维度 1-2）；≥ 5 → 完整四维度。

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

降级：子 Agent 工具不可用时（极端环境），退回主 Agent 自行修复，报告中声明限制。环境不支持并行 Agent 时，修复子 Agent 改为串行执行，拆分规则不变，报告中声明"串行执行（环境限制）"。

**Step 5 — Quick Review 收尾**

- 独立 Agent（非 Step 4 实施者）通读修复子 Agent 的输出 + 主 Agent 的校验记录
- 输出快速检查报告：是否所有问题均已修复？修复是否引入新问题？文档整体一致性是否保持？
- 仅单一 Agent 可用时，在审查报告中声明限制（缺少独立视角）
- Quick Review 通过后输出收敛提醒

注意：Step 5 在本轮审查层面检查修复质量（本轮问题是否已彻底修复）；最终通读 Gate 在跨轮累积层面检查全局一致性（多轮修复之间是否有冲突）。两者触发时机不同，检查维度互补，不重复。
````

- [ ] **Step 3: 自审 — 验证替换完整性**

检查：
1. 旧版 Steps 3/4/5 的 21 行是否已完全删除？
2. 新版内容中所有 Markdown 格式是否正确（代码围栏配对、表格语法、标题层级）？
3. 新版 Steps 3/4/5 的编号是否连续（Step 2→Step 3→Step 4→Step 5）？
4. "注意"段与最终通读 Gate 的关系是否保留？

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-review/SKILL.md
git commit -m "feat: 审查流程强化 — Step 3 强制化 + Step 4 子 Agent 修复

- Step 3 监督 Agent 从可选改为强制交叉验证（删除跳过条件）
- Step 4 修复执行者从主 Agent 改为独立子 Agent
- 新增上下文传递机制（Agent prompt 注入 + 截断策略）
- P0 用户确认 Gate、跨文件语义依赖检查、回环重试上限
- Step 5 Quick Review 通读对象微调"
```
