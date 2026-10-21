# specpowers 单轨瘦身 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改变任何判定语义的前提下，把 specpowers 正本从「同一规则重述 2–4 遍」重构为「单一权威源 + 按需加载」，使 review SKILL.md 从 657 行降到 ≤480 行、protocols.md 拆为 6 个按时机加载的 refs 文件。

**Architecture:** 四个独立 MR 串行落地（纯结构拆分 → review 主体瘦身 → 入口去重 → 收尾同步）。协议编号与子节名作为稳定接口原样迁移；判定类规则与标记块格式模板留在主体，执行细则下放 refs；每步以「先写校验（预期 FAIL）→ 实施 → 校验 PASS → 提交」闭环。

**Tech Stack:** Markdown（YAML frontmatter + 正文）、零依赖 Node.js 校验脚本、git（gitlab/github flow）。

**Spec:** `docs/superpowers/specs/2026-09-19-skill-slimming-design.md`（修订 2）

## 计划对设计的两处事实修正（评审发现，执行时以本节为准）

1. **仓库无 CHANGELOG.md**（已实测 `ls CHANGELOG.md` 为空）。设计 §6 的「CHANGELOG」项取消——不新建文件，版本变更写入 MR 描述与 GitHub Release。
2. **PR-1 后 refs 合计为 779 行**，非设计所估 772：拆分丢弃 L1–L16（标题 + 目录 + 空行）共 16 行，保留 761 行正文，每文件加 3 行头（标题 + 导航 + 空行）×6 = 18 行 ⇒ 779。验收改为 **779 ± 3**；PR-2 去重后 ≤820 不变。

## 已确认的执行决策（grilling Round 1–2）

1. **执行方式**：Native（本会话逐 Task 执行），每 PR 停下确认；全部完成后起独立子 Agent 做整分支评审。
2. **节奏**：先只做 PR-1（Task 1–3），验收后停下。
3. **evals**：本机无 `skill-up`/`claude` ⇒ 接受降级，MR 记录 `[DEGRADED]`，**不得**声称 evals 通过。
4. **合理化表**：删 4 行（保留 `[新口径] 多拒绝` 那条）→ **10 行**（原计划 9 行，按决策 4 调整）。
5. **分支**：每 PR 独立分支——PR-1 = `feat/skill-slimming-1`（设计/计划/ADR 随此 PR 合入），后续 `-2/-3/-4` 从最新 main 拉。
6. **版本号**：PR-4 bump 到 **1.1.0**（minor：布局变更，语义不变）。
7. **摘要侧时机**：AGENTS.md 两行节名同步**前移到 PR-2**（与改名同一 PR），PR-4 只做四技能去重与其余摘要项。
8. **ADR**：写 1 个 `docs/adr/0001-adaptive-disclosure-over-dual-track.md`（随 PR-1）；**不建 GLOSSARY.md**（术语正本已在 AGENTS.md 与 review SKILL.md）。
9. **推送时机**：PR-1 本地完成后先给用户看 diff 与验收输出，确认后再推送开 MR。

## 执行期修正（PR-3/PR-4 实施时确认，覆盖上文对应条目）

10. **版本号改为 1.2.0**（覆盖决策 6 的 1.1.0）：`chore/release: v1.1.0` 已先于本计划合入 main，1.1.0 被占用。`README.md:80` / `README.en.md:80` 的安装行**不动**——它指向已发布的 tag `v1.1.0`（v1.2.0 tag 尚未创建，改指会变成死链）。
11. **PR-4 的「四子技能去重 −20 行」目标取消（实测若无重复）**：跨 6 个 `SKILL.md` 按 ≥25 字符逐字比对，**与 review 正本重复的规则全文 0 条**（子技能早已是 `执行入口 specpowers SKILL.md「Gate 返回后验证协议」节（参数：Gate=N, Phase=N）` 式一行引用）；跨技能逐字重复的 8 条中 6 条是「平台适配」块（每个技能必须自带，否则被单独加载时调不动其他技能）、2 条是两张小 Gate 表的表头。故 Task 8 的 ≤608 验收项**改判为不可达**，PR-4 实际只做两处：并入两张 Gate 小表（−9 行 → **619**），evals 描述校准。
12. **CRLF 无需处理**：`.gitattributes` 为 `* text=auto eol=lf`；CI 的 `convert-skills-to-crlf.mjs` 只就地转换 6 个 `SKILL.md`（**不含 `refs/`**）并在同一 job 内跑校验。已本地复跑该 leg 通过。
13. **PR-3 实施时删除了计划未列的 4 处**（概述×技能组结构合并、删「各模式映射」表、GitLab Flow ASCII 图并入节标题、微小子句合并），入口 386 → **341**；`specpowers-archive/SKILL.md:62` 原指向的「Pre-Flight Check」已并入「环境准备」，同步改指。
14. **GitLab 合并方式**：项目 `merge_method=merge` 会让 GitLab 用账号身份（公司邮箱域）生成 Merge commit，触发 `verify-no-internal-refs` 的身份扫描。后续 MR 合并一律**临时切 `merge_method=ff` → 合并 → 立即恢复**，保持 main 上的提交身份为 `SAXEM1997@users.noreply.github.com`；GitHub 侧以 fast-forward 镜像 main。

## Global Constraints

以下为 spec §5 红线，逐字适用；每个 task 的要求隐含包含本节：

