# Task 3 Report: specpowers-apply SKILL.md Gate 3 阈值同步 + 行数计算

## Status: COMPLETED

## Changes Applied (6/6)

### Change 1 (L12): Pre-check item 4
- **Before**: 微小任务跳过 specpowers-review Gate 体系，由内部审查协议执行
- **After**: 微小任务仍须加载 specpowers-review 执行 Gate 3 审查（走内部级联判定路径）

### Change 2 (L43-46): Gate 3 decision tree summary
- **Before**: 3路分支（微小/中等+<10文件/中等+≥10文件），5-agent
- **After**: 2路级联（条件1: ≤2文件且≤200行→加强审查 / 条件2: 其他→UltraReview），6-agent

### Change 3 (L52-56): Verify 0
- **Before**: mode === "tiny" → 跳过全部验证
- **After**: 所有模式均继续验证 1 + 验证 2

### Change 4 (L58-64): Verify 1 STEP marker expectations
- **Before**: UltraReview(≥10文件): STEP1-5, 加强审查(<10文件): STEP1-2
- **After**: 加强审查(≤2文件且≤200行): STEP1-2, UltraReview+对齐审查(其他): STEP1-5

### Change 5 (L75-77): code-review section condition
- **Before**: 加强审查路径（代码 <10 文件）
- **After**: 加强审查路径（代码 ≤2 文件且 ≤200 行）

### Change 6 (NEW): Step 0 — 计算变更规模
- Inserted after `## 审查（Gate 3）` header
- Uses `git diff --shortstat $(git merge-base main HEAD)..HEAD` to compute file count + total churn
- Uses `awk '{print $4+$6}'` to compute additions + deletions

## Verification
- `grep` for old thresholds (>=10 文件, <10 文件, 微小任务 跳过, mode === "tiny") → **0 matches**
- New content confirmed: `git diff --shortstat`, `Step 0`, `条件 1/2`, `所有模式均继续`, `加强审查（≤2 文件且 ≤200 行）`

## Commit
- `git add skills/specpowers-apply/SKILL.md`
- `git commit -m "refactor: apply-skill Gate 3同步新阈值 + 新增行数计算步骤"`
- 1 file changed, 20 insertions(+), 11 deletions(-)
