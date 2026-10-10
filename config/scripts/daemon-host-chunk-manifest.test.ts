import { describe, expect, it } from 'vitest'
import {
  collectDaemonHostChunks,
  createDaemonHostChunkManifestPlugin,
  type BundleChunkNode
} from '../build-plugins/daemon-host-chunk-manifest'
import { parseDaemonHostChunkManifest } from '../../src/main/daemon/daemon-host-chunk-manifest'

function chunk(
  fileName: string,
  edges: { imports?: string[]; dynamicImports?: string[]; code?: string; entry?: string } = {}
): BundleChunkNode {
  return {
    fileName,
    imports: edges.imports ?? [],
    dynamicImports: edges.dynamicImports ?? [],
    code: edges.code ?? '',
    isEntry: edges.entry !== undefined,
    name: edges.entry ?? fileName
  }
}

const graph = [
  chunk('daemon-entry.js', {
    entry: 'daemon-entry',
    imports: ['chunks/a.js', 'node:fs', 'node-pty'],
    dynamicImports: ['chunks/lazy.js'],
    code: 'async function f(){return import(`node-pty`)}'
  }),
  chunk('chunks/a.js', { imports: ['chunks/b.js'] }),
  chunk('chunks/b.js', { imports: ['chunks/a.js'] }),
  chunk('chunks/lazy.js'),
  chunk('main-app.js', { entry: 'main-app', imports: ['chunks/a.js', 'chunks/main-only.js'] }),
  chunk('chunks/main-only.js')
]

describe('collectDaemonHostChunks', () => {
  it('lists static and dynamic chunk edges from daemon-entry, skipping externals and other entries', () => {
    expect(collectDaemonHostChunks(graph)).toEqual({
      entryFileName: 'daemon-entry.js',
      chunks: ['chunks/a.js', 'chunks/b.js', 'chunks/lazy.js']
    })
  })

  it('returns null when the bundle has no daemon entry', () => {
    expect(collectDaemonHostChunks(graph.filter((c) => c.name !== 'daemon-entry'))).toBeNull()
  })

  it('refuses a reachable non-literal import(), whose target the graph cannot list', () => {
    const withComputed = graph.map((c) =>
      c.fileName === 'chunks/b.js' ? { ...c, code: 'const m=await import(e)' } : c
    )
    expect(() => collectDaemonHostChunks(withComputed)).toThrow(/chunks\/b\.js.*non-literal import/)
    const withTemplate = graph.map((c) =>
      c.fileName === 'chunks/b.js' ? { ...c, code: 'import(`./${name}.js`)' } : c
    )
    expect(() => collectDaemonHostChunks(withTemplate)).toThrow(/non-literal import/)
  })

  it('ignores a non-literal import() in a chunk the daemon cannot reach, and method calls named import', () => {
    const unreachable = graph.map((c) =>
      c.fileName === 'chunks/main-only.js' ? { ...c, code: 'import(e)' } : c
    )
    expect(collectDaemonHostChunks(unreachable)?.chunks).toHaveLength(3)
    const method = graph.map((c) =>
      c.fileName === 'chunks/a.js' ? { ...c, code: 'loader.import(e);"x".import(y)' } : c
    )
    expect(collectDaemonHostChunks(method)?.chunks).toHaveLength(3)
  })
})

describe('createDaemonHostChunkManifestPlugin', () => {
  it('emits a manifest beside daemon-entry that the relocation reader accepts', () => {
    const plugin = createDaemonHostChunkManifestPlugin()
    const hook = plugin.generateBundle
    if (typeof hook !== 'function') {
      throw new Error('Expected generateBundle hook')
    }
    const emitted: { fileName?: string; source?: unknown }[] = []
    const bundle = Object.fromEntries(graph.map((c) => [c.fileName, { ...c, type: 'chunk' }]))
    hook.call(
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook only calls emitFile on its context.
      { emitFile: (file: { fileName?: string; source?: unknown }) => emitted.push(file) } as never,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook never reads output options.
      {} as never,
      // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the hook reads only the BundleChunkNode fields set above.
      bundle as never,
      false
    )
    expect(emitted).toHaveLength(1)
    expect(emitted[0].fileName).toBe('daemon-entry.host-chunks.json')
    expect(parseDaemonHostChunkManifest(String(emitted[0].source))).toEqual([
      'chunks/a.js',
      'chunks/b.js',
      'chunks/lazy.js'
    ])
  })
})