- 5 收敛触发条件及阈值原文（`p0_merged>1` / `p1_merged>5` / `P0-P2>10` / 全级>20 / `p1_merged` 轮间新增>3）
- 守恒等式 `Σ(所有行 sources 条数) + Σp*_rejected == Σp*_raw + Σp*_supplement`
- `[拒绝异常]` / `[补充否决异常]` 判据与阈值（>3 条或 >30%）
- 四轴触发面 `p0_raw≥1 ∨ p0_rejected≥1 ∨ agent_rejected≥1 ∨ user_rejected≥1`
- tier 路由矩阵与分桶阈值（微小 1-3 / 中等 4-19 / 复杂 20-49 / 大规模 50+；文档类 ≤100 / 101-300 / 301-600 / >600）
- Gate 链与 Gate Token 产物依赖链
- 标记块字段名、取值枚举与存在性语义
- `[ANTI_LAZINESS_SELF_CHECK]` / `[SELF_VERIFY]` / `[TIER_ROUTING]` / `[CONVERGENCE_CHECK]` / `[GATE_PASSED]` 标记语法
- 协议编号 1–9 与各协议内部子节标题（如「独立调用场景自检」「Gate Token 输出」「Step 5 合并验证模式注入模板」）
- evals 用例的断言语义
- 两条强制自检及其通过标准：`node scripts/verify-dsh-provider.mjs`、`node scripts/verify-no-internal-refs.mjs`

**红线判定规则**：任何拟删除/修改的正文文本，先 `grep -rn "<文本片段>" skills/*/evals/`；命中则保留原文，或列入 PR-4「evals 校准」单独 diff，**禁止混入 PR-2**。

**环境事实（已实测）**：`skill-up` 与 `claude` 均不在 PATH ⇒ evals 无法本地运行；所有涉及 evals 的步骤**必须**以静态校验替代并在输出中记录 `[DEGRADED] evals 未运行：skill-up/claude 不可用`，不得声称「evals 通过」。

**行数口径**：`wc -l`。验收以行数为唯一口径。

## Review Focus

1. **跳读 refs 后细则缺失**——最可能出事的场景：会话压缩恢复后直接续跑 Step 4 自执行修复，未读 dispatch.md 而同文件并发写入。预期行为：Step 1/4 骨架内各保留 1 行硬前置引用，且 dispatch.md 加载表覆盖自执行路径。
2. **32 处引用的子节名锚点在拆分后失配**——如协议 3「独立调用场景自检」改名或未迁移，引用变成悬空锚文本。预期：32 行逐条对账通过。
3. **加强审查例外表格化丢分支**——`[拒绝异常]`×N>0 / N==0 / 用户拒绝 P0 三条分支与「Step4 退化回退」互相交叉，漏一条即行为变更。
4. **摘要侧陈旧**——AGENTS.md:34/:48 仍写「审查纪律自检 + 防偷懒协议」，S2 合并后指向不存在的节名。
5. **evals 无自动覆盖**——本计划的行为回归只能靠静态断言 + 人工推演，残余风险显式接受。

---

## Task 1（PR-1）: 拆分 protocols.md 为 6 个 refs 文件

**Files:**
- Create: `skills/specpowers-review/refs/ledger.md`、`markers.md`、`dispatch.md`、`routing.md`、`ultrareview.md`、`convergence.md`
- Delete: `skills/specpowers-review/refs/protocols.md`

**Interfaces:**
- Produces: 6 个文件，各以 `## 协议 N: <原标题>` 小节头承载协议内容（标题与子节名逐字不变），供 Task 2 的引用改向与 Task 5/6 的下放收编使用。

- [ ] **Step 1: 写切分校验脚本并确认它失败**

```bash
cd /workspace/specpowers
for f in ledger markers dispatch routing ultrareview convergence; do
  test -f skills/specpowers-review/refs/$f.md || echo "MISSING refs/$f.md"
done
test -f skills/specpowers-review/refs/protocols.md && echo "protocols.md still present"
```
Expected: 6 个 MISSING + protocols.md 存在（脚本以非零缺口表示失败）。

- [ ] **Step 2: 按精确区间切分（源文件 777 行）**

| 目标文件 | 源区间 | 内容 |
|---|---|---|
| ledger.md | L17–L190 | 协议 1（17–127）+ 协议 2（128–190） |
| markers.md | L191–L384 | 协议 3 |
| dispatch.md | L385–L482 | 协议 4（385–425）+ 协议 5（426–482） |
| routing.md | L483–L591 | 协议 6 |
| ultrareview.md | L663–L729 | 协议 8 |
| convergence.md | L592–L662 + L730–L777 | 协议 7 + 协议 9（按此顺序拼接） |

丢弃 L1–L16（文件标题、目录、空行）。每个新文件前置 3 行头，然后接源区间原文（**逐字复制，不改任何标题、表格、代码块**）：

```markdown
# specpowers-review 协议参考：<账本与缓存|标记格式|派发与注入|路由|UltraReview|收敛与通读>
> 含协议 <N|N–M>；加载时机见 SKILL.md「按需加载表」。
```

- [ ] **Step 3: 删除原文件并校验行数**

```bash
cd /workspace/specpowers
git rm -q skills/specpowers-review/refs/protocols.md
wc -l skills/specpowers-review/refs/{ledger,markers,dispatch,routing,ultrareview,convergence}.md | tail -1
```
Expected: 合计 **779 ± 3**。

- [ ] **Step 4: 校验协议小节头与子节名完整**

```bash
cd /workspace/specpowers
R=skills/specpowers-review/refs
for p in "1 ledger" "2 ledger" "3 markers" "4 dispatch" "5 dispatch" "6 routing" "7 convergence" "8 ultrareview" "9 convergence"; do
  set -- $p; grep -q "^## 协议 $1:" $R/$2.md || echo "FAIL 协议 $1 不在 $2.md"
done
grep -c '^### ' $R/ledger.md $R/markers.md $R/dispatch.md $R/routing.md $R/convergence.md $R/ultrareview.md
```
Expected: 无 FAIL；各文件 `###` 子节数与源文件一致（实施前先 `grep -c '^### ' protocols.md` 记录基线，仅 convergence.md 为协议 7+9 之和）。

- [ ] **Step 5: Commit**

```bash
git add skills/specpowers-review/refs/
git commit -m "refactor(review): 拆分 protocols.md 为 6 个按时机加载的 refs 文件"
```

