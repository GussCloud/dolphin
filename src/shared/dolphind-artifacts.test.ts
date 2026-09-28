import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUNDLED_RIPGREP_PLATFORMS, bundledRipgrepBinaryName } from './bundled-ripgrep'
import {
  DOLPHIND_RIPGREP_ARTIFACTS,
  DOLPHIND_RIPGREP_LICENSE_ARTIFACTS,
  dolphindArtifactFilenames
} from './dolphind-artifacts'

describe('standalone runtime artifacts', () => {
  it('ships search binaries for every SSH host and includes them in the install identity', () => {
    const expected = BUNDLED_RIPGREP_PLATFORMS.map(
      (platform) => `ripgrep/${platform}/${bundledRipgrepBinaryName(platform)}`
    )
    expect(DOLPHIND_RIPGREP_ARTIFACTS).toEqual(expected)
    expect(dolphindArtifactFilenames()).toEqual(expect.arrayContaining(expected))
  })

  it('ships the binary redistribution notices with every install', () => {
    const sourceDir = join(__dirname, '../../resources/licenses/ripgrep')
    expect(DOLPHIND_RIPGREP_LICENSE_ARTIFACTS.map((path) => path.split('/').at(-1)).sort()).toEqual(
      readdirSync(sourceDir).sort()
    )
    expect(dolphindArtifactFilenames()).toEqual(
      expect.arrayContaining([...DOLPHIND_RIPGREP_LICENSE_ARTIFACTS])
    )
  })
})
