// Per-workspace policy for permission prompts that Claude still raises in bypass mode.
// Measured on claude 2.1.323: in bypass, only the dangerous-removal safety check prompts.

/** Dangerous-removal kinds Dolphin can recognize from a Bash command; anything else goes to the user. */
export const BYPASS_REMOVAL_CATEGORIES = [
  'working-directory',
  'variable-target',
  'command-substitution',
  'mounted-drive'
] as const

export type BypassRemovalCategory = (typeof BYPASS_REMOVAL_CATEGORIES)[number]

/** The "Most used" quick selection; categories whose target Dolphin cannot see stay opt-in. */
export const MOST_USED_BYPASS_REMOVAL_CATEGORIES: readonly BypassRemovalCategory[] = [
  'working-directory'
]

export type AgentPermissionPolicy =
  | { mode: 'approve-all' }
  | { mode: 'catalog'; categories: BypassRemovalCategory[] }

export function isBypassRemovalCategory(value: unknown): value is BypassRemovalCategory {
  return (
    typeof value === 'string' && BYPASS_REMOVAL_CATEGORIES.some((category) => category === value)
  )
}

/** Parses persisted or wire data; an unknown shape is no policy, never approve-all. */
export function parseAgentPermissionPolicy(value: unknown): AgentPermissionPolicy | null {
  if (!value || typeof value !== 'object' || !('mode' in value)) {
    return null
  }
  if (value.mode === 'approve-all') {
    return { mode: 'approve-all' }
  }
  if (value.mode === 'catalog' && 'categories' in value && Array.isArray(value.categories)) {
    return {
      mode: 'catalog',
      categories: [...new Set(value.categories.filter(isBypassRemovalCategory))]
    }
  }
  return null
}
