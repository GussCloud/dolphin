import { createElement } from 'react'
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppStateStatus } from 'react-native'

const appState = vi.hoisted(() => ({
  current: 'active',
  listeners: new Set<(state: AppStateStatus) => void>()
}))

vi.mock('react-native', async () => {
  const React = await import('react')
  const Text = ({ children, ...props }: { children?: unknown }): unknown =>
    React.createElement('Text', props, children)
  return {
    AppState: {
      get currentState() {
        return appState.current
      },
      addEventListener: (_event: string, listener: (state: AppStateStatus) => void) => {
        appState.listeners.add(listener)
        return {
          remove: () => {
            appState.listeners.delete(listener)
          }
        }
      }
    },
    ActivityIndicator: (props: Record<string, unknown>) =>
      React.createElement('ActivityIndicator', props),
    Pressable: ({ children, ...props }: { children?: unknown }) =>
      React.createElement('Pressable', props, children),
    Text,
    View: ({ children, ...props }: { children?: unknown }) =>
      React.createElement('View', props, children),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 }
  }
})
vi.mock('lucide-react-native', () => ({ ChevronRight: 'ChevronRight' }))

import { MobileNativeChatTurnStatus } from './MobileNativeChatTurnStatus'

describe('MobileNativeChatTurnStatus', () => {
  let renderer: ReactTestRenderer | null = null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-09-04T00:00:00Z'))
    appState.current = 'active'
    appState.listeners.clear()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = null
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  function changeAppState(state: AppStateStatus) {
    act(() => {
      appState.current = state
      for (const listener of appState.listeners) {
        listener(state)
      }
    })
  }

  function render(props: {
    startedAt: number | null
    thinking: boolean
    workedSeconds?: number | null
    activityText?: string | null
    expanded?: boolean
    onToggleExpanded?: () => void
  }): ReactTestRenderer {
    act(() => {
      renderer = create(createElement(MobileNativeChatTurnStatus, props))
    })
    return renderer!
  }

  const labels = (node: ReactTestInstance): string[] =>
    node.findAllByType('Text' as never).map((text) => String(text.children.join('')))

  const spinners = (node: ReactTestInstance): ReactTestInstance[] =>
    node.findAllByType('ActivityIndicator' as never)

  it('reads "Thinking" beside one spinner while the turn reasons', () => {
    const tree = render({ startedAt: Date.now(), thinking: true })
    expect(labels(tree.root)).toEqual(['Thinking'])
    expect(spinners(tree.root)).toHaveLength(1)
  })

  it('counts up on that same single row when the turn is not reasoning', () => {
    const startedAt = Date.now()
    const tree = render({ startedAt, thinking: false })
    expect(labels(tree.root)).toEqual(['Working for 0s'])
    act(() => {
      vi.advanceTimersByTime(12_000)
    })
    expect(labels(tree.root)).toEqual(['Working for 12s'])
    expect(spinners(tree.root)).toHaveLength(1)
  })

  it('lets provider activity text beat both fallbacks and hold the clock', () => {
    const tree = render({
      startedAt: Date.now(),
      thinking: true,
      activityText: 'Running pnpm test'
    })
    expect(labels(tree.root)).toEqual(['Running pnpm test'])
    expect(spinners(tree.root)).toHaveLength(1)
    // No label consumes the duration, so nothing schedules a tick for it.
    expect(vi.getTimerCount()).toBe(0)
  })

  it('settles to a tappable "Worked for" row that toggles the turn', () => {
    const onToggleExpanded = vi.fn()
    const tree = render({
      startedAt: Date.now(),
      thinking: false,
      workedSeconds: 184,
      onToggleExpanded
    })
    expect(labels(tree.root)).toEqual(['Worked for 3m 4s'])
    const button = tree.root.findByType('Pressable' as never)
    expect(button.props.accessibilityLabel).toBe('Toggle turn details')
    expect(button.props.accessibilityState).toEqual({ expanded: false })
    act(() => button.props.onPress())
    expect(onToggleExpanded).toHaveBeenCalledOnce()
  })

  it('stays a plain row when the settled turn has nothing to disclose', () => {
    const tree = render({ startedAt: Date.now(), thinking: false, workedSeconds: 5 })
    expect(tree.root.findAllByType('Pressable' as never)).toHaveLength(0)
    expect(labels(tree.root)).toEqual(['Worked for 5s'])
  })

  it('holds no interval, and no spinner, once the turn has settled', () => {
    const tree = render({ startedAt: Date.now(), thinking: false, workedSeconds: 5 })
    expect(vi.getTimerCount()).toBe(0)
    expect(spinners(tree.root)).toHaveLength(0)
  })

  it('announces the live row to assistive tech', () => {
    const tree = render({ startedAt: Date.now(), thinking: true })
    const row = tree.root.findByType('View' as never)
    expect(row.props.accessibilityLiveRegion).toBe('polite')
    expect(row.props.accessibilityLabel).toBe('Agent is responding')
  })

  it('stops clock callbacks in the background and catches up immediately on resume', () => {
    const tree = render({ startedAt: Date.now(), thinking: false })
    act(() => {
      vi.advanceTimersByTime(2_000)
    })
    expect(labels(tree.root)).toEqual(['Working for 2s'])

    changeAppState('background')
    const clockReads = vi.spyOn(Date, 'now')
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(clockReads).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(labels(tree.root)).toEqual(['Working for 2s'])

    changeAppState('active')
    expect(labels(tree.root)).toEqual(['Working for 1m 2s'])
    expect(vi.getTimerCount()).toBe(1)
    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    expect(labels(tree.root)).toEqual(['Working for 1m 3s'])
  })

  it('creates no clock while initially backgrounded and uses a supplied start time on resume', () => {
    appState.current = 'background'
    const startedAt = Date.now() - 5_000
    const tree = render({ startedAt, thinking: false })
    expect(vi.getTimerCount()).toBe(0)
    act(() => {
      vi.advanceTimersByTime(15_000)
    })
    changeAppState('active')
    expect(labels(tree.root)).toEqual(['Working for 20s'])
    expect(vi.getTimerCount()).toBe(1)
  })
})
