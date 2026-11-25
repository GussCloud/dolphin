export type CodexManagedAccount = {
  id: string
  email: string
  managedHomePath: string
  managedHomeRuntime?: 'host' | 'wsl'
  wslDistro?: string | null
  wslLinuxHomePath?: string | null
  providerAccountId?: string | null
  workspaceLabel?: string | null
  workspaceAccountId?: string | null
  createdAt: number
  updatedAt: number
  lastAuthenticatedAt: number
}

export type CodexManagedAccountSummary = {
  id: string
  email: string
  managedHomeRuntime?: 'host' | 'wsl'
  wslDistro?: string | null
  providerAccountId?: string | null
  workspaceLabel?: string | null
  workspaceAccountId?: string | null
  createdAt: number
  updatedAt: number
  lastAuthenticatedAt: number
}

/** Live, read-only identity of the user's real ~/.codex used by the
 *  system-default (activeAccountId:null) Codex account. Dolphin reads this to
 *  display and attribute the system default; it never writes ~/.codex. */
export type CodexSystemDefaultIdentity = {
  /** True when ~/.codex/auth.json exists (signed in via a token file). */
  hasAuth: boolean
  /** 'oauth' = ChatGPT sign-in with an id token (has ChatGPT usage);
   *  'api-key' = env-key/custom provider (no ChatGPT usage);
   *  'none' = signed out or identity could not be resolved. */
  authKind: 'oauth' | 'api-key' | 'none'
  email: string | null
  providerAccountId: string | null
  workspaceLabel: string | null
}

export type CodexRateLimitAccountsState = {
  accounts: CodexManagedAccountSummary[]
  activeAccountId: string | null
  activeAccountIdsByRuntime?: CodexManagedAccountRuntimeSelection
  /** Resolved identity of the host system-default (real ~/.codex) account.
   *  Omitted for runtimes where it is not resolved (e.g. per-distro WSL). */
  systemDefault?: CodexSystemDefaultIdentity
}

export type CodexManagedAccountRuntimeSelection = {
  host: string | null
  wsl: Record<string, string | null>
}

/** 'api-key': billed to an Anthropic API key held by Dolphin, never usable by plain `claude`. */
export type ClaudeAccountAuthMethod = 'subscription-oauth' | 'api-key' | 'unknown'

export type ClaudeManagedAccount = {
  id: string
  email: string
  managedAuthPath: string
  managedAuthRuntime?: 'host' | 'wsl'
  wslDistro?: string | null
  wslLinuxAuthPath?: string | null
  /** A config dir the user already manages (e.g. from a terminal menu); Dolphin launches in it
   *  and never writes credentials there. Absent: an isolated profile Dolphin manages. */
  linkedConfigDir?: string | null
  authMethod: ClaudeAccountAuthMethod
  /** Name the user gave an api-key account, which has no OAuth email (`email` is empty). */
  label?: string | null
  organizationUuid?: string | null
  organizationName?: string | null
  createdAt: number
  updatedAt: number
  lastAuthenticatedAt: number
}

export type ClaudeManagedAccountSummary = {
  id: string
  email: string
  managedAuthRuntime?: 'host' | 'wsl'
  wslDistro?: string | null
  linkedConfigDir?: string | null
  authMethod: ClaudeAccountAuthMethod
  /** Name the user gave an api-key account, which has no OAuth email (`email` is empty). */
  label?: string | null
  organizationUuid?: string | null
  organizationName?: string | null
  createdAt: number
  updatedAt: number
  lastAuthenticatedAt: number
}

/** A Claude config folder the user's terminal account menu uses, found by Dolphin read-only. */
export type ClaudeConfigFolderCandidate = {
  configDir: string
  /** `~/.claude`, which Claude runs without CLAUDE_CONFIG_DIR. */
  isDefault: boolean
  email: string | null
  organizationName: string | null
  organizationUuid: string | null
  linkedAccountId: string | null
}

export type ClaudeConfigFolderDiscovery = {
  /** The zsh file defining the `claude` menu; null when there is none. */
  selectorFile: string | null
  folders: ClaudeConfigFolderCandidate[]
}

export type ClaudeRateLimitAccountsState = {
  accounts: ClaudeManagedAccountSummary[]
  activeAccountId: string | null
  activeAccountIdsByRuntime?: ClaudeManagedAccountRuntimeSelection
}

export type ClaudeManagedAccountRuntimeSelection = {
  host: string | null
  wsl: Record<string, string | null>
}

export type ClaudeApiKeyStatus = {
  apiKeyConfigured: boolean
  encryptionAvailable: boolean
}

export type ClaudeApiKeyAccountRequest = {
  label: string
  apiKey: string
  /** Account whose profile (instructions, settings, tools; never credentials) seeds the new one. */
  copyFromAccountId?: string | null
}
