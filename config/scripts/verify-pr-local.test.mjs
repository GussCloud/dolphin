import { describe, expect, it } from 'vitest'
import {
  findNewRootEntries,
  planFixers,
  planGates,
  selectTestsForChanges
} from './verify-pr-local.mjs'

describe('selectTestsForChanges', () => {
  const allTests = [
    'src/shared/tui-agent.test.ts',
    'src/shared/tui-agent-config.test.ts',
    'src/shared/tui-agent-launch.win32.test.ts',
    'src/shared/other.test.ts',
    'src/main/tui-agent.test.ts'
  ]

  it('picks colocated tests that share the changed source basename', () => {
    expect(selectTestsForChanges(['src/shared/tui-agent.ts'], allTests)).toEqual([
      'src/shared/tui-agent-config.test.ts',
      'src/shared/tui-agent-launch.win32.test.ts',
      'src/shared/tui-agent.test.ts'
    ])
  })

  it('keeps changed tests and never reaches into other directories', () => {
    expect(
      selectTestsForChanges(['src/shared/other.test.ts', 'src/shared/tui-agent.ts'], allTests)
    ).not.toContain('src/main/tui-agent.test.ts')
    expect(selectTestsForChanges(['src/shared/other.test.ts'], allTests)).toEqual([
      'src/shared/other.test.ts'
    ])
  })

  it('selects nothing for non-code changes', () => {
    expect(selectTestsForChanges(['docs/reference/x.md'], allTests)).toEqual([])
  })
})

describe('planGates', () => {
  it('runs no gate for a docs-only change', () => {
    expect(planGates(['docs/reference/x.md'])).toEqual([])
  })

  it('adds renderer-only gates only when the renderer changes', () => {
    const mainOnly = planGates(['src/main/a.ts']).map((gate) => gate.label)
    const renderer = planGates(['src/renderer/src/A.tsx']).map((gate) => gate.label)
    expect(mainOnly).toContain('typecheck')
    expect(mainOnly).not.toContain('localization catalogs')
    expect(renderer).toContain('React Doctor (changed lines)')
    expect(renderer).toContain('localization catalogs')
  })

  it('checks compiled :has() scope only for inputs that can change the emitted CSS', () => {
    const label = 'compiled :has() restyle scope'
    expect(planGates(['src/renderer/src/A.tsx']).map((gate) => gate.label)).toContain(label)
    expect(planGates(['src/shared/theme.css']).map((gate) => gate.label)).toContain(label)
    expect(planGates(['src/main/a.ts']).map((gate) => gate.label)).not.toContain(label)
  })

  it('checks the RPC params catalog only for contract changes', () => {
    expect(planGates(['src/shared/rpc-contract/x.ts']).map((gate) => gate.label)).toContain(
      'RPC params catalog'
    )
    expect(planGates(['src/shared/x.ts']).map((gate) => gate.label)).not.toContain(
      'RPC params catalog'
    )
  })
})

describe('report-only gates', () => {
  it('marks style and size gates as report-only and keeps correctness gates blocking', () => {
    const gates = planGates(['src/renderer/src/A.tsx'])
    const reportOnly = gates.filter((gate) => gate.report).map((gate) => gate.label)
    const blocking = gates.filter((gate) => !gate.report).map((gate) => gate.label)
    expect(reportOnly).toEqual(
      expect.arrayContaining([
        'changed-code quality',
        'anti-slop',
        'max-lines ratchet',
        'React Doctor (changed lines)',
        'dead design-system classes'
      ])
    )
    expect(blocking).toEqual(
      expect.arrayContaining(['typecheck', 'ts-nocheck ratchet', 'localization catalogs'])
    )
  })
})

describe('planFixers', () => {
  const labels = (files) => planFixers(files).map((fixer) => fixer.label)

  it('fixes nothing for a change no fixer covers', () => {
    expect(labels(['LICENSE'])).toEqual([])
  })

  it('regenerates catalogs for their inputs and always formats last', () => {
    expect(labels(['src/shared/rpc-contract/x.ts'])).toEqual([
      'RPC params catalog',
      'oxlint --fix',
      'oxfmt'
    ])
    expect(labels(['src/renderer/src/A.tsx'])).toEqual([
      'localization catalog',
      'runtime English catalog',
      'oxlint --fix',
      'oxfmt'
    ])
    expect(labels(['skill-guides/orchestration.md'])).toEqual([
      'bundled skill guides',
      'skill bundle manifest',
      'oxfmt'
    ])
  })
})

describe('findNewRootEntries', () => {
  it('flags a top-level entry the base tree lacks, once', () => {
    expect(
      findNewRootEntries(
        [
          'Microsoft/Windows/PowerShell/ModuleAnalysisCache',
          'Microsoft/x',
          'src/a.ts',
          'AGENTS.md'
        ],
        ['src', 'AGENTS.md']
      )
    ).toEqual(['Microsoft'])
  })

  it('accepts changes under existing entries', () => {
    expect(findNewRootEntries(['src/a.ts', 'docs/x.md'], ['src', 'docs'])).toEqual([])
  })

  it('accepts entries the CI guard already reviewed', () => {
    expect(findNewRootEntries(['.claude/skills/animate/SKILL.md'], ['src'])).toEqual([])
  })
})
