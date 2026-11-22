// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { hydrateOverrides, setFitOverride } from '@/lib/pane-manager/mobile-fit-overrides'
import type { PaneManager } from '@/lib/pane-manager/pane-manager'
import type { PtyTransport } from './pty-transport'
import { useMobileOverlayTicks } from './use-mobile-overlay-ticks'

const PTY_ID = 'pty-fallback'

function createPaneState() {
  const terminal = {
    cols: 40,
    rows: 20,
    resize: vi.fn((cols: number, rows: number) => {
      terminal.cols = cols
      terminal.rows = rows
    })
  }
  const container = {
    dataset: {},
    getBoundingClientRect: () => ({ width: 320, height: 480 })
  }
  return { id: 1, terminal, container }
}

describe('useMobileOverlayTicks desktop-fit fallback', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Why: a hidden or occluded window never runs animation frames; only the timer fallback can act.
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn(() => 1)
    )
    vi.stubGlobal('cancelAnimationFrame', vi.fn())
  })

  afterEach(() => {
    cleanup()
    hydrateOverrides([])
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('applies to the pane even though getPanes returns a fresh view each call', () => {
    const state = createPaneState()
    // Why: PaneManager.getPanes materializes new public views on every call.
    const managerRef = {
      current: { getPanes: () => [{ ...state }] } as unknown as PaneManager
    }
    const paneTransportsRef: {
      current: ReadonlyMap<number, Pick<PtyTransport, 'getPtyId'>>
    } = { current: new Map([[state.id, { getPtyId: () => PTY_ID }]]) }
    function Subscriber(): null {
      useMobileOverlayTicks({ managerRef, paneTransportsRef })
      return null
    }
    render(<Subscriber />)
    setFitOverride(PTY_ID, 'mobile-fit', 40, 20)
    state.terminal.resize.mockClear()

    setFitOverride(PTY_ID, 'desktop-fit', 37, 46)
    vi.advanceTimersByTime(100)

    expect(state.terminal.resize).toHaveBeenCalledWith(37, 46)
    expect({ cols: state.terminal.cols, rows: state.terminal.rows }).toEqual({
      cols: 37,
      rows: 46
    })
  })
})
