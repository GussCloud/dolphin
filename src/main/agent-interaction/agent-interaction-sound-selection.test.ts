import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
  AGENT_INTERACTION_KINDS,
  mergeAgentInteractionSettings
} from '../../shared/agent-interaction-settings'
import { getSelectedAgentInteractionSoundPath } from './agent-interaction-sound-selection'

const absoluteSound = join(process.cwd(), 'sounds', 'done.wav')

describe('getSelectedAgentInteractionSoundPath', () => {
  it('plays a distinct bundled sound per event by default', () => {
    const settings = mergeAgentInteractionSettings(undefined, {})
    const paths = AGENT_INTERACTION_KINDS.map(
      (kind) => getSelectedAgentInteractionSoundPath(settings, kind).path
    )
    expect(paths.every((path) => typeof path === 'string')).toBe(true)
    expect(new Set(paths).size).toBe(AGENT_INTERACTION_KINDS.length)
  })

  it('is silent when the event sound is off', () => {
    const settings = mergeAgentInteractionSettings(undefined, {
      events: { 'task-done': { soundSource: 'none' } }
    })
    expect(getSelectedAgentInteractionSoundPath(settings, 'task-done')).toEqual({
      path: null,
      reason: 'silent'
    })
  })

  it('validates a custom pick like the notification sound', () => {
    const pick = (customSoundPath: string) =>
      getSelectedAgentInteractionSoundPath(
        mergeAgentInteractionSettings(undefined, {
          events: { 'task-done': { soundSource: 'custom', customSoundPath } }
        }),
        'task-done'
      )
    expect(pick(absoluteSound)).toEqual({ path: absoluteSound })
    expect(pick('relative/done.wav')).toEqual({ path: null, reason: 'invalid-path' })
    expect(pick(join(process.cwd(), 'done.txt'))).toEqual({
      path: null,
      reason: 'unsupported-type'
    })
  })
})
