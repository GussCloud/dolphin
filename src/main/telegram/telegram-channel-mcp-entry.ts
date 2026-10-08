/**
 * Plain-Node entry `claude` spawns over stdio (Electron with ELECTRON_RUN_AS_NODE) for the Dolphin
 * Telegram channel. Never import electron here: plain-node-entry-guard fails the build if it does.
 */
import { randomUUID } from 'node:crypto'
import { createInterface } from 'node:readline'
import {
  createTelegramChannelHttpHost,
  resolveTelegramChannelEndpoint
} from './telegram-channel-host-client'
import { createTelegramChannelMcpServer } from './telegram-channel-mcp-server'

const CHANNEL_SERVER_VERSION = '1.0.0'

function main(): void {
  const paneKey = process.env.DOLPHIN_PANE_KEY
  const launchToken = process.env.DOLPHIN_AGENT_LAUNCH_TOKEN
  if (!paneKey || !launchToken) {
    // Why exit: outside a Dolphin agent pane there is nowhere to route messages; /mcp shows it failed.
    process.stderr.write('dolphin-telegram channel: not running in a Dolphin agent pane\n')
    process.exit(1)
  }
  const host = createTelegramChannelHttpHost({
    session: { paneKey, sessionId: randomUUID(), launchToken },
    resolveEndpoint: () => resolveTelegramChannelEndpoint(process.env)
  })
  const server = createTelegramChannelMcpServer({
    host,
    version: CHANNEL_SERVER_VERSION,
    send: (message) => {
      process.stdout.write(`${JSON.stringify(message)}\n`)
    }
  })
  const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
  lines.on('line', (line) => {
    if (!line.trim()) {
      return
    }
    try {
      server.handleMessage(JSON.parse(line))
    } catch {
      // Malformed frames are dropped; MCP stdio has no error channel for unparsable input.
    }
  })
  lines.on('close', () => {
    void server.close().finally(() => process.exit(0))
  })
}

main()
