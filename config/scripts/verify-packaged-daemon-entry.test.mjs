import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const {
  assertPackagedDaemonEntryExists,
  readPackagedDaemonHostChunks,
  verifyPackagedDaemonEntryBoots,
  verifyPackagedDaemonHostChunksBoot
} = require('./verify-packaged-daemon-entry.cjs')

describe('verify-packaged-daemon-entry', () => {
  let resourcesDir

  beforeEach(() => {
    resourcesDir = mkdtempSync(join(tmpdir(), 'dolphin-daemon-entry-verify-'))
  })

  afterEach(() => {
    rmSync(resourcesDir, { recursive: true, force: true })
  })

  function writePackagedEntry(source) {
    const entryDir = join(resourcesDir, 'app.asar.unpacked', 'out', 'main')
    mkdirSync(entryDir, { recursive: true })
    writeFileSync(join(entryDir, 'daemon-entry.js'), source)
  }

  // Why: a silent skip on a missing entry false-passed exactly the packaged
  // layout regression this gate exists to catch (rc.1 daemon-load incident).
  it('throws when the unpacked daemon entry is missing', () => {
    expect(() => assertPackagedDaemonEntryExists(resourcesDir)).toThrow(
      /missing unpacked daemon entry/
    )
    expect(() => verifyPackagedDaemonEntryBoots(resourcesDir)).toThrow(
      /missing unpacked daemon entry/
    )
  })

  it('passes when the packaged entry loads and reaches argv parsing', () => {
    writePackagedEntry('console.error("Usage: daemon-entry <socket>"); process.exit(1)\n')
    expect(() => verifyPackagedDaemonEntryBoots(resourcesDir)).not.toThrow()
  })

  it('fails when the packaged entry cannot resolve its module graph', () => {
    writePackagedEntry('require("dolphin-module-that-does-not-exist")\n')
    expect(() => verifyPackagedDaemonEntryBoots(resourcesDir)).toThrow(
      /failed to load under plain Node/
    )
  })

  it('fails when the packaged entry never reaches argv parsing', () => {
    writePackagedEntry('process.exit(0)\n')
    expect(() => verifyPackagedDaemonEntryBoots(resourcesDir)).toThrow(/did not reach argv parsing/)
  })

  describe('daemon host chunk list', () => {
    const usage = 'console.error("Usage: daemon-entry <socket>"); process.exit(1)\n'

    function writeChunks(listed, entrySource) {
      writePackagedEntry(entrySource)
      const mainDir = join(resourcesDir, 'app.asar.unpacked', 'out', 'main')
      mkdirSync(join(mainDir, 'chunks'), { recursive: true })
      writeFileSync(join(mainDir, 'chunks', 'needed.js'), 'module.exports = 1\n')
      writeFileSync(join(mainDir, 'chunks', 'unlisted.js'), 'module.exports = 2\n')
      writeFileSync(
        join(mainDir, 'daemon-entry.host-chunks.json'),
        JSON.stringify({ formatVersion: 1, chunks: listed })
      )
    }

    it('boots the entry from a copy holding only the listed chunks', () => {
      writeChunks(['chunks/needed.js'], `require('./chunks/needed.js'); ${usage}`)
      expect(readPackagedDaemonHostChunks(resourcesDir)).toEqual(['chunks/needed.js'])
      expect(() => verifyPackagedDaemonHostChunksBoot(resourcesDir)).not.toThrow()
    })

    // The relocated Windows host would be missing the chunk the same way.
    it('fails when the entry loads a chunk the list leaves out', () => {
      writeChunks([], `require('./chunks/needed.js'); ${usage}`)
      expect(() => verifyPackagedDaemonHostChunksBoot(resourcesDir)).toThrow(
        /only the 0 chunks.*failed to load/s
      )
    })

    it('fails when the list is missing or names a chunk the package lacks', () => {
      writePackagedEntry(usage)
      expect(() => readPackagedDaemonHostChunks(resourcesDir)).toThrow(/missing .*host-chunks/)
      writeChunks(['chunks/gone.js'], usage)
      expect(() => readPackagedDaemonHostChunks(resourcesDir)).toThrow(/chunks\/gone\.js/)
      writeChunks(['../daemon-entry.js'], usage)
      expect(() => readPackagedDaemonHostChunks(resourcesDir)).toThrow(/unreadable chunk list/)
    })
  })
})
