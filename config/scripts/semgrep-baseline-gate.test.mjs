import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildBaseline,
  compareToBaseline,
  findingsFromSemgrep,
  main,
  ruleName,
  SCAN_TARGETS,
  semgrepScanArgs
} from './semgrep-baseline-gate.mjs'

const SOURCE = [
  "import { spawn } from 'node:child_process'",
  '',
  'spawn(command, [], { shell: true })',
  'eval(code)'
].join('\n')

function semgrepResult(rule, line, endLine = line) {
  return {
    check_id: `config.security.${rule}`,
    path: 'src/main/launch.ts',
    start: { line, col: 1 },
    end: { line: endLine, col: 10 },
    extra: { message: `${rule} message`, lines: 'requires login' }
  }
}

const read = () => SOURCE

describe('findingsFromSemgrep', () => {
  it('reads matched text from source instead of the login-gated `lines` field', () => {
    const [finding] = findingsFromSemgrep(
      { results: [semgrepResult('child-process-shell-true', 3)] },
      read
    )
    expect(finding).toMatchObject({
      rule: 'child-process-shell-true',
      path: 'src/main/launch.ts',
      line: 3,
      snippet: 'spawn(command, [], { shell: true })'
    })
  })

  it('collapses whitespace across a multi-line match', () => {
    const [finding] = findingsFromSemgrep({ results: [semgrepResult('x', 3, 4)] }, read)
    expect(finding.snippet).toBe('spawn(command, [], { shell: true }) eval(code)')
  })

  it('rejects output without a results array so a crashed scan cannot pass', () => {
    expect(() => findingsFromSemgrep({ errors: [] }, read)).toThrow(/no results array/)
  })

  it('strips the config-path prefix from check ids', () => {
    expect(ruleName('config.security.dynamic-code-evaluation')).toBe('dynamic-code-evaluation')
  })
})

describe('compareToBaseline', () => {
  const shell = {
    rule: 'child-process-shell-true',
    path: 'a.ts',
    line: 3,
    snippet: 'spawn(x, { shell: true })'
  }

  it('ignores a baselined finding that moved to another line', () => {
    const baseline = buildBaseline([shell])
    expect(compareToBaseline([{ ...shell, line: 40 }], baseline)).toEqual({ added: [], fixed: [] })
  })

  it('reports a second identical finding in the same file as new', () => {
    const baseline = buildBaseline([shell])
    const { added } = compareToBaseline([shell, { ...shell, line: 9 }], baseline)
    expect(added).toEqual([{ ...shell, line: 9 }])
  })

  it('reports the same code under a different rule or file as new', () => {
    const baseline = buildBaseline([shell])
    const { added } = compareToBaseline(
      [
        { ...shell, rule: 'dynamic-code-evaluation' },
        { ...shell, path: 'b.ts' }
      ],
      baseline
    )
    expect(added).toHaveLength(2)
  })

  it('lists baseline entries that no longer match as fixed', () => {
    const { added, fixed } = compareToBaseline([], buildBaseline([shell]))
    expect(added).toEqual([])
    expect(fixed).toEqual([{ rule: shell.rule, path: shell.path, snippet: shell.snippet }])
  })
})

describe('semgrepScanArgs', () => {
  it('scans every target with the repo rules and skips tests', () => {
    const args = semgrepScanArgs('/tmp/out.json')
    expect(args.slice(0, 5)).toEqual([
      'scan',
      '--metrics=off',
      '--disable-version-check',
      '--config',
      'config/security/semgrep-electron.yml'
    ])
    expect(args.slice(-SCAN_TARGETS.length)).toEqual(SCAN_TARGETS)
    expect(args).toContain('*.test.ts')
  })
})

describe('main', () => {
  let dir
  afterEach(() => {
    vi.restoreAllMocks()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  function setup(results) {
    dir = mkdtempSync(path.join(tmpdir(), 'semgrep-baseline-'))
    mkdirSync(path.join(dir, 'src', 'main'), { recursive: true })
    writeFileSync(path.join(dir, 'src', 'main', 'launch.ts'), SOURCE)
    writeFileSync(path.join(dir, 'results.json'), JSON.stringify({ results, errors: [] }))
    vi.spyOn(console, 'log').mockImplementation(() => {})
  }

  it('passes after update and fails once a new finding appears', () => {
    setup([semgrepResult('child-process-shell-true', 3)])
    expect(main(['update', '--results', 'results.json', '--baseline', 'baseline.json'], dir)).toBe(
      0
    )
    expect(main(['check', '--results', 'results.json', '--baseline', 'baseline.json'], dir)).toBe(0)

    writeFileSync(
      path.join(dir, 'results.json'),
      JSON.stringify({
        results: [
          semgrepResult('child-process-shell-true', 3),
          semgrepResult('dynamic-code-evaluation', 4)
        ]
      })
    )
    expect(main(['check', '--results', 'results.json', '--baseline', 'baseline.json'], dir)).toBe(1)
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        '::error file=src/main/launch.ts,line=4,title=semgrep dynamic-code-evaluation::'
      )
    )
  })

  it('keeps the checked-in baseline in the shape check expects', () => {
    const baseline = JSON.parse(
      readFileSync(
        path.join(import.meta.dirname, '..', 'security', 'semgrep-baseline.json'),
        'utf8'
      )
    )
    for (const entry of baseline.findings) {
      expect(Object.keys(entry).sort()).toEqual(['path', 'rule', 'snippet'])
    }
  })
})