---

## Task 2（PR-1）: SKILL.md 引用改向 + 按需加载表 + platform-tools 同步

**Files:**
- Modify: `skills/specpowers-review/SKILL.md`（32 行引用 + 634–651 节）
- Modify: `skills/specpowers/refs/platform-tools.md:48`

**Interfaces:**
- Consumes: Task 1 的 6 个文件。
- Produces: SKILL.md 内不再出现 `refs/protocols.md`；新增「按需加载表」节（Task 5/6 会再更新其内容列）。

- [ ] **Step 1: 写引用完整性校验并确认失败**

```bash
cd /workspace/specpowers
grep -c 'refs/protocols\.md' skills/specpowers-review/SKILL.md   # 基线 32
```
Expected: 32（改完应为 0）。

- [ ] **Step 2: 按协议号批量改向**

映射：协议 1/2 → `refs/ledger.md`；3 → `refs/markers.md`；4/5 → `refs/dispatch.md`；6 → `refs/routing.md`；7/9 → `refs/convergence.md`；8 → `refs/ultrareview.md`。

```bash
cd /workspace/specpowers
F=skills/specpowers-review/SKILL.md
sed -i \
  -e 's|refs/protocols\.md（协议 1（会话上下文账本））|refs/ledger.md（协议 1（会话上下文账本））|g' \
  -e 's|refs/protocols\.md 协议 1「|refs/ledger.md 协议 1「|g' \
  $F
# 其余 31 处逐一按上表替换；替换后用 Step 3 校验，凡残留即回查
```
注：`sed` 仅用于无歧义形态；含多协议混引的行（如 L357 同引协议 6 与协议 3、L640–649 列表）**手工改写**。

- [ ] **Step 3: 32 行引用逐条锚点对账（PR-1 的核心验收）**

```bash
cd /workspace/specpowers
node - <<'EOF'
const fs = require('fs');
const base = 'skills/specpowers-review/';
const files = {1:'ledger',2:'ledger',3:'markers',4:'dispatch',5:'dispatch',6:'routing',7:'convergence',8:'ultrareview',9:'convergence'};
const text = fs.readFileSync(base + 'SKILL.md', 'utf8');
let bad = 0, checked = 0;
for (const line of text.split('\n')) {
  const re = /refs\/(ledger|markers|dispatch|routing|ultrareview|convergence)\.md([^|\n]*)/g;
  let m;
  while ((m = re.exec(line))) {
    checked++;
    const tail = m[2];
    const protos = [...tail.matchAll(/协议\s*(\d)/g)].map(x => x[1]);
    for (const p of protos) {
      if (files[p] !== m[1]) { console.log(`FAIL 协议 ${p} 指向 ${m[1]}.md：${line.trim().slice(0,120)}`); bad++; }
    }
    // 子节锚点：协议 N 后的「...」必须在目标文件中存在
    for (const sub of [...tail.matchAll(/协议\s*\d[^「]*「([^」]+)」/g)].map(x => x[1])) {
      const target = files[protos[0]];
      const body = fs.readFileSync(base + 'refs/' + target + '.md', 'utf8');
      if (!body.includes(sub)) { console.log(`FAIL 子节「${sub}」不在 ${target}.md`); bad++; }
    }
  }
}
console.log(bad ? `FAIL ${bad} 处` : `PASS ${checked} 处引用锚点全部有效`);
process.exit(bad ? 1 : 0);
EOF
```
Expected: `PASS <N> 处引用锚点全部有效`，且 `grep -c 'refs/protocols\.md'` 为 0。

- [ ] **Step 4: 用按需加载表替换「审查基础设施与协议」节（现 L634–651）**

替换为（逐字）：

```markdown
## 按需加载表（执行前必读对应 refs）

> 下表为**硬指令**：标注时机到达时必须先读取对应文件再执行，不得凭记忆操作。

| 时机 | 必读 | 内容 |
|---|---|---|
| Step 0 路由 / 加强审查轮全程 | refs/routing.md | 协议 6、加强审查例外全集 |
| 派发任何子 Agent 前 / Step 1 汇总 raw_count 前（含会话恢复续跑）/ Step 2 构建 sources 列前 / Step 4 修复前（含主 Agent 自执行）/ Step 5 兼并判定与复核前 | refs/dispatch.md | 协议 4+5、短名规范、RAW_COUNT、同文件不并发、兼并五项、注入模板 |
| 每 Step 收尾输出标记块前 | refs/markers.md | 协议 3 字段注记与验证细则（格式模板在主体） |
| 读写账本 / review-cache | refs/ledger.md | 协议 1+2 |
| 每轮收敛判定前 / 最终通读前 | refs/convergence.md | 协议 7+9 |
| 路由到 UltraReview recipe | refs/ultrareview.md | 协议 8 |
```

- [ ] **Step 5: 同步 platform-tools.md 的路径引用**

```bash
cd /workspace/specpowers
sed -i 's|refs/protocols\.md|refs/markers.md|g' skills/specpowers/refs/platform-tools.md
grep -n 'protocols\.md' skills/specpowers/refs/platform-tools.md || echo "PASS 无残留"
```
Expected: PASS 无残留（该行引用的是 Gate Token 输出，属协议 3 → markers.md）。

- [ ] **Step 6: Commit**

```bash
git add skills/specpowers-review/SKILL.md skills/specpowers/refs/platform-tools.md
git commit -m "refactor(review): SKILL.md 引用改向并新增按需加载表"
```

---

## Task 3（PR-1）: 自检脚本补校验 + 两条强制自检 + PR-1 收尾

**Files:**
- Modify: `scripts/verify-dsh-provider.mjs:114-131`

**Interfaces:**
- Consumes: Task 1 的 6 个 refs 文件。
- Produces: review refs 存在性纳入自检（消除校验盲区），PR-1 可合入。

- [ ] **Step 1: 写校验并确认当前脚本不覆盖 review refs**

