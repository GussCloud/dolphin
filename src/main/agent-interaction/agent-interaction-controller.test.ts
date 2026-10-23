import { describe, expect, it, vi } from 'vitest'
import {
  getDefaultAgentInteractionSettings,
  mergeAgentInteractionSettings,
  type AgentInteractionEventSettings,
  type AgentInteractionKind,
  type AgentInteractionSettings
} from '../../shared/agent-interaction-settings'
import type { AgentStatusIpcPayload } from '../../shared/agent-status-types'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import { AgentInteractionController } from './agent-interaction-controller'

const PANE = 'tab-1:11111111-1111-4111-8111-111111111111'

function event(
  state: EnrichedAgentHookEventPayload['payload']['state'],
  overrides: Partial<EnrichedAgentHookEventPayload> = {}
): EnrichedAgentHookEventPayload {
  return {
    paneKey: PANE,
    worktreeId: 'repo::/w1',
    connectionId: null,
    receivedAt: 1,
    stateStartedAt: state === 'working' ? 1 : 2,
    payload: { state, prompt: '', agentType: 'claude' },
    ...overrides
  }
}

function setup(agentInteraction: AgentInteractionSettings = enabledSettings()) {
  const presenter = { present: vi.fn(), hide: vi.fn() }
  const settings = { agentInteraction }
  const focus = { mainWindow: false }
  const controller = new AgentInteractionController({
    getSettings: () => settings,
    resolveWorkspaceLabel: () => 'w1',
    isMainWindowFocused: () => focus.mainWindow,
    presenter,
    now: () => 42
  })
  return { controller, presenter, settings, focus }
}

function enabledSettings(
  events: Partial<Record<AgentInteractionKind, Partial<AgentInteractionEventSettings>>> = {}
): AgentInteractionSettings {
  return mergeAgentInteractionSettings(undefined, { enabled: true, events })
}

describe('AgentInteractionController', () => {
  it('announces a finished task with its sound and workspace label', () => {
    const { controller, presenter } = setup()
    controller.onStatus(event('working'))
    controller.onStatus(event('done'))
    expect(presenter.present).toHaveBeenCalledWith({
      view: {
        cue: {
          kind: 'task-done',
          paneKey: PANE,
          worktreeId: 'repo::/w1',
          workspaceLabel: 'w1',
          agentType: 'claude',
          surface: 'terminal',
          createdAt: 42
        },
        pendingCount: 0
      },
      soundKind: 'task-done'
    })
  })

  it('stays silent while the feature or the event is off', () => {
    const off = setup(getDefaultAgentInteractionSettings())
    off.controller.onStatus(event('working'))
    off.controller.onStatus(event('done'))
    expect(off.presenter.present).not.toHaveBeenCalled()

    const eventOff = setup(enabledSettings({ 'task-done': { enabled: false } }))
    eventOff.controller.onStatus(event('working'))
    eventOff.controller.onStatus(event('done'))
    expect(eventOff.presenter.present).not.toHaveBeenCalled()
  })

  it('never announces rows that were already live at startup, or relay replays', () => {
    const { controller, presenter } = setup()
    const blocked: AgentStatusIpcPayload = {
      paneKey: PANE,
      state: 'blocked',
      prompt: '',
      connectionId: null,
      receivedAt: 1,
      stateStartedAt: 2
    }
    controller.seed([blocked])
    controller.onStatus(event('blocked'))
    controller.onStatus(event('done', { isReplay: true }))
    expect(presenter.present).not.toHaveBeenCalled()
  })

  it('hides the avatar once the agent stops waiting for an answer', () => {
    const { controller, presenter } = setup()
    controller.onStatus(event('working'))
    controller.onStatus(event('blocked'))
    expect(presenter.present).toHaveBeenLastCalledWith(
      expect.objectContaining({ soundKind: 'needs-permission' })
    )
    controller.onStatus(event('working', { stateStartedAt: 3 }))
    expect(presenter.hide).toHaveBeenCalledTimes(1)
  })

  it('re-renders without sound when another pane is acknowledged', () => {
    const { controller, presenter } = setup()
    const other = 'tab-2:22222222-2222-4222-8222-222222222222'
    controller.onStatus(event('working'))
    controller.onStatus(event('done'))
    controller.onStatus(event('working', { paneKey: other, worktreeId: 'repo::/w2' }))
    controller.onStatus(event('done', { paneKey: other, worktreeId: 'repo::/w2' }))
    expect(controller.current()?.pendingCount).toBe(1)
    controller.acknowledge({ worktreeId: 'repo::/w2' })
    expect(presenter.present).toHaveBeenLastCalledWith({
      view: expect.objectContaining({ pendingCount: 0 })
    })
    controller.onPaneCleared(PANE)
    expect(presenter.hide).toHaveBeenCalledTimes(1)
  })

  it('closes every queued cue at once', () => {
    const { controller, presenter } = setup()
    const other = 'tab-2:22222222-2222-4222-8222-222222222222'
    controller.onStatus(event('working'))
    controller.onStatus(event('done'))
    controller.onStatus(event('working', { paneKey: other, worktreeId: 'repo::/w2' }))
    controller.onStatus(event('done', { paneKey: other, worktreeId: 'repo::/w2' }))
    controller.dismissAll()
    expect(controller.current()).toBeNull()
    expect(presenter.hide).toHaveBeenCalledTimes(1)
  })

  it('hides the cues of a workspace once the user opens it', () => {
    const { controller, presenter } = setup()
    controller.onStatus(event('working'))
    controller.onStatus(event('done'))
    controller.setViewedWorktrees(['repo::/other'])
    expect(presenter.hide).not.toHaveBeenCalled()
    controller.setViewedWorktrees(['repo::/w1'])
    expect(presenter.hide).toHaveBeenCalledTimes(1)
    expect(controller.current()).toBeNull()
  })

  it('skips a cue for the workspace the focused main window already shows', () => {
    const { controller, presenter, focus } = setup()
    controller.setViewedWorktrees(['repo::/w1'])
    focus.mainWindow = true
    controller.onStatus(event('working'))
    controller.onStatus(event('done'))
    expect(presenter.present).not.toHaveBeenCalled()

    // Same workspace on screen but Dolphin in the background: the user is not looking at it.
    focus.mainWindow = false
    controller.onStatus(event('working', { stateStartedAt: 5 }))
    controller.onStatus(event('done', { stateStartedAt: 6 }))
    expect(presenter.present).toHaveBeenCalledTimes(1)
  })

  it('announces an exhausted auto-retry and clears everything when disabled', () => {
    const { controller, presenter, settings } = setup()
    controller.onRetryExhausted({ paneKey: PANE, worktreeId: 'repo::/w1' })
    expect(presenter.present).toHaveBeenLastCalledWith(
      expect.objectContaining({ soundKind: 'retry-exhausted' })
    )
    settings.agentInteraction = getDefaultAgentInteractionSettings()
    controller.onSettingsChanged()
    expect(presenter.hide).toHaveBeenCalledTimes(1)
    expect(controller.current()).toBeNull()
  })
})
