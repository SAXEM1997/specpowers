# DSH 适配 — 8 项判据验证报告

- 日期：2026-09-17
- 分支：`feat/dsh-adaptation`，验证时 HEAD：`1bde313`（fix(readme): 英文 README 翻译叙述性代码块）
- 依据：`docs/superpowers/specs/2026-09-17-dsh-adaptation-design.md` 「验证（可执行证据）」表 + `docs/superpowers/plans/2026-09-17-dsh-adaptation.md` Task 11
- 内网主机名在本报告中一律以 `${INTERNAL_HOST}` 变量/「内网主机名」指代，不写字面量；其伴随搜索词一律以 `<companion>` 指代（执行时为字面量，报告中替换以避免新增已追踪文件命中）。

## 结论总览

| # | 判据 | 结论 |
|---|---|---|
| 1 | frontmatter 解析 | **PASS**（`ALL PASS`，exit 0） |
| 2 | 前缀残留（白名单外为 0） | **PASS**（15 处命中全部在白名单内；白名单外 0） |
| 3 | provider 契约 | **PASS**（判据 1 的 `PASS get()` + `PASS resourceBase` 覆盖） |
| 4 | 协议 + 状态机裸名 | **PASS**（5 个裸 `skill` 字段；`SKILL: specpowers-design`） |
| 5 | 清单有效性 | **PASS**（`PASS manifests`；`git ls-files .claude-plugin` = 2） |
| 6 | 技能文件无损坏 | **PASS**（6 个行数逐一精确相符；`前置检查` 5 文件各 1；标题数 delta 全 0） |
| 7 | 无内网地址残留 | **PASS（主机名）**，附两项如实记录的残留/偏差（见下） |
| 8 | 无 Comet 残留（活文件） | **PASS**（0） |

**8/8 通过**，其中判据 7 的通过限定于「内网主机名字面量」本身，两条不可消除/超出判据本意的残留如实记录在下方「必须 prominent 声明的事项」。

---

## 必须 prominent 声明的事项（诚实声明）

### 1. DSH 端到端安装**未执行**

`dsh plugin --profile web add` 需要写入 `/dsh-home/profiles/web/`，该路径在会话工作区之外，`workspace-write` 沙箱会拒绝该操作，因此本次验证**没有执行端到端安装**。本报告**不能**也不应被解读为「插件已装好」。实际验证到的是：同一份 provider 代码（`lib/index.js` 的 `registerProvider` 契约、`list()`、`get()`、`resourceBase`）在进程内被真实执行并通过全部断言（判据 1/3/4），以及打包面清单（判据 5）合法。若要真实安装验证，需由用户在沙箱之外（或提权后）执行。

### 2. git 历史提交信息中的内网主机名残留（判据 7 已声明的不可消除残留）

`git log --format='%H %s' | grep -cE "${INTERNAL_HOST}"` 实测 **1**。残留位于早期提交 `65e1030` 的标题（记录仓库远程地址迁移，主题中含内网主机名字面量，此处不引用原文）。消除它需要重写历史（`git filter-repo` / rebase），属于破坏性操作且会使全部提交哈希变化——本计划明确不做。**首次推送到公开托管前应由用户决定**：接受该历史残留，或先重写历史再推送。

### 3. 判据 7 的伴随搜索词在 `docs/` 内有 7 处自指命中（超出判据本意的偏差，如实记录）

判据 7 的组合模式（`${INTERNAL_HOST}` 或伴随搜索词）在**含 `docs/`** 的已追踪文件中实测 **7** 处命中，而非计划 Task 11 Step 7 预期的 0：

```text
docs/superpowers/plans/2026-09-17-dsh-adaptation.md:23,865,1470,2097,2098,2099
docs/superpowers/specs/2026-09-17-dsh-adaptation-design.md:298
```

逐条核对：7 处全部是**伴随搜索词本身**出现在计划/spec 文档记录的 grep 命令文本与约束表述里（文档为记录验证命令而引用了该词），**没有一处是内网主机名字面量**。产品面（排除 `docs/` 后）该伴随词实测 0。这与判据 2/8 对 `docs/` 的定位一致（历史记录，按 spec 定义排除），但与计划自身第 23 行「本计划与 spec 自身也受此约束」的措辞存在自指矛盾——判据写成「含 docs/ 也为 0」在计划自己的命令文本上不可能成立。此为**计划文本缺陷，非产品面残留**，交控制器分诊；本任务只记录，不修改。

---

## 判据 1 — frontmatter 解析

**命令：**

```bash
node scripts/verify-dsh-provider.mjs
```

**实际输出：**

```text
PASS manifests: package.json + cordis.patch.yml
PASS list(): 6 技能，裸名与 description 锚点全部正确
PASS get(): 6 技能正文与 resourceBase 全部正确
PASS resourceBase: refs/ 与 scripts/ 相对资源可达
ALL PASS
exit=0
```

**对比预期**：以 `ALL PASS` 结束，含四行 PASS（manifests / list() / get() / resourceBase）——完全相符。
**结论：PASS。**

## 判据 2 — 前缀残留（白名单外为 0）

