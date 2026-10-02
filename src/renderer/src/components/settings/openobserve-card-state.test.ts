import { describe, expect, it } from 'vitest'
import type { OpenObserveCliStatus } from '../../../../shared/openobserve-cli'
import { deriveOpenObserveCardState, deriveOpenObserveSkillState } from './openobserve-card-state'

const installed = (
  overrides: Partial<Extract<OpenObserveCliStatus, { installed: true }>> = {}
): OpenObserveCliStatus => ({
  installed: true,
  version: 'v0.14.0',
  contexts: [{ name: 'prod', baseUrl: 'https://o2.example.com', org: 'acme', current: true }],
  activeContext: 'prod',
  baseUrl: 'https://o2.example.com',
  org: 'acme',
  authScheme: 'basic',
  authenticated: true,
  username: 'dev@example.com',
  authError: null,
  skill: { installedAgents: ['claude-code'], outdatedAgents: [] },
  ...overrides
})

describe('deriveOpenObserveCardState', () => {
  it('waits for the first probe, then reports an unavailable host on failure', () => {
    expect(deriveOpenObserveCardState(null, false)).toBe('checking')
    expect(deriveOpenObserveCardState(null, true)).toBe('unavailable')
  })

  it('walks install → configure → sign in → connected', () => {
    expect(deriveOpenObserveCardState({ installed: false }, false)).toBe('not-installed')
    expect(
      deriveOpenObserveCardState(installed({ activeContext: null, baseUrl: null }), false)
    ).toBe('not-configured')
    expect(deriveOpenObserveCardState(installed({ authenticated: false }), false)).toBe(
      'not-authenticated'
    )
    expect(deriveOpenObserveCardState(installed(), false)).toBe('connected')
  })
})

describe('deriveOpenObserveSkillState', () => {
  it('distinguishes missing, outdated and current skill copies', () => {
    expect(deriveOpenObserveSkillState(installed({ skill: null }))).toBe('unknown')
    expect(
      deriveOpenObserveSkillState(installed({ skill: { installedAgents: [], outdatedAgents: [] } }))
    ).toBe('not-installed')
    expect(
      deriveOpenObserveSkillState(
        installed({ skill: { installedAgents: ['codex'], outdatedAgents: ['codex'] } })
      )
    ).toBe('outdated')
    expect(deriveOpenObserveSkillState(installed())).toBe('installed')
  })
})
