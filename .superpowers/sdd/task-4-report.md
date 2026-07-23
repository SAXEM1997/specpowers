# Task 4 Report: 辅助文件旧审查阈值替换

## 执行摘要

4 个辅助文件已完成旧阈值替换，每文件独立 commit。验证通过（0 残留）。

## 修改详情

### A. protocols.md
- Commit: `docs: protocols.md标记块验证规则表同步新审查阈值`
- 修改: Gate 3 标记块验证规则表中 2 行
  - `>=10 文件` → `其他情况`
  - `<10 文件` → `≤2 文件且 ≤200 行`

### B. README.md
- Commit: `docs: README同步新审查阈值`
- 修改: 3 处
  - 技能职责表: `UltraReview（代码 ≥10 文件）` → `加强审查（≤2 文件且 ≤200 行）/ UltraReview + 对齐审查（其他情况）`
  - 审查决策树: `≥10 文件 → UltraReview (5 Agent 团队)` → `其他情况 → UltraReview + 对齐审查（6 Agent 团队）`
  - 审查决策树: `<10 文件 → 加强审查 (code-review + 对齐 Agent 单审)` → `加强审查（≤2 文件且 ≤200 行, code-review + 对齐 Agent 单审）`

### C. CLAUDE.md
- Commit: `docs: CLAUDE.md同步新审查阈值`
- 修改: 2 处
  - 目录结构表 L31: `UltraReview（代码≥10文件）` → `UltraReview+对齐审查（其他情况）`
  - 设计决策 L42: `代码类≥10文件→UltraReview，<10文件→加强审查` → `代码类由 specpowers-review 内部按文件数+行数级联判定`

### D. commands/specpowers.md
- Commit: `docs: commands/specpowers.md同步新审查阈值`
- 修改: 1 处
  - `UltraReview for code ≥10 files` → `加强审查 (≤2 files ≤200 lines) / UltraReview + 对齐审查 (other cases)`

## 验证结果

```
grep -rn ">=10.*文件\|<10.*文件\|≥10.*文件" README.md CLAUDE.md commands/specpowers.md skills/specpowers-review/refs/protocols.md
```
**结果: 0 匹配** — 所有旧阈值已完全替换。

## Git 日志

```
docs: commands/specpowers.md同步新审查阈值
docs: CLAUDE.md同步新审查阈值
docs: README同步新审查阈值
docs: protocols.md标记块验证规则表同步新审查阈值
```

```STEP1_EXECUTED
status: complete
agents: [main_agent(claude)]
issues_found: 0
degradation: none
ref: AgentId=self, tokens=~8000
```
