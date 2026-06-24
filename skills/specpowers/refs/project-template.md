# 项目模板

启用 specpowers 的项目需具备以下目录结构：

```
project/
├── .claude/settings.json    # hooks 配置 (GitLab Flow + checklist)
├── docs/
│   ├── checklist.md         # Pre/Post-Task 清单
│   ├── superpowers/plans/   # 实施计划
│   ├── skills/specpowers/   # 本 skill（方法论）
│   ├── skills/<domain>/     # 其他领域 skill
│   ├── experience/          # 通用开发经验（按领域分类）
│   │   ├── README.md
│   │   ├── <domain>-pitfalls.md
│   │   └── ...
│   └── refs/                # 外部参考文档
│       └── <reference>.md
├── openspec/
│   ├── config.yaml          # schema: spec-driven
│   ├── specs/               # 主规范
│   └── changes/             # 活跃变更 + archive/
├── .claude/skills/          # 项目 skills (Claude Code 可发现)
└── scripts/                 # 项目脚本
```

## 目录说明

| 目录 | 用途 | 面向 |
|------|------|------|
| `docs/skills/` | 可执行方法论（怎么做） | AI + 人 |
| `docs/experience/` | 通用开发经验（避坑指南） | AI + 人 |
| `docs/refs/` | 外部参考文档原文 | 人（设计参考） |
| `.claude/skills/` | Claude Code 自动发现路径（符号链接/安装） | AI |
| `openspec/` | 规范驱动开发文档 | AI（SDD 流程） |

> `docs/skills/` = 人类可读 + Git 版本控制；`.claude/skills/` = Claude Code 运行时自动发现。
> 两者可以指向同一内容（通过符号链接或 `cp -r`），也可独立维护。
