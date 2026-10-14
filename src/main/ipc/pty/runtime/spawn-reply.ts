import type { AgentSessionClaimedSpawnResult } from '../../../../shared/agent-session-host-authority'

/** The fields a runtime spawn returns to main; anything not forwarded here never reaches it. */
export function toRuntimeSpawnReply(result: {
  id: string
  incarnationId?: string
  wslDistro?: string | null
  stablePaneOwner?: { handle: string; tabId: string; leafId: string }
  agentSessionEnsure?: AgentSessionClaimedSpawnResult
  reattachedLiveSession?: true
}) {
  return {
    id: result.id,
    ...(result.incarnationId ? { incarnationId: result.incarnationId } : {}),
    ...(typeof result.wslDistro === 'string' ? { wslDistro: result.wslDistro } : {}),
    ...(result.stablePaneOwner ? { stablePaneOwner: result.stablePaneOwner } : {}),
    ...(result.agentSessionEnsure ? { agentSessionEnsure: result.agentSessionEnsure } : {}),
    ...(result.reattachedLiveSession ? { reattachedLiveSession: true as const } : {})
  }
}
