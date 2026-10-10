import { describe, expect, it } from 'vitest'
import {
  findInstallerAssetName,
  getUpdateChannelForTarget,
  hasInstallableArtifactForPlatform
} from './release-channel'

const BOTH_WINDOWS_ARCHES = [
  'dolphin-windows-setup.exe',
  'dolphin-windows-setup.exe.blockmap',
  'latest.yml',
  'dolphin-windows-setup-arm64.exe',
  'dolphin-windows-setup-arm64.exe.blockmap',
  'latest-arm64.yml'
]
const X64_ONLY = ['dolphin-windows-setup.exe', 'latest.yml']

describe('Windows arm64 release assets', () => {
  it('keeps x64 on the default channel and gives arm64 its own', () => {
    expect(getUpdateChannelForTarget('win32', 'x64')).toBeNull()
    expect(getUpdateChannelForTarget('win32', 'arm64')).toBe('latest-arm64')
    expect(getUpdateChannelForTarget('linux', 'arm64')).toBeNull()
    expect(getUpdateChannelForTarget('darwin', 'arm64')).toBeNull()
  })

  it('picks the installer matching the running arch', () => {
    expect(findInstallerAssetName('win32', BOTH_WINDOWS_ARCHES, 'x64')).toBe(
      'dolphin-windows-setup.exe'
    )
    expect(findInstallerAssetName('win32', BOTH_WINDOWS_ARCHES)).toBe('dolphin-windows-setup.exe')
    expect(findInstallerAssetName('win32', BOTH_WINDOWS_ARCHES, 'arm64')).toBe(
      'dolphin-windows-setup-arm64.exe'
    )
    expect(findInstallerAssetName('win32', X64_ONLY, 'arm64')).toBeNull()
  })

  it('hides x64-only releases from arm64 installs', () => {
    expect(hasInstallableArtifactForPlatform('win32', X64_ONLY, 'x64')).toBe(true)
    expect(hasInstallableArtifactForPlatform('win32', X64_ONLY, 'arm64')).toBe(false)
    expect(hasInstallableArtifactForPlatform('win32', BOTH_WINDOWS_ARCHES, 'arm64')).toBe(true)
    expect(hasInstallableArtifactForPlatform('win32', ['latest-arm64.yml'], 'x64')).toBe(false)
  })
})
