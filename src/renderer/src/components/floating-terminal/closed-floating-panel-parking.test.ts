import { describe, expect, it, vi } from 'vitest'

vi.mock('../terminal/terminal-provider-snapshot-capability', () => ({
  terminalProviderHasAuthoritativeSnapshot: () => true
}))

import {
  CLOSED_FLOATING_PANEL_INELIGIBLE_RECHECK_MS,
  CLOSED_FLOATING_PANEL_PARK_DELAY_MS,
  decideClosedFloatingPanelPark
} from './closed-floating-panel-parking'

const FLOATING_PTY = 'global-floating-terminal@@pty-1'
const closedSinceMs = 1_000_000

function decide(overrides: Partial<Parameters<typeof decideClosedFloatingPanelPark>[0]> = {}) {
  return decideClosedFloatingPanelPark({
    open: false,
    closedSinceMs,
    terminalTabs: [{ id: 'tab-1', ptyId: FLOATING_PTY }],
    pendingStartupByTabId: {},
    parkingEnabled: true,
    nowMs: closedSinceMs + CLOSED_FLOATING_PANEL_PARK_DELAY_MS,
    canWatcherCoverTab: () => true,
    ...overrides
  })
}

describe('decideClosedFloatingPanelPark', () => {
  it('parks every tab once the panel has been closed for the hot-retain window', () => {
    expect(decide()).toEqual({ park: true, recheckDelayMs: null })
  })

  it('keeps the panel mounted until the deadline and asks for a recheck at it', () => {
    expect(decide({ nowMs: closedSinceMs + 1_000 })).toEqual({
      park: false,
      recheckDelayMs: CLOSED_FLOATING_PANEL_PARK_DELAY_MS - 1_000
    })
  })

  it('never parks an open panel, a disabled policy, or an empty panel', () => {
    expect(decide({ open: true }).park).toBe(false)
    expect(decide({ parkingEnabled: false }).park).toBe(false)
    expect(decide({ terminalTabs: [] }).park).toBe(false)
    expect(decide({ closedSinceMs: null }).park).toBe(false)
  })

  it('withholds the park while any tab cannot restore or be watched, and rechecks later', () => {
    const ineligible = { park: false, recheckDelayMs: CLOSED_FLOATING_PANEL_INELIGIBLE_RECHECK_MS }
    expect(decide({ terminalTabs: [{ id: 'tab-1', ptyId: null }] })).toEqual(ineligible)
    expect(decide({ pendingStartupByTabId: { 'tab-1': true } })).toEqual(ineligible)
    expect(decide({ canWatcherCoverTab: () => false })).toEqual(ineligible)
  })

  it('honors the e2e delay override', () => {
    expect(decide({ nowMs: closedSinceMs + 50, closedParkDelayMs: 50 }).park).toBe(true)
  })
})
