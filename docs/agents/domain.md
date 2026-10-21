# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

**Layout: single-context.** This repo keeps one repository-wide `GLOSSARY.md` at the root and one ADR directory at `docs/adr/`. There is no `GLOSSARY-MAP.md` and no per-package/per-context `GLOSSARY.md` or `docs/adr/`. Do not scaffold them unless the repo actually becomes multi-context.

## Before exploring, read these

- **`GLOSSARY.md`** at the repo root.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved. This repo starts without `GLOSSARY.md`: create it — and add ADRs under `docs/adr/` — only at the first real term or decision, not during setup. `GLOSSARY-MAP.md` and per-context glossaries are for a multi-context repo and are not created here.

## File structure

Single-context repo (this repo):

```
/
├── GLOSSARY.md
└── docs/adr/
    ├── 0001-....md
    └── 0002-....md
```

Multi-context (not used here) would add a root `GLOSSARY-MAP.md` pointing at one `GLOSSARY.md` per context, plus an optional `docs/adr/` inside each context.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `GLOSSARY.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_
