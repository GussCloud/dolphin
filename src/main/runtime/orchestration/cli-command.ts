import {
  CLI_COMMAND_NAME,
  type CliCommandName,
  LINUX_CLI_COMMAND_NAME
} from '../../../shared/cli-command-names'
import type { ProjectExecutionRuntimeResolution } from '../../../shared/project-execution-runtime'
import { isWslUncPath } from '../../../shared/wsl-paths'
import { splitWorktreeIdForFilesystem } from '../../../shared/worktree/id'

export type OrchestrationCliCommand = CliCommandName

export function resolveTerminalOrchestrationCliCommand(args: {
  connectionId: string | null
  isWsl: boolean | null | undefined
  worktreeId: string
  projectRuntime?: ProjectExecutionRuntimeResolution
  runtimeCliCommand?: OrchestrationCliCommand
}): OrchestrationCliCommand {
  if (args.connectionId) {
    return CLI_COMMAND_NAME
  }
  if (args.runtimeCliCommand) {
    return args.runtimeCliCommand
  }
  if (args.isWsl !== null && args.isWsl !== undefined) {
    return args.isWsl ? LINUX_CLI_COMMAND_NAME : CLI_COMMAND_NAME
  }
  if (args.projectRuntime?.status === 'resolved' && args.projectRuntime.runtime.kind === 'wsl') {
    return LINUX_CLI_COMMAND_NAME
  }

  const worktreePath = splitWorktreeIdForFilesystem(args.worktreeId)?.worktreePath
  return worktreePath && isWslUncPath(worktreePath) ? LINUX_CLI_COMMAND_NAME : CLI_COMMAND_NAME
}
