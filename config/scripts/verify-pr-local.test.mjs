import { describe, expect, it } from 'vitest'
import { planGates, selectTestsForChanges } from './verify-pr-local.mjs'

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

  it('checks the RPC params catalog only for contract changes', () => {
    expect(planGates(['src/shared/rpc-contract/x.ts']).map((gate) => gate.label)).toContain(
      'RPC params catalog'
    )
    expect(planGates(['src/shared/x.ts']).map((gate) => gate.label)).not.toContain(
      'RPC params catalog'
    )
  })
})
