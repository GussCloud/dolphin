import { z } from 'zod'
import type { TuiAgent } from './tui-agent'

/** DeepSeek has no harness of its own; these agents run the Claude Code CLI against DeepSeek's Anthropic-compatible API. */
export const DEEPSEEK_TUI_AGENTS = [
  'deepseek',
  'deepseek-agent-teams'
] as const satisfies readonly TuiAgent[]

export type DeepSeekTuiAgent = (typeof DEEPSEEK_TUI_AGENTS)[number]

export function isDeepSeekTuiAgent(agent: unknown): agent is DeepSeekTuiAgent {
  return agent === 'deepseek' || agent === 'deepseek-agent-teams'
}

export const DEEPSEEK_ANTHROPIC_BASE_URL = 'https://api.deepseek.com/anthropic'
export const DEEPSEEK_MODELS_URL = 'https://api.deepseek.com/models'

/** Home-relative Claude config dir, so DeepSeek sessions, settings and hooks never mix into `~/.claude`. */
export const DEEPSEEK_CLAUDE_CONFIG_DIR_NAME = '.claude-deepseek'

/** Pane env marker: lets teammate and relaunched panes skip the managed Claude account auth gate. */
export const DEEPSEEK_PROVIDER_ENV_KEY = 'DOLPHIN_CLAUDE_PROVIDER'
export const DEEPSEEK_PROVIDER_ENV_VALUE = 'deepseek'

export type DeepSeekModelSlots = {
  main: string
  opus: string
  sonnet: string
  haiku: string
  subagent: string
}

export const DEEPSEEK_MODEL_SLOT_KEYS = [
  'main',
  'opus',
  'sonnet',
  'haiku',
  'subagent'
] as const satisfies readonly (keyof DeepSeekModelSlots)[]

/** Suffix Claude Code reads as "this model has a 1M-token context window". */
export const DEEPSEEK_ONE_MILLION_CONTEXT_SUFFIX = '[1m]'

// Why: values from DeepSeek's Claude Code guide (api-docs.deepseek.com/quick_start/agent_integrations/claude_code).
export const DEFAULT_DEEPSEEK_MODEL_SLOTS: DeepSeekModelSlots = {
  main: 'deepseek-flash[1m]',
  opus: 'deepseek-flash[1m]',
  sonnet: 'deepseek-flash[1m]',
  haiku: 'deepseek-flash',
  subagent: 'deepseek-flash'
}

export const DEEPSEEK_MODEL_SLOT_ENV: Record<keyof DeepSeekModelSlots, string> = {
  main: 'ANTHROPIC_MODEL',
  opus: 'ANTHROPIC_DEFAULT_OPUS_MODEL',
  sonnet: 'ANTHROPIC_DEFAULT_SONNET_MODEL',
  haiku: 'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  subagent: 'CLAUDE_CODE_SUBAGENT_MODEL'
}

const DEEPSEEK_STATIC_ENV: Record<string, string> = {
  ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL,
  CLAUDE_CODE_EFFORT_LEVEL: 'max',
  CLAUDE_CODE_AUTO_COMPACT_WINDOW: '786432'
}

/** Every key `buildDeepSeekClaudeEnv` can emit; WSL forwarding and env cleanup read this list. */
export const DEEPSEEK_CLAUDE_ENV_KEYS: readonly string[] = [
  ...Object.keys(DEEPSEEK_STATIC_ENV),
  ...Object.values(DEEPSEEK_MODEL_SLOT_ENV),
  'ANTHROPIC_AUTH_TOKEN',
  'CLAUDE_CONFIG_DIR',
  DEEPSEEK_PROVIDER_ENV_KEY
]

const modelSlotValue = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1))
  .optional()
  .catch(undefined)
const modelSlotsSchema = z.object({
  main: modelSlotValue,
  opus: modelSlotValue,
  sonnet: modelSlotValue,
  haiku: modelSlotValue,
  subagent: modelSlotValue
})

/** Persisted slots with every missing, blank or malformed value replaced by its default. */
export function normalizeDeepSeekModelSlots(value: unknown): DeepSeekModelSlots {
  const parsed = modelSlotsSchema.safeParse(value)
  const slots = { ...DEFAULT_DEEPSEEK_MODEL_SLOTS }
  if (!parsed.success) {
    return slots
  }
  for (const key of DEEPSEEK_MODEL_SLOT_KEYS) {
    slots[key] = parsed.data[key] ?? slots[key]
  }
  return slots
}

/**
 * The env a DeepSeek Claude Code process needs. `configDir` is the path as the process host sees it
 * (Windows path locally, Linux path inside WSL, remote path over SSH).
 */
export function buildDeepSeekClaudeEnv(args: {
  apiKey: string
  slots: DeepSeekModelSlots
  configDir: string
}): Record<string, string> {
  const env: Record<string, string> = {
    ...DEEPSEEK_STATIC_ENV,
    ANTHROPIC_AUTH_TOKEN: args.apiKey,
    CLAUDE_CONFIG_DIR: args.configDir,
    [DEEPSEEK_PROVIDER_ENV_KEY]: DEEPSEEK_PROVIDER_ENV_VALUE
  }
  for (const key of DEEPSEEK_MODEL_SLOT_KEYS) {
    env[DEEPSEEK_MODEL_SLOT_ENV[key]] = args.slots[key]
  }
  return env
}

export function isDeepSeekProviderEnv(
  env: Record<string, string | undefined> | undefined
): boolean {
  return env?.[DEEPSEEK_PROVIDER_ENV_KEY] === DEEPSEEK_PROVIDER_ENV_VALUE
}

/** One entry of DeepSeek's `GET /models` list, reduced to what the model pickers show. */
export type DeepSeekModelOption = {
  id: string
  contextWindow: number | null
}

export type DeepSeekCredentialsStatus = {
  apiKeyConfigured: boolean
  /** False when the OS has no secure storage; saving the key is then refused. */
  encryptionAvailable: boolean
}

export type DeepSeekListModelsResult =
  | { ok: true; models: DeepSeekModelOption[] }
  | { ok: false; reason: 'no-api-key' | 'unauthorized' | 'network' | 'invalid-response' }
