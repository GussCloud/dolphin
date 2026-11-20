import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'

export const DEFAULT_BASELINE = 'config/security/semgrep-baseline.json'
export const RULES = 'config/security/semgrep-electron.yml'
const SNIPPET_LIMIT = 200
// Product code plus repo scripts; rules narrow themselves further with `paths`.
export const SCAN_TARGETS = ['src', 'cloud', 'mobile/src', 'mobile/app', 'config/scripts']
const SCAN_EXCLUDES = [
  '*.test.ts',
  '*.test.tsx',
  '*.test.mjs',
  '*.spec.ts',
  '__fixtures__',
  '__mocks__'
]

export function semgrepScanArgs(outputPath) {
  return [
    'scan',
    '--metrics=off',
    '--disable-version-check',
    '--config',
    RULES,
    '--json',
    '--output',
    outputPath,
    '--timeout',
    '30',
    ...SCAN_EXCLUDES.flatMap((pattern) => ['--exclude', pattern]),
    ...SCAN_TARGETS
  ]
}

function runSemgrep(semgrep, root) {
  const dir = mkdtempSync(path.join(tmpdir(), 'semgrep-gate-'))
  const output = path.join(dir, 'results.json')
  try {
    const result = spawnSync(semgrep, semgrepScanArgs(output), {
      cwd: root,
      stdio: ['ignore', 'inherit', 'inherit'],
      windowsHide: true
    })
    if (result.error) {
      throw result.error
    }
    // Exit 0 = no findings, 1 = findings; anything else is a crashed scan.
    if (result.status !== 0 && result.status !== 1) {
      throw new Error(`semgrep exited ${result.status}`)
    }
    return readFileSync(output, 'utf8')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

// check_id carries the config path as a dotted prefix (config.security.<rule>); rule ids have no dots.
export function ruleName(checkId) {
  return checkId.slice(checkId.lastIndexOf('.') + 1)
}

/**
 * Keys a finding by rule, file and matched source text rather than line number, so unrelated
 * edits above a baselined finding do not turn it into a "new" one.
 */
export function fingerprint({ rule, path: filePath, snippet }) {
  return `${rule}\0${filePath}\0${snippet}`
}

function normalizeSnippet(text) {
  return text.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LIMIT)
}

/** Reads the matched lines from disk: semgrep OSS prints "requires login" in `extra.lines`. */
export function findingsFromSemgrep(report, readSource) {
  if (!report || !Array.isArray(report.results)) {
    throw new Error('semgrep JSON has no results array')
  }
  const sourceCache = new Map()
  return report.results.map((result) => {
    const filePath = result.path.split(path.sep).join('/')
    if (!sourceCache.has(filePath)) {
      sourceCache.set(filePath, readSource(filePath).split(/\r?\n/))
    }
    const lines = sourceCache.get(filePath).slice(result.start.line - 1, result.end.line)
    return {
      rule: ruleName(result.check_id),
      path: filePath,
      line: result.start.line,
      snippet: normalizeSnippet(lines.join('\n')),
      message: result.extra?.message ?? ''
    }
  })
}

function countByKey(entries) {
  const counts = new Map()
  for (const entry of entries) {
    const key = fingerprint(entry)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Returns findings beyond the baselined count for their key, and baseline entries now gone. */
export function compareToBaseline(findings, baseline) {
  const remaining = countByKey(baseline.findings ?? [])
  const added = []
  for (const finding of findings) {
    const key = fingerprint(finding)
    const left = remaining.get(key) ?? 0
    if (left > 0) {
      remaining.set(key, left - 1)
    } else {
      added.push(finding)
    }
  }
  const fixed = []
  for (const entry of baseline.findings ?? []) {
    const key = fingerprint(entry)
    const left = remaining.get(key) ?? 0
    if (left > 0) {
      remaining.set(key, left - 1)
      fixed.push(entry)
    }
  }
  return { added, fixed }
}

export function buildBaseline(findings) {
  const sorted = findings
    .map(({ rule, path: filePath, snippet }) => ({ rule, path: filePath, snippet }))
    .sort((a, b) => fingerprint(a).localeCompare(fingerprint(b)))
  return {
    $comment:
      'Semgrep findings accepted on main. Regenerate only to remove fixed entries: ' +
      'node config/scripts/semgrep-baseline-gate.mjs update --semgrep <semgrep binary>',
    findings: sorted
  }
}

function parseArgs(argv) {
  const [command, ...rest] = argv
  const options = { command, results: null, semgrep: null, baseline: DEFAULT_BASELINE }
  for (let index = 0; index < rest.length; index += 2) {
    const flag = rest[index]
    const key = { '--results': 'results', '--semgrep': 'semgrep', '--baseline': 'baseline' }[flag]
    if (!key) {
      throw new Error(`Unknown argument: ${flag}`)
    }
    options[key] = rest[index + 1]
  }
  // --semgrep <bin> runs the scan itself; --results reads a saved `semgrep --json` output.
  if (!['check', 'update'].includes(command) || !(options.results || options.semgrep)) {
    throw new Error(
      'Usage: semgrep-baseline-gate.mjs <check|update> (--semgrep <bin> | --results <semgrep.json>) [--baseline <file>]'
    )
  }
  return options
}

export function main(argv = process.argv.slice(2), root = process.cwd()) {
  const options = parseArgs(argv)
  const report = JSON.parse(
    options.results
      ? readFileSync(path.resolve(root, options.results), 'utf8')
      : runSemgrep(options.semgrep, root)
  )
  const findings = findingsFromSemgrep(report, (filePath) =>
    readFileSync(path.resolve(root, filePath), 'utf8')
  )
  const baselinePath = path.resolve(root, options.baseline)
  if (options.command === 'update') {
    writeFileSync(baselinePath, `${JSON.stringify(buildBaseline(findings), null, 2)}\n`)
    console.log(`Wrote ${findings.length} findings to ${options.baseline}.`)
    return 0
  }
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  const { added, fixed } = compareToBaseline(findings, baseline)
  for (const finding of added) {
    console.log(
      `::error file=${finding.path},line=${finding.line},title=semgrep ${finding.rule}::${finding.message.replace(/\s+/g, ' ').trim()}`
    )
  }
  for (const entry of fixed) {
    console.log(
      `::notice title=semgrep baseline::${entry.rule} in ${entry.path} is gone; drop it from the baseline`
    )
  }
  const parseErrors = Array.isArray(report.errors) ? report.errors.length : 0
  console.log(
    `Semgrep: ${findings.length} findings, ${added.length} new, ${fixed.length} baselined entries fixed, ` +
      `${parseErrors} scan errors (unparsed files are not covered).`
  )
  return added.length > 0 ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  process.exitCode = main()
}
