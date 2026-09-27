import { describe, expect, it } from 'vitest'
import { findSessionInconsistencies, probeLocalPid } from './session-inconsistencies'

const alive = () => 'live' as const

describe('findSessionInconsistencies', () => {
  it('reports nothing when main and the daemon agree', () => {
    expect(
      findSessionInconsistencies({
        registered: [{ ptyId: 'a', pid: 1 }],
        daemonSessions: [{ sessionId: 'a', pid: 1, isAlive: true }],
        expectRegisteredInDaemon: true,
        probePid: alive
      })
    ).toEqual([])
  })

  it('flags a tracked PTY whose root exited, without a second finding for it', () => {
    expect(
      findSessionInconsistencies({
        registered: [{ ptyId: 'a', pid: 1 }],
        daemonSessions: [],
        expectRegisteredInDaemon: true,
        probePid: () => 'exited'
      })
    ).toEqual([{ kind: 'registered-pty-exited', sessionId: 'a', pid: 1 }])
  })

  it('never treats an unverifiable probe as death', () => {
    expect(
      findSessionInconsistencies({
        registered: [{ ptyId: 'a', pid: 1 }],
        daemonSessions: null,
        expectRegisteredInDaemon: true,
        probePid: () => 'unverifiable'
      })
    ).toEqual([])
  })

  it('cross-checks both directions against a complete daemon inventory', () => {
    expect(
      findSessionInconsistencies({
        registered: [{ ptyId: 'tracked-only', pid: 2 }],
        daemonSessions: [
          { sessionId: 'daemon-only', pid: 3, isAlive: true },
          { sessionId: 'exited', pid: null, isAlive: false }
        ],
        expectRegisteredInDaemon: true,
        probePid: alive
      })
    ).toEqual([
      { kind: 'registered-pty-missing-from-daemon', sessionId: 'tracked-only', pid: 2 },
      { kind: 'daemon-session-untracked', sessionId: 'daemon-only', pid: 3 }
    ])
  })

  it('withholds daemon cross-checks when the inventory is incomplete', () => {
    expect(
      findSessionInconsistencies({
        registered: [{ ptyId: 'a', pid: 1 }],
        daemonSessions: null,
        expectRegisteredInDaemon: true,
        probePid: alive
      })
    ).toEqual([])
  })

  it('does not expect PTYs in the daemon while degraded', () => {
    expect(
      findSessionInconsistencies({
        registered: [{ ptyId: 'local', pid: 1 }],
        daemonSessions: [],
        expectRegisteredInDaemon: false,
        probePid: alive
      })
    ).toEqual([])
  })
})

describe('probeLocalPid', () => {
  it('reads this process as live', () => {
    expect(probeLocalPid(process.pid)).toBe('live')
  })
})
