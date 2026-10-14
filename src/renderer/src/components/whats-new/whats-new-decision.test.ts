import { describe, expect, it } from 'vitest'
import { compareReleaseVersions, getWhatsNewDecision } from './whats-new-decision'

const base = { appVersion: '0.2.9', lastSeenVersion: undefined, onboardingVisible: false }

describe('getWhatsNewDecision', () => {
  it('shows to an upgrader with no recorded version', () => {
    expect(getWhatsNewDecision(base)).toEqual({
      kind: 'show',
      release: { version: '0.2.9', id: 'azure-prs' }
    })
  })

  it('shows when the last seen version is older', () => {
    expect(getWhatsNewDecision({ ...base, lastSeenVersion: '0.2.8' }).kind).toBe('show')
  })

  it('skips when already seen', () => {
    expect(getWhatsNewDecision({ ...base, lastSeenVersion: '0.2.9' })).toEqual({ kind: 'skip' })
  })

  it('records and does not show on a fresh install with onboarding', () => {
    expect(getWhatsNewDecision({ ...base, onboardingVisible: true })).toEqual({
      kind: 'record',
      version: '0.2.9'
    })
  })

  it('skips on a build older than the first entry', () => {
    expect(getWhatsNewDecision({ ...base, appVersion: '0.2.8' })).toEqual({ kind: 'skip' })
  })

  it('skips when no newer entry exists', () => {
    expect(getWhatsNewDecision({ ...base, appVersion: '0.3.0', lastSeenVersion: '0.2.9' })).toEqual(
      { kind: 'skip' }
    )
  })

  it('skips while the app version is unknown', () => {
    expect(getWhatsNewDecision({ ...base, appVersion: null })).toEqual({ kind: 'skip' })
  })

  it('treats prerelease builds by their numeric version', () => {
    expect(getWhatsNewDecision({ ...base, appVersion: '0.2.9-rc.1' }).kind).toBe('show')
  })

  it('picks the newest unseen entry', () => {
    const releases = [
      { version: '0.2.9', id: 'azure-prs' as const },
      { version: '0.3.0', id: 'azure-prs' as const }
    ]
    expect(
      getWhatsNewDecision({ ...base, appVersion: '0.3.1', lastSeenVersion: '0.2.9', releases })
    ).toEqual({ kind: 'show', release: releases[1] })
  })
})

describe('compareReleaseVersions', () => {
  it('orders numerically, not lexically', () => {
    expect(compareReleaseVersions('0.10.0', '0.9.0')).toBe(1)
    expect(compareReleaseVersions('0.2.9', '0.2.9')).toBe(0)
  })
})
