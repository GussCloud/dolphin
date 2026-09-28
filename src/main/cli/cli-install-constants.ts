import {
  CLI_COMMAND_NAME,
  DEV_CLI_COMMAND_NAME,
  LEGACY_CLI_COMMAND_NAME
} from '../../shared/cli-command-names'

export const DEFAULT_MAC_COMMAND_PATH = `/usr/local/bin/${CLI_COMMAND_NAME}`
export const DEV_COMMAND_NAME = DEV_CLI_COMMAND_NAME
// Why: upstream Orca once linked ~/.local/bin/orca to the packaged launcher; only that link is ours to reclaim.
export const LEGACY_LINUX_COMMAND_NAME = LEGACY_CLI_COMMAND_NAME
export const DEV_LAUNCHER_DIR = ['cli', 'bin'] as const
export const WINDOWS_PATH_WRITE_TIMEOUT_MS = 5_000
