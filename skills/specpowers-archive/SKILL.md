---
name: specpowers-archive
description: Use when entering the verification and archiving phase of a specpowers workflow. Triggered after specpowers-apply or specpowers-review completes, or when user says "verify and archive" or "finish this change".
---

# specpowers-archive: 验证+归档阶段

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers:specpowers"})` 加载入口 skill，获取 Post-Task Checklist 和 GitLab Flow 规则。等待加载完成后继续。
> 2. 确认当前变更的 `<name>`。实现必须已完成（代码已提交）。如当前模式为微小任务，跳过本技能。
> 3. **Phase1 跳过兼容**: 检查 `.superpowers/.phase1-skipped` — 若存在则 Phase1 已被跳过，无 OpenSpec change 目录；后续 Step 2 (openspec validate) 和 Step 3 (/opsx:archive) 自动跳过。若不存在，按标准路径 `openspec/changes/<name>/` 执行完整 Gate 链。
> 4. **Gate 3 确认**：搜索会话上下文中 `[GATE_PASSED] gate=3` 标记，或检查 `.superpowers/.gate-passed-3` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 3 Gate 3 未执行，回 specpowers-apply 完成 Gate 3 后再进入 Phase 4。微小任务跳过此项（但 apply 中 tiny 仍执行 Gate 3——见 apply 前置检查）。

**REQUIRED SUB-SKILL:** Skill({skill: "superpowers:verification-before-completion"})
**REQUIRED BACKGROUND:** Skill({skill: "superpowers:finishing-a-development-branch"})

---

## 验证顺序（强制硬 Gate 链）

> 本阶段的硬 Gate 链（Step 1-5）对应 specpowers-review Gate 表中的 Gate 4 节点。

**硬约束: 任一步骤失败 → Phase 4 终止，不允许降级为手动操作。**

```
全量测试 → 规范验证(openspec validate) → 归档(/opsx:archive) → 完整性验证 → 收尾(finishing)
    │                │                    │                    │
    └── 失败→回 Phase 3  └── 失败→回 Phase 1/Phase 3  └── 失败→终止        └── 失败→终止
```

### Step 1: 全量测试 Gate

**Pitfall 7: archive 前必须跑全量测试。verify 只检查规范合规，不跑测试。**

```bash
# ⚠️ GATE: 返回非 0 → 强制回 Phase 3，执行 superpowers:systematic-debugging
# 不可跳过此 Gate。

# 自动检测测试命令（按优先级）:
if [ -n "$TEST_COMMAND" ]; then
    $TEST_COMMAND
elif command -v xmake >/dev/null 2>&1; then
    xmake build && xmake test
elif [ -f Makefile ]; then
    make test
elif command -v npm >/dev/null 2>&1; then
    npm test
else
    echo "[ERROR] 未检测到测试命令，请配置 TEST_COMMAND 环境变量后重试"
    exit 1
fi
```
> **xmake 多 target 项目**: `xmake build` 使用默认构建规则；如项目有多个 target，需在 `TEST_COMMAND` 中显式指定（如 `TEST_COMMAND="xmake build <target> && xmake test"`）。
> 如自动检测失败，在 specpowers entry skill 的 Pre-Flight Check 中手动定义 TEST_COMMAND。

### Step 2: OpenSpec validate Gate

> **Phase1 跳过分支**: 若 `.superpowers/.phase1-skipped` 存在 → 跳过本步骤（Phase1 已跳过，无 OpenSpec change 可验证），直接进入 Step 3 跳过路径。

```bash
# 仅在 .superpowers/.phase1-skipped 不存在时执行
openspec validate --change <name>
```

| 维度 | 检查 |
|------|------|
| 完整性 | 每个需求是否有对应实现 |
| 正确性 | 实现是否符合规范意图 |
| 一致性 | 实现是否和 design.md 一致 |

**⚠️ GATE: 返回非 0 → 强制回 Phase 1（spec 修复）或 Phase 3（实现修复），不可跳过。**

### Step 3: /opsx:archive（强制命令）

