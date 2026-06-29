---
name: specpowers
description: Start a new feature with the full specpowers SDD+TDD workflow
category: Workflow
tags: [workflow, sdd, tdd, engineering]
---

# /specpowers — SDD+TDD Engineering Workflow

Start the specpowers Phase 0→4 workflow. The entry skill (`specpowers`) determines execution mode (tiny/medium/complex/large-scale) by file count and complexity, then routes through the appropriate phases.

## Usage

```
/specpowers                        # Start with current task context
/specpowers <feature description>  # Start with feature description
```

## What Happens

1. Entry skill `specpowers` loads → decision tree classifies task mode
2. Routes through Phase 0 (brainstorming) → Phase 1 (propose) → Phase 2 (plan) → Phase 3 (implement) → Phase 4 (archive)
3. Each Phase output triggers a review Gate (multi-model progressive for docs, 加强审查 (≤2 files ≤200 lines) / UltraReview + 对齐审查 (other cases))
4. Convergence reminders ensure reviews iterate until issues settle

For tiny tasks (≤3 files), specpowers degrades to lightweight mode: skip formal Phases, execute directly with internal review.

To jump to a specific Phase, use natural language (e.g., "run specpowers-review").