**命令（原始命中）：**

```bash
grep -rnoE 'specpowers:specpowers|superpowers:' skills/ lib/ commands/ .claude-plugin/ AGENTS.md CLAUDE.md README.md README.en.md
```

**实际输出（15 处）：**

```text
skills/specpowers-review/SKILL.md:16:specpowers:specpowers
skills/specpowers-review/SKILL.md:16:superpowers:
skills/specpowers-apply/SKILL.md:11:specpowers:specpowers
skills/specpowers-apply/SKILL.md:11:superpowers:
skills/specpowers-plan/SKILL.md:12:specpowers:specpowers
skills/specpowers-plan/SKILL.md:12:superpowers:
skills/specpowers-archive/SKILL.md:11:specpowers:specpowers
skills/specpowers-archive/SKILL.md:11:superpowers:
skills/specpowers/SKILL.md:20:specpowers:specpowers
skills/specpowers/SKILL.md:20:superpowers:
skills/specpowers/refs/platform-tools.md:11:superpowers:
skills/specpowers-design/SKILL.md:12:specpowers:specpowers
skills/specpowers-design/SKILL.md:12:superpowers:
README.md:220:specpowers:specpowers
README.en.md:220:specpowers:specpowers
```

6 个 `SKILL.md` 均为恰好 2 处命中且在同一行；该行含「回退」。

**命令（白名单断言脚本，计划 Task 11 Step 2 原样执行）：** 白名单 = 6 个 `skills/*/SKILL.md` + `skills/specpowers/refs/platform-tools.md` + `README.md` + `README.en.md`；逐命中断言所属文件在白名单内、6 个 SKILL.md 各恰 2 处同线且含「回退」、`lib/index.js`/`AGENTS.md`/`CLAUDE.md`/`commands/`/`.claude-plugin/` 零命中。

**实际输出：**

```text
PASS prefix-residue: 15 处命中全部落在白名单的回退指南内
命中文件： README.en.md, README.md, skills/specpowers-apply/SKILL.md, skills/specpowers-archive/SKILL.md, skills/specpowers-design/SKILL.md, skills/specpowers-plan/SKILL.md, skills/specpowers-review/SKILL.md, skills/specpowers/SKILL.md, skills/specpowers/refs/platform-tools.md
exit=0
```

**对比预期**：命中文件恰好为 9 个白名单文件，白名单外 0——相符。控制器预期的「每个 SKILL.md 恰 2 处、同一行、含「回退」」逐文件成立。
**结论：PASS。**

## 判据 3 — provider 契约

由判据 1 输出中的 `PASS get(): 6 技能正文与 resourceBase 全部正确` 与 `PASS resourceBase: refs/ 与 scripts/ 相对资源可达` 两行覆盖（`get()` 返回 `content` 非空、`resourceBase` 指向 `skills/<name>/`、相对资源真实可达）。
**结论：PASS。**

## 判据 4 — 协议与状态机裸名

**命令（协议 JSON 断言，5 个 `skill` 字段不得含 `:`）：**

```bash
node --input-type=module <<'EOF'
... assert protocol.nodes.length === 5; 每个 node.skill 不含 ':'
EOF
```

**实际输出：**

```text
PASS protocol: specpowers-design specpowers-design specpowers-plan specpowers-apply specpowers-archive
exit=0
```

**对比预期**：`specpowers-design specpowers-design specpowers-plan specpowers-apply specpowers-archive`——逐字相符。

**命令（状态机，在 `mktemp -d` 临时目录中以 phase0 状态运行）：**

```bash
TMP=$(mktemp -d); mkdir -p "$TMP/.superpowers"
printf '%s\n' '{"name":"demo-feature","currentPhase":"phase0","completedPhases":[],"mode":"medium","blockedReason":null,"evidence":{}}' > "$TMP/.superpowers/state.json"
(cd "$TMP" && node /workspace/specpowers/skills/specpowers/scripts/workflow-state.mjs next) | grep '^SKILL:'
rm -rf "$TMP"
```

**实际输出：**

```text
SKILL: specpowers-design
```

**对比预期**：`SKILL: specpowers-design`（裸名，无 `specpowers:` 前缀）——相符。执行 cwd 为临时目录，非仓库根。
**结论：PASS。**

## 判据 5 — 清单有效性

**命令：**

```bash
node --input-type=module -e "... 三个清单 JSON.parse；pkg.dsh.bundle.patch === './cordis.patch.yml'；文件存在；cordis.patch.yml 有效行 deepEqual ['- insert:','- id: specpowers',\"name: 'specpowers'\"] ..."
git ls-files .claude-plugin | wc -l
```

**实际输出：**

```text
PASS manifests
exit=0
2
```

**对比预期**：`PASS manifests`；`git ls-files .claude-plugin | wc -l` = `2`——均相符（`plugin.json` 与 `marketplace.json` 仍被追踪）。
**结论：PASS。**

## 判据 6 — 技能文件无损坏

**命令：**

