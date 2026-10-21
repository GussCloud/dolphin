import { describe, expect, it } from 'vitest'
import {
  agentInteractionKindForNotification,
  isNotificationSoundOwnedByAgentInteraction
} from './agent-interaction-notification-sound'
import { mergeAgentInteractionSettings } from './agent-interaction-settings'

describe('agent interaction notification sound ownership', () => {
  it('maps agent notifications to the event the avatar announces', () => {
    expect(agentInteractionKindForNotification({ source: 'agent-task-complete' })).toBe('task-done')
    expect(
      agentInteractionKindForNotification({ source: 'agent-task-complete', agentState: 'blocked' })
    ).toBe('needs-permission')
    expect(
      agentInteractionKindForNotification({ source: 'agent-task-complete', agentState: 'waiting' })
    ).toBe('needs-input')
    expect(
      agentInteractionKindForNotification({ source: 'agent-task-complete', agentInterrupted: true })
    ).toBe('task-interrupted')
    expect(agentInteractionKindForNotification({ source: 'agent-auto-retry-exhausted' })).toBe(
      'retry-exhausted'
    )
    expect(agentInteractionKindForNotification({ source: 'terminal-bell' })).toBeNull()
  })

  it('silences the notification only when the avatar handles that event', () => {
    const request = { source: 'agent-task-complete' } as const
    expect(isNotificationSoundOwnedByAgentInteraction(undefined, request)).toBe(false)
    expect(
      isNotificationSoundOwnedByAgentInteraction(mergeAgentInteractionSettings(undefined, {}), request)
    ).toBe(false)
    const enabled = mergeAgentInteractionSettings(undefined, { enabled: true })
    expect(isNotificationSoundOwnedByAgentInteraction(enabled, request)).toBe(true)
    expect(
      isNotificationSoundOwnedByAgentInteraction(enabled, { source: 'terminal-bell' })
    ).toBe(false)
    const eventOff = mergeAgentInteractionSettings(enabled, {
      events: { 'task-done': { enabled: false } }
    })
    expect(isNotificationSoundOwnedByAgentInteraction(eventOff, request)).toBe(false)
  })
})
