import { FORK_IDENTITY } from './fork-identity'

/** The command users type on macOS and Windows. */
export const CLI_COMMAND_NAME = FORK_IDENTITY.cliCommandName
/** The command on Linux and WSL, where the bare name belongs to another package. */
export const LINUX_CLI_COMMAND_NAME = FORK_IDENTITY.linuxCliCommandName
/** The dev-build command, so a dev checkout never shadows the installed CLI. */
export const DEV_CLI_COMMAND_NAME = FORK_IDENTITY.devCliCommandName

export const CLI_COMMAND_VALUES = [
  CLI_COMMAND_NAME,
  LINUX_CLI_COMMAND_NAME,
  DEV_CLI_COMMAND_NAME
] as const

export type CliCommandName = (typeof CLI_COMMAND_VALUES)[number]

export function getCliCommandNameForPlatform(platform: NodeJS.Platform): CliCommandName {
  return platform === 'linux' ? LINUX_CLI_COMMAND_NAME : CLI_COMMAND_NAME
}

/** The file a shell resolves for the command: Windows runs the .cmd shim. */
export function getCliCommandFileNameForPlatform(platform: NodeJS.Platform): string {
  const name = getCliCommandNameForPlatform(platform)
  return platform === 'win32' ? `${name}.cmd` : name
}

export function parseCliCommandName(value: string | undefined): CliCommandName | undefined {
  return CLI_COMMAND_VALUES.find((candidate) => candidate === value)
}
