import { beforeEach, describe, expect, it } from 'vitest'
import {
  clearPaneCacheState,
  createHookListenerState,
  type HookListenerState
} from './agent-hook-listener/listener-state'
import { normalizeHookPayload } from './agent-hook-listener'
import { PANE_KEY } from './agent-hook-listener-test-harness'

function claudeEvent(state: HookListenerState, payload: Record<string, unknown>) {
  return normalizeHookPayload(state, 'claude', { paneKey: PANE_KEY, payload }, 'production')
}

describe('Claude session model on status rows', () => {
  let state: HookListenerState

  beforeEach(() => {
    state = createHookListenerState()
  })

  it('publishes the SessionStart model, [1m] included, on later rows of the session', () => {
    const start = claudeEvent(state, {
      hook_event_name: 'SessionStart',
      source: 'startup',
      model: 'claude-opus-5[1m]'
    })
    expect(start?.payload.model).toBe('claude-opus-5[1m]')
    claudeEvent(state, { hook_event_name: 'UserPromptSubmit', prompt: 'go' })
    const stop = claudeEvent(state, { hook_event_name: 'Stop' })
    expect(stop?.payload.model).toBe('claude-opus-5[1m]')
  })

  it('drops the model on a new session that names none, and on pane reset', () => {
    claudeEvent(state, { hook_event_name: 'SessionStart', source: 'startup', model: 'm[1m]' })
    const cleared = claudeEvent(state, { hook_event_name: 'SessionStart', source: 'clear' })
    expect(cleared?.payload.model).toBeUndefined()

    claudeEvent(state, { hook_event_name: 'SessionStart', source: 'startup', model: 'm[1m]' })
    clearPaneCacheState(state, PANE_KEY)
    expect(state.claudeModelByPaneKey.has(PANE_KEY)).toBe(false)
  })
})
