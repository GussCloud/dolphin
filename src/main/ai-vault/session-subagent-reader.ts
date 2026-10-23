import type { AiVaultSubagentListResult } from '../../shared/ai-vault-types'
import { listClaudeSubagentSessions } from './session-scanner-claude-subagents'
import { listOmpSubagentSessions } from './session-scanner-omp-subagent-listing'
import type { AiVaultServiceSubagentRequest } from './session-scanner-service-protocol'

export function listLocalAiVaultSubagentSessions(
  request: AiVaultServiceSubagentRequest
): Promise<AiVaultSubagentListResult> {
  return request.agent === 'omp'
    ? listOmpSubagentSessions({ parentFilePath: request.parentFilePath })
    : listClaudeSubagentSessions({ parentFilePath: request.parentFilePath, agent: request.agent })
}
