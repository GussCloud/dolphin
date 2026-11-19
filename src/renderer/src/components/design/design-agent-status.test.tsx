// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DesignAgentStatus } from '../../../../shared/design-types'
import { DESIGN_AGENT_STATUS_POLL_MS, useDesignAgentStatus } from './design-agent-status'

const readDesignAgentStatus = vi.fn<(id: string) => Promise<DesignAgentStatus>>()
vi.mock('./design-index', () => ({
  readDesignAgentStatus: (id: string) => readDesignAgentStatus(id),
  isDesignMethodMissing: (error: unknown) =>
    error instanceof Error && error.message === 'method_not_found'
}))

type HookListener = (payload: { paneKey: string }) => void
let hookListeners: HookListener[]
let container: HTMLDivElement
let root: ReturnType<typeof createRoot>
let seen: (DesignAgentStatus | null)[]

function Probe({ id, revision }: { id: string; revision: number }): null {
  seen.push(useDesignAgentStatus(id, 'tab:1', revision))
  return null
}

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve()
  })
}

function mount(id = 'd1', revision = 1): void {
  act(() => root.render(<Probe id={id} revision={revision} />))
}

function setVisibility(state: 'visible' | 'hidden'): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  vi.useFakeTimers()
  readDesignAgentStatus.mockReset()
  readDesignAgentStatus.mockResolvedValue({ live: true, status: 'working' })
  hookListeners = []
  seen = []
  Object.defineProperty(window, 'api', {
    configurable: true,
    value: {
      agentStatus: {
        onSet: (listener: HookListener) => {
          hookListeners.push(listener)
          return () => {
            hookListeners = hookListeners.filter((entry) => entry !== listener)
          }
        }
      }
    }
  })
  setVisibility('visible')
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.useRealTimers()
})

describe('useDesignAgentStatus', () => {
  it('reads at once, then polls only while the window is visible', async () => {
    mount()
    await flush()
    expect(seen.at(-1)).toEqual({ live: true, status: 'working' })
    expect(readDesignAgentStatus).toHaveBeenCalledTimes(1)
    await act(async () => vi.advanceTimersByTime(DESIGN_AGENT_STATUS_POLL_MS))
    expect(readDesignAgentStatus).toHaveBeenCalledTimes(2)
    setVisibility('hidden')
    await act(async () => vi.advanceTimersByTime(DESIGN_AGENT_STATUS_POLL_MS * 3))
    expect(readDesignAgentStatus).toHaveBeenCalledTimes(2)
  })

  it('re-reads when the design changes and on a hook signal for its own pane only', async () => {
    mount('d1', 1)
    await flush()
    mount('d1', 2)
    await flush()
    expect(readDesignAgentStatus).toHaveBeenCalledTimes(2)
    act(() => hookListeners.forEach((listener) => listener({ paneKey: 'other:1' })))
    await act(async () => vi.advanceTimersByTime(300))
    expect(readDesignAgentStatus).toHaveBeenCalledTimes(2)
    act(() => hookListeners.forEach((listener) => listener({ paneKey: 'tab:1' })))
    await act(async () => vi.advanceTimersByTime(300))
    expect(readDesignAgentStatus).toHaveBeenCalledTimes(3)
  })

  it('reports an older host as unverifiable and stops asking it', async () => {
    readDesignAgentStatus.mockRejectedValue(new Error('method_not_found'))
    mount()
    await flush()
    expect(seen.at(-1)).toBeNull()
    await act(async () => vi.advanceTimersByTime(DESIGN_AGENT_STATUS_POLL_MS * 3))
    expect(readDesignAgentStatus).toHaveBeenCalledTimes(1)
  })

  it('keeps polling after a transient failure, unverifiable meanwhile', async () => {
    readDesignAgentStatus.mockRejectedValueOnce(new Error('timeout'))
    mount()
    await flush()
    expect(seen.at(-1)).toBeNull()
    await act(async () => vi.advanceTimersByTime(DESIGN_AGENT_STATUS_POLL_MS))
    await flush()
    expect(seen.at(-1)).toEqual({ live: true, status: 'working' })
  })

  it('never shows another design’s reading', async () => {
    mount('d1')
    await flush()
    readDesignAgentStatus.mockReturnValue(new Promise(() => {}))
    mount('d2')
    expect(seen.at(-1)).toBeNull()
  })
})
