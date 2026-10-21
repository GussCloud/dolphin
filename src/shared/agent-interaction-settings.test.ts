import { describe, expect, it } from 'vitest'
import {
  AGENT_INTERACTION_KINDS,
  getDefaultAgentInteractionSettings,
  mergeAgentInteractionSettings,
  normalizeAgentInteractionSettings,
  persistedAgentInteractionSettingsRepaired
} from './agent-interaction-settings'

describe('agent interaction settings', () => {
  it('ships disabled, with only the noisy events off', () => {
    const defaults = getDefaultAgentInteractionSettings()
    expect(defaults.enabled).toBe(false)
    const off = AGENT_INTERACTION_KINDS.filter((kind) => !defaults.events[kind].enabled)
    expect(off).toEqual(['task-interrupted', 'subagent-done', 'task-started'])
    for (const kind of AGENT_INTERACTION_KINDS) {
      expect(defaults.events[kind].soundSource).toBe('default')
    }
  })

  it('repairs type-flipped and out-of-range values field by field', () => {
    const normalized = normalizeAgentInteractionSettings({
      enabled: 'true',
      volume: 250,
      avatar: { source: 'custom', customImagePath: '' },
      events: {
        'task-done': { enabled: false, soundSource: 'custom', customSoundPath: 42 },
        'needs-input': { enabled: 'no', soundSource: 'none' },
        'not-a-kind': { enabled: true }
      }
    })
    expect(normalized.enabled).toBe(false)
    expect(normalized.volume).toBe(100)
    expect(normalized.avatar).toEqual({ source: 'default', customImagePath: null })
    // A custom source without a usable path falls back instead of playing nothing silently.
    expect(normalized.events['task-done']).toEqual({
      enabled: false,
      soundSource: 'default',
      customSoundPath: null
    })
    expect(normalized.events['needs-input']).toEqual({
      enabled: true,
      soundSource: 'none',
      customSoundPath: null
    })
    expect(normalized.events).not.toHaveProperty('not-a-kind')
  })

  it('keeps a custom path while another source is selected', () => {
    const normalized = normalizeAgentInteractionSettings({
      events: {
        'task-done': { enabled: true, soundSource: 'default', customSoundPath: '/a/done.mp3' }
      }
    })
    expect(normalized.events['task-done'].customSoundPath).toBe('/a/done.mp3')
  })

  it('merges one event update without resetting its siblings', () => {
    const current = mergeAgentInteractionSettings(getDefaultAgentInteractionSettings(), {
      enabled: true,
      volume: 40,
      events: { 'task-done': { soundSource: 'custom', customSoundPath: '/a/done.mp3' } }
    })
    const next = mergeAgentInteractionSettings(current, {
      events: { 'task-done': { enabled: false } }
    })
    expect(next.enabled).toBe(true)
    expect(next.volume).toBe(40)
    expect(next.events['task-done']).toEqual({
      enabled: false,
      soundSource: 'custom',
      customSoundPath: '/a/done.mp3'
    })
    expect(next.events['needs-permission']).toEqual(current.events['needs-permission'])
  })

  it('merges into a missing value as defaults', () => {
    const merged = mergeAgentInteractionSettings(undefined, { enabled: true })
    expect(merged).toEqual({ ...getDefaultAgentInteractionSettings(), enabled: true })
  })

  it('reports a repair only when the persisted value differs', () => {
    const defaults = getDefaultAgentInteractionSettings()
    expect(persistedAgentInteractionSettingsRepaired(undefined, defaults)).toBe(false)
    expect(persistedAgentInteractionSettingsRepaired(defaults, defaults)).toBe(false)
    expect(
      persistedAgentInteractionSettingsRepaired(
        { ...defaults, volume: '50' },
        normalizeAgentInteractionSettings({ ...defaults, volume: '50' })
      )
    ).toBe(true)
  })
})
