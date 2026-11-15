/** What the user can bring from their own `~/.claude` into an account profile. */
export type ClaudeProfileImportKind =
  | 'instructions'
  | 'settings'
  | 'keybindings'
  | 'skill'
  | 'agent'
  | 'command'
  | 'output-style'
  | 'mcp-server'
  | 'plugin'

export type ClaudeProfileImportItem = {
  /** `<kind>:<name>`, stable across listings. */
  id: string
  kind: ClaudeProfileImportKind
  name: string
  /** Already present in the profile; importing it would be skipped, never overwritten. */
  existsInProfile: boolean
  /** Carries accesses (an MCP server's command and env, a plugin's code): never pre-selected. */
  sensitive: boolean
}

export type ClaudeProfileDetails = {
  accountId: string
  configDir: string
  /** A folder the user manages: it can be edited, but nothing is imported into it. */
  linked: boolean
  /** Converted from the shared layout and not yet reviewed by the user. */
  reviewPending: boolean
  /** What that conversion copied from `~/.claude`. */
  migratedCopied: string[]
  instructions: string | null
  mcpServers: string[]
  importItems: ClaudeProfileImportItem[]
}

export type ClaudeProfileImportResult = {
  imported: string[]
  skipped: string[]
}

export function claudeProfileImportId(kind: ClaudeProfileImportKind, name: string): string {
  return `${kind}:${name}`
}