```bash
cd /workspace/specpowers
grep -n "specpowers-review" scripts/verify-dsh-provider.mjs || echo "CONFIRMED 脚本未校验 review refs"
```
Expected: CONFIRMED。

- [ ] **Step 2: 在 entry 资源检查块之后追加 review refs 检查**

在 `console.log('PASS resourceBase: refs/ 与 scripts/ 相对资源可达')` 之后、`console.log('ALL PASS')` 之前插入：

```js
const reviewName = 'specpowers-review'
const reviewFull = await provider.get(
  candidates.find((entry) => entry.name === reviewName),
  {}
)
for (const relative of [
  'refs/ledger.md',
  'refs/markers.md',
  'refs/dispatch.md',
  'refs/routing.md',
  'refs/ultrareview.md',
  'refs/convergence.md'
]) {
  assert.ok(
    existsSync(join(reviewFull.resourceBase.path, relative)),
    `resourceBase 下缺相对资源：${reviewName}/${relative}`
  )
}
console.log('PASS resourceBase: review refs 6 文件可达')
```

- [ ] **Step 2b: 创建 ADR（决策 8，随 PR-1 合入）**

```bash
mkdir -p docs/adr
```

写入 `docs/adr/0001-adaptive-disclosure-over-dual-track.md`（已由本轮 grilling 定稿，内容为单段：为什么选择渐进披露而不是 comet 式双轨，以及 460 行地板的原因）。

- [ ] **Step 3: 跑两条强制自检**

```bash
cd /workspace/specpowers
node scripts/verify-dsh-provider.mjs
node scripts/verify-no-internal-refs.mjs
```
Expected: 两者均输出含 `ALL PASS` / 无违规命中（后者 0 hits）。

- [ ] **Step 4: Commit 本体改动（**不推送**——决策 9：先给用户看 diff 与验收输出，确认后再推送）**

```bash
git add scripts/verify-dsh-provider.mjs
git commit -m "chore(verify): 自检覆盖 review 的 6 个 refs 资源"
git log --oneline -1
```
Expected: 提交成功；**停在本地**。推送与开 MR 由 Task 10 在用户确认后执行。

---

## Task 4（PR-2）: S1 合理化表 14→10 + S2 自检清单合并

**Files:**
- Modify: `skills/specpowers-review/SKILL.md`（377–446 区域）

**Interfaces:**
- Consumes: 无（本任务不改 refs）。
- Produces: 单一「自检清单」节，供 Task 5 的 Step 骨架引用；`[ANTI_LAZINESS_SELF_CHECK]` 语义不变。

- [ ] **Step 1: 红线前置 grep（拟删文本是否被 evals 断言）**

```bash
cd /workspace/specpowers
for s in "三个 Agent 结论一致" "问题少" "这轮只是小修复" "用户会发现剩余问题" \
         "退化声明太复杂" "零问题" "Step 3 和 Step 4 可以同时启动" \
         "[多轮] 这是第N轮审查" "[多轮] 尽快进入收敛状态" "[多轮] 问题已修复" \
         "[新口径] 这些发现多是噪声" "[新口径] 同一个问题多个 Agent" \
         "上下文太长了" "tier 路由降级了"; do
  hit=$(grep -rl "$s" skills/*/evals/ 2>/dev/null)
  [ -n "$hit" ] && echo "HIT: $s -> $hit"
done
echo "--- 已实测预期：仅 anti-laziness-step-skip.yaml 的 description 含「合理化表」「Red Flags 自检清单」两词，不含上述行文本 ---"
```
Expected: 无 HIT（description 中的两个节名由 Task 9 处理）。

- [ ] **Step 2: 删除 4 行合理化表（保留 10 行）**

精确删除以下 4 个表格行（整行，含行尾 `|`）：

| 现行号 | 行首文本 | 吸收去向 |
|---|---|---|
| 390 | `\| "[多轮] 这是第N轮审查，只需快速过一遍 / 只查修改部分"` | 自检清单「第≥2轮追加」的轮次提醒 |
| 391 | `\| "[多轮] 尽快进入收敛状态，少一轮是一轮"` | 同上（收敛加速提醒） |
| 394 | `\| "[新口径] 同一个问题多个 Agent 都报了` | 「问题数口径权威定义」口径分配表「收敛触发条件」行 |
| 395 | `\| "上下文太长了，简化流程省 token"` | 自检清单「第≥2轮追加」的上下文提醒 |

保留：383–389（7 行）、392（merged 口径陷阱）、**393（`[新口径] 多拒绝`，按决策 4 保留）**、396（tier 搭便车）= 10 行。
在「问题数口径权威定义」反偷懒硬约束段末尾追加一行（补偿「按原始条数」的可见性）：

```markdown
> **常见合理化对照**：「多拒绝几条就能压低问题数」见 ①②④；「按原始条数更保险」见口径分配表。二者均不构成放行理由。
```

- [ ] **Step 3: 合并 Red Flags 与多轮协议为单一自检清单**

把现 398–415（Red Flags，12 个 `□`）与 417–446（多轮防偷懒协议）合并为一节，结构固定为：

```markdown
### 审查纪律自检

#### 自检清单
**每轮（每个 Step 完成后逐条核对）**
□ …（原 12 条逐条保留，措辞可压缩，条目语义与数量不变）
□ 本轮是第 ≥2 轮审查？→ 已完成下方「第≥2轮追加」自检？（检查报告含 `[ANTI_LAZINESS_SELF_CHECK] round=<N>, passed=true`）

**第 ≥2 轮追加（主 Agent 在调度子 Agent 前执行）**
1. 确定轮次 N = 账本中非 aborted 轮次数 + 1（区别于 Step 3 的问题总数 N）
2. 打印自检提醒并逐条确认：不以轮次缩减范围 / 不以收敛加速流程 / 不以上下文跳过步骤
3. 逐项核对上方「合理化表」
4. 逐项核对本清单「每轮」组
5. 子 Agent prompt 含 Step 1 完整性指令
6. 记录 `[ANTI_LAZINESS_SELF_CHECK] round=<N>, passed=true`

**违规检测**：Step 2 合并时逐章/逐文件核对每个审查 Agent 的报告覆盖面；发现遗漏 → 该报告标记不完整，要求补审后再合并。
```

