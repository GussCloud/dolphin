import { app } from 'electron'
import { join } from 'node:path'
import { getManagedAgentHookTarget } from '../../shared/managed-agent-hook-targets'
import { agentHookServer } from '../agent-hooks/server'
import { detectLocalManagedAgentCliPresence } from '../agent-hooks/local-agent-cli-presence'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { probeClaudeCliVersion } from '../claude/claude-session-end-hook-capability'
import { resolveUnpackedMainEntryPath } from '../ipc/parcel-watcher-entry-path'
import type { Store } from '../persistence'
import {
  buildClaudeChannelMcpConfig,
  createClaudeChannelLaunchPolicy,
  setClaudeChannelLaunchPolicy,
  TELEGRAM_CHANNEL_ENTRY_FILE_NAME,
  writeClaudeChannelMcpConfigFile
} from '../telegram/claude-channel-launch'
import type { TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { TelegramChannelGateway } from '../telegram/telegram-channel-gateway'
import {
  chainTelegramChannelInbound,
  createChannelPermissionNoticeFilter
} from '../telegram/telegram-channel-inbound'
import type { TelegramInboundHandler } from '../telegram/telegram-inbound'

async function probeLocalClaudeVersion(store: Store): Promise<string | null> {
  const target = getManagedAgentHookTarget('claude')
  if (!target) {
    return null
  }
  const presence = await detectLocalManagedAgentCliPresence([target], store.getSettings())
  const found = presence.claude
  return found?.state === 'found' && found.executablePath
    ? probeClaudeCliVersion(found.executablePath)
    : null
}

/**
 * Starts the Claude Code channel half of the bridge: hook-listener routes, the launch policy that
 * opts local Claude panes in, and the permission-notice filter. Returns the inbound wrapper the
 * answer service registers through, so the channel answers before the terminal fallback.
 */
export function startMainProcessTelegramChannel(
  bridge: TelegramBridgeService,
  store: Store
): { wrapInboundHandler: (fallback: TelegramInboundHandler) => TelegramInboundHandler } {
  const gateway = new TelegramChannelGateway(bridge)
  agentHookServer.setChannelRouteHandler(gateway.handleRoute)
  const isEnabled = (): boolean => {
    const snapshot = bridge.settings.getSnapshot()
    // Why hooks too: the channel server finds main through the hook env injected into the PTY.
    return (
      snapshot.enabled && snapshot.channelsEnabled && isAgentStatusHooksEnabled(store.getSettings())
    )
  }
  const policy = createClaudeChannelLaunchPolicy({
    isEnabled,
    probeClaudeVersion: () => probeLocalClaudeVersion(store),
    writeMcpConfig: () =>
      writeClaudeChannelMcpConfigFile(
        join(app.getPath('userData'), 'telegram-channel'),
        buildClaudeChannelMcpConfig({
          execPath: process.execPath,
          entryPath: resolveUnpackedMainEntryPath(
            app.getAppPath(),
            app.isPackaged,
            TELEGRAM_CHANNEL_ENTRY_FILE_NAME
          )
        })
      )
  })
  setClaudeChannelLaunchPolicy(policy)
  // Why probe on enable: launches read the cached verdict, so the first one after turning it on counts.
  const probeIfEnabled = (): void => {
    if (isEnabled()) {
      void policy.refresh()
    }
  }
  probeIfEnabled()
  const disposeSettings = bridge.settings.onChange(probeIfEnabled)
  const disposeFilter = bridge.registerNoticeFilter(createChannelPermissionNoticeFilter(gateway))
  app.once('will-quit', () => {
    disposeSettings()
    disposeFilter()
    setClaudeChannelLaunchPolicy(null)
    agentHookServer.setChannelRouteHandler(null)
    gateway.dispose()
  })
  return { wrapInboundHandler: (fallback) => chainTelegramChannelInbound(gateway, fallback) }
}
