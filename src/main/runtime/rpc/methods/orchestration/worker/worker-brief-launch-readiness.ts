import { AGENT_PROMPT_EFFECT_TIMEOUT_MS } from '../../../../../../shared/orchestration-timing-budgets'
import { waitForWorkerAuthority, watchWorkerStartupBlock } from './worker-brief-launch'
import { persistWorkerSetupWaitOutcome } from './worker-setup-gate'
import { deliverAndSettleWorkerStartReadiness } from './worker-start-readiness-settlement'

type SettleArgs = Omit<
  Parameters<typeof deliverAndSettleWorkerStartReadiness>[0],
  'dispatchCapability' | 'briefRidesLaunch'
>

/**
 * Readiness for a worker whose agent was launched with its `worker-brief` pointer. The agent is
 * already working on that prompt, so it never reaches the idle prompt a paste would wait for:
 * the start mints the capability as soon as the pane has an identity, holds the brief, and is
 * ready when the worker fetches it.
 */
export async function settleLaunchedWorkerStart(
  args: SettleArgs & {
    worktreeId: string
    setupStage: Omit<Parameters<typeof persistWorkerSetupWaitOutcome>[0], 'wait'>
  }
): Promise<unknown> {
  const { runtime, setupStage, setupReceipt } = args
  const startedAt = Date.now()
  let briefFetched = false
  // Still read the startup screen: a login, update or trust prompt fails the start at once.
  const startupBlocked = watchWorkerStartupBlock({
    runtime,
    terminalHandle: args.terminalHandle,
    timeoutMs: args.timeoutMs,
    onExited: (wait) => {
      // Why: the read can end after the fetch settled the start; it must not rewrite its stage.
      if (briefFetched) {
        return 'agent_readiness'
      }
      persistWorkerSetupWaitOutcome({ ...setupStage, wait })
      return setupReceipt.state === 'failed' ? 'setup_wait' : 'agent_readiness'
    }
  })
  const authority = await waitForWorkerAuthority(runtime, args.terminalHandle, args.timeoutMs)
  const dispatchCapability = args.db.prepareStartingWorkerAuthority({
    dispatchId: args.dispatchId,
    handle: args.terminalHandle,
    ...authority,
    worktreeId: args.worktreeId,
    effects: args.effects,
    setupState: setupReceipt.state,
    terminalOwnership: 'created'
  })
  return await deliverAndSettleWorkerStartReadiness({
    ...args,
    dispatchCapability,
    briefRidesLaunch: {
      paneKey: authority.paneKey,
      startupBlocked,
      // The agent of a gated setup launches only after setup succeeded, so a fetch proves it.
      onFetched: () => {
        briefFetched = true
        persistWorkerSetupWaitOutcome({
          ...setupStage,
          wait: { satisfied: true, status: 'running' }
        })
      },
      fetchTimeoutMs: Math.max(
        0,
        args.timeoutMs + AGENT_PROMPT_EFFECT_TIMEOUT_MS - (Date.now() - startedAt)
      )
    }
  })
}
