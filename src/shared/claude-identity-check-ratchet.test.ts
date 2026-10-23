import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Ratchet on code that branches on the Claude identity (`=== 'claude'`, `case 'claude'`, ...).
 *
 * DeepSeek runs the same Claude Code CLI, so every new Claude-only branch is a decision about
 * whether DeepSeek gets it too. Each listed file is pinned to its exact count of such checks:
 * adding one fails here until someone decides (shared predicate in deepseek-status-identity.ts,
 * or a deliberate Claude-only check) and updates the count; removing one requires lowering it.
 */
const ALLOWLIST_PATH = join(__dirname, '__fixtures__', 'claude-identity-check-allowlist.txt')

function readAllowlist(): Map<string, number> {
  const counts = new Map<string, number>()
  for (const raw of readFileSync(ALLOWLIST_PATH, 'utf8').split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) {
      continue
    }
    const [path, count] = line.split(/\s+/)
    counts.set(path, Number(count))
  }
  return counts
}

const CLAUDE_LITERAL = String.raw`'claude(?:-agent-teams)?'`
const CHECK_PATTERN = new RegExp(
  String.raw`(?:[!=]==?\s*${CLAUDE_LITERAL})|(?:${CLAUDE_LITERAL}\s*[!=]==?)|(?:\bcase\s+${CLAUDE_LITERAL})`,
  'g'
)
const SCANNED_ROOTS = ['src', 'mobile/src', 'mobile/app']
const SCANNED_EXTENSIONS = ['.ts', '.tsx']
const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'out',
  'build',
  '.git',
  '__fixtures__'
])

function isTestFile(path: string): boolean {
  return (
    /\.(?:test|spec)\.tsx?$/.test(path) ||
    /(?:test-harness|test-utils|test-setup|test-fixture|test-support|test-mocks|repro)/.test(
      path
    ) ||
    path.includes('/__tests__/')
  )
}

function collectSourceFiles(root: string): string[] {
  let found: string[] = []
  let entries: string[]
  try {
    entries = readdirSync(root)
  } catch {
    return found
  }
  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry)) {
      continue
    }
    const full = join(root, entry)
    if (statSync(full).isDirectory()) {
      found = found.concat(collectSourceFiles(full))
      continue
    }
    if (SCANNED_EXTENSIONS.some((extension) => full.endsWith(extension))) {
      found.push(full)
    }
  }
  return found
}

/** Drop comment-only lines so prose quoting the idiom is not counted. */
function codeText(contents: string): string {
  return contents
    .split('\n')
    .filter((line) => !/^\s*(?:\/\/|\/\*|\*)/.test(line))
    .join('\n')
}

describe('Claude identity check ratchet', () => {
  const repoRoot = resolve(__dirname, '..', '..')
  const files = SCANNED_ROOTS.flatMap((root) => collectSourceFiles(join(repoRoot, root)))
  const actual = new Map<string, number>()
  for (const file of files) {
    const path = relative(repoRoot, file).split('\\').join('/')
    if (isTestFile(path)) {
      continue
    }
    const count = codeText(readFileSync(file, 'utf8')).match(CHECK_PATTERN)?.length ?? 0
    if (count > 0) {
      actual.set(path, count)
    }
  }
  const allowlist = readAllowlist()

  it('scans a plausible number of files', () => {
    // A broken root or extension list would make the guard silently vacuous.
    expect(files.length).toBeGreaterThan(500)
    expect(actual.size).toBeGreaterThan(50)
  })

  it('has no new Claude identity check outside the allowlist', () => {
    const grown = [...actual]
      .filter(([path, count]) => count > (allowlist.get(path) ?? 0))
      .map(([path, count]) => `${path} ${count} (allowed ${allowlist.get(path) ?? 0})`)
    expect(
      grown,
      'New Claude identity check. Decide whether DeepSeek (same Claude Code CLI) needs it: use ' +
        'isClaudeHookAgentType/toHookHostAgentType from src/shared/deepseek-status-identity.ts, or ' +
        'keep it Claude-only on purpose — then raise the count in ' +
        'src/shared/__fixtures__/claude-identity-check-allowlist.txt.'
    ).toEqual([])
  })

  it('has no stale allowlist count', () => {
    // Why: a count left above reality re-opens room for the next unreviewed check.
    const shrunk = [...allowlist]
      .filter(([path, count]) => (actual.get(path) ?? 0) < count)
      .map(([path, count]) => `${path} ${actual.get(path) ?? 0} (listed ${count})`)
    expect(shrunk, 'Lower (or delete) these allowlist entries to the new count.').toEqual([])
  })
})