删除原「#### 合理化表」外的重复标题层级，使 377–446 区域目标 **≤48 行**（原 70 行）。

- [ ] **Step 4: 校验**

```bash
cd /workspace/specpowers
S=skills/specpowers-review/SKILL.md
echo "合理化表数据行: $(sed -n '/#### 合理化表/,/^#### /p' $S | grep -c '^| "')"   # 期望 10
echo "自检清单条目: $(grep -c '^□' $S)"                                          # 期望 ≥12
grep -q 'ANTI_LAZINESS_SELF_CHECK' $S && echo "PASS 标记保留"
grep -n '多轮审查防偷懒协议' $S || echo "PASS 旧节名已消失"
```
Expected: 10 / ≥12 / PASS / PASS。

- [ ] **Step 5: Commit**

```bash
git add skills/specpowers-review/SKILL.md
git commit -m "refactor(review): 合理化表精简为9行并将两层自检合并为单一自检清单"
```

---

## Task 5（PR-2）: Step 1–5 骨架化 + 细则下放 dispatch.md/routing.md

**Files:**
- Modify: `skills/specpowers-review/SKILL.md`（448–573）
- Modify: `skills/specpowers-review/refs/dispatch.md`（收编）
- Modify: `skills/specpowers-review/refs/routing.md`（收编）

**Interfaces:**
- Consumes: Task 2 的加载表（本任务只复用，不改）。
- Produces: Step 1–5 合计 ≤85 行（含 STEP 标记块格式模板 10 行）；dispatch.md 承载 5 类细则；routing.md 承载加强审查例外完整叙述。

- [ ] **Step 1: 先记录基线并写校验（预期失败）**

```bash
cd /workspace/specpowers
S=skills/specpowers-review/SKILL.md
sed -n '/^\*\*Step 1 — 审查 Agent 并行执行/,/^### Gate Token 输出/p' $S | wc -l   # 基线 126
for k in 'sources 短名规范' '编号空间隔离' 'RAW_COUNT 强制' '同文件不并发' '兼并 Step 3 合并验证模式'; do
  grep -q "$k" skills/specpowers-review/refs/dispatch.md || echo "MISSING in dispatch: $k"
done
```
Expected: 基线 126；5 个 MISSING。

- [ ] **Step 2: 按「留 / 下放」清单改写每一步**

| Step | 留在主体（骨架，每步 ≤15 行含标题空行） | 下放到 |
|---|---|---|
| Step 1 | 目的、按 recipe 启动（引 recipe 表）、子 Agent prompt 完整性硬约束 1 行、RAW_COUNT 要求 1 行 + `refs/dispatch.md` 引用 | RAW_COUNT 编号/求和细则、加强审查路径并入口径细则 → dispatch.md |
| Step 2 | 去重规则 3 行、`sources` 列强制 1 行 + dispatch 引用、未纳入清单 2 行、守恒等式自检原文、`[拒绝异常]` 检测 2 行（判据原文保留） | `sources` 短名规范、编号空间隔离（三编号空间）→ dispatch.md |
| Step 3 | 前置条件 1 行、三档阈值（raw 口径）原文、`[拒绝异常]` 覆盖规则、口径冻结、时序硬约束 | 截断回退细则（已为口径节例外④，此处只留 1 行引用）；监督 4 维展开 → dispatch.md |
| Step 4 | 前置条件 checklist 5 条、修复策略 5 条、P0 前置 Gate + 记账规则压缩、同文件不并发 1 行 + dispatch 引用、校验/退化补偿 2 行 | 同文件不并发判定细则（现 527–538）、多修复子 Agent 合并规则 → dispatch.md |
| Step 5 | 独立 Agent 要求、四轴触发面原文、兼并触发条件、5 项名称列表、收敛判定引用、退化补偿两轮 1 行 | 5 项逐项执行细则、各档载体细节 → dispatch.md |

必须保留在主体的原文（红线）：三档阈值、`[拒绝异常]` 判据、四轴触发面、守恒等式、口径冻结规则。
必须保留的模板：`STEP<N>_EXECUTED` 字段枚举（status/mode/raw_count_sum/merged_count/conservation/merged_count_final/agents/issues_found/degradation/notes/ref）与「标记块缺失 = 未执行」通过标准。

- [ ] **Step 3: 收编到 dispatch.md / routing.md**

在 dispatch.md 末尾追加 5 个小节（标题固定）：

```markdown
## 细则 A: sources 短名规范与编号空间隔离
## 细则 B: RAW_COUNT 强制与守恒校验
## 细则 C: 同文件不并发判定
## 细则 D: Step 5 兼并合并验证五项
## 细则 E: 多模型渐进式对齐细则与 0b 注入模板
```

内容逐字迁入原 SKILL.md 对应文本（463/465/456/527–538/559–564/227–246/343–353），不改语义。
routing.md 末尾追加：

```markdown
## 细则 F: 加强审查例外完整叙述（原 SKILL.md 207/211 节全文）
```

- [ ] **Step 4: 校验**

