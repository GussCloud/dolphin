/**
 * A worker started like the coordinator: its first message rides the agent's launch command, so
 * Dolphin never types into the pane and no Enter can be dropped. The message points at
 * `worker-brief`, which returns the full brief once this start has minted it.
 *
 * Why: on Windows Claude drops the first Enter after a paste into a freshly started composer, and
 * workers waited for a manual Enter. The coordinator never did, because its prompt is in argv.
 */
import { DEV_CLI_COMMAND_NAME } from '../../../../../../shared/cli-command-names'
import type { TuiAgent } from '../../../../../../shared/tui-agent'
import { TUI_AGENT_CONFIG } from '../../../../../../shared/tui-agent-config'
import type { DolphinRuntimeService } from '../../../../dolphin-runtime'
import { buildWorkerBriefLaunchPrompt } from '../../../../orchestration/worker-brief-store'
import { describeTerminalWaitBlockedReason } from '../../../../../../shared/terminal-wait-blocked-reason-legacy-alias'
import { requireWorkerAuthority } from './worker-topology'

const AUTHORITY_POLL_MS = 100

/** Plain argument modes only: AGY's interactive flag and Hermes' query plan keep their paste. */
function launchCarriesPlainPrompt(agent: TuiAgent): boolean {
  const mode = TUI_AGENT_CONFIG[agent].promptInjectionMode
  return mode === 'argv' || mode === 'flag-prompt'
}

/** The launch prompt, or undefined when this start must keep typing its brief into the pane. */
export function resolveWorkerBriefLaunchPrompt(args: {
  runtime: Pick<DolphinRuntimeService, 'getWorktreeOrchestrationCliCommand'>
  agent: TuiAgent | undefined
  params: { terminal?: string; repo?: string; devMode?: boolean }
  /** The existing worktree, or the coordinator's when this start creates one. */
  placement: { id: string; repoId?: string } | undefined
  createsWorktree: boolean
  dispatchId: string
  task: { id: string; spec: string }
}): string | undefined {
  // A created worktree lands on the coordinator's host unless --repo names another repo, whose
  // host (and so CLI name) is not known before the worktree exists.
  const sameHost =
    !args.createsWorktree ||
    args.params.repo === undefined ||
    args.params.repo === args.placement?.repoId
  if (
    args.params.terminal ||
    !args.agent ||
    !launchCarriesPlainPrompt(args.agent) ||
    !args.placement ||
    !sameHost
  ) {
    return undefined
  }
  return buildWorkerBriefLaunchPrompt({
    cli: args.params.devMode
      ? DEV_CLI_COMMAND_NAME
      : args.runtime.getWorktreeOrchestrationCliCommand(args.placement.id),
    dispatchId: args.dispatchId,
    taskId: args.task.id,
    taskSpec: args.task.spec
  })
}

/** A gated setup can start the agent terminal late; its identity is what the capability binds. */
export async function waitForWorkerAuthority(
  runtime: DolphinRuntimeService,
  terminalHandle: string,
  timeoutMs: number
): Promise<ReturnType<typeof requireWorkerAuthority>> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    try {
      return requireWorkerAuthority(runtime, terminalHandle)
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error
      }
    }
    await new Promise((resolve) => setTimeout(resolve, AUTHORITY_POLL_MS))
  }
}

export type WorkerStartupBlock = { stage: 'agent_readiness' | 'setup_wait'; error: Error }

/**
 * Resolves a failure when the new agent is held by a startup screen or its terminal exits, and
 * null otherwise. An agent busy on its launch prompt never reads idle, so a timeout is not one.
 * `onExited` lets a gated setup record its outcome from the same read, as the paste path does.
 */
export async function watchWorkerStartupBlock(args: {
  runtime: Pick<DolphinRuntimeService, 'waitForTerminal'>
  terminalHandle: string
  timeoutMs: number
  onExited: (wait: { satisfied: boolean; status: string }) => 'agent_readiness' | 'setup_wait'
}): Promise<WorkerStartupBlock | null> {
  let wait: Awaited<ReturnType<DolphinRuntimeService['waitForTerminal']>>
  try {
    wait = await args.runtime.waitForTerminal(args.terminalHandle, {
      condition: 'tui-idle',
      timeoutMs: args.timeoutMs
    })
  } catch {
    // The fetch is the readiness proof; a failed screen read only loses the early failure.
    return null
  }
  if (wait.satisfied) {
    return null
  }
  if (wait.blockedReason) {
    return {
      stage: 'agent_readiness',
      error: new Error(
        `Agent startup blocked: ${describeTerminalWaitBlockedReason(wait.blockedReason)}`
      )
    }
  }
  if (wait.status !== 'exited') {
    return null
  }
  return {
    stage: args.onExited(wait),
    error: new Error(`Agent did not become ready (${wait.status}).`)
  }
}
