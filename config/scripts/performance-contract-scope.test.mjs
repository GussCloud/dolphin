import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  classifyPrJobs,
  isPerformanceContractPath,
  PERFORMANCE_AUDIT_DIRS,
  PERFORMANCE_CONTRACT_TESTS
} from './pr-code-change-scope.mjs'
import { MEMORY_AUDIT_REPRODUCTIONS } from './run-memory-audit-reproductions.mjs'

const root = resolve(import.meta.dirname, '../..')

function readContracts() {
  const config = readFileSync(join(root, 'config/vitest.performance.config.ts'), 'utf8')
  const list = config.match(/const contracts = \[([\s\S]*?)\]/)
  expect(list, 'contracts array in vitest.performance.config.ts').not.toBeNull()
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1])
}

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.mjs', '.js', '/index.ts', '/index.tsx']
const IMPORT_PATTERN = /(?:from\s+|import\s*\(\s*|import\s+)['"]([^'"]+)['"]/g
const SOURCE_STRING_PATTERN = /['"`](?:\.\/)?(src\/[A-Za-z0-9_./-]+)['"`]/g

function resolveLocalImport(fromFile, specifier) {
  let base
  if (specifier.startsWith('.')) {
    base = join(dirname(fromFile), specifier)
  } else if (specifier.startsWith('@/') || specifier.startsWith('@renderer/')) {
    base = join('src/renderer/src', specifier.slice(specifier.indexOf('/') + 1))
  } else if (specifier.startsWith('src/')) {
    base = specifier
  } else {
    return null
  }
  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = join(root, base + suffix)
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return relative(root, candidate).replaceAll('\\', '/')
    }
  }
  return null
}

// Regex walk, type imports included: over-inclusion only widens routing, never hides a gap.
function localImportClosure(entries) {
  const seen = new Set()
  const queue = [...entries]
  while (queue.length > 0) {
    const file = queue.pop()
    if (seen.has(file)) {
      continue
    }
    seen.add(file)
    const source = readFileSync(join(root, file), 'utf8')
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const resolved = resolveLocalImport(file, match[1])
      if (resolved) {
        queue.push(resolved)
      }
    }
    if (!file.startsWith('docs/audits/')) {
      continue
    }
    // Reproductions name subjects as strings: esbuild `build` bundles their imports, while a
    // single-file `transform` strips them, so those subjects are leaves.
    const bundles = /\bbuild\(/.test(source)
    for (const match of source.matchAll(SOURCE_STRING_PATTERN)) {
      const resolved = resolveLocalImport(file, match[1])
      if (resolved && bundles) {
        queue.push(resolved)
      } else if (resolved) {
        seen.add(resolved)
      }
    }
  }
  return [...seen].sort()
}

describe('performance contract PR routing', () => {
  it('lists every src contract from the performance config', () => {
    const contracts = readContracts()
    expect([...PERFORMANCE_CONTRACT_TESTS].sort()).toEqual(
      contracts.filter((file) => file.startsWith('src/')).sort()
    )
    for (const contract of contracts) {
      expect(isPerformanceContractPath(contract), contract).toBe(true)
    }
  })

  it('routes every file the contracts and reproductions import', () => {
    const entries = [
      ...readContracts(),
      ...MEMORY_AUDIT_REPRODUCTIONS.map(({ audit }) => `docs/audits/${audit}/reproduce.mjs`)
    ]
    const closure = localImportClosure(entries)
    // Guards the walker: a pattern that stopped matching would pass vacuously.
    expect(closure.length).toBeGreaterThan(entries.length * 10)
    const unrouted = closure.filter(
      (file) => !file.startsWith('docs/audits/') && !isPerformanceContractPath(file)
    )
    expect(unrouted).toEqual([])
  })

  it('tracks exactly the audits the reproduction runner executes', () => {
    expect([...PERFORMANCE_AUDIT_DIRS].sort()).toEqual(
      MEMORY_AUDIT_REPRODUCTIONS.map(({ audit }) => `docs/audits/${audit}/`).sort()
    )
  })

  it('skips unrelated tests and source the contracts cannot reach', () => {
    for (const file of [
      'src/renderer/src/App.test.tsx',
      'src/main/git/worktree.ts',
      'src/main/runtime/runtime-rpc.ts',
      'src/cli/index.ts',
      'mobile/app/index.tsx',
      'config/scripts/build-relay.mjs'
    ]) {
      expect(classifyPrJobs([file]).performance, file).toBe(false)
    }
  })

  it('runs for reproduction edits even though docs-only diffs skip other jobs', () => {
    const files = ['docs/audits/retained-text-slices/reproduce.mjs']
    expect(classifyPrJobs(files)).toMatchObject({ should_run: false, performance: true })
    expect(classifyPrJobs(['docs/audits/crashpad-read-limit/README.md']).performance).toBe(false)
  })

  it('runs for contract source and harness changes', () => {
    for (const file of [
      'src/main/sqlite/sync-database.ts',
      'src/renderer/src/store/store-identity-churn-probe.ts',
      'config/vitest.performance.config.ts',
      'config/scripts/run-memory-audit-reproductions.mjs',
      'config/oxlint-plugins/app-store-performance.mjs'
    ]) {
      expect(classifyPrJobs([file]).performance, file).toBe(true)
    }
  })
})
