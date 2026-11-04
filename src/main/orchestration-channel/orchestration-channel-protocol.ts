/**
 * Wire contract of the orchestration channel: the Claude Code channel server a local goal
 * coordinator loads so Dolphin can hand it mailbox pointers without typing into its terminal.
 * Electron-free: the channel entry imports it.
 */
import type { ClaudeChannelServerProfile } from '../telegram/telegram-channel-mcp-server'

/** MCP server name; also the `server:<name>` the development-channels flag opts in. */
export const DOLPHIN_ORCHESTRATION_CHANNEL_SERVER_NAME = 'dolphin-orchestration'

export const ORCHESTRATION_CHANNEL_PATH_PREFIX = '/channel/orchestration/'
export const ORCHESTRATION_CHANNEL_POLL_PATH = `${ORCHESTRATION_CHANNEL_PATH_PREFIX}poll`
export const ORCHESTRATION_CHANNEL_DISCONNECT_PATH = `${ORCHESTRATION_CHANNEL_PATH_PREFIX}disconnect`

export const ORCHESTRATION_CHANNEL_ENTRY_FILE_NAME = 'orchestration-channel-mcp-entry.js'

export const ORCHESTRATION_CHANNEL_INSTRUCTIONS =
  `Messages from <channel source="${DOLPHIN_ORCHESTRATION_CHANNEL_SERVER_NAME}" ...> come from Dolphin, ` +
  'the app running this session: they announce new orchestration mail for the goal you coordinate. ' +
  'Act on them exactly as if the same line had been typed in this terminal.'

export const ORCHESTRATION_CHANNEL_PROFILE: ClaudeChannelServerProfile = {
  name: DOLPHIN_ORCHESTRATION_CHANNEL_SERVER_NAME,
  instructions: ORCHESTRATION_CHANNEL_INSTRUCTIONS,
  replyTool: false,
  relayPermissions: false
}
