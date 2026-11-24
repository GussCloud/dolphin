// Recognizes Claude's bypass-mode removal prompts by a strict grammar: the whole command must be a
// single `rm`/`rmdir` with known flags, and every target must match one category's exact shape.
// Anything else is null and the prompt stays with the user.
import type { BypassRemovalCategory } from './agent-permission-policy'
import {
  isFilesystemRoot,
  isRemovableMountPath,
  isSameOrAncestor,
  normalizeCwd,
  pathRulesForCwd,
  resolveTargetPath,
  samePath,
  type PathRules
} from './bypass-removal-target-paths'

export type BypassRemovalClassifierOptions = {
  /** Needed to read `~/`; without it such a target is unrecognized. */
  homeDir?: string
  /** Host the command runs on; decides case sensitivity. Defaults to this process. */
  platform?: NodeJS.Platform
}

/** What main must confirm on disk before approving: symlinks can move a literal path. */
export type BypassRemovalDiskCheck =
  | { kind: 'is-cwd'; path: string }
  | { kind: 'is-mount'; path: string }

export type BypassRemovalAnalysis = {
  categories: BypassRemovalCategory[]
  diskChecks: BypassRemovalDiskCheck[]
}

type ClassifiedTarget = { category: BypassRemovalCategory; check?: BypassRemovalDiskCheck }

