import { describe, expect, it } from 'vitest'
import { overlayPlatformEnv } from './platform-env-overlay'

describe('overlayPlatformEnv', () => {
  it('drops a base spelling of an overlay key on win32', () => {
    expect(
      overlayPlatformEnv({ Path: 'C:\\main', Other: 'x' }, { PATH: 'C:\\shim;C:\\pane' }, 'win32')
    ).toEqual({ Other: 'x', PATH: 'C:\\shim;C:\\pane' })
  })

  it('keeps case-distinct keys on POSIX', () => {
    expect(overlayPlatformEnv({ Path: '/decoy' }, { PATH: '/bin' }, 'linux')).toEqual({
      Path: '/decoy',
      PATH: '/bin'
    })
  })
})
