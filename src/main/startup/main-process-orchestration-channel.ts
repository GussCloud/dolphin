import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { agentHookServer } from '../agent-hooks/server'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { probeLocalClaudeVersion } from '../claude/local-claude-version'
import { resolveUnpackedMainEntryPath } from '../ipc/parcel-watcher-entry-path'
import { orchestrationChannelGateway } from '../orchestration-channel/orchestration-channel-gateway'
import {
  DOLPHIN_ORCHESTRATION_CHANNEL_SERVER_NAME,
  ORCHESTRATION_CHANNEL_ENTRY_FILE_NAME,
  ORCHESTRATION_CHANNEL_PATH_PREFIX
} from '../orchestration-channel/orchestration-channel-protocol'
import type { Store } from '../persistence'
import {
  buildClaudeChannelMcpConfig,
  createClaudeChannelLaunchPolicy,
  setCoordinatorChannelLaunchPolicy,
  TELEGRAM_CHANNEL_ENTRY_FILE_NAME,
  writeClaudeChannelMcpConfig,
  type CoordinatorChannelLaunchArgs
} from '../telegram/claude-channel-launch'
import { isClaudeChannelLaunchGranted } from '../telegram/claude-channel-panes'
import { DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME } from '../telegram/telegram-channel-protocol'

function entryPath(fileName: string): string {
  return resolveUnpackedMainEntryPath(app.getAppPath(), app.isPackaged, fileName)
}

function writeCoordinatorMcpConfigs(): CoordinatorChannelLaunchArgs | null {
  // Why a home fallback: the launch line must name the file literally in every shell.
  const dirs = [
    join(app.getPath('userData'), 'orchestration-channel'),
    join(homedir(), '.dolphin', 'orchestration-channel')
  ]
  const orchestration = {
    name: DOLPHIN_ORCHESTRATION_CHANNEL_SERVER_NAME,
    entryPath: entryPath(ORCHESTRATION_CHANNEL_ENTRY_FILE_NAME)
  }
  const telegram = {
    name: DOLPHIN_TELEGRAM_CHANNEL_SERVER_NAME,
    entryPath: entryPath(TELEGRAM_CHANNEL_ENTRY_FILE_NAME)
  }
  const execPath = process.execPath
  const alone = writeClaudeChannelMcpConfig(
    dirs,
    buildClaudeChannelMcpConfig({ execPath, servers: [orchestration] }),
    'coordinator-channel-mcp.json'
  )
  if (!alone) {
    return null
  }
  // Why a second file: a server in the config but not in the channel list would run unregistered.
  const withTelegram = writeClaudeChannelMcpConfig(
    dirs,
    buildClaudeChannelMcpConfig({ execPath, servers: [orchestration, telegram] }),
    'coordinator-telegram-channel-mcp.json'
  )
  return { alone, withTelegram }
}

/**
 * Lets local goal coordinators take mailbox pointers through a Claude Code channel instead of typed
 * text: the hook-listener route its server polls, and the launch policy that opts them in.
 */
export function startMainProcessOrchestrationChannel(store: Store): void {
  agentHookServer.setChannelRouteHandler(
    orchestrationChannelGateway.handleRoute,
    isClaudeChannelLaunchGranted,
    ORCHESTRATION_CHANNEL_PATH_PREFIX
  )
  const policy = createClaudeChannelLaunchPolicy<CoordinatorChannelLaunchArgs>({
    // Why hooks: the channel server finds main through the hook env injected into the PTY.
    isEnabled: () => isAgentStatusHooksEnabled(store.getSettings()),
    probeClaudeVersion: () => probeLocalClaudeVersion(store.getSettings()),
    writeMcpConfig: writeCoordinatorMcpConfigs
  })
  setCoordinatorChannelLaunchPolicy(policy)
  // Why probe now: spawns read the cached verdict, so the first coordinator launch counts.
  if (isAgentStatusHooksEnabled(store.getSettings())) {
    void policy.refresh()
  }
  app.once('will-quit', () => {
    setCoordinatorChannelLaunchPolicy(null)
    agentHookServer.setChannelRouteHandler(null, null, ORCHESTRATION_CHANNEL_PATH_PREFIX)
    orchestrationChannelGateway.dispose()
  })
}
