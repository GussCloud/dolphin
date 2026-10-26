import { describe, expect, it, vi } from 'vitest'
import {
  CLOSED_PANE_REAP_GRACE_MS,
  createClosedPaneAgentReaper,
  parseNetstatClientPid,
  resolveOrphanAgentRoot
} from './closed-pane-agent-reaper'

const OWN_PID = 900
const DAEMON = { pid: 50, ppid: 4, name: 'Dolphin.exe', creationTimeMs: 1_000 }
// An escaped teammate: its pane shell (pid 60) is gone, so node.exe's ppid names nothing.
const ORPHAN_CHAIN = [
  { pid: 70, ppid: 60, name: 'node.exe', creationTimeMs: 2_000 },
  { pid: 80, ppid: 70, name: 'bash.exe', creationTimeMs: 3_000 },
  { pid: 81, ppid: 80, name: 'cmd.exe', creationTimeMs: 3_001 },
  { pid: 82, ppid: 81, name: 'curl.exe', creationTimeMs: 3_002 }
]

const NETSTAT = [
  '  Proto  Local Address          Foreign Address        State           PID',
  '  TCP    127.0.0.1:51000        127.0.0.1:4100         ESTABLISHED     12',
  '  TCP    127.0.0.1:51234        127.0.0.1:4100         ESTABLISHED     82',
  '  TCP    127.0.0.1:4100         127.0.0.1:51234        ESTABLISHED     900'
].join('\r\n')

describe('parseNetstatClientPid', () => {
  it('names the client side of the exact loopback connection', () => {
    expect(parseNetstatClientPid(NETSTAT, 51234, 4100)).toBe(82)
    expect(parseNetstatClientPid(NETSTAT, 4100, 51234)).toBe(900)
    expect(parseNetstatClientPid(NETSTAT, 51235, 4100)).toBeNull()
  })
})

describe('resolveOrphanAgentRoot', () => {
  it('returns the agent at the top of a chain whose parent is gone', () => {
    expect(resolveOrphanAgentRoot(ORPHAN_CHAIN, 82, OWN_PID)).toEqual({
      pid: 70,
      creationTimeMs: 2_000,
      name: 'node.exe'
    })
  })

  it('treats a parent pid recycled after the child started as gone', () => {
    const recycled = { pid: 60, ppid: 4, name: 'svchost.exe', creationTimeMs: 9_000 }
    expect(resolveOrphanAgentRoot([...ORPHAN_CHAIN, recycled], 82, OWN_PID)?.pid).toBe(70)
  })

  it('refuses a tree a live non-agent process still owns', () => {
    const liveShell = { pid: 60, ppid: 50, name: 'bash.exe', creationTimeMs: 1_500 }
    expect(resolveOrphanAgentRoot([DAEMON, liveShell, ...ORPHAN_CHAIN], 82, OWN_PID)).toBeNull()
    const pwsh = { pid: 60, ppid: 50, name: 'pwsh.exe', creationTimeMs: 1_500 }
    expect(resolveOrphanAgentRoot([DAEMON, pwsh, ...ORPHAN_CHAIN], 82, OWN_PID)).toBeNull()
  })

  it('refuses a chain without an agent, without creation times, or through Dolphin itself', () => {
    expect(resolveOrphanAgentRoot(ORPHAN_CHAIN.slice(1), 82, OWN_PID)).toBeNull()
    const untimed = ORPHAN_CHAIN.map((row) => ({ ...row, creationTimeMs: undefined }))
    expect(resolveOrphanAgentRoot(untimed, 82, OWN_PID)).toBeNull()
    expect(resolveOrphanAgentRoot(ORPHAN_CHAIN, 82, 70)).toBeNull()
    expect(resolveOrphanAgentRoot(ORPHAN_CHAIN, 404, OWN_PID)).toBeNull()
  })
})

describe('createClosedPaneAgentReaper', () => {
  function setup() {
    let now = 10_000
    const terminateTree = vi.fn(async () => true)
    const onReaped = vi.fn()
    const readNetstat = vi.fn(async () => NETSTAT)
    const reaper = createClosedPaneAgentReaper({
      now: () => now,
      ownPid: OWN_PID,
      readNetstat,
      readTable: async () => ORPHAN_CHAIN,
      terminateTree,
      onReaped
    })
    const post = () =>
      reaper.onClosedPaneHook({ paneKey: 'tab:leaf', clientPort: 51234, serverPort: 4100 })
    return {
      post,
      readNetstat,
      terminateTree,
      onReaped,
      advance: (ms: number) => {
        now += ms
      }
    }
  }

  it('stops the agent only once its pane has stayed closed past the grace period', async () => {
    const harness = setup()
    await harness.post()
    harness.advance(CLOSED_PANE_REAP_GRACE_MS - 1)
    await harness.post()
    expect(harness.readNetstat).not.toHaveBeenCalled()

    harness.advance(1)
    await harness.post()
    await vi.waitFor(() => expect(harness.onReaped).toHaveBeenCalledTimes(1))
    expect(harness.terminateTree).toHaveBeenCalledWith({
      pid: 70,
      creationTimeMs: 2_000,
      name: 'node.exe'
    })
    expect(harness.onReaped).toHaveBeenCalledWith({
      paneKey: 'tab:leaf',
      root: { pid: 70, creationTimeMs: 2_000, name: 'node.exe' }
    })
  })

  it('reports nothing when the stop could not be proven', async () => {
    const harness = setup()
    harness.terminateTree.mockResolvedValue(false)
    await harness.post()
    harness.advance(CLOSED_PANE_REAP_GRACE_MS)
    await harness.post()
    await vi.waitFor(() => expect(harness.terminateTree).toHaveBeenCalledTimes(1))
    expect(harness.onReaped).not.toHaveBeenCalled()
  })
})
