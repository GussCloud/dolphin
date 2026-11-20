import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, describe, expect, it, vi } from 'vitest'

type Handlers = {
  onBegin?: () => void
  onStart?: () => void
  onUpdate?: (e: { translationY: number }) => void
  onEnd?: (e: { velocityY: number }) => void
}
type SpringCall = {
  to: number
  config: { velocity?: number; dampingRatio?: number; overshootClamping?: boolean }
  callback?: (finished?: boolean) => void
}

const harness = vi.hoisted((): { pans: Handlers[]; springs: SpringCall[] } => ({
  pans: [],
  springs: []
}))

vi.mock('../platform/keyboard-occlusion', () => ({
  currentSoftKeyboardHeight: () => 0,
  subscribeSoftKeyboard: () => () => {}
}))
vi.mock('../navigation/use-back-claim', () => ({ useBackClaim: () => {} }))
vi.mock('react-native', () => ({
  Keyboard: { dismiss: () => {} },
  Modal: 'Modal',
  Platform: { OS: 'ios', select: (options: { ios?: unknown }) => options.ios },
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFillObject: {} },
  View: 'View',
  useWindowDimensions: () => ({ width: 390, height: 844 })
}))
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 62, bottom: 34, left: 0, right: 0 })
}))
vi.mock('react-native-gesture-handler', () => {
  function pan() {
    const handlers: Handlers = {}
    harness.pans.push(handlers)
    const chain: Record<string, unknown> = {
      activeOffsetY: () => chain,
      simultaneousWithExternalGesture: () => chain
    }
    for (const name of ['onBegin', 'onStart', 'onUpdate', 'onEnd'] as const) {
      chain[name] = (fn: never) => {
        handlers[name] = fn
        return chain
      }
    }
    return chain
  }
  return {
    Gesture: { Pan: pan, Native: () => ({}) },
    GestureDetector: 'GestureDetector',
    GestureHandlerRootView: 'GestureHandlerRootView'
  }
})
vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: () => void) => fn()
}))
vi.mock('react-native-reanimated', async () => {
  const { useState } = await import('react')
  return {
    default: { View: 'AnimatedView', ScrollView: 'AnimatedScrollView' },
    // Stable across renders, as the real hook is, so memoized gestures can be checked.
    useSharedValue: (initial: unknown) => useState(() => ({ value: initial }))[0],
    useAnimatedStyle: () => ({}),
    useAnimatedScrollHandler: () => () => {},
    useReducedMotion: () => false,
    cancelAnimation: () => {},
    withSpring: (to: number, config: SpringCall['config'], callback?: SpringCall['callback']) => {
      harness.springs.push({ to, config, callback })
      return to
    },
    withTiming: (to: number) => to,
    Easing: { bezier: () => (t: number) => t },
    ReduceMotion: { System: 'system', Never: 'never' },
    interpolate: () => 0,
    Extrapolation: { CLAMP: 'clamp' }
  }
})

import { MountedBottomDrawer } from './mounted-bottom-drawer'

const SCREEN_HEIGHT = 844

function render(onClose: () => void): ReactTestRenderer {
  let renderer!: ReactTestRenderer
  act(() => {
    renderer = create(
      <MountedBottomDrawer visible onClose={onClose} onHidden={() => {}}>
        {null}
      </MountedBottomDrawer>
    )
  })
  return renderer
}

/** The grabber's pan is the first one the sheet builds. */
function dragHandle(translationY: number, velocityY: number): void {
  const handle = harness.pans[0]!
  handle.onStart?.()
  handle.onUpdate?.({ translationY })
  handle.onEnd?.({ velocityY })
}

describe('bottom drawer drag release', () => {
  afterEach(() => {
    harness.pans.length = 0
    harness.springs.length = 0
  })

  it('dismisses a short fast flick with one spring that keeps the finger velocity', () => {
    const onClose = vi.fn()
    const renderer = render(onClose)

    dragHandle(20, 1400)

    const spring = harness.springs.at(-1)!
    expect(spring.to).toBe(SCREEN_HEIGHT)
    expect(spring.config).toMatchObject({ velocity: 1400, overshootClamping: true })
    expect(onClose).not.toHaveBeenCalled()
    spring.callback?.(true)
    expect(onClose).toHaveBeenCalledTimes(1)
    act(() => renderer.unmount())
  })

  it('keeps the sheet when a re-grab interrupts the dismiss spring', () => {
    const onClose = vi.fn()
    const renderer = render(onClose)

    dragHandle(120, 0)
    harness.springs.at(-1)!.callback?.(false)

    expect(onClose).not.toHaveBeenCalled()
    act(() => renderer.unmount())
  })

  it('springs a slow short drag home with the release velocity', () => {
    const onClose = vi.fn()
    const renderer = render(onClose)

    dragHandle(30, 120)

    expect(harness.springs.at(-1)).toMatchObject({
      to: 0,
      config: { velocity: 120, dampingRatio: 0.8 }
    })
    expect(onClose).not.toHaveBeenCalled()
    act(() => renderer.unmount())
  })

  // A rebuilt gesture reattaches its recognizer and can drop a drag in flight.
  it('keeps the same gestures across a re-render', () => {
    const onClose = vi.fn()
    const renderer = render(onClose)
    const built = harness.pans.length

    act(() => {
      renderer.update(
        <MountedBottomDrawer visible onClose={onClose} onHidden={() => {}}>
          {null}
        </MountedBottomDrawer>
      )
    })

    expect(harness.pans.length).toBe(built)
    act(() => renderer.unmount())
  })
})
