---
name: specpowers-archive
description: Use when entering the verification and archiving phase of a specpowers workflow. Triggered after specpowers-apply or specpowers-review completes, or when user says "verify and archive" or "finish this change".
---

# specpowers-archive: 验证+归档阶段

> **平台适配（技能调用）**: 本技能内所有技能引用一律用**裸名**（如 `specpowers-review`、`brainstorming`）。
> - **DSH**: `skill(name: "specpowers-archive")`；`Skill({skill: "specpowers-archive"})` 视为等价写法。
> - **Claude Code**: 裸名可用则 `Skill({skill: "specpowers-archive"})`；技能注册表要求插件命名空间时
>   回退 `Skill({skill: "specpowers:specpowers-archive"})`（上游技能回退 `Skill({skill: "superpowers:brainstorming"})`）。
> - **Codex**: 技能名直呼（skills-only 工具）。🔲 未验证
> 完整三平台映射与降级路径见 `<SKILL_BASE>/refs/platform-tools.md`（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）。

> **前置检查（必须执行，不可跳过）**:
> 1. 执行 `Skill({skill: "specpowers"})` 加载入口 skill，获取 Post-Task Checklist 和 GitLab Flow 规则。等待加载完成后继续。
> 2. 确认当前变更的 `<name>`。实现必须已完成（代码已提交）。如当前模式为微小任务，跳过本技能。
> 3. **Phase 1 跳过兼容**: 检查 `.superpowers/.phase1-skipped` — 若存在则 Phase 1 已被跳过，无 OpenSpec change 目录；后续 Step 2（openspec validate）和 Step 3 (/opsx:archive) 自动跳过。若不存在，按标准路径 `openspec/changes/<name>/` 执行完整 Gate 链。
> 4. **Gate 3 确认**：搜索会话上下文中 `[GATE_PASSED] gate=3` 标记，或检查 `.superpowers/.gate-passed-3` 文件（`name=<当前任务>` 匹配）。两者都没有 → Phase 3 Gate 3 未执行，回 specpowers-apply 完成 Gate 3 后再进入 Phase 4。微小任务跳过此项。

**REQUIRED SUB-SKILL:** Skill({skill: "verification-before-completion"})
**REQUIRED BACKGROUND:** Skill({skill: "finishing-a-development-branch"})

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
# ⚠️ GATE: 返回非 0 → 强制回 Phase 3，执行 systematic-debugging
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
> **结果核查（原始输出）**: 判定本 Gate 通过/失败必须读测试命令的原始输出，不得以摘要代理输出为准——摘要工具（如 rtk）可能吞掉输出尾部的 `, N errors`/`FAILED` 后缀。输出尾部含 `N errors`/`FAILED` 或退出码非 0 → 一律视为失败，走 Gate 回退；不确定时用原始命令重跑或读完整输出文件。
> **xmake 多 target 项目**: `xmake build` 使用默认构建规则；如项目有多个 target，需在 `TEST_COMMAND` 中显式指定（如 `TEST_COMMAND="xmake build <target> && xmake test"`）。
> 如自动检测失败，在 specpowers entry skill 的 Pre-Flight Check 中手动定义 TEST_COMMAND。

### Step 2: OpenSpec validate Gate

> **Phase 1 跳过分支**: 若 `.superpowers/.phase1-skipped` 存在 → 跳过本步骤（Phase 1 已跳过，无 OpenSpec change 可验证），直接进入 Step 3 跳过路径。

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

### Step 3: 归档（强制步骤，默认 `/opsx:archive`）

> **Phase 1 跳过分支**: 若 `.superpowers/.phase1-skipped` 存在 → 跳过本步骤（Phase 1 已跳过，无 OpenSpec change 可归档），直接进入 Step 4（此时 Step 4 仅验证 git commit 存在）。

