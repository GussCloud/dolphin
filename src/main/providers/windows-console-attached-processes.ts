import { forkProcess } from '../../shared/child-process/fork-process'

const CONPTY_PROCESS_LIST_TIMEOUT_MS = 3_000
const CONPTY_PROCESS_LIST_IDLE_MS = 30_000
const CONPTY_PROCESS_LIST_RESTART_BACKOFF_MS = 500
const CONPTY_PROCESS_LIST_MAX_RESTART_BACKOFF_MS = 30_000

type ProcessListMessage = { id?: unknown; consoleProcessList?: unknown }

/** The slice of a forked ChildProcess the pool uses. */
type ConsoleListHelper = {
  readonly pid?: number
  readonly connected: boolean
  kill: () => boolean
  send: (message: { id: number; shellPid: number }) => boolean
  on: (event: 'message' | 'error' | 'exit', listener: (value: unknown) => void) => unknown
  unref?: () => void
  channel?: { unref: () => void } | null
}

function isProcessListMessage(value: unknown): value is ProcessListMessage {
  return typeof value === 'object' && value !== null
}

export type WindowsConsoleListClientDeps = {
  forkHelper?: (modulePath: string, args: readonly string[]) => ConsoleListHelper
  resolveAgentPath?: () => string
  timeoutMs?: number
  idleMs?: number
  restartBackoffMs?: number
  maxRestartBackoffMs?: number
  now?: () => number
}

export type WindowsConsoleListClient = {
  read: (rootPid: number) => Promise<ReadonlySet<number> | null>
  dispose: () => void
}

type PendingRead = {
  id: number
  rootPid: number
  resolve: (value: ReadonlySet<number> | null) => void
  deadline: ReturnType<typeof setTimeout>
}

function resolveNodePtyConsoleListAgent(): string {
  return require.resolve('node-pty/lib/conpty_console_list_agent.js')
}

function forkConsoleListHelper(modulePath: string, args: readonly string[]): ConsoleListHelper {
  // Why: a child of this host, never of a pane, so no per-PTY job can contain or kill it.
  return forkProcess({ modulePath, args, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] })
}

function parseConsoleProcessList(
  value: unknown,
  rootPid: number,
  helperPid: number | undefined
): ReadonlySet<number> | null {
  if (
    !Array.isArray(value) ||
    helperPid === undefined ||
    !value.includes(rootPid) ||
    !value.includes(helperPid) ||
    value.some((pid) => !Number.isSafeInteger(pid) || pid <= 0)
  ) {
    return null
  }
  // Why: GetConsoleProcessList includes this helper; removing it makes a
  // root-only set authoritative shell-only evidence instead of a false child.
  const consoleProcessIds = new Set<number>(value)
  consoleProcessIds.delete(helperPid)
  return consoleProcessIds
}

/**
 * One supervised, long-lived node-pty console-list helper (`--serve` mode, added by
 * config/patches/node-pty@1.1.0.patch) serving requests one at a time, so a poll
 * costs an IPC round trip instead of a process start (#10857).
 */
