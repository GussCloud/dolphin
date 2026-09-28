export type SetupRunPolicy = 'ask' | 'run-by-default' | 'skip-by-default'
export type SetupAgentStartupPolicy = 'start-immediately' | 'wait-for-setup'
export type HookCommandSourcePolicy = 'shared-only' | 'local-only' | 'run-both'

// ─── Hooks (dolphin.yaml) ──────────────────────────────────────────────
export type DolphinHooks = {
  scripts: {
    setup?: string // Runs after worktree is created
    archive?: string // Runs before worktree is archived
  }
  setupAgentStartupPolicy?: SetupAgentStartupPolicy
  issueCommand?: string // Shared default command for linked GitHub issues
  defaultTabs?: DolphinDefaultTabTemplate[] // Terminal tabs to create once for a new worktree
  environmentRecipes?: DolphinVmRecipe[] // Project-scoped per-workspace environment recipes
  environmentRecipeDiagnostics?: DolphinVmRecipeDiagnostic[] // Non-fatal validation issues from environmentRecipes
  worktree?: DolphinWorktreeDefaults // Project-scoped defaults applied when a worktree is created
}

export type DolphinWorktreeDefaults = {
  // Why: shared (symlinked) rather than copied — large rebuildable dirs like
  // node_modules should be one install serving every worktree.
  sharedDirectories?: string[]
}

export type DolphinDefaultTabTemplate = {
  title?: string
  color?: string
  command?: string
}

export type EphemeralVmCheckoutMode = 'dolphin-worktree' | 'provisioned-root'

export type DolphinVmRecipe = {
  id: string
  name: string
  create: string
  checkoutMode?: EphemeralVmCheckoutMode
  description?: string
  suspend?: string
  resume?: string
  destroy?: string
  destroyDisabled?: boolean
}

export type DolphinVmRecipeDiagnostic = {
  index: number
  field?: string
  message: string
}

export type RepoHookSettings = {
  // Why: persisted data may still include the old mode field from the earlier
  // hook UI. Keep it in the shape so existing local state reads without a migration.
  mode: 'auto' | 'override'
  setupRunPolicy?: SetupRunPolicy
  setupAgentStartupPolicy?: SetupAgentStartupPolicy
  commandSourcePolicy?: HookCommandSourcePolicy
  scripts: {
    setup: string
    archive: string
  }
}

export type PersistedTrustedDolphinHookEntry = {
  contentHash: string
  approvedAt: number
}

export type PersistedTrustedDolphinHookRepo = {
  all?: {
    approvedAt: number
  }
  setup?: PersistedTrustedDolphinHookEntry
  archive?: PersistedTrustedDolphinHookEntry
  issueCommand?: PersistedTrustedDolphinHookEntry
  vmRecipe?: PersistedTrustedDolphinHookEntry
}

export type PersistedTrustedDolphinHooks = Record<string, PersistedTrustedDolphinHookRepo>
