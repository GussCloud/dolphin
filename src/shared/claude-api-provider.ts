import { DEEPSEEK_PROVIDER_ENV_KEY } from './deepseek-claude-provider'
import type { TuiAgent } from './tui-agent'

/** The Claude Code CLI billed to a per-account Anthropic API key, inside that account's profile. */
export const CLAUDE_API_TUI_AGENTS = ['claude-api'] as const satisfies readonly TuiAgent[]

export type ClaudeApiTuiAgent = (typeof CLAUDE_API_TUI_AGENTS)[number]

export function isClaudeApiTuiAgent(agent: unknown): agent is ClaudeApiTuiAgent {
  return agent === 'claude-api'
}

/** Same marker key as DeepSeek: one pane runs one provider. */
export const CLAUDE_API_PROVIDER_ENV_KEY = DEEPSEEK_PROVIDER_ENV_KEY
export const CLAUDE_API_PROVIDER_ENV_VALUE = 'anthropic-api'
/** Non-secret: which API account a pane (resume, relaunch, teammate) is billed to. */
export const CLAUDE_API_ACCOUNT_ENV_KEY = 'DOLPHIN_CLAUDE_API_ACCOUNT'

/**
 * Env that would send the CLI to another credential, endpoint or cloud provider, so it never
 * reaches an API-key launch. ANTHROPIC_API_KEY is absent: the launch sets its own.
 */
export const CLAUDE_API_CONFLICTING_ENV_KEYS: readonly string[] = [
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'ANTHROPIC_BASE_URL',
  'ANTHROPIC_CUSTOM_HEADERS',
  'ANTHROPIC_UNIX_SOCKET',
  'AWS_BEARER_TOKEN_BEDROCK',
  'ANTHROPIC_BEDROCK_BASE_URL',
  'ANTHROPIC_VERTEX_BASE_URL',
  'ANTHROPIC_VERTEX_PROJECT_ID',
  'ANTHROPIC_FOUNDRY_API_KEY',
  'ANTHROPIC_FOUNDRY_BASE_URL',
  'ANTHROPIC_FOUNDRY_RESOURCE',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_FOUNDRY',
  'CLAUDE_CODE_SKIP_BEDROCK_AUTH',
  'CLAUDE_CODE_SKIP_VERTEX_AUTH',
  'CLAUDE_CODE_SKIP_FOUNDRY_AUTH'
]

export function isClaudeApiProviderEnv(
  env: Record<string, string | undefined> | undefined
): boolean {
  return env?.[CLAUDE_API_PROVIDER_ENV_KEY] === CLAUDE_API_PROVIDER_ENV_VALUE
}

export function readClaudeApiAccountEnv(
  env: Record<string, string | undefined> | undefined
): string | null {
  return env?.[CLAUDE_API_ACCOUNT_ENV_KEY]?.trim() || null
}

/** The env an API-key Claude Code process needs; `configDir` is the account profile dir. */
export function buildClaudeApiClaudeEnv(args: {
  apiKey: string
  accountId: string
  configDir: string
}): Record<string, string> {
  return {
    CLAUDE_CONFIG_DIR: args.configDir,
    [CLAUDE_API_PROVIDER_ENV_KEY]: CLAUDE_API_PROVIDER_ENV_VALUE,
    [CLAUDE_API_ACCOUNT_ENV_KEY]: args.accountId,
    ANTHROPIC_API_KEY: args.apiKey
  }
}
