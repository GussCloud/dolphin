import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  DOLPHIND_BUILD_TARGET_FILENAME,
  DOLPHIND_RIPGREP_ARTIFACTS,
  dolphindArtifactFilenames
} from '../../src/shared/dolphind-artifacts.ts'
import { DOLPHIND_BUN_TARGETS } from '../../src/shared/dolphind-bun-runtime.ts'
import { dolphindAgentBrowserNativeName } from '../../src/shared/dolphind-agent-browser-name.ts'
import { readDolphindArtifactIdentity } from '../../src/main/dolphind/dolphind-artifact-identity.ts'
import { computeDolphindFullVersion } from './dolphind-artifact-version.mjs'

const directories = []
afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

function createArtifactDirectory(target = '') {
  const directory = mkdtempSync(join(tmpdir(), 'dolphind-version-'))
  directories.push(directory)
  for (const filename of dolphindArtifactFilenames(target)) {
    const path = join(directory, filename)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, filename)
  }
  writeFileSync(join(directory, DOLPHIND_BUILD_TARGET_FILENAME), `${target}\n`)
  return directory
}

describe('standalone runtime version', () => {
  it('changes when a shipped search binary changes and rejects a missing binary', () => {
    const dir = createArtifactDirectory()
    const before = computeDolphindFullVersion(dir)
    const binary = join(dir, DOLPHIND_RIPGREP_ARTIFACTS[0])
    writeFileSync(binary, 'updated binary')
    expect(computeDolphindFullVersion(dir)).not.toBe(before)
    rmSync(binary)
    expect(() => computeDolphindFullVersion(dir)).toThrow(DOLPHIND_RIPGREP_ARTIFACTS[0])
  })

  it.each(DOLPHIND_BUN_TARGETS)(
    'matches the installed %s identity with and without its optional browser',
    async (target) => {
      const dir = createArtifactDirectory(target)
      const [platform, arch] = target.split('-')
      const agentBrowserFilename = dolphindAgentBrowserNativeName(
        platform,
        arch,
        target.endsWith('-musl') ? 'musl' : 'glibc'
      )
      const options = { target, agentBrowserFilename }
      const withoutBrowser = computeDolphindFullVersion(dir, options)
      expect(withoutBrowser).toBe(await readDolphindArtifactIdentity(dir))
      writeFileSync(join(dir, agentBrowserFilename), 'browser')
      const withBrowser = computeDolphindFullVersion(dir, options)
      expect(withBrowser).not.toBe(withoutBrowser)
      expect(withBrowser).toBe(await readDolphindArtifactIdentity(dir))
      writeFileSync(join(dir, agentBrowserFilename), 'updated-browser')
      expect(computeDolphindFullVersion(dir, options)).not.toBe(withBrowser)
      expect(computeDolphindFullVersion(dir, options)).toBe(await readDolphindArtifactIdentity(dir))
    }
  )
})