> **Phase1 跳过分支**: 若 `.superpowers/.phase1-skipped` 存在 → 跳过本步骤（Phase1 已跳过，无 OpenSpec change 可归档），直接进入 Step 4（此时 Step 4 仅验证 git commit 存在）。

```bash
# 仅在 .superpowers/.phase1-skipped 不存在时执行
# <name> 由当前任务上下文获取，避免多活跃 change 时交互选择打断硬 Gate 链
/opsx:archive <name>
```

**禁止以下行为**:
- ❌ 手动 `mv openspec/changes/<name>/ → archive/`
- ❌ 手动编辑 `openspec/specs/` 合并 delta
- ❌ 使用其他命令替代 `/opsx:archive`

**违规检测**: /opsx:archive 执行后，运行以下检查：
```bash
# 用 openspec status 获取实际归档路径（避免硬编码日期格式）
ARCHIVE_PATH=$(openspec status --change <name> --json 2>/dev/null | grep -o '"archivePath":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ARCHIVE_PATH" ]; then
    # 回退：按标准命名规则推断路径
    ARCHIVE_PATH="openspec/changes/archive/$(echo <name> | grep -oP '\d{4}-\d{2}-\d{2}')-<name>/"
fi

# 检查 archive 后 changes/ 已清空（Windows: 使用等效 PowerShell/CMD 命令）
test -d "openspec/changes/<name>" && echo "[FAIL] changes/<name>/ 仍存在，归档未完成" && exit 1
test ! -d "$ARCHIVE_PATH" && echo "[FAIL] 归档路径 $ARCHIVE_PATH 不存在，归档失败" && exit 1
echo "[PASS] 归档目录迁移完成: $ARCHIVE_PATH"
# 将 ARCHIVE_PATH 存入会话上下文供 Step 4 复用（避免归档后重复查询失败）
```
> Windows 环境：`bash` 命令需 Git Bash 执行，或将 `test` 替换为 `if exist`（CMD）/ `Test-Path`（PowerShell）。

**⚠️ GATE: /opsx:archive 失败 → Phase 4 终止，不允许手动绕过。**

### Step 4: 归档完整性验证（新增，自动执行）

> **Phase1 跳过分支**: 若 `.superpowers/.phase1-skipped` 存在 → 仅执行检查 4（确认 git commit 存在），跳过 OpenSpec 目录相关检查（检查 1-3），直接输出简化报告。

归档命令执行后，确保变更已提交，然后立即验证:

```bash
# 如 /opsx:archive 未自动提交，显式提交归档产物
git add openspec/ && (git diff --cached --quiet || git commit -m "chore: archive <name>")

# 复用 Step 3 已计算的 ARCHIVE_PATH（Step 3 已将其存入会话上下文）
# 无需重复查询 openspec status（此时 change 已归档，查询可能失败）
```

**标准路径验证**（`.superpowers/.phase1-skipped` 不存在时执行）:

```
检查1: openspec changes/<name>/ 是否已移除？
检查2: $ARCHIVE_PATH 是否包含 proposal.md / design.md / specs/ / tasks.md 四件套？
检查3: openspec specs/ 是否已正确更新（delta 已合并到主规范）？
检查4: git log --oneline -1 确认归档 commit 存在（包含 archive <name>）
```

**Phase1 跳过路径验证**（`.superpowers/.phase1-skipped` 存在时执行）:

```
检查4: git log --oneline -1 确认提交存在（包含 <name>）
```

**输出验证报告**:

```
[PASS/FAIL] changes/<name>/ → $ARCHIVE_PATH           — <状态>
[PASS/FAIL] 四件套完整性                              — <状态>
[PASS/FAIL] specs/ delta 已合并                       — <状态>
[PASS/FAIL] 归档 commit: <hash>                       — <状态>
```

全部 PASS → 进入 Step 5。任一 FAIL → Phase 4 终止，人工介入。

### Step 5: finishing

```bash
# 用 finishing-a-development-branch 收尾
```

**横切提醒**: 提交前核对 specpowers entry skill 中的 Post-Task Checklist + GitLab Flow。