```bash
for f in skills/*/SKILL.md; do printf '%-40s %s\n' "$f" "$(wc -l < "$f")"; done
grep -c '前置检查' skills/specpowers-*/SKILL.md
grep -c '^#' skills/*/SKILL.md
# 标题数基线对照（本任务补充执行，对照 master）：
for f in skills/*/SKILL.md; do before=$(git show master:"$f" | grep -c '^#'); after=$(grep -c '^#' "$f"); ...; done
```

**实际输出（行数）：**

```text
skills/specpowers-apply/SKILL.md         132
skills/specpowers-archive/SKILL.md       180
skills/specpowers-design/SKILL.md        224
skills/specpowers-plan/SKILL.md           92
skills/specpowers-review/SKILL.md        576
skills/specpowers/SKILL.md               386
```

**对比预期**（控制器确认值）：386 / 224 / 92 / 132 / 576 / 180 —— **6 个全部精确相符**。

**实际输出（`前置检查`）：**

```text
skills/specpowers-apply/SKILL.md:1
skills/specpowers-archive/SKILL.md:1
skills/specpowers-design/SKILL.md:1
skills/specpowers-plan/SKILL.md:1
skills/specpowers-review/SKILL.md:1
```

glob 恰为 5 个子技能文件，各 1 处——与预期相符（入口技能另有 1 处，不在该 glob 内）。

**实际输出（标题数 delta，master → HEAD）：**

```text
skills/specpowers-apply/SKILL.md         before=6   after=6   delta=0
skills/specpowers-archive/SKILL.md       before=18  after=18  delta=0
skills/specpowers-design/SKILL.md        before=15  after=15  delta=0
skills/specpowers-plan/SKILL.md          before=8   after=8   delta=0
skills/specpowers-review/SKILL.md        before=36  after=36  delta=0
skills/specpowers/SKILL.md               before=33  after=33  delta=0
```

**对比预期**：标题行数增加 0——全部相符（平台适配块为引用行，未引入标题）。
**结论：PASS。**

## 判据 7 — 无内网地址残留

**命令**（`INTERNAL_HOST` 为执行时 shell 变量；`<companion>` 为伴随搜索词，报告中不写字面量）：

```bash
INTERNAL_HOST='<执行时填入>'
echo "tracked-excluding-docs: $(git grep -nE "${INTERNAL_HOST}|<companion>" -- . ':!docs/' | wc -l)"
echo "tracked-including-docs: $(git grep -nE "${INTERNAL_HOST}|<companion>" -- . | wc -l)"
echo "worktree-excl-superpowers: $(grep -rnE "${INTERNAL_HOST}|<companion>" --include='*' . 2>/dev/null | grep -v '^\./\.git/' | grep -v '^\./\.superpowers/' | wc -l)"
```

**实际输出：**

```text
tracked-excluding-docs: 0
tracked-including-docs: 7
worktree-excl-superpowers: 7
```

**拆解核查（主机名字面量单独计）：**

```bash
git grep -nE "${INTERNAL_HOST}" -- .               | wc -l   # → 0
git grep -nE "${INTERNAL_HOST}" -- . ':!docs/'     | wc -l   # → 0
grep -rnE "${INTERNAL_HOST}" … 排除 .git/.superpowers | wc -l # → 0
git grep -n '<companion>' -- . ':!docs/'           | wc -l   # → 0
```

**逐条核对那 7 处命中**：全部位于 `docs/superpowers/plans/2026-09-17-dsh-adaptation.md`（6 处）与 `docs/superpowers/specs/2026-09-17-dsh-adaptation-design.md`（1 处），且全部是伴随搜索词出现在文档自身记录的 grep 命令文本里——无一处主机名字面量。详见上方「必须 prominent 声明的事项」第 3 条。`.superpowers/` 运行时工作区被两路 grep 均按判据定义排除。

**git 历史残留核查：**

```bash
git log --format='%H %s' | grep -cE "${INTERNAL_HOST}"   # → 1（提交 65e1030，标题含主机名字面量）
```

**对比预期**：计划 Step 7 写「三行全为 0」——产品面三个主机名作用域实测全 0（**主机名判据成立**）；组合模式含 `docs/` 的两路实测 7，全部为上述自指命中，系计划文本与自身命令的自指矛盾（见声明第 3 条），非产品面残留。
**结论：PASS（内网主机名字面量在全部已追踪文件与工作区产物面均为 0）；伴随词在 `docs/` 的 7 处自指命中与 git 历史提交信息 1 处残留如实记录，交控制器/用户处置。**

## 判据 8 — 无 Comet 残留（活文件）

**命令：**

```bash
grep -rniE 'comet' skills/ lib/ commands/ .claude-plugin/ AGENTS.md CLAUDE.md README.md README.en.md | wc -l
```

**实际输出：**

```text
0
```

**对比预期**：`0`——相符。（`docs/` 内确有含该词的历史文档，按 spec 定义排除，不在判据作用域。）
**结论：PASS。**

---

## 未执行项

- **DSH 端到端安装**（`dsh plugin --profile web add`）：未执行，原因与影响见「必须 prominent 声明的事项」第 1 条。
- 除此之外，8 项判据的全部命令均已实际执行并记录原始输出，无跳过项。
