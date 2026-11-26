// Why: AI Vault agents added after remote clients shipped a closed agent enum in the search reply
// schema. An older client refuses the whole page on one such hit, so the host withholds each agent's
// rows and hits from remote clients that do not advertise its capability (lost, never mislabelled).
export const AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY =
  'ai-vault.deepseek-sessions.v1' as const
export const AI_VAULT_CLAUDE_API_SESSIONS_RUNTIME_CAPABILITY =
  'ai-vault.claude-api-sessions.v1' as const

/** Advertised by every client of this build and by the host, which reads them all. */
export const AI_VAULT_GATED_AGENT_RUNTIME_CAPABILITIES = [
  AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY,
  AI_VAULT_CLAUDE_API_SESSIONS_RUNTIME_CAPABILITY
] as const
