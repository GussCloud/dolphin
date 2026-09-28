import {
  CLI_COMMAND_NAME,
  type CliCommandName,
  getCliCommandNameForPlatform,
  LINUX_CLI_COMMAND_NAME,
  parseCliCommandName
} from '../../../shared/cli-command-names'
import { FORK_IDENTITY } from '../../../shared/fork-identity'
import { RuntimeClientError } from '../../runtime-client'

/** The command this CLI was launched as. */
export function resolveCompatibilityCliCommand(): CliCommandName {
  return (
    parseCliCommandName(process.env.DOLPHIN_CLI_COMMAND) ??
    getCliCommandNameForPlatform(process.platform)
  )
}

export function resolvePackagedWindowsCompatibilityCommand():
  | typeof CLI_COMMAND_NAME
  | typeof LINUX_CLI_COMMAND_NAME
  | undefined {
  if (process.env.DOLPHIN_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = parseCliCommandName(process.env.DOLPHIN_CLI_COMMAND)
  if (command === CLI_COMMAND_NAME || command === LINUX_CLI_COMMAND_NAME) {
    return command
  }
  throw new RuntimeClientError(
    'invalid_argument',
    `The packaged ${FORK_IDENTITY.productName} launcher did not provide a valid resume command. No question was created.`
  )
}

export async function flushOrchestrationStdout(): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    process.stdout.write('', (error) => {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    })
  })
}

export function isDevCliInvocation(): boolean {
  return (
    process.env.DOLPHIN_DEV_CLI_INVOCATION === '1' ||
    (process.env.DOLPHIN_USER_DATA_PATH?.includes('dolphin-dev') ?? false)
  )
}
