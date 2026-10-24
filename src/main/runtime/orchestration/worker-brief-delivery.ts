import type { DolphinRuntimeService } from '../dolphin-runtime'
import { dispatchPreambleSendOptions } from './preamble'
import { buildWorkerBriefPointer, getWorkerBriefStore } from './worker-brief-store'
import { DEV_CLI_COMMAND_NAME } from '../../../shared/cli-command-names'

type BriefDeliveryRuntime = Pick<
  DolphinRuntimeService,
  | 'sendTerminalAgentPrompt'
  | 'getOrchestrationDispatchAuthority'
  | 'getTerminalPaneKey'
  | 'getTerminalOrchestrationCliCommand'
>

/** Types a one-line pointer into a worker's agent; the multi-line brief is fetched by `worker-brief`. */
export async function sendWorkerBriefPointer(
  runtime: BriefDeliveryRuntime,
  args: {
    terminalHandle: string
    dispatchId: string
    taskId: string
    taskSpec: string
    preamble: string
    devMode: boolean | undefined
    requestId: string
  }
): ReturnType<DolphinRuntimeService['sendTerminalAgentPrompt']> {
  const paneKey =
    runtime.getOrchestrationDispatchAuthority(args.terminalHandle)?.paneKey ??
    runtime.getTerminalPaneKey(args.terminalHandle)
  if (!paneKey) {
    // Why: without a pane identity nobody could authenticate the fetch, so keep the full paste.
    return runtime.sendTerminalAgentPrompt(
      args.terminalHandle,
      args.preamble,
      dispatchPreambleSendOptions(args.requestId)
    )
  }
  getWorkerBriefStore(runtime).hold(args.dispatchId, {
    brief: args.preamble,
    paneKey,
    taskId: args.taskId
  })
  const cli = args.devMode
    ? DEV_CLI_COMMAND_NAME
    : runtime.getTerminalOrchestrationCliCommand(args.terminalHandle)
  return runtime.sendTerminalAgentPrompt(
    args.terminalHandle,
    buildWorkerBriefPointer({
      cli,
      taskId: args.taskId,
      dispatchId: args.dispatchId,
      taskSpec: args.taskSpec
    }),
    dispatchPreambleSendOptions(args.requestId, 'brief-pointer')
  )
}
