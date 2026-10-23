// Pre-PR local verification: the cheap PR-CI gates that apply to this diff, plus the tests that
// sit next to the changed files. The full sharded unit suite, e2e and packaging stay in CI, which
// runs them on clean Linux runners; repeating them on a developer machine mostly re-reports
// environment failures (symlinks, ACLs, timeouts under load) at many times the cost.
import { spawn, execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveOxlintInvocation } from './oxlint-cli-invocation.mjs'

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
const TEST_FILE = /\.test\.(?:[cm]?[jt]sx?)$/
const SOURCE_FILE = /\.(?:[cm]?[jt]sx?)$/
const LEFT_TO_CI = [
  'full unit suite (Linux, sharded)',
  'e2e',
  'packaging (Linux, Windows)',
  'mobile web bundle',
  'shell and Git compatibility'
]

function stripSourceExtension(file) {
  return file.replace(SOURCE_FILE, '')
}

/**
 * Tests that exercise the change directly: changed tests, plus tests in the same directory
 * whose name starts with a changed source's basename (`foo.ts` → `foo.test.ts`,
 * `foo-bar.test.ts`, `foo.win32.test.ts`). Import-graph selection (`vitest related`) is not
 * used: a change in src/shared reaches thousands of files and exhausts file handles on Windows.
 */
export function selectTestsForChanges(changedFiles, allTestFiles) {
  const selected = new Set(changedFiles.filter((file) => TEST_FILE.test(file)))
  const prefixes = changedFiles
    .filter((file) => SOURCE_FILE.test(file) && !TEST_FILE.test(file))
    .map(stripSourceExtension)
  for (const testFile of allTestFiles) {
    if (
      prefixes.some(
        (prefix) =>
          testFile.startsWith(`${prefix}.`) ||
          (testFile.startsWith(`${prefix}-`) &&
            path.posix.dirname(testFile) === path.posix.dirname(prefix))
      )
    ) {
      selected.add(testFile)
    }
  }
  return [...selected].sort()
}

