import type { AiVaultListResult } from '../../shared/ai-vault-types'
import type { AiVaultSearchResponse } from '../../shared/ai-vault-search-types'
import {
  AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY,
  type RuntimeCapability
} from '../../shared/protocol-version'

type ClientContext = {
  /** Undefined for in-process callers, which are this build. */
  clientKind?: 'mobile' | 'runtime'
  clientCapabilities?: readonly RuntimeCapability[]
}

/** Whether this caller can read `deepseek` AI Vault rows; see AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY. */
export function clientReadsDeepSeekAiVaultRows(context: ClientContext): boolean {
  return (
    context.clientKind === undefined ||
    (context.clientCapabilities?.includes(AI_VAULT_DEEPSEEK_SESSIONS_RUNTIME_CAPABILITY) ?? false)
  )
}

export function projectDeepSeekAiVaultListResult(
  result: AiVaultListResult,
  context: ClientContext
): AiVaultListResult {
  if (clientReadsDeepSeekAiVaultRows(context)) {
    return result
  }
  return {
    ...result,
    sessions: result.sessions.filter((session) => session.agent !== 'deepseek'),
    issues: result.issues.filter((issue) => issue.agent !== 'deepseek')
  }
}

export function projectDeepSeekAiVaultSearchResponse(
  response: AiVaultSearchResponse,
  context: ClientContext
): AiVaultSearchResponse {
  if (response.kind !== 'results' || clientReadsDeepSeekAiVaultRows(context)) {
    return response
  }
  return { ...response, hits: response.hits.filter((hit) => hit.agent !== 'deepseek') }
}