export function createWindowsConsoleListClient(
  deps: WindowsConsoleListClientDeps = {}
): WindowsConsoleListClient {
  const forkHelper = deps.forkHelper ?? forkConsoleListHelper
  const timeoutMs = deps.timeoutMs ?? CONPTY_PROCESS_LIST_TIMEOUT_MS
  const idleMs = deps.idleMs ?? CONPTY_PROCESS_LIST_IDLE_MS
  const baseBackoffMs = deps.restartBackoffMs ?? CONPTY_PROCESS_LIST_RESTART_BACKOFF_MS
  const maxBackoffMs = deps.maxRestartBackoffMs ?? CONPTY_PROCESS_LIST_MAX_RESTART_BACKOFF_MS
  const now = deps.now ?? Date.now

  let helper: ConsoleListHelper | null = null
  let inFlight: PendingRead | null = null
  const queue: PendingRead[] = []
  let nextId = 1
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let consecutiveFailures = 0
  let restartBlockedUntil = 0

  const clearIdleTimer = (): void => {
    if (idleTimer) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
  }

  const killOnHostExit = (): void => {
    helper?.kill()
  }

  const stopHelper = (failed: boolean): void => {
    const current = helper
    helper = null
    clearIdleTimer()
    process.removeListener('exit', killOnHostExit)
    if (failed) {
      consecutiveFailures += 1
      const backoff = Math.min(baseBackoffMs * 2 ** (consecutiveFailures - 1), maxBackoffMs)
      restartBlockedUntil = now() + backoff
    }
    current?.kill()
  }

  const settle = (request: PendingRead, value: ReadonlySet<number> | null): void => {
    clearTimeout(request.deadline)
    request.resolve(value)
  }

  const scheduleIdleShutdown = (): void => {
    clearIdleTimer()
    idleTimer = setTimeout(() => {
      idleTimer = null
      if (!inFlight && queue.length === 0) {
        stopHelper(false)
      }
    }, idleMs)
    idleTimer.unref?.()
  }

  const ensureHelper = (): ConsoleListHelper | null => {
    if (helper?.connected) {
      return helper
    }
    if (helper) {
      stopHelper(true)
    }
    if (now() < restartBlockedUntil) {
      return null
    }
    let child: ConsoleListHelper
    try {
      child = forkHelper((deps.resolveAgentPath ?? resolveNodePtyConsoleListAgent)(), ['--serve'])
    } catch {
      stopHelper(true)
      return null
    }
    helper = child
    // Why: an idle helper must not keep the app or daemon alive; the agent exits on disconnect.
    child.unref?.()
    child.channel?.unref()
    process.on('exit', killOnHostExit)
    child.on('message', (message) => {
      if (
        helper !== child ||
        !inFlight ||
        !isProcessListMessage(message) ||
        message.id !== inFlight.id
      ) {
        return
      }
      const request = inFlight
      inFlight = null
      const result = parseConsoleProcessList(message.consoleProcessList, request.rootPid, child.pid)
      // Why any reply: a rejected list (the shell exited) still proves the helper healthy.
      consecutiveFailures = 0
      settle(request, result)
      pump()
    })
    // Why: kill and spawn failures emit asynchronously; a listener must outlive settlement.
    child.on('error', () => {
      if (helper === child) {
        onHelperGone()
      }
    })
    child.on('exit', () => {
      if (helper === child) {
        onHelperGone()
      }
    })
    return child
  }

  const onHelperGone = (): void => {
    stopHelper(true)
    const request = inFlight
    inFlight = null
    if (request) {
      settle(request, null)
    }
    pump()
  }

  const pump = (): void => {
    while (!inFlight) {
      const request = queue.shift()
      if (!request) {
        break
      }
      const child = ensureHelper()
      if (!child) {
        settle(request, null)
        continue
      }
      inFlight = request
      try {
        child.send({ id: request.id, shellPid: request.rootPid })
      } catch {
        onHelperGone()
      }
    }
    if (!inFlight && queue.length === 0 && helper) {
      scheduleIdleShutdown()
    }
  }

  return {
    read: (rootPid) => {
      if (!Number.isSafeInteger(rootPid) || rootPid <= 0) {
        return Promise.resolve(null)
      }
      clearIdleTimer()
      return new Promise((resolve) => {
        const request: PendingRead = {
          id: nextId++,
          rootPid,
          resolve,
          // Why one deadline from enqueue: a caller never waits longer than the old per-fork timeout.
          deadline: setTimeout(() => {
            if (inFlight === request) {
              inFlight = null
              stopHelper(true)
              request.resolve(null)
              pump()
              return
            }
            const index = queue.indexOf(request)
            if (index !== -1) {
              queue.splice(index, 1)
              request.resolve(null)
            }
          }, timeoutMs)
        }
        queue.push(request)
        pump()
      })
    },
    dispose: () => {
      const pending = inFlight ? [inFlight, ...queue] : [...queue]
      inFlight = null
      queue.length = 0
      stopHelper(false)
      for (const request of pending) {
        settle(request, null)
      }
    }
  }
}

let sharedClient: WindowsConsoleListClient | null = null

/**
 * Processes ATTACHED TO THIS PANE'S CONSOLE, or null when unavailable.
 *
 * Distinct from job membership on purpose. `GetConsoleProcessList` must be
 * called from a process attached to that console, and a process can hold only
 * one console at a time -- which is why node-pty answers it from a separate
 * process. One pooled helper per host process answers every pane in turn.
 *
 * Only the candidate FILTER may use this. That filter exists to drop a
 * descendant which detached from the console (`Start-Process`, a GUI child), and
 * the job object deliberately still contains those, so the job cannot answer it
 * -- see docs/windows-wsl-root-cause-plan.html, "Use B".
 */
export function readWindowsConsoleAttachedProcessIds(
  rootPid: number
): Promise<ReadonlySet<number> | null> {
  sharedClient ??= createWindowsConsoleListClient()
  return sharedClient.read(rootPid)
}