const PROGRAMS = new Set(['rm', 'rmdir', '/bin/rm', '/bin/rmdir', '/usr/bin/rm', '/usr/bin/rmdir'])
const LONG_FLAGS = new Set(['--recursive', '--force', '--dir', '--verbose'])
const SHORT_FLAGS = /^-[rRfdv]+$/
const NAME = '[A-Za-z_][A-Za-z0-9_]*'
const SAFE_CHARS = '[A-Za-z0-9._/@+=,:%-]'
const VARIABLE = new RegExp(`^(")?\\$(?:${NAME}|\\{${NAME}\\})(${SAFE_CHARS}*)\\1$`)
const SUBSTITUTION = new RegExp(
  `^(")?\\$\\((?:pwd|mktemp|dirname|basename|realpath|git rev-parse)(?: ${SAFE_CHARS}+)*\\)\\1$`
)
const LITERAL = /^(?:'([^']*)'|"([^"$`\\!]*)"|([A-Za-z0-9._/@+=,:%~*?[\]-]+))$/
const GLOB_CHARS = /[*?[]/
const DOUBLE_QUOTED_BODY = /^(?:[^"`\\!$]|\$[A-Za-z_{(][A-Za-z0-9_ ./@+=,:%{}()-]*)*$/
const SUBSTITUTION_BODY = /^\([A-Za-z0-9_ ./@+=,:%-]*$/
const BRACED_NAME_BODY = new RegExp(`^\\{${NAME}$`)
const UNQUOTED_WORD_CHAR = /[A-Za-z0-9._/@+=,:%~*?[\]$-]/

/** Splits on blanks; null when the text holds any shell syntax beyond words, quotes and `$`. */
function splitWords(command: string): string[] | null {
  const words: string[] = []
  let word = ''
  let i = 0
  const takeThrough = (close: string, body: RegExp): boolean => {
    const end = command.indexOf(close, i + 1)
    if (end === -1 || !body.test(command.slice(i + 1, end))) {
      return false
    }
    word += command.slice(i, end + 1)
    i = end + 1
    return true
  }
  while (i < command.length) {
    const ch = command[i]
    let ok = true
    if (ch === ' ' || ch === '\t') {
      if (word) {
        words.push(word)
        word = ''
      }
      i++
    } else if (ch === "'") {
      ok = takeThrough("'", /^[^']*$/)
    } else if (ch === '"') {
      ok = takeThrough('"', DOUBLE_QUOTED_BODY)
    } else if (ch === '$' && command[i + 1] === '(') {
      ok = takeThrough(')', SUBSTITUTION_BODY)
    } else if (ch === '$' && command[i + 1] === '{') {
      ok = takeThrough('}', BRACED_NAME_BODY)
    } else if (UNQUOTED_WORD_CHAR.test(ch)) {
      word += ch
      i++
    } else {
      // ; & | < > ( ) { } ! # ` \ newlines and anything else: not one simple command.
      ok = false
    }
    if (!ok) {
      return null
    }
  }
  if (word) {
    words.push(word)
  }
  return words
}

const hasDotDotSegment = (path: string) => path.split(/[\\/]/).includes('..')

type Scan = {
  cwd: string
  rules: PathRules
  homeDir: string | undefined
  platform: NodeJS.Platform
}

function classifyLiteral(value: string, quoted: boolean, scan: Scan): ClassifiedTarget | null {
  if (hasDotDotSegment(value)) {
    return null
  }
  // Why no globs at all: `.*/*` matches `..` before bash 5.2 and `*/*` follows symlinked folders.
  if (!quoted && GLOB_CHARS.test(value)) {
    return null
  }
  let literal = value
  if (!quoted && value.startsWith('~')) {
    if (!scan.homeDir || !value.startsWith('~/')) {
      return null
    }
    literal = scan.homeDir + value.slice(1)
  }
  const resolved = resolveTargetPath(literal, scan.cwd, scan.rules)
  if (resolved === null) {
    return null
  }
  if (literal.startsWith('/') && isRemovableMountPath(resolved, scan.rules, scan.platform)) {
    return { category: 'mounted-drive', check: { kind: 'is-mount', path: resolved } }
  }
  const home = scan.homeDir ? normalizeCwd(scan.homeDir, scan.rules) : null
  // Exactly the cwd, never the filesystem root, home or a parent of home; inside the cwd is null.
  if (
    isFilesystemRoot(resolved, scan.rules) ||
    (home !== null && isSameOrAncestor(resolved, home, scan.rules)) ||
    !samePath(resolved, scan.cwd, scan.rules)
  ) {
    return null
  }
  return { category: 'working-directory', check: { kind: 'is-cwd', path: resolved } }
}

function classifyTarget(word: string, scan: Scan): ClassifiedTarget | null {
  const variable = VARIABLE.exec(word)
  if (variable) {
    return hasDotDotSegment(variable[2]) ? null : { category: 'variable-target' }
  }
  if (SUBSTITUTION.test(word)) {
    return { category: 'command-substitution' }
  }
  const literal = LITERAL.exec(word)
  if (!literal) {
    return null
  }
  const quotedValue = literal[1] ?? literal[2]
  return classifyLiteral(quotedValue ?? literal[3], quotedValue !== undefined, scan)
}

/** The categories and on-disk checks a removal command needs, or null when it is not one. */
export function analyzeBypassRemoval(
  command: string,
  cwd: string,
  options: BypassRemovalClassifierOptions = {}
): BypassRemovalAnalysis | null {
  const words = splitWords(command.trim())
  if (!words || words.length < 2 || !PROGRAMS.has(words[0])) {
    return null
  }
  const platform = options.platform ?? process.platform
  const rules = pathRulesForCwd(cwd, platform)
  const scan: Scan = { cwd: normalizeCwd(cwd, rules), rules, homeDir: options.homeDir, platform }
  const categories = new Set<BypassRemovalCategory>()
  const diskChecks: BypassRemovalDiskCheck[] = []
  let optionsEnded = false
  let targets = 0
  for (const word of words.slice(1)) {
    if (!optionsEnded && word === '--') {
      optionsEnded = true
      continue
    }
    // GNU rm also reads options after operands, so every dash word must be a known flag.
    if (!optionsEnded && word.startsWith('-')) {
      if (!SHORT_FLAGS.test(word) && !LONG_FLAGS.has(word)) {
        return null
      }
      continue
    }
    const target = classifyTarget(word, scan)
    if (!target) {
      return null
    }
    categories.add(target.category)
    if (target.check) {
      diskChecks.push(target.check)
    }
    targets++
  }
  return targets === 0 ? null : { categories: [...categories].sort(), diskChecks }
}

/** Every category the command needs, or null when it is not a recognized removal. */
export function classifyBypassRemovals(
  command: string,
  cwd: string,
  options: BypassRemovalClassifierOptions = {}
): BypassRemovalCategory[] | null {
  return analyzeBypassRemoval(command, cwd, options)?.categories ?? null
}

/** The single category of the command, or null when it needs several or is unrecognized. */
export function classifyBypassRemoval(
  command: string,
  cwd: string,
  options: BypassRemovalClassifierOptions = {}
): BypassRemovalCategory | null {
  const categories = classifyBypassRemovals(command, cwd, options)
  return categories?.length === 1 ? categories[0] : null
}
