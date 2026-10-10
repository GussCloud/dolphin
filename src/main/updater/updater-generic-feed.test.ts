import { describe, expect, it } from 'vitest'
import { genericReleaseFeed } from './updater-generic-feed'

const URL = 'https://github.com/GussCloud/dolphin/releases/download/v1.2.3'

describe('genericReleaseFeed', () => {
  it('leaves x64 Windows and other platforms on the default manifest', () => {
    expect(genericReleaseFeed(URL, 'win32', 'x64')).toEqual({ provider: 'generic', url: URL })
    expect(genericReleaseFeed(URL, 'linux', 'arm64')).toEqual({ provider: 'generic', url: URL })
    expect(genericReleaseFeed(URL, 'darwin', 'arm64')).toEqual({ provider: 'generic', url: URL })
  })

  it('points Windows arm64 at latest-arm64.yml', () => {
    expect(genericReleaseFeed(URL, 'win32', 'arm64')).toEqual({
      provider: 'generic',
      url: URL,
      channel: 'latest-arm64'
    })
  })
})
