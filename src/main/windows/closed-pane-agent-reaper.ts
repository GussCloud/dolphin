import type { WindowsProcessIdentityRow } from './windows-process-table-flag-sets'
import type { WindowsProcessIdentity } from '../windows-descendant-exit-verification'

/** A closed pane must stay closed this long before its agent counts as orphaned. */
export const CLOSED_PANE_REAP_GRACE_MS = 60_000
const MAX_TRACKED_PANES = 500
const MAX_ANCESTOR_DEPTH = 8

// Why an allowlist: the walk climbs from the hook's curl.exe, and any other live ancestor
// (Dolphin.exe, pwsh, mintty, explorer) means a live owner still holds the tree.
const HOOK_CHAIN_IMAGE_NAMES = new Set([
  'curl.exe',
  'cmd.exe',
  'bash.exe',
  'sh.exe',
  'node.exe',
  'claude.exe',
  'codex.exe'
])
const AGENT_IMAGE_NAMES = new Set(['node.exe', 'claude.exe', 'codex.exe'])

export type OrphanAgentRoot = WindowsProcessIdentity & { name: string }

/** The pid netstat lists for a loopback connection `clientPort` -> `serverPort`. */
export function parseNetstatClientPid(
  stdout: string,
  clientPort: number,
  serverPort: number
): number | null {
  const pattern = new RegExp(
    String.raw`^\s*TCP\s+127\.0\.0\.1:${clientPort}\s+127\.0\.0\.1:${serverPort}\s+\S+\s+(\d+)\s*$`,
    'i'
  )
  for (const line of stdout.split(/\r?\n/)) {
    const match = pattern.exec(line)
    if (match) {
      return Number(match[1])
    }
  }
  return null
}

/**
 * The top of the hook's process chain when nothing alive owns it: every ancestor up to it
 * is a shell, curl or agent image, and its own parent is gone (absent, or a recycled pid
 * younger than it). Null whenever any link cannot be proven.
 */
export function resolveOrphanAgentRoot(
  rows: readonly WindowsProcessIdentityRow[],
  hookPid: number,
  ownPid: number
): OrphanAgentRoot | null {
  const byPid = new Map(rows.map((row) => [row.pid, row]))
  let current = byPid.get(hookPid)
  let sawAgent = false
  for (let depth = 0; current && depth < MAX_ANCESTOR_DEPTH; depth += 1) {
    const name = current.name.toLowerCase()
    if (
      current.pid === ownPid ||
      typeof current.creationTimeMs !== 'number' ||
      !HOOK_CHAIN_IMAGE_NAMES.has(name)
    ) {
      return null
    }
    sawAgent ||= AGENT_IMAGE_NAMES.has(name)
    const parent = byPid.get(current.ppid)
    const parentGone =
      !parent ||
      (typeof parent.creationTimeMs === 'number' && parent.creationTimeMs > current.creationTimeMs)
    if (parentGone) {
      return sawAgent ? { pid: current.pid, creationTimeMs: current.creationTimeMs, name } : null
    }
    current = parent
  }
  return null
}

export type ClosedPaneAgentReaperDeps = {
  now?: () => number
  ownPid?: number
  readNetstat: () => Promise<string | null>
  readTable: () => Promise<readonly WindowsProcessIdentityRow[]>
  /** Revalidates the identity and kills the tree; false when it could not. */
  terminateTree: (root: OrphanAgentRoot) => Promise<boolean>
  onReaped: (event: { paneKey: string; root: OrphanAgentRoot }) => void
}

export type ClosedPaneHookEvent = { paneKey: string; clientPort?: number; serverPort: number }

/**
 * Stops an agent that keeps posting hooks for a pane Dolphin already closed. Resolves once
 * the hook's connection is read, so the caller can hold the request open until then.
 */
export function createClosedPaneAgentReaper(deps: ClosedPaneAgentReaperDeps): {
  onClosedPaneHook: (event: ClosedPaneHookEvent) => Promise<void>
} {
  const now = deps.now ?? Date.now
  const firstSeenAtByPane = new Map<string, number>()
  const inFlight = new Set<string>()

  const onClosedPaneHook = async (event: ClosedPaneHookEvent): Promise<void> => {
    const seenAt = firstSeenAtByPane.get(event.paneKey)
    if (seenAt === undefined) {
      if (firstSeenAtByPane.size >= MAX_TRACKED_PANES) {
        firstSeenAtByPane.delete(firstSeenAtByPane.keys().next().value ?? '')
      }
      firstSeenAtByPane.set(event.paneKey, now())
      return
    }
    if (now() - seenAt < CLOSED_PANE_REAP_GRACE_MS || inFlight.has(event.paneKey)) {
      return
    }
    if (!event.clientPort) {
      return
    }
    inFlight.add(event.paneKey)
    try {
      // Why read netstat before responding: the hook's curl owns this connection only while
      // the request is open, and its live parent links are what name the agent.
      const netstat = await deps.readNetstat().catch(() => null)
      const hookPid = netstat
        ? parseNetstatClientPid(netstat, event.clientPort, event.serverPort)
        : null
      const table = hookPid ? await deps.readTable().catch(() => null) : null
      const root =
        table && hookPid ? resolveOrphanAgentRoot(table, hookPid, deps.ownPid ?? process.pid) : null
      if (!root) {
        inFlight.delete(event.paneKey)
        return
      }
      void deps
        .terminateTree(root)
        .then((terminated) => {
          if (terminated) {
            firstSeenAtByPane.delete(event.paneKey)
            deps.onReaped({ paneKey: event.paneKey, root })
          }
        })
        .catch((error: unknown) => console.warn('[closed-pane-reaper] stop failed', error))
        .finally(() => inFlight.delete(event.paneKey))
    } catch (error) {
      inFlight.delete(event.paneKey)
      throw error
    }
  }

  return { onClosedPaneHook }
}
