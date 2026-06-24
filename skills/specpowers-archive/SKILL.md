---
name: specpowers-archive
description: Use when entering the verification and archiving phase of a specpowers workflow. Triggered after specpowers-apply or specpowers-review completes, or when user says "verify and archive" or "finish this change".
---

# specpowers-archive: 验证+归档阶段

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取 Post-Task Checklist 和 GitLab Flow 规则。等待加载完成后继续。
> 2. 确认 `openspec/changes/<name>/` 存在且实现已完成（代码已提交）。
> 3. 如当前模式为微小任务，跳过本技能。

**REQUIRED SUB-SKILL:** Skill({skill: "superpowers:verification-before-completion"})
**REQUIRED BACKGROUND:** Skill({skill: "superpowers:finishing-a-development-branch"})

---

## 验证顺序（强制硬 Gate 链）

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
<your-test-command>

# 自动检测逻辑（按优先级）:
#   if [ -f xmake.lua ]; then xmake build <target>
#   elif [ -f Makefile ]; then make test
#   elif [ -f package.json ]; then npm test
#   else echo "请配置 TEST_COMMAND"
```
> 如自动检测失败，在 specpowers entry skill 的 Pre-Flight Check 中手动定义 TEST_COMMAND。

### Step 2: OpenSpec validate Gate

```bash
openspec validate <change-name>
```

| 维度 | 检查 |
|------|------|
| 完整性 | 每个需求是否有对应实现 |
| 正确性 | 实现是否符合规范意图 |
| 一致性 | 实现是否和 design.md 一致 |

**⚠️ GATE: 返回非 0 → 强制回 Phase 1（spec 修复）或 Phase 3（实现修复），不可跳过。**

### Step 3: /opsx:archive（强制命令）

```bash
/opsx:archive
```

**禁止以下行为**:
- ❌ 手动 `mv openspec/changes/<name>/ → archive/`
- ❌ 手动编辑 `openspec/specs/` 合并 delta
- ❌ 使用其他命令替代 `/opsx:archive`

**违规检测**: /opsx:archive 执行后，运行以下检查：
```bash
# 检查 archive 后 changes/ 已清空（Windows: 使用等效 PowerShell/CMD 命令）
test -d "openspec/changes/<name>" && echo "[FAIL] changes/<name>/ 仍存在，归档未完成" && exit 1
test ! -d "openspec/archive/<name>" && echo "[FAIL] archive/<name>/ 不存在，归档失败" && exit 1
echo "[PASS] 归档目录迁移完成"
```
> Windows 环境：`bash` 命令需 Git Bash 执行，或将 `test` 替换为 `if exist`（CMD）/ `Test-Path`（PowerShell）。

**⚠️ GATE: /opsx:archive 失败 → Phase 4 终止，不允许手动绕过。**

### Step 4: 归档完整性验证（新增，自动执行）

归档命令执行后，确保变更已提交，然后立即验证:

```bash
# 如 /opsx:archive 未自动提交，显式提交归档产物
git add openspec/ && git commit -m "chore: archive <name>"
```

```
检查1: openspec changes/<name>/ 是否已移除？
检查2: openspec archive/<name>/ 是否包含 proposal.md / design.md / specs/ / tasks.md 四件套？
检查3: openspec specs/ 是否已正确更新（delta 已合并到主规范）？
检查4: git log --oneline -1 确认归档 commit 存在（包含 archive <name>）
```

**输出验证报告**:

```
[PASS/FAIL] changes/<name>/ → archive/<name>/      — <状态>
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
