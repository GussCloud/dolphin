import { describe, expect, it } from 'vitest'
import {
  parseDaemonHostChunkManifest,
  serializeDaemonHostChunkManifest
} from './daemon-host-chunk-manifest'

describe('daemon host chunk manifest', () => {
  it('round-trips a sorted chunk list', () => {
    const text = serializeDaemonHostChunkManifest(['chunks/b-2.js', 'chunks/a-1.js'])
    expect(parseDaemonHostChunkManifest(text)).toEqual(['chunks/a-1.js', 'chunks/b-2.js'])
  })

  it('accepts an empty list (an entry with no chunks)', () => {
    expect(parseDaemonHostChunkManifest(serializeDaemonHostChunkManifest([]))).toEqual([])
  })

  it.each([
    ['not json', 'nope'],
    ['null', 'null'],
    ['unknown format', JSON.stringify({ formatVersion: 2, chunks: [] })],
    ['chunks not an array', JSON.stringify({ formatVersion: 1, chunks: 'chunks/a.js' })],
    ['path escape', JSON.stringify({ formatVersion: 1, chunks: ['chunks/../../evil.js'] })],
    ['outside chunks/', JSON.stringify({ formatVersion: 1, chunks: ['daemon-entry.js'] })],
    ['nested dir', JSON.stringify({ formatVersion: 1, chunks: ['chunks/x/y.js'] })],
    ['backslash', JSON.stringify({ formatVersion: 1, chunks: ['chunks\\a.js'] })],
    ['drive path', JSON.stringify({ formatVersion: 1, chunks: ['chunks/C:a.js'] })],
    ['non-string', JSON.stringify({ formatVersion: 1, chunks: [1] })]
  ])('returns null (copy everything) for %s', (_label, text) => {
    expect(parseDaemonHostChunkManifest(text)).toBeNull()
  })
})
