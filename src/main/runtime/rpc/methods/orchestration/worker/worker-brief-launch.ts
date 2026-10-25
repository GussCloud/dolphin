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
import { agentPromptRidesLaunchCommand } from '../../../../../../shared/tui-agent-startup'
import type { DolphinRuntimeService } from '../../../../dolphin-runtime'
import { buildWorkerBriefLaunchPrompt } from '../../../../orchestration/worker-brief-store'
import { requireWorkerAuthority } from './worker-topology'

const AUTHORITY_POLL_MS = 100

/** The launch prompt, or undefined when this start must keep typing its brief into the pane. */
export function resolveWorkerBriefLaunchPrompt(args: {
  runtime: Pick<DolphinRuntimeService, 'getWorktreeOrchestrationCliCommand'>
  agent: TuiAgent | undefined
  /** A reused terminal already runs its agent; only a terminal this start creates can carry it. */
  reusesTerminal: boolean
  /** Names the host the new terminal runs on; undefined when it cannot be known beforehand. */
  cliWorktreeId: string | undefined
  devMode: boolean | undefined
  dispatchId: string
  taskId: string
  taskSpec: string
}): string | undefined {
  if (
    args.reusesTerminal ||
    !args.agent ||
    !agentPromptRidesLaunchCommand(args.agent) ||
    !args.cliWorktreeId
  ) {
    return undefined
  }
  return buildWorkerBriefLaunchPrompt({
    cli: args.devMode
      ? DEV_CLI_COMMAND_NAME
      : args.runtime.getWorktreeOrchestrationCliCommand(args.cliWorktreeId),
    dispatchId: args.dispatchId,
    taskId: args.taskId,
    taskSpec: args.taskSpec
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