```bash
cd /workspace/specpowers
S=skills/specpowers-review/SKILL.md
L=$(sed -n '/^\*\*Step 1 — 审查 Agent 并行执行/,/^### Gate Token 输出/p' $S | wc -l)
echo "Step1-5 区块行数: $L"     # 期望 ≤85
for k in 'sources 短名规范' '编号空间隔离' 'RAW_COUNT 强制' '同文件不并发' '兼并 Step 3 合并验证模式'; do
  grep -q "$k" skills/specpowers-review/refs/dispatch.md && echo "PASS dispatch: $k"
done
grep -q '细则 F: 加强审查例外完整叙述' skills/specpowers-review/refs/routing.md && echo "PASS routing 收编"
# 红线存在性
for k in 'p0_raw≥3 或 N>15' '合计 > 3 条，或占 `Σp\*_raw` 比例 > 30%' 'p0_raw≥1` 或 `p0_rejected≥1' '∑p\*_supplement'; do
  grep -q "$k" $S || echo "REDLINE MISSING: $k"
done
```
Expected: ≤85、5 个 PASS、routing PASS、无 REDLINE MISSING。

- [ ] **Step 5: Commit**

```bash
git add skills/specpowers-review/SKILL.md skills/specpowers-review/refs/dispatch.md skills/specpowers-review/refs/routing.md
git commit -m "refactor(review): Step1-5 骨架化并将执行细则下放 dispatch/routing"
```

---

## Task 6（PR-2）: 加强审查例外表 + S3/S5 + 收敛节压缩 + 行数收口

**Files:**
- Modify: `skills/specpowers-review/SKILL.md`（196–211、584–631）
- Modify: `skills/specpowers-review/refs/markers.md`（S3 去重 + S5 压缩）
- Modify: `skills/specpowers-review/refs/ledger.md`（S3 注释瘦身）
- Modify: `AGENTS.md:34`、`AGENTS.md:48`（节名同步，自 PR-4 前移）

**Interfaces:**
- Consumes: Task 5 下放到 routing.md 的「细则 F」。
- Produces: review SKILL.md ≤480 行；例外表 4 行覆盖全部交叉分支。

- [ ] **Step 1: 把加强审查 207/211 两段散文改写为例外表**

主体保留 196–206 主干（适用条件、code-review+对齐两关、P0 修复机制首段），207/211 替换为：

```markdown
#### 加强审查例外表（完整叙述见 refs/routing.md「细则 F」）

| 触发 | 动作 | 输出标记 |
|---|---|---|
| 默认轮（无 `[拒绝异常]`） | 内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token；收敛按 **raw** 口径 | STEP3/4/5_TIER_SKIPPED |
| `[拒绝异常]` 且 N>0 | 不裁剪 Step 3：独立监督 4 维；Step 4/5 仍裁剪；`[补充否决异常]` 复议留痕写入 notes | STEP3_EXECUTED（**不输出** STEP3_TIER_SKIPPED） |
| `[拒绝异常]` 且 N==0 | 不启动 Step 3；例外启动独立 Step 5 复核拒绝理由与守恒等式 | STEP5_EXECUTED（**不输出** STEP5_TIER_SKIPPED） |
| 用户拒绝某项 P0 | 放弃子路径，升级完整层：Step 3/4/5 全执行 | STEP3/4/5_EXECUTED（不输出 TIER_SKIPPED） |

> 执行顺序（写死）：`STEP2 合并 → [例外 Step 3] → 内联修复 + 对齐复检（P0 清零）→ 轻量通读 → 收敛判定 → Gate Token`。
```

- [ ] **Step 2: 压缩收敛节的字段重述与三差值全文**

- 596 行的 A/B/C 三差值定义删除，改为：`任一轮缺 p*_merged 时按 refs/ledger.md 协议 1「⑤（差值型条件）特殊处理」的三差值规则计算（任一 > 3 即触发）`。
- 600 行的字段逐项解释压到 3 行（字段名清单 + 「判定口径 merged / 审计基线 raw / 守恒 fail 不得 exit」+ 「完整字段以 refs/convergence.md 协议 7 为正本」）。
- 5 触发条件原文、默认继续制、用户通知模板**不动**。

- [ ] **Step 3: S3 + S5（在 refs 侧执行）**

- `markers.md` 协议 3 的 `mode` 字段说明（原 L216）：删去重复的档位判据全文，改为 `档位判据见 SKILL.md Step 3；本字段仅说明取值语义`，保留 `standard|transferred_to_step5|trivial` 三值定义各 1 句。
- `markers.md` 的「验证能力与限制」表 + 「双层验证原理」图（原 L279–309）压缩为一段 ≤6 行，**保留**：「缺失即阻塞」「伪 AgentId 不可技术验证」两条结论。
- `ledger.md` 账本结构注释：每字段保留一句语义，重复的守恒/拒绝异常解释改为 `见 SKILL.md「问题数口径权威定义」`。
- 追加在协议 3「各 Step 标记块定义」后一行：`字段语义与判定规则的唯一权威：SKILL.md「问题数口径权威定义」`。

- [ ] **Step 3b: AGENTS.md 节名同步（决策 7：与改名同一 PR，不留陈旧窗口）**

- L34 目录表 review 行：`审查纪律自检 + 防偷懒协议` → `自检清单（合理化表 + Red Flags + 多轮追加）`。
- L48 决策 7：`三层防退化防御——审查纪律自检（合理化表 + Red Flags）、多轮审查防偷懒协议（主 Agent 自检）、审查层级边界` → `三层防退化防御——自检清单（合理化表 + Red Flags + 第≥2轮追加）、审查层级边界（两层边界原则）`。

- [ ] **Step 4: 全文件行数与红线校验**

```bash
cd /workspace/specpowers
S=skills/specpowers-review/SKILL.md
echo "SKILL: $(wc -l < $S) 行"                 # 期望 ≤480
echo "refs: $(cat skills/specpowers-review/refs/*.md | wc -l) 行"   # 期望 ≤820
grep -q 'p0_merged > 1' $S && grep -q 'p1_merged > 5' $S && echo "PASS 5 触发条件原文"
grep -q 'Σ(所有行的 sources 条数) + Σp\*_rejected == Σp\*_raw + Σp\*_supplement' $S && echo "PASS 守恒等式"
grep -c 'STEP.*_TIER_SKIPPED' $S                                # 例外表 4 行均含标记
grep -n '多轮审查防偷懒协议\|审查纪律自检（合理化表' AGENTS.md || echo "PASS AGENTS 旧节名已清除"
```
Expected: ≤480 / ≤820 / PASS / PASS / ≥4 / PASS。

