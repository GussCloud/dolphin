import { app } from 'electron'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { getManagedAgentHookTarget } from '../../shared/managed-agent-hook-targets'
import { agentHookServer } from '../agent-hooks/server'
import { detectLocalManagedAgentCliPresence } from '../agent-hooks/local-agent-cli-presence'
import { isAgentStatusHooksEnabled } from '../agent-hooks/managed-agent-hook-controls'
import { probeClaudeCliVersion } from '../claude/claude-session-end-hook-capability'
import {
  broadcastTelegramBridgeState,
  setTelegramChannelAvailabilityReader
} from '../ipc/telegram-bridge'
import { resolveUnpackedMainEntryPath } from '../ipc/parcel-watcher-entry-path'
import type { Store } from '../persistence'
import {
  buildClaudeChannelMcpConfig,
  createClaudeChannelLaunchPolicy,
  setClaudeChannelLaunchPolicy,
  TELEGRAM_CHANNEL_ENTRY_FILE_NAME,
  writeClaudeChannelMcpConfig
} from '../telegram/claude-channel-launch'
import { isClaudeChannelLaunchGranted } from '../telegram/claude-channel-panes'
import type { TelegramBridgeService } from '../telegram/telegram-bridge-service'
import { TelegramChannelGateway } from '../telegram/telegram-channel-gateway'
import { createChannelApprovalButtonStripper } from '../telegram/telegram-channel-approval-fallback'
import { chainTelegramChannelInbound } from '../telegram/telegram-channel-inbound'
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

function writeMcpConfig(): string | null {
  return writeClaudeChannelMcpConfig(
    // Why a home fallback: the launch line must name the file literally in every shell, and some
    // userData paths cannot be (e.g. a `%` or `$` in the profile path).
    [
      join(app.getPath('userData'), 'telegram-channel'),
      join(homedir(), '.dolphin', 'telegram-channel')
    ],
    buildClaudeChannelMcpConfig({
      execPath: process.execPath,
      entryPath: resolveUnpackedMainEntryPath(
        app.getAppPath(),
        app.isPackaged,
        TELEGRAM_CHANNEL_ENTRY_FILE_NAME
      )
    })
  )
}

/**
 * Starts the Claude Code channel half of the bridge: hook-listener routes, the launch policy that
 * opts local Claude panes in, and its availability for the settings card. `wrapInboundHandler`
 * puts the channel ahead of the answer service; `registerAfterAnswers` adds the notice decorator
 * that must run after the answer buttons exist.
 */
export function startMainProcessTelegramChannel(
  bridge: TelegramBridgeService,
  store: Store
): {
  wrapInboundHandler: (fallback: TelegramInboundHandler) => TelegramInboundHandler
  registerAfterAnswers: () => void
} {
  const gateway = new TelegramChannelGateway(bridge, {
    attentionPaneKeys: () =>
      agentHookServer
        .getStatusSnapshot()
        .filter((row) => row.state === 'blocked' || row.state === 'waiting')
        .map((row) => row.paneKey)
  })
  agentHookServer.setChannelRouteHandler(gateway.handleRoute, isClaudeChannelLaunchGranted)
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
    writeMcpConfig
  })
  setClaudeChannelLaunchPolicy(policy)
  setTelegramChannelAvailabilityReader(() => policy.availability())
  const disposeAvailability = policy.onAvailabilityChange(broadcastTelegramBridgeState)
  // Why probe on enable: launches read the cached verdict, so the first one after turning it on counts.
  const probeIfEnabled = (): void => {
    if (isEnabled()) {
      void policy.refresh()
    }
  }
  probeIfEnabled()
  const disposeSettings = bridge.settings.onChange(probeIfEnabled)
  let disposeDecorator = (): void => {}
  app.once('will-quit', () => {
    disposeSettings()
    disposeAvailability()
    disposeDecorator()
    setTelegramChannelAvailabilityReader(null)
    setClaudeChannelLaunchPolicy(null)
    agentHookServer.setChannelRouteHandler(null)
    gateway.dispose()
  })
  return {
    wrapInboundHandler: (fallback) => chainTelegramChannelInbound(gateway, fallback),
    registerAfterAnswers: () => {
      disposeDecorator = bridge.registerNoticeDecorator(
        createChannelApprovalButtonStripper({
          gateway,
          bridge,
          readPaneStatus: (paneKey) => agentHookServer.getStatusSnapshotForPane(paneKey)[0] ?? null
        })
      )
    }
  }
}
