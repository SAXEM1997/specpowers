// specpowers: SpecPowers skills for the DeepSeek Harness.
//
// A Cordis plugin that registers one skill provider into the HOST layer of the
// `ctx.skills` registry, so every agent preset's scope chain merges these
// skills. Skill bodies live in `../skills/<name>/SKILL.md` inside this
// package; the provider locates them from `import.meta.url` (an assembly fact
// of this package, never user config) and loads bodies on demand.
//
// The provider protocol mirrors @deepseek-ai/dsh-skill-filesystem:
//   - list()  discovers directory-bundle candidates (name/description from
//     YAML frontmatter, body left unread until requested)
//   - get()   parses the winning candidate's SKILL.md and returns the full
//     definition with a directory resource base for relative references
//
// @module specpowers
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const name = 'specpowers'
const inject = ['skills']

/** Registry precedence for packaged skill providers: ranks below the local bundled root (600). */
const PACKAGED_SKILL_RANK = 550

/** The source bucket these skills advertise under (prompt-visible metadata). */
const SOURCE = 'custom'

/** A top-level `key:` line. Indented lines belong to a block scalar or nested mapping. */
const KEY_RE = /^([A-Za-z][\w-]*):(.*)$/

/**
 * Strip one layer of matching single or double quotes.
 * @param value - the raw scalar text.
 * @returns the unquoted text.
 */
function unquote(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

/**
 * Fold the lines of a YAML folded block scalar: single line breaks become
 * spaces, blank lines become newlines.
 * @param lines - block scalar lines with base indentation already removed.
 * @returns the folded text.
 */
function foldLines(lines) {
  const paragraphs = []
  let buffer = []
  for (const line of lines) {
    if (line === '') {
      paragraphs.push(buffer.join(' '))
      buffer = []
    } else {
      buffer.push(line)
    }
  }
  paragraphs.push(buffer.join(' '))
  return paragraphs.join('\n')
}

/**
 * Parse the YAML frontmatter block of a SKILL.md into metadata plus body.
 *
 * Unlike a naive line-by-line scalar reader, this handles every scalar form the
 * specpowers skills actually use: single-line scalars, folded block scalars
 * (`>` / `>-`), literal block scalars (`|` / `|-`), and multi-line plain
 * scalars whose continuation lines are indented. `description` is the only
 * routing signal DSH has, so silently degrading it to `>` or truncating it
 * would make skills discoverable but unselectable.
 *
 * @param text - the raw skill file contents.
 * @returns parsed metadata object and the markdown body after the block, or
 *   null when the file has no frontmatter block at all.
 */
function parseFrontmatter(text) {
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---', 3)
  if (end === -1) return null
  const block = text.slice(3, end)
  const body = text.slice(end + 4).replace(/^\n+/, '')
  const metadata = {}
  const lines = block.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    // Top-level keys only: skip blanks, comments, and already-claimed indented lines.
    if (/^\s*$/.test(line) || /^\s*#/.test(line) || /^\s/.test(line)) {
      i++
      continue
    }
    const match = KEY_RE.exec(line)
    if (match === null) {
      i++
      continue
    }
    const key = match[1]
    const rest = match[2].trim()
    if (rest === '') {
      // Nested mapping (e.g. `metadata:`): consume its indented block verbatim.
      const nested = []
      i++
      while (i < lines.length && (/^\s/.test(lines[i]) || /^\s*$/.test(lines[i]))) {
        nested.push(lines[i])
        i++
      }
      metadata[key] = nested.join('\n')
      continue
    }
    if (rest === '>' || rest === '>-' || rest === '|' || rest === '|-') {
      const folded = rest[0] === '>'
      const collected = []
      let baseIndent = -1
      i++
      while (i < lines.length) {
        const current = lines[i]
        if (/^\s*$/.test(current)) {
          collected.push('')
          i++
          continue
        }
        const indent = current.length - current.trimStart().length
        if (baseIndent === -1) baseIndent = indent
        else if (indent < baseIndent) break
        collected.push(current.slice(baseIndent))
        i++
      }
      while (collected.length > 0 && collected[collected.length - 1] === '') collected.pop()
      // `>` clips and `>-` strips a trailing newline; both are normalized away
      // because DSH consumes a description as single-line routing text.
      metadata[key] = folded ? foldLines(collected) : collected.join('\n')
      continue
    }
    // Plain scalar, possibly continued on more-indented following lines.
    const parts = [rest]
    i++
    while (i < lines.length && /^\s+\S/.test(lines[i])) {
      parts.push(lines[i].trim())
      i++
    }
    metadata[key] = unquote(parts.join(' '))
  }
  return { metadata, body }
}

/**
 * Read and parse one skill directory's SKILL.md.
 * @param skillFile - absolute path to the SKILL.md file.
 * @param signal - optional cancellation; aborts the read.
 * @returns the parsed skill record, or undefined when the file vanished.
 */
async function parseSkillFile(skillFile, signal) {
  let text
  try {
    text = await readFile(skillFile, 'utf8')
  } catch {
    return undefined
  }
  if (signal?.aborted) return undefined
  const parsed = parseFrontmatter(text)
  if (parsed === null) return undefined
  return {
    name: parsed.metadata.name ?? '',
    description: parsed.metadata.description ?? '',
    whenToUse: parsed.metadata.whenToUse,
    metadata: parsed.metadata,
    content: parsed.body
  }
}

/**
 * Discover packaged skill candidates by scanning the package's `skills/`
 * directory: one subdirectory per skill, each carrying a SKILL.md.
 * @param skillsRoot - absolute path to this package's skills directory.
 * @param signal - optional cancellation.
 * @returns the candidate list.
 */
async function discoverCandidates(skillsRoot, signal) {
  let entries
  try {
    entries = await readdir(skillsRoot, { withFileTypes: true })
  } catch {
    return []
  }
  const candidates = []
  for (const entry of entries) {
    if (signal?.aborted) break
    if (!entry.isDirectory()) continue
    const skillDir = join(skillsRoot, entry.name)
    const skillFile = join(skillDir, 'SKILL.md')
    const parsed = await parseSkillFile(skillFile, signal)
    if (parsed === undefined) continue
    candidates.push({
      name: parsed.name,
      description: parsed.description,
      ...(parsed.whenToUse !== undefined ? { whenToUse: parsed.whenToUse } : {}),
      invocation: { modelInvocable: true, userInvocable: true },
      source: SOURCE,
      provider: name,
      rank: PACKAGED_SKILL_RANK,
      locator: skillDir,
      path: skillFile,
      ...(Object.keys(parsed.metadata).length > 0 ? { metadata: parsed.metadata } : {})
    })
  }
  return candidates
}

/** Register the packaged specpowers provider on `ctx.skills`. */
function apply(ctx) {
  const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills')
  ctx.skills.registerProvider(() => ({
    name,
    async list(options) {
      return discoverCandidates(skillsRoot, options.signal)
    }
  }))
}

export { apply, name, inject }
export default { apply, name, inject }
