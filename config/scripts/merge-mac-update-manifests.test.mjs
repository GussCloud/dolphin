import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import {
  mergeMacUpdateManifests,
  serializeMacUpdateManifest
} from './merge-mac-update-manifests.mjs'

// The latest-mac.yml the v0.2.58-rc.1 release shipped, written by one two-slice electron-builder run.
const twoSliceText = readFileSync(
  join(import.meta.dirname, '__fixtures__/latest-mac-two-slice.yml'),
  'utf8'
)
const twoSlice = parse(twoSliceText)

// Reconstruction of what a one-slice run writes: only that slice's files, path naming its own zip.
function slice(arch, overrides = {}) {
  const files = twoSlice.files.filter((file) => file.url.includes('arm64') === (arch === 'arm64'))
  const zip = files.find((file) => file.url.endsWith('.zip'))
  return serializeMacUpdateManifest({
    version: twoSlice.version,
    files,
    path: zip.url,
    sha512: zip.sha512,
    releaseDate: arch === 'x64' ? '2026-11-25T08:40:01.000Z' : twoSlice.releaseDate,
    ...overrides
  })
}

describe('mergeMacUpdateManifests', () => {
  it('rebuilds exactly the manifest a two-slice run published', () => {
    expect(mergeMacUpdateManifests(slice('x64'), slice('arm64'))).toEqual(twoSlice)
  })

  it('keeps the later release date whichever slice finished last', () => {
    const late = '2026-11-25T09:00:00.000Z'
    expect(
      mergeMacUpdateManifests(slice('x64', { releaseDate: late }), slice('arm64')).releaseDate
    ).toBe(late)
  })

  it('refuses slices handed over in the wrong order', () => {
    expect(() => mergeMacUpdateManifests(slice('arm64'), slice('x64'))).toThrow(
      /x64 manifest: .* belongs to the other slice/
    )
  })

  it('refuses slices of different versions', () => {
    expect(() =>
      mergeMacUpdateManifests(slice('x64'), slice('arm64', { version: '0.2.58-rc.2' }))
    ).toThrow(/disagree on the version/)
  })

  it('refuses a slice that is missing its dmg or carries a file with no hash', () => {
    const [zip] = twoSlice.files.filter((file) => !file.url.includes('arm64'))
    expect(() => mergeMacUpdateManifests(slice('x64', { files: [zip] }), slice('arm64'))).toThrow(
      /expected one zip and one dmg/
    )
    expect(() =>
      mergeMacUpdateManifests(
        slice('x64', { files: [{ ...zip, sha512: 'abc' }, zip] }),
        slice('arm64')
      )
    ).toThrow(/malformed file entry/)
  })

  it('refuses a key it does not know rather than dropping it', () => {
    expect(() =>
      mergeMacUpdateManifests(slice('x64', { minimumSystemVersion: '12.0' }), slice('arm64'))
    ).toThrow(/unknown key\(s\) minimumSystemVersion/)
  })

  it('writes, byte for byte, the file the two-slice run published', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mac-manifest-'))
    try {
      writeFileSync(join(dir, 'x64.yml'), slice('x64'))
      writeFileSync(join(dir, 'arm64.yml'), slice('arm64'))
      execFileSync(process.execPath, [
        join(import.meta.dirname, 'merge-mac-update-manifests.mjs'),
        join(dir, 'x64.yml'),
        join(dir, 'arm64.yml'),
        join(dir, 'latest-mac.yml')
      ])
      // Why bytes, not a parse: an unquoted releaseDate parses fine here but becomes a Date in
      // the updater's js-yaml, and a folded sha512 is not what electron-builder writes.
      expect(readFileSync(join(dir, 'latest-mac.yml'), 'utf8')).toBe(twoSliceText)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