- [ ] **Step 5: 例外分支矩阵人工推演并记录**

在 MR 描述中逐条写出推演结论（4 条）：
1. 默认轮 × 有 P0 → 内联修复+复检，P0 清零后轻量通读；
2. `[拒绝异常]`×N>0 → Step 3 独立监督，Step 4/5 裁剪，复议留痕进 notes；
3. `[拒绝异常]`×N==0 → 独立 Step 5 复核，不输出 SKIPPED；
4. 用户拒 P0 → 升完整层，后续按完整层 Step 3/4/5；
5. Step 4 退化 + transferred → 回退独立 Step 3（原规则保留，不受本表影响）。

- [ ] **Step 6: Commit**

```bash
git add -A skills/specpowers-review/ AGENTS.md
git commit -m "refactor(review): 加强审查例外表格化、收敛节去重并收口行数"
```

---

## Task 7（PR-3）: 入口技能去重（386 → ≤345）

**Files:**
- Modify: `skills/specpowers/SKILL.md`

**Interfaces:**
- Produces: 入口技能行数 ≤345，且启动协议、执行模式决策树、验证链**逐字不变**。

- [ ] **Step 1: 基线校验**

```bash
cd /workspace/specpowers
wc -l skills/specpowers/SKILL.md   # 基线 386
```

- [ ] **Step 2: 三处定点合并**

1. **Pre-Flight（278–290）并入环境准备（236–249）**：删除重复的 `openspec --version`、`node --version` 两行检查（环境准备表已有），保留 TEST_COMMAND/QTDIR 与「配置方式」1 行；删除 Pre-Flight 空节标题。
2. **适用场景（222–234）三小节 → 一张表**：

```markdown
## 适用场景

| 场景 | 用法 |
|---|---|
| 团队/长期维护/复杂功能/跨会话多步骤 | 完整 specpowers |
| 小改动、需求明确（改颜色/修 typo） | 只用 OpenSpec |
| 一次性脚本、无需长期规范的小功能 | 只用 Superpowers |

**判断标准**: 代码生命周期 × 协作人数。生命周期 < 1 天且单人 → 无需；> 1 月且多人 → 完整 specpowers。
```

3. **Red Flags（99–112）删除 1 行**：`| 收敛判定问用户是否继续 | 默认继续制：通知不是询问 |`（决策分类表「Gate 0-3 审查收敛判定」已同义）；**快速上手（360–373）**合并 `brainstorming`+`propose` 两行为一行 design，合并 `验证`+`归档` 两行为一行 archive。

- [ ] **Step 3: 校验**

```bash
cd /workspace/specpowers
S=skills/specpowers/SKILL.md
echo "行数: $(wc -l < $S)"                                  # 期望 ≤345
grep -q '## 执行模式选择' $S && grep -q '## 启动协议' $S && grep -q 'Gate 返回后验证协议' $S && echo "PASS 承重节保留"
grep -c 'skipped' $S >/dev/null; grep -q 'Gate 3 除外' $S && echo "PASS 验证0 微小豁免保留"
```
Expected: ≤345 / PASS / PASS。

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers/SKILL.md
git commit -m "refactor(entry): 合并重复节，入口技能收口至345行内"
```

---

## Task 8（PR-4）: 四子技能轻度去重

**Files:**
- Modify: `skills/specpowers-design/SKILL.md`、`skills/specpowers-plan/SKILL.md`、`skills/specpowers-apply/SKILL.md`、`skills/specpowers-archive/SKILL.md`

**Interfaces:**
- Consumes: Task 4 的新节名「自检清单」（AGENTS.md 已在 Task 6 同步，本任务只做回归核对）。
- Produces: 四技能合计 ≤608 行（−20 起）。

- [ ] **Step 1: 定位重复复述**

```bash
cd /workspace/specpowers
grep -n '标记块\|收敛判定\|防偷懒\|合理化表\|Red Flags\|问题数口径' \
  skills/specpowers-design/SKILL.md skills/specpowers-plan/SKILL.md \
  skills/specpowers-apply/SKILL.md skills/specpowers-archive/SKILL.md
```
Expected: 列出各技能的复述行；只处理**与 review 正本重复的规则全文**，改为 1 行引用（如 `完整规则见 specpowers-review「审查纪律自检」`）。

- [ ] **Step 2: 逐技能替换（三处已知项）**

1. `specpowers-apply`：Step 0 中与 review 重复的「标记块完整性/收敛判定」说明 → 保留 1 行引用入口「Gate 返回后验证协议」。
2. `specpowers-design`：Gate 0/1 说明中与 review「各 Gate 详细定义表」重复的列 → 保留 1 行 `见 specpowers-review「各 Gate 详细定义表」`。
3. `specpowers-plan`/`specpowers-archive`：仅删除逐字重复的 1–2 行，无重复则不改（**不得为凑行数删有效内容**）。

- [ ] **Step 3: 校验**

```bash
cd /workspace/specpowers
wc -l skills/specpowers-design/SKILL.md skills/specpowers-plan/SKILL.md \
      skills/specpowers-apply/SKILL.md skills/specpowers-archive/SKILL.md | tail -1   # 期望 ≤608
