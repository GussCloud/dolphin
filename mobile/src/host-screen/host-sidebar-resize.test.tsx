import { createElement } from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

type Handlers = {
  onStart?: () => void
  onUpdate?: (e: { translationX: number }) => void
  onEnd?: (e: { translationX: number; velocityX: number }) => void
}
type SpringCall = { to: number; config: { velocity?: number; dampingRatio?: number } }

type Harness = {
  pans: { chain: unknown; handlers: Handlers }[]
  springs: SpringCall[]
  edge: { value: number } | null
}

const harness = vi.hoisted((): Harness => ({ pans: [], springs: [], edge: null }))

vi.mock('../storage/preferences', () => ({
  HOST_SIDEBAR_MIN_WIDTH: 280,
  HOST_SIDEBAR_MAX_WIDTH: 560
}))
vi.mock('react-native-gesture-handler', () => ({
  Gesture: {
    Pan: () => {
      const handlers: Handlers = {}
      const chain: Record<string, unknown> = { minDistance: () => chain }
      for (const name of ['onStart', 'onUpdate', 'onEnd'] as const) {
        chain[name] = (fn: never) => {
          handlers[name] = fn
          return chain
        }
      }
      harness.pans.push({ chain, handlers })
      return chain
    }
  }
}))
vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args)
}))
vi.mock('react-native-reanimated', async () => {
  const { useState } = await import('react')
  return {
    useSharedValue: (initial: number) => {
      const shared = useState(() => ({ value: initial }))[0]
      harness.edge ??= shared
      return shared
    },
    useAnimatedStyle: () => ({}),
    cancelAnimation: () => {},
    withSpring: (to: number, config: SpringCall['config']) => {
      harness.springs.push({ to, config })
      return to
    },
    withTiming: (to: number) => to,
    Easing: { bezier: () => (t: number) => t },
    ReduceMotion: { System: 'system', Never: 'never' }
  }
})

import { clampSidebarToWindow, resolveSidebarDragEdge } from './host-sidebar-width'
import { useHostSidebarResize } from './use-host-sidebar-resize'

const WINDOW = 1024
// 1024 - 320 leaves 704 for the sidebar, so the 560 bound is the one that applies.
const MAX = 560
const MIN = 280

function Probe(props: { width: number; onResizeEnd: (width: number) => void }) {
  useHostSidebarResize({ ...props, windowWidth: WINDOW })
  return null
}

function render(width: number, onResizeEnd: (width: number) => void): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(createElement(Probe, { width, onResizeEnd }))
  })
  return renderer
}

function latestPan(): Handlers {
  return harness.pans.at(-1)!.handlers
}

describe('sidebar width bounds', () => {
  it('clamps to the bounds and leaves the detail pane its minimum', () => {
    expect(clampSidebarToWindow(900, WINDOW)).toBe(MAX)
    expect(clampSidebarToWindow(100, WINDOW)).toBe(MIN)
    expect(clampSidebarToWindow(500, 760)).toBe(440)
  })

  it('follows the finger inside the bounds and resists, without stopping dead, past them', () => {
    expect(resolveSidebarDragEdge(400, WINDOW)).toBe(400)
    const past = resolveSidebarDragEdge(MAX + 200, WINDOW)
    expect(past).toBeGreaterThan(MAX)
    expect(past).toBeLessThan(MAX + 200)
    const under = resolveSidebarDragEdge(MIN - 200, WINDOW)
    expect(under).toBeLessThan(MIN)
    expect(under).toBeGreaterThan(MIN - 200)
  })
})

describe('sidebar resize gesture', () => {
  afterEach(() => {
    harness.pans.length = 0
    harness.springs.length = 0
    harness.edge = null
  })

  it('moves only the guide while dragging and commits the width once, on release', () => {
    const onResizeEnd = vi.fn()
    render(340, onResizeEnd)
    const pan = latestPan()

    pan.onStart?.()
    for (const dx of [10, 40, 80]) {
      pan.onUpdate?.({ translationX: dx })
    }
    expect(onResizeEnd).not.toHaveBeenCalled()
    expect(harness.edge?.value).toBe(420)

    pan.onEnd?.({ translationX: 80, velocityX: 600 })
    expect(onResizeEnd).toHaveBeenCalledTimes(1)
    expect(onResizeEnd).toHaveBeenCalledWith(420)
  })

  it('springs a guide pulled past the limit back onto it, carrying the release velocity', () => {
    const onResizeEnd = vi.fn()
    render(340, onResizeEnd)
    const pan = latestPan()

    pan.onStart?.()
    pan.onUpdate?.({ translationX: 600 })
    pan.onEnd?.({ translationX: 600, velocityX: 1200 })

    expect(harness.springs.at(-1)).toMatchObject({
      to: MAX,
      config: { velocity: 1200, dampingRatio: 1 }
    })
    expect(onResizeEnd).toHaveBeenCalledWith(MAX)
  })

  it('commits nothing for a tap or a drag that lands where it started', () => {
    const onResizeEnd = vi.fn()
    render(340, onResizeEnd)
    const pan = latestPan()

    pan.onStart?.()
    pan.onEnd?.({ translationX: 0, velocityX: 0 })
    expect(onResizeEnd).not.toHaveBeenCalled()
  })

  it('keeps one recognizer across re-renders that do not change the width', () => {
    const onResizeEnd = vi.fn()
    const renderer = render(340, onResizeEnd)
    const first = harness.pans.length
    act(() => {
      renderer.update(createElement(Probe, { width: 340, onResizeEnd }))
    })
    expect(harness.pans.length).toBe(first)
  })
})