**环境检查（执行载体选择，入口称『载体降级链』）**: `/opsx:archive` 是斜杠命令（非 shell 命令），仅在本仓库 `.claude/commands/opsx/` 或 openspec 插件注册了该命令的会话中可用——不要假设应用项目中存在。可用性以当前会话实际可用的 slash command 列表为准，按降级链选择载体：
1. 会话 slash command 列表含 `/opsx:archive`（或 openspec 插件等价命令）→ 用该命令执行
2. 命令不可用 → 若**项目根**存在 `.claude/commands/opsx/archive.md`（dogfooding 本仓库或项目自带）→ Read 并按其定义步骤逐条执行（artifact/tasks 完成度检查 → delta sync 评估 → `mkdir -p archive` + `mv` 归档——等价完整流程，非裸 `mv`）；项目根无此文件（应用项目常见）→ 直接进入第 3 级
3. 该文件不存在或不可读 → openspec CLI 直接执行 `openspec archive <name> -y`（-y 跳过交互确认，agent 非 TTY 场景必需；命令名以项目实际 openspec 安装为准）

> 降级的是执行载体（哪个命令做归档），不是归档步骤本身——任一载体执行后，违规检测与 Gate 判定不变，本步骤不可跳过。
> 第 3 级归档后若 git log 最近 commit 不含 `archive <name>`（openspec 自动 commit 消息格式可能不同），按 Step 4 的 commit 命令补一次 `chore: archive <name>`——guard exit phase4 的归档 commit 检查依赖此消息。

通过会话 slash command 调用（非 shell 命令——不要在 bash 中执行）：

```
/opsx:archive <name>
```

- 仅在 `.superpowers/.phase1-skipped` 不存在时执行
- `<name>` 由当前任务上下文获取，避免多活跃 change 时交互选择打断硬 Gate 链
- 命令不可用时按上方「环境检查（载体降级链）」选择等价载体

**禁止以下行为**:
- ❌ 手动 `mv openspec/changes/<name>/ → archive/`（降级链第 2 级的完整流程除外）
- ❌ 手动编辑 `openspec/specs/` 合并 delta
- ❌ 使用降级链之外的命令替代归档命令

**违规检测**: 归档命令执行后（任一载体），运行以下检查：
```bash
# 用 openspec status 获取实际归档路径（避免硬编码日期格式）
ARCHIVE_PATH=$(openspec status --change <name> --json 2>/dev/null | grep -o '"archivePath":"[^"]*"' | cut -d'"' -f4)
if [ -z "$ARCHIVE_PATH" ]; then
    # 回退：按标准命名规则推断路径
    ARCHIVE_PATH="openspec/changes/archive/$(echo <name> | grep -oP '\d{4}-\d{2}-\d{2}')-<name>/"
    # 注：此 fallback 从 name 提取日期，跨日归档时可能不准——openspec status 失败时才触发，优先依赖 openspec status --json 的 archivePath
fi

# 检查 archive 后 changes/ 已清空（Windows: 使用等效 PowerShell/CMD 命令）
test -d "openspec/changes/<name>" && echo "[FAIL] changes/<name>/ 仍存在，归档未完成" && exit 1
test ! -d "$ARCHIVE_PATH" && echo "[FAIL] 归档路径 $ARCHIVE_PATH 不存在，归档失败" && exit 1
echo "[PASS] 归档目录迁移完成: $ARCHIVE_PATH"
# 将 ARCHIVE_PATH 存入会话上下文供 Step 4 复用（避免归档后重复查询失败）
```
> Windows 环境：`bash` 命令需 Git Bash 执行，或将 `test` 替换为 `if exist`（CMD）/ `Test-Path`（PowerShell）。

**⚠️ GATE: 归档失败（含降级链全部载体不可用）→ Phase 4 终止，不允许手动绕过。**

### Step 4: 归档完整性验证（自动执行）

> **Phase 1 跳过分支**: 若 `.superpowers/.phase1-skipped` 存在 → 仅执行检查 4（确认 git commit 存在），跳过 OpenSpec 目录相关检查（检查 1-3），直接输出简化报告。

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

**Phase 1 跳过路径验证**（`.superpowers/.phase1-skipped` 存在时执行）:

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

全部 PASS 后，执行节点出口守卫（中等+；微小模式无 state.json，跳过本技能不调用）：
node <SKILL_BASE>/scripts/workflow-guard.mjs exit phase4 --apply
（`<SKILL_BASE>` 见入口技能「脚本路径解析」节）

> **注**：guard 是 Step 4 检查的子集（覆盖检查 1 归档目录迁移 + 检查 4 归档 commit；检查 2/3 由本技能自身完成）。

### Step 5: finishing

```bash
# 用 finishing-a-development-branch 收尾
```

**横切提醒**: 提交前核对 specpowers entry skill 中的 Post-Task Checklist + GitLab Flow。
