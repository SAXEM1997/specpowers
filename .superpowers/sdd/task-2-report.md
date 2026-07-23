# Task 2 Report: 入口skill路由表和映射表同步新审查阈值

**Date**: 2026-06-29
**Commit**: `1bffcf0`

## Changes Made

### Change 1: Stage routing table — review row (line 110)

**Before:**
```
| 审查 | 代码（≥10 文件触发 UltraReview，<10 文件由 specpowers-apply 加载（code-review）+ specpowers-review 对齐 Agent 单审）或 文档类 或 用户手动触发 | specpowers-review | `Skill({skill: "specpowers-review"})` |
```

**After:**
```
| 审查 | 代码类（由 specpowers-review 内部按文件数+行数自动判定）或 文档类 或 用户手动触发 | specpowers-review | `Skill({skill: "specpowers-review"})` |
```

The old text hardcoded the ≥10 threshold and UltraReview/加强审查 routing in the entry skill. The new text delegates all judgment to specpowers-review's internal decision tree.

### Change 2: Mode mapping table — 微小 row review column (line 126)

**Before:**
```
| **微小** | 轻量上下文探索 | 跳过 | 跳过 | 子代理直接执行 | 跳过 | 跳过 |
```

**After:**
```
| **微小** | 轻量上下文探索 | 跳过 | 跳过 | 子代理直接执行 | 跳过 | → specpowers-review 内部判定 |
```

Previously, 微小 tasks skipped review entirely. Now they route to specpowers-review, which, per the new threshold (≤2 files AND ≤200 lines), would internally classify a 微小 task as "skip review" — but the decision lives in review, not in the entry skill.

## Verification

- `grep ">=10.*文件|<10.*文件" skills/specpowers/SKILL.md` → 0 results (old thresholds fully removed)
- 微小 row review column confirmed: `→ specpowers-review 内部判定` (no longer `跳过`)
- Commit successful on branch `master`
