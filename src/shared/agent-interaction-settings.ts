import { isRecord } from './agent-status-child-work-value-guards'

/**
 * Agent Interaction: a floating avatar plus a per-event sound that asks for the user when an
 * agent needs them or finishes. This module owns the event vocabulary and the persisted settings.
 */

/** Order is the settings-pane order: human-attention events first. */
export const AGENT_INTERACTION_KINDS = [
  'needs-permission',
  'needs-input',
  'task-done',
  'task-failed',
  'task-interrupted',
  'retry-exhausted',
  'subagent-attention',
  'subagent-done',
  'task-started'
] as const
export type AgentInteractionKind = (typeof AGENT_INTERACTION_KINDS)[number]

export function isAgentInteractionKind(value: unknown): value is AgentInteractionKind {
  return AGENT_INTERACTION_KINDS.some((kind) => kind === value)
}

/** `default` plays the bundled sound for the event's kind. */
export type AgentInteractionSoundSource = 'default' | 'custom' | 'none'

export type AgentInteractionEventSettings = {
  enabled: boolean
  soundSource: AgentInteractionSoundSource
  /** Kept while `soundSource` is not `custom` so switching back restores the user's pick. */
  customSoundPath: string | null
}

export type AgentInteractionAvatarSettings = {
  source: 'default' | 'custom'
  customImagePath: string | null
}

export type AgentInteractionSettings = {
  enabled: boolean
  /** 0–100, applied to every event's sound. */
  volume: number
  avatar: AgentInteractionAvatarSettings
  events: Record<AgentInteractionKind, AgentInteractionEventSettings>
}

// Why off: these fire often enough to become noise; the user opts in per event.
const EVENTS_OFF_BY_DEFAULT: ReadonlySet<AgentInteractionKind> = new Set([
  'task-interrupted',
  'subagent-done',
  'task-started'
])

export function getDefaultAgentInteractionSettings(): AgentInteractionSettings {
  return {
    enabled: false,
    volume: 100,
    avatar: { source: 'default', customImagePath: null },
    events: mapAgentInteractionKinds((kind) => ({
      enabled: !EVENTS_OFF_BY_DEFAULT.has(kind),
      soundSource: 'default',
      customSoundPath: null
    }))
  }
}

function readRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

/** Built key-by-key so the compiler proves every kind is present. */
function mapAgentInteractionKinds<T>(
  build: (kind: AgentInteractionKind) => T
): Record<AgentInteractionKind, T> {
  return {
    'needs-permission': build('needs-permission'),
    'needs-input': build('needs-input'),
    'task-done': build('task-done'),
    'task-failed': build('task-failed'),
    'task-interrupted': build('task-interrupted'),
    'retry-exhausted': build('retry-exhausted'),
    'subagent-attention': build('subagent-attention'),
    'subagent-done': build('subagent-done'),
    'task-started': build('task-started')
  }
}

function booleanOr(raw: unknown, fallback: boolean): boolean {
  return typeof raw === 'boolean' ? raw : fallback
}

function pathOrNull(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() !== '' ? raw : null
}

function normalizeEventSettings(
  raw: unknown,
  fallback: AgentInteractionEventSettings
): AgentInteractionEventSettings {
  const candidate = readRecord(raw)
  const customSoundPath = pathOrNull(candidate.customSoundPath)
  const rawSource = candidate.soundSource
  const soundSource: AgentInteractionSoundSource =
    rawSource === 'default' || rawSource === 'none' || (rawSource === 'custom' && customSoundPath)
      ? rawSource
      : fallback.soundSource
  return {
    enabled: booleanOr(candidate.enabled, fallback.enabled),
    soundSource,
    customSoundPath
  }
}

/** Field-by-field so a hand-edited or type-flipped value on disk never reaches a loader. */
export function normalizeAgentInteractionSettings(value: unknown): AgentInteractionSettings {
  const defaults = getDefaultAgentInteractionSettings()
  const candidate = readRecord(value)
  const rawVolume = candidate.volume
  const rawAvatar = readRecord(candidate.avatar)
  const customImagePath = pathOrNull(rawAvatar.customImagePath)
  const rawEvents = readRecord(candidate.events)
  return {
    enabled: booleanOr(candidate.enabled, defaults.enabled),
    volume:
      typeof rawVolume === 'number' && Number.isFinite(rawVolume)
        ? Math.min(100, Math.max(0, Math.round(rawVolume)))
        : defaults.volume,
    avatar: {
      source: rawAvatar.source === 'custom' && customImagePath ? 'custom' : 'default',
      customImagePath
    },
    events: mapAgentInteractionKinds((kind) =>
      normalizeEventSettings(rawEvents[kind], defaults.events[kind])
    )
  }
}

/** Applies a partial update; nested objects merge so flipping one event keeps its siblings. */
export function mergeAgentInteractionSettings(current: unknown, patch: unknown): AgentInteractionSettings {
  // Why normalize first: a state object built before this field existed has no value to merge into.
  const base = normalizeAgentInteractionSettings(current)
  const update = readRecord(patch)
  const updateEvents = readRecord(update.events)
  return normalizeAgentInteractionSettings({
    ...base,
    ...update,
    avatar: { ...base.avatar, ...readRecord(update.avatar) },
    events: mapAgentInteractionKinds((kind) => ({
      ...base.events[kind],
      ...readRecord(updateEvents[kind])
    }))
  })
}

/** True when loading had to repair the persisted value, so the fix is written back once. */
export function persistedAgentInteractionSettingsRepaired(
  value: unknown,
  normalized: AgentInteractionSettings
): boolean {
  if (value === undefined) {
    return false
  }
  return JSON.stringify(value) !== JSON.stringify(normalized)
}
