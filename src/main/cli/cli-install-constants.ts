import { CLI_COMMAND_NAME, DEV_CLI_COMMAND_NAME } from '../../shared/cli-command-names'

export const DEFAULT_MAC_COMMAND_PATH = `/usr/local/bin/${CLI_COMMAND_NAME}`
export const DEV_COMMAND_NAME = DEV_CLI_COMMAND_NAME
// Why: the bare name belongs to KDE Dolphin on Linux; a link to our launcher there is ours to reclaim.
export const LEGACY_LINUX_COMMAND_NAME = CLI_COMMAND_NAME
export const DEV_LAUNCHER_DIR = ['cli', 'bin'] as const
export const WINDOWS_PATH_WRITE_TIMEOUT_MS = 5_000
