import type {
  WslConfigSuggestion,
  WslConfigSuggestionId
} from '../../shared/wslconfig-tuning-types'
import {
  readWslConfigValue,
  setWslConfigValue,
  type WslConfigDocument
} from './wslconfig-ini-document'

const BYTES_PER_GB = 1024 ** 3
// Why: above this share of host RAM the WSL VM's page cache starves Windows-side agents and builds.
const MEMORY_CAP_MAX_FRACTION = 0.75
const SUGGESTED_MEMORY_FRACTION = 0.5

const UNIT_BYTES: Record<string, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 ** 2,
  GB: 1024 ** 3,
  TB: 1024 ** 4
}

/** Parses WSL size strings such as `8GB`, `512MB` or `4G`; null when unrecognised. */
export function parseWslMemorySize(value: string): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*([KMGT]?B?)$/i.exec(value.trim())
  if (!match) {
    return null
  }
  const rawUnit = match[2].toUpperCase()
  const unit = rawUnit === '' ? 'B' : rawUnit.endsWith('B') ? rawUnit : `${rawUnit}B`
  const multiplier = UNIT_BYTES[unit]
  return multiplier === undefined ? null : Number(match[1]) * multiplier
}

// Why: these keys moved between [experimental] and [wsl2] across WSL releases; honor either.
function readKeyInEitherSection(document: WslConfigDocument, key: string): string | null {
  return (
    readWslConfigValue(document, 'experimental', key) ?? readWslConfigValue(document, 'wsl2', key)
  )
}

export function buildWslConfigSuggestions(
  document: WslConfigDocument,
  totalMemoryBytes: number
): WslConfigSuggestion[] {
  const suggestions: WslConfigSuggestion[] = []
  // Why: only fill keys the user never set — an explicit value, even "disabled", is their choice.
  if (readKeyInEitherSection(document, 'autoMemoryReclaim') === null) {
    suggestions.push({
      id: 'auto-memory-reclaim',
      section: 'experimental',
      key: 'autoMemoryReclaim',
      currentValue: null,
      suggestedValue: 'gradual'
    })
  }
  if (readKeyInEitherSection(document, 'sparseVhd') === null) {
    suggestions.push({
      id: 'sparse-vhd',
      section: 'experimental',
      key: 'sparseVhd',
      currentValue: null,
      suggestedValue: 'true'
    })
  }
  // Why: an unset memory key already defaults to 50% of RAM, so only an oversized cap is worth changing.
  const memory = readWslConfigValue(document, 'wsl2', 'memory')
  const memoryBytes = memory === null ? null : parseWslMemorySize(memory)
  const suggestedGb = Math.floor((totalMemoryBytes * SUGGESTED_MEMORY_FRACTION) / BYTES_PER_GB)
  if (
    memory !== null &&
    memoryBytes !== null &&
    suggestedGb > 0 &&
    memoryBytes > totalMemoryBytes * MEMORY_CAP_MAX_FRACTION
  ) {
    suggestions.push({
      id: 'memory-cap',
      section: 'wsl2',
      key: 'memory',
      currentValue: memory,
      suggestedValue: `${suggestedGb}GB`
    })
  }
  return suggestions
}

export function applyWslConfigSuggestions(
  document: WslConfigDocument,
  suggestions: readonly WslConfigSuggestion[],
  ids: readonly WslConfigSuggestionId[]
): { document: WslConfigDocument; appliedIds: WslConfigSuggestionId[] } {
  let next = document
  const appliedIds: WslConfigSuggestionId[] = []
  for (const suggestion of suggestions) {
    if (!ids.includes(suggestion.id)) {
      continue
    }
    next = setWslConfigValue(next, suggestion.section, suggestion.key, suggestion.suggestedValue)
    appliedIds.push(suggestion.id)
  }
  return { document: next, appliedIds }
}
