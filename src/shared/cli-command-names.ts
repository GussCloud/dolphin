import { FORK_IDENTITY } from './fork-identity'

/** The command users type on macOS and Windows. */
export const CLI_COMMAND_NAME = FORK_IDENTITY.cliCommandName
/** The command on Linux and WSL, where the bare name belongs to another package. */
export const LINUX_CLI_COMMAND_NAME = FORK_IDENTITY.linuxCliCommandName
/** The dev-build command, so a dev checkout never shadows the installed CLI. */
export const DEV_CLI_COMMAND_NAME = FORK_IDENTITY.devCliCommandName

/** Names upstream Orca installed. Only recognized for cleanup and for older peers on the wire. */
export const LEGACY_CLI_COMMAND_NAME = 'orca'
export const LEGACY_LINUX_CLI_COMMAND_NAME = 'orca-ide'
export const LEGACY_DEV_CLI_COMMAND_NAME = 'orca-dev'

export type CliCommandName =
  | typeof CLI_COMMAND_NAME
  | typeof LINUX_CLI_COMMAND_NAME
  | typeof DEV_CLI_COMMAND_NAME

export type LegacyCliCommandName =
  | typeof LEGACY_CLI_COMMAND_NAME
  | typeof LEGACY_LINUX_CLI_COMMAND_NAME
  | typeof LEGACY_DEV_CLI_COMMAND_NAME

export function getCliCommandNameForPlatform(platform: NodeJS.Platform): CliCommandName {
  return platform === 'linux' ? LINUX_CLI_COMMAND_NAME : CLI_COMMAND_NAME
}

/** The file a shell resolves for the command: Windows runs the .cmd shim. */
export function getCliCommandFileNameForPlatform(platform: NodeJS.Platform): string {
  const name = getCliCommandNameForPlatform(platform)
  return platform === 'win32' ? `${name}.cmd` : name
}

/** Maps a command name an older peer sent to the name this build installs. */
export function toCurrentCliCommandName(
  name: CliCommandName | LegacyCliCommandName
): CliCommandName {
  switch (name) {
    case LEGACY_CLI_COMMAND_NAME:
      return CLI_COMMAND_NAME
    case LEGACY_LINUX_CLI_COMMAND_NAME:
      return LINUX_CLI_COMMAND_NAME
    case LEGACY_DEV_CLI_COMMAND_NAME:
      return DEV_CLI_COMMAND_NAME
    case CLI_COMMAND_NAME:
    case LINUX_CLI_COMMAND_NAME:
      return name
  }
}

/** Values `compatibilityCliCommand` may carry: hosts accept both, clients send the legacy token. */
export const WIRE_CLI_COMMAND_VALUES = [
  LEGACY_CLI_COMMAND_NAME,
  LEGACY_LINUX_CLI_COMMAND_NAME,
  LEGACY_DEV_CLI_COMMAND_NAME,
  CLI_COMMAND_NAME,
  LINUX_CLI_COMMAND_NAME
] as const

export type WireCliCommandName = (typeof WIRE_CLI_COMMAND_VALUES)[number]

/** Why legacy on the wire: hosts that predate the rename validate this field as a closed enum. */
export function toWireCliCommandName(name: CliCommandName): LegacyCliCommandName {
  switch (name) {
    case CLI_COMMAND_NAME:
      return LEGACY_CLI_COMMAND_NAME
    case LINUX_CLI_COMMAND_NAME:
      return LEGACY_LINUX_CLI_COMMAND_NAME
    case DEV_CLI_COMMAND_NAME:
      return LEGACY_DEV_CLI_COMMAND_NAME
  }
}

export function parseCliCommandName(value: string | undefined): CliCommandName | undefined {
  const known = WIRE_CLI_COMMAND_VALUES.find((candidate) => candidate === value)
  return known ? toCurrentCliCommandName(known) : undefined
}
