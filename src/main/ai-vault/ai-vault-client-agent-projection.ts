import type { AiVaultAgent, AiVaultListResult } from '../../shared/ai-vault-types'
import type { AiVaultSearchResponse } from '../../shared/ai-vault-search-types'
import {
  AI_VAULT_CLAUDE_API_SESSIONS_RUNTIME_CAPABILITY,
  AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY
} from '../../shared/ai-vault-agent-runtime-capabilities'
import type { RuntimeCapability } from '../../shared/protocol-version'

type ClientContext = {
  /** Undefined for in-process callers, which are this build. */
  clientKind?: 'mobile' | 'runtime'
  clientCapabilities?: readonly RuntimeCapability[]
}

/** AI Vault agents added after remote clients shipped a closed agent enum, with their gate. */
const GATED_AI_VAULT_AGENTS: readonly { agent: AiVaultAgent; capability: RuntimeCapability }[] = [
  { agent: 'deepseek', capability: AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY },
  { agent: 'claude-api', capability: AI_VAULT_CLAUDE_API_SESSIONS_RUNTIME_CAPABILITY }
]

/** Gated agents this caller cannot read; empty for in-process callers. */
export function aiVaultAgentsWithheldFrom(context: ClientContext): ReadonlySet<AiVaultAgent> {
  if (context.clientKind === undefined) {
    return new Set()
  }
  return new Set(
    GATED_AI_VAULT_AGENTS.filter(
      ({ capability }) => !(context.clientCapabilities?.includes(capability) ?? false)
    ).map(({ agent }) => agent)
  )
}

export function projectAiVaultListResultForClient(
  result: AiVaultListResult,
  context: ClientContext
): AiVaultListResult {
  const withheld = aiVaultAgentsWithheldFrom(context)
  if (withheld.size === 0) {
    return result
  }
  return {
    ...result,
    sessions: result.sessions.filter((session) => !withheld.has(session.agent)),
    issues: result.issues.filter((issue) => !withheld.has(issue.agent))
  }
}

export function projectAiVaultSearchResponseForClient(
  response: AiVaultSearchResponse,
  context: ClientContext
): AiVaultSearchResponse {
  const withheld = aiVaultAgentsWithheldFrom(context)
  if (response.kind !== 'results' || withheld.size === 0) {
    return response
  }
  return { ...response, hits: response.hits.filter((hit) => !withheld.has(hit.agent)) }
}
