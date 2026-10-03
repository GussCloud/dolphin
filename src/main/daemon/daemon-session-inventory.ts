import { DaemonPtyRouter } from './daemon-pty-router'
import { DegradedDaemonPtyProvider } from './degraded-daemon-pty-provider'
import type { DaemonPtyAdapter } from './daemon-pty-adapter'
import { getDaemonProvider } from './daemon-init'
import { getCurrentDaemonAdapter } from './daemon-provider-routing'
import type { DaemonEndpointIdentity } from './daemon-hello-protocol'
import type { DaemonSessionInfo } from './types'
import type { DaemonHeapUsage } from './daemon-heap-usage'

export function getDaemonAdapters(): DaemonPtyAdapter[] {
  const provider = getDaemonProvider()
  if (!provider) {
    return []
  }
  if (provider instanceof DaemonPtyRouter || provider instanceof DegradedDaemonPtyProvider) {
    return [...provider.getAllAdapters()]
  }
  return [provider]
}

// Why: surface degraded mode (daemon alive but cannot spawn fresh PTYs) so the UI can warn new terminals lack persistence.
export function isDaemonDegraded(): boolean {
  const provider = getDaemonProvider()
  return (
    provider instanceof DegradedDaemonPtyProvider &&
    provider.routesFreshSpawnsToLocalProvider === true
  )
}

// Why the current adapter only: evidence is keyed to the daemon now spawning terminals, so a
// legacy adapter's daemon must never satisfy the identity match that keeps the notice up.
export function readCurrentDaemonIdentity(): DaemonEndpointIdentity | null {
  const provider = getDaemonProvider()
  return provider ? getCurrentDaemonAdapter(provider).getDaemonIdentity() : null
}

/** The daemon now spawning terminals reports its own heap; null when absent or too old. */
export async function readCurrentDaemonHeapUsage(): Promise<DaemonHeapUsage | null> {
  const provider = getDaemonProvider()
  return provider ? await getCurrentDaemonAdapter(provider).readHeapUsage() : null
}

export type DaemonSessionInventory = { sessions: DaemonSessionInfo[]; complete: boolean }

/** Null when no daemon provider exists; `complete` is false when any adapter failed to answer. */
export async function listDaemonSessionInventory(): Promise<DaemonSessionInventory | null> {
  if (!getDaemonProvider()) {
    return null
  }
  return await collectDaemonSessionInventory(getDaemonAdapters())
}

export async function collectDaemonSessions(
  adapters: DaemonPtyAdapter[]
): Promise<DaemonSessionInfo[]> {
  return (await collectDaemonSessionInventory(adapters)).sessions
}

async function collectDaemonSessionInventory(
  adapters: DaemonPtyAdapter[]
): Promise<DaemonSessionInventory> {
  const results = await Promise.allSettled(
    adapters.map(async (adapter) => {
      const sessions = await adapter.listSessions()
      return sessions.map<DaemonSessionInfo>((s) => ({
        ...s,
        protocolVersion: adapter.protocolVersion
      }))
    })
  )
  return {
    sessions: results.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    complete: results.every((r) => r.status === 'fulfilled')
  }
}
