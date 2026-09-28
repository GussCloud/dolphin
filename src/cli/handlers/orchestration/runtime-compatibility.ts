import {
  getCliCommandNameForPlatform,
  LEGACY_CLI_COMMAND_NAME,
  LEGACY_LINUX_CLI_COMMAND_NAME,
  type LegacyCliCommandName,
  parseCliCommandName,
  toWireCliCommandName
} from '../../../shared/cli-command-names'
import { FORK_IDENTITY } from '../../../shared/fork-identity'
import { RuntimeClientError } from '../../runtime-client'

/** The command this CLI was launched as, in the legacy token hosts of every age accept. */
export function resolveCompatibilityCliCommand(): LegacyCliCommandName {
  const configured = parseCliCommandName(process.env.ORCA_CLI_COMMAND)
  return toWireCliCommandName(configured ?? getCliCommandNameForPlatform(process.platform))
}

export function resolvePackagedWindowsCompatibilityCommand():
  | typeof LEGACY_CLI_COMMAND_NAME
  | typeof LEGACY_LINUX_CLI_COMMAND_NAME
  | undefined {
  if (process.env.ORCA_WINDOWS_PACKAGED_CLI_LAUNCHER !== '1') {
    return undefined
  }
  const command = parseCliCommandName(process.env.ORCA_CLI_COMMAND)
  const wire = command ? toWireCliCommandName(command) : undefined
  if (wire === LEGACY_CLI_COMMAND_NAME || wire === LEGACY_LINUX_CLI_COMMAND_NAME) {
    return wire
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
    process.env.ORCA_DEV_CLI_INVOCATION === '1' ||
    (process.env.ORCA_USER_DATA_PATH?.includes('orca-dev') ?? false)
  )
}