grep -n '多轮审查防偷懒协议\|审查纪律自检（合理化表' AGENTS.md || echo "PASS AGENTS 无旧节名（PR-2 已同步）"
grep -rn 'protocols\.md' AGENTS.md README.md README.en.md || echo "PASS 摘要侧无旧路径"
```
Expected: ≤608 / PASS / PASS。

- [ ] **Step 4: Commit**

```bash
git add skills/specpowers-*/SKILL.md
git commit -m "refactor: 四子技能去重（重复规则改引用 review 正本）"
```

---

## Task 9（PR-4）: evals 校准 + 版本 bump + 全仓终验

**Files:**
- Modify: `skills/specpowers-review/evals/cases/anti-laziness-step-skip.yaml:4-5`
- Modify: `package.json:4`、`.claude-plugin/plugin.json:5`

- [ ] **Step 1: 更新 evals 描述文字（不改断言）**

`anti-laziness-step-skip.yaml` 的 `description` 中「合理化表和 Red Flags 自检清单」→「自检清单（合理化表 + Red Flags + 第≥2轮追加）」。**`expect` / `judge` 一字不改**。

- [ ] **Step 2: 校验 evals 结构未破坏**

```bash
cd /workspace/specpowers
node - <<'EOF'
const fs=require('fs'),path='skills/specpowers-review/evals/';
const cfg=fs.readFileSync(path+'eval.yaml','utf8');
for(const m of cfg.matchAll(/- (evals\/cases\/[^\s]+)/g)){
  if(!fs.existsSync(path+m[1])) console.log('MISSING case:', m[1]);
}
const cases=fs.readdirSync(path+'cases');
console.log(`cases: ${cases.length} 个，引用完整`);
for(const c of cases){ const t=fs.readFileSync(path+'cases/'+c,'utf8');
  if(!/^id:/m.test(t)||!/^judge:/m.test(t)) console.log('BAD case:',c); }
EOF
command -v skill-up >/dev/null && skill-up validate skills/specpowers-review || echo "[DEGRADED] evals 未运行：skill-up/claude 不可用（静态校验通过）"
```
Expected: `cases: 8 个，引用完整` + DEGRADED 声明（**不得**声称 evals 通过）。

- [ ] **Step 3: 版本 bump**

```bash
cd /workspace/specpowers
sed -i 's/"version": "1.0.0"/"version": "1.1.0"/' package.json .claude-plugin/plugin.json
grep -n '"version"' package.json .claude-plugin/plugin.json
```
Expected: 两处均为 `1.1.0`。

- [ ] **Step 4: 全仓终验**

```bash
cd /workspace/specpowers
echo "=== 行数 ==="
wc -l skills/specpowers-review/SKILL.md skills/specpowers/SKILL.md
cat skills/specpowers-review/refs/*.md | wc -l
echo "=== 旧路径/旧节名残留（应为空）==="
grep -rn 'refs/protocols\.md' skills/ AGENTS.md README.md README.en.md || echo "PASS 无残留"
grep -rn '多轮审查防偷懒协议' skills/ AGENTS.md README.md README.en.md || echo "PASS 无旧节名"
echo "=== 两条强制自检 ==="
node scripts/verify-dsh-provider.mjs
node scripts/verify-no-internal-refs.mjs
```
Expected: review ≤480、入口 ≤345、refs ≤820；两条 PASS 行；两脚本 ALL PASS。

- [ ] **Step 5: Commit 并推送**

```bash
git add -A
git commit -m "chore: evals 描述校准、版本 bump 至 1.1.0"
git push origin feat/skill-slimming
```

- [ ] **Step 6: 记录验收报告（写入 MR 描述，不新建文件）**

MR 描述必须含：四组行数前后对比表、引用完整性审计输出、规则唯一性审计结论（~25 条规则族逐条「唯一完整定义位置」）、红线逐项核对、`[DEGRADED] evals 未运行` 声明、以及「仓库无 CHANGELOG，版本变更见本 MR」说明。

---

## Task 10: 推送与 MR（每个 PR 完成后执行，需用户确认）

**Files:** 无代码改动。

- [ ] **Step 1: 确认工作树与自检**

```bash
cd /workspace/specpowers && git status -sb && node scripts/verify-dsh-provider.mjs && node scripts/verify-no-internal-refs.mjs
```

- [ ] **Step 2: 推送并开 MR（用户确认后）**

```bash
git push origin feat/skill-slimming
# GitLab：MR feat/skill-slimming → main；标题与描述按 Task 9 Step 6 的验收报告
# 合入后：git checkout main && git pull && git checkout feat/skill-slimming && git rebase main，再进入下一 PR
```

---

## Self-Review（计划自检结果）

- **Spec coverage**：§4.1 去向表 → Task 4/5/6 逐节覆盖；§4.2 六文件 → Task 1/5；§4.3 加载表 → Task 2；§4.4 入口与摘要 → Task 7/8；§5 S1–S7 → Task 4/6/7/8；§6 四个 PR → Task 1–3 / 4–6 / 7 / 8–9；§9 验收 → Task 6/9 校验命令。无遗漏项。
- **Step scan**：每个 step 都给出可执行命令或逐字替换内容；未出现「适当处理」「视情况」类空步。压缩类步骤给出保留清单与目标行数，实施者不需自行决定删什么。
- **Type consistency**：新文件名 `ledger/markers/dispatch/routing/ultrareview/convergence` 在 Task 1/2/3/5/6 中一致；「自检清单」节名在 Task 4/8 一致；`refs/dispatch.md 细则 A–E`、`routing.md 细则 F` 与 Task 5 Step 3 定义一致。
- **Review Focus**：5 条各有归属测试——① Task 5 Step 4 的 dispatch 关键字断言；② Task 2 Step 3 的锚点脚本；③ Task 6 Step 4/5 的例外标记计数与矩阵推演；④ Task 8 Step 4 的 AGENTS grep；⑤ Task 9 Step 2 的 DEGRADED 声明与静态校验。
- **Proportion**：计划约 400 行 vs 设计约 200 行，主要篇幅是命令与逐字替换内容（不可由实施者推断），无代码抄录。

**计划偏差披露**：设计 §6 提到的 CHANGELOG 与 §4.2 的 772 行估算已按实测修正（见文首）。其余未偏离设计。