/** The PR-CI gates (.github/workflows/pr.yml) worth running locally for this set of changes. */
export function planGates(changedFiles) {
  const touches = (pattern) => changedFiles.some((file) => pattern.test(file))
  const code = touches(SOURCE_FILE)
  const renderer = touches(/^src\/renderer\//)
  const reactFiles = touches(/^(?:src\/renderer|mobile)\/.*\.tsx$/)
  const localization = renderer || touches(/^src\/renderer\/src\/i18n\//)
  const gates = [
    {
      label: 'typecheck',
      script: 'run-typecheck-projects-in-parallel.mjs',
      when: code,
      heavy: true
    },
    { label: 'changed-code quality', script: 'check-changed-code-quality.mjs', when: code },
    { label: 'anti-slop', anti: true, when: code },
    { label: 'max-lines ratchet', script: 'check-max-lines-ratchet.mjs', when: code },
    { label: 'ts-nocheck ratchet', script: 'check-ts-nocheck-ratchet.mjs', when: code },
    {
      label: 'runtime Electron-import ratchet',
      script: 'check-runtime-electron-ratchet.mjs',
      when: code
    },
    { label: 'reliability gates', script: 'check-reliability-gates.mjs', when: code },
    {
      label: 'React Doctor (changed lines)',
      script: 'check-react-doctor-changed.mjs',
      when: reactFiles
    },
    {
      label: 'dead design-system classes',
      oxlintConfig: 'config/oxlint-dead-classes.json',
      target: 'src/renderer',
      when: renderer
    },
    {
      label: 'localization extraction',
      script: 'verify-localization-extraction.mjs',
      when: localization
    },
    {
      label: 'localization catalogs',
      script: 'verify-localization-catalogs.mjs',
      when: localization
    },
    {
      label: 'localization coverage',
      script: 'audit-localization-coverage.mjs',
      args: ['--check'],
      when: localization
    },
    {
      label: 'RPC params catalog',
      script: 'generate-rpc-params-catalog.mjs',
      args: ['--check'],
      when: touches(/^src\/shared\/rpc-contract\//)
    }
  ]
  return gates.filter((gate) => gate.when)
}

function git(args) {
  return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function listChangedFiles(base) {
  const mergeBase = git(['merge-base', base, 'HEAD']).trim()
  const tracked = git(['diff', '--name-only', '--diff-filter=ACMRTUB', mergeBase, '--'])
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
  return [...new Set(`${tracked}\n${untracked}`.split('\n').filter(Boolean))]
}

function scriptCommand(script, args = []) {
  return {
    command: process.execPath,
    args: [path.join(repoRoot, 'config/scripts', script), ...args]
  }
}

/** The commands a gate runs, in order; a step stops at its first failing command. */
function gateCommands(gate) {
  if (gate.anti || gate.oxlintConfig) {
    const oxlint = resolveOxlintInvocation(repoRoot)
    const args = gate.anti
      ? [
          '--config',
          'config/oxlint-anti-slop.json',
          'src',
          'config',
          'tests',
          'mobile',
          '--deny-warnings'
        ]
      : ['--config', gate.oxlintConfig, gate.target]
    const lint = { command: oxlint.command, args: [...oxlint.prefixArgs, ...args] }
    // Why the sync: the anti-slop plugin is copied out of node_modules before oxlint can load it.
    return gate.anti ? [scriptCommand('sync-anti-slop-plugin.mjs'), lint] : [lint]
  }
  return [scriptCommand(gate.script, gate.args)]
}

function vitestCommand(testFiles) {
  const requireFromRoot = createRequire(path.join(repoRoot, 'package.json'))
  const manifestPath = requireFromRoot.resolve('vitest/package.json')
  const binField = requireFromRoot('vitest/package.json').bin
  const binEntry = typeof binField === 'string' ? binField : binField.vitest
  return {
    command: process.execPath,
    args: [
      path.resolve(path.dirname(manifestPath), binEntry),
      'run',
      '--config',
      'config/vitest.config.ts',
      '--reporter=dot',
      ...testFiles
    ]
  }
}

// Why buffered: a passing gate's output is noise; only failures are printed, in full.
function runCommand({ command, args }) {
  return new Promise((resolve) => {
    let output = ''
    const child = spawn(command, args, { cwd: repoRoot, windowsHide: true })
    child.stdout.on('data', (chunk) => (output += chunk))
    child.stderr.on('data', (chunk) => (output += chunk))
    child.on('error', (error) => resolve({ ok: false, output: String(error) }))
    child.on('exit', (code) => resolve({ ok: code === 0, output }))
  })
}

async function runStep(label, commands) {
  const startedAt = Date.now()
  let output = ''
  for (const command of commands) {
    const result = await runCommand(command)
    output += result.output
    if (!result.ok) {
      return { label, ok: false, output, ms: Date.now() - startedAt }
    }
  }
  return { label, ok: true, output, ms: Date.now() - startedAt }
}

async function runAll(steps, concurrency) {
  const results = []
  let next = 0
  const worker = async () => {
    while (next < steps.length) {
      const step = steps[next++]
      const result = await runStep(step.label, step.invocation)
      console.log(
        `${result.ok ? 'pass' : 'FAIL'}  ${result.label}  (${(result.ms / 1000).toFixed(1)}s)`
      )
      results.push(result)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker))
  return results
}

async function main() {
  const argv = process.argv.slice(2)
  const base = argv.find((arg) => !arg.startsWith('--')) ?? 'origin/main'
  const dryRun = argv.includes('--dry-run')
  const changedFiles = listChangedFiles(base)
  const allTests = git(['ls-files', '--', '*.test.*'])
    .split('\n')
    .concat(changedFiles)
    .filter((file) => TEST_FILE.test(file))
  const testFiles = selectTestsForChanges(changedFiles, [...new Set(allTests)]).filter(
    (file) => file.startsWith('src/') || file.startsWith('config/')
  )
  const gates = planGates(changedFiles)
  console.log(
    `${changedFiles.length} changed files vs ${base}; ${gates.length} gates; ${testFiles.length} test files`
  )
  if (dryRun) {
    for (const gate of gates) {
      console.log(`gate  ${gate.label}`)
    }
    for (const file of testFiles) {
      console.log(`test  ${file}`)
    }
    return
  }
  const startedAt = Date.now()
  // Why typecheck first and alone in its lane: it is the longest step and the most memory hungry.
  const steps = [
    ...gates.map((gate) => ({ label: gate.label, invocation: gateCommands(gate) })),
    ...(testFiles.length > 0
      ? [{ label: `tests (${testFiles.length} files)`, invocation: [vitestCommand(testFiles)] }]
      : [])
  ]
  const results = await runAll(steps, 3)
  const failures = results.filter((result) => !result.ok)
  for (const failure of failures) {
    console.log(`\n===== ${failure.label} =====\n${failure.output.trim()}`)
  }
  console.log(
    `\n${results.length - failures.length}/${results.length} passed in ${((Date.now() - startedAt) / 1000).toFixed(0)}s. Left to CI: ${LEFT_TO_CI.join(', ')}.`
  )
  process.exitCode = failures.length > 0 ? 1 : 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
