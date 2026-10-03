import { describe, expect, it } from 'vitest'
import {
  DAEMON_MAX_OLD_SPACE_ENV,
  daemonHeapCeilingExecArgv,
  resolveDaemonMaxOldSpaceMb
} from './daemon-heap-ceiling'

const GB = 1024 * 1024 * 1024

describe('resolveDaemonMaxOldSpaceMb', () => {
  it('caps large hosts at 2 GB and follows a quarter of RAM on small ones', () => {
    expect(resolveDaemonMaxOldSpaceMb({}, 32 * GB)).toBe(2048)
    expect(resolveDaemonMaxOldSpaceMb({}, 4 * GB)).toBe(1024)
    expect(resolveDaemonMaxOldSpaceMb({}, 1 * GB)).toBe(512)
  })

  it('honours an explicit override and lets it disable the flag', () => {
    expect(resolveDaemonMaxOldSpaceMb({ [DAEMON_MAX_OLD_SPACE_ENV]: '4096' }, 32 * GB)).toBe(4096)
    expect(resolveDaemonMaxOldSpaceMb({ [DAEMON_MAX_OLD_SPACE_ENV]: '0' }, 32 * GB)).toBeNull()
    expect(resolveDaemonMaxOldSpaceMb({ [DAEMON_MAX_OLD_SPACE_ENV]: 'OFF' }, 32 * GB)).toBeNull()
  })

  it('ignores overrides that are not whole megabytes at or above the floor', () => {
    for (const raw of ['128', '700.5', 'lots', '-1', '']) {
      expect(resolveDaemonMaxOldSpaceMb({ [DAEMON_MAX_OLD_SPACE_ENV]: raw }, 32 * GB)).toBe(2048)
    }
  })
})

describe('daemonHeapCeilingExecArgv', () => {
  it('emits the V8 flag for a Node/Electron launcher', () => {
    expect(daemonHeapCeilingExecArgv({}, 32 * GB, false)).toEqual(['--max-old-space-size=2048'])
  })

  it('emits nothing for a Bun launcher or a disabled ceiling', () => {
    expect(daemonHeapCeilingExecArgv({}, 32 * GB, true)).toEqual([])
    expect(
      daemonHeapCeilingExecArgv({ [DAEMON_MAX_OLD_SPACE_ENV]: 'off' }, 32 * GB, false)
    ).toEqual([])
  })
})
