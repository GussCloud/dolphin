import { posix } from 'node:path'
import type { Plugin, Rollup } from 'vite'
import {
  DAEMON_HOST_CHUNK_MANIFEST_NAME,
  serializeDaemonHostChunkManifest
} from '../../src/main/daemon/daemon-host-chunk-manifest'

// Why: on Windows the daemon runs from a copy of the runtime under %LOCALAPPDATA%
// (docs/reference/windows-daemon-host-relocation.md). Copying every main chunk ships
// ~6 MB the daemon never loads; this emits the chunk graph's answer to "what can
// daemon-entry reach" so the copy takes only that.

export type BundleChunkNode = Pick<
  Rollup.OutputChunk,
  'code' | 'dynamicImports' | 'fileName' | 'imports' | 'isEntry' | 'name'
>

const DAEMON_ENTRY_NAME = 'daemon-entry'

// An `import(` whose argument is not one plain string literal has no edge in the chunk graph.
const NON_LITERAL_DYNAMIC_IMPORT_RE = /(?<![.\w$])import\(\s*(?!(["'`])[^"'`$\\]*\1\s*\))/

/**
 * Chunk paths (relative to the entry's directory) reachable from daemon-entry through static
 * and dynamic imports, or null when the bundle has no daemon entry. Externals are not chunks
 * and are skipped. Throws when a reachable chunk has a non-literal import(), because then the
 * reachable set would be a guess and a missing chunk breaks terminals after an update.
 */
export function collectDaemonHostChunks(
  chunks: readonly BundleChunkNode[]
): { entryFileName: string; chunks: string[] } | null {
  const entry = chunks.find((chunk) => chunk.isEntry && chunk.name === DAEMON_ENTRY_NAME)
  if (!entry) {
    return null
  }
  const byFileName = new Map(chunks.map((chunk) => [chunk.fileName, chunk]))
  const seen = new Set<string>()
  const stack = [entry.fileName]
  while (stack.length > 0) {
    const fileName = stack.pop()
    if (fileName === undefined || seen.has(fileName)) {
      continue
    }
    const chunk = byFileName.get(fileName)
    if (!chunk) {
      continue
    }
    seen.add(fileName)
    const nonLiteral = NON_LITERAL_DYNAMIC_IMPORT_RE.exec(chunk.code)
    if (nonLiteral) {
      const at = nonLiteral.index
      throw new Error(
        `[daemon-host-chunk-manifest] "${fileName}" (reachable from ${DAEMON_ENTRY_NAME}) has a ` +
          `non-literal import(): ${JSON.stringify(chunk.code.slice(at, at + 80))}. The relocated ` +
          `Windows daemon host copies only chunks the bundle graph lists, so a target computed at ` +
          `runtime could be missing there. Import a literal specifier instead.`
      )
    }
    stack.push(...chunk.imports, ...chunk.dynamicImports)
  }
  const entryDir = posix.dirname(entry.fileName)
  return {
    entryFileName: entry.fileName,
    chunks: [...seen]
      .filter((fileName) => fileName !== entry.fileName)
      .map((fileName) => posix.relative(entryDir, fileName))
      .sort()
  }
}

export function createDaemonHostChunkManifestPlugin(): Plugin {
  return {
    name: 'dolphin-daemon-host-chunk-manifest',
    generateBundle(_options: Rollup.NormalizedOutputOptions, bundle: Rollup.OutputBundle) {
      const chunks = Object.values(bundle).filter(
        (item): item is Rollup.OutputChunk => item.type === 'chunk'
      )
      const reachable = collectDaemonHostChunks(chunks)
      if (!reachable) {
        return
      }
      this.emitFile({
        type: 'asset',
        fileName: posix.join(
          posix.dirname(reachable.entryFileName),
          DAEMON_HOST_CHUNK_MANIFEST_NAME
        ),
        source: serializeDaemonHostChunkManifest(reachable.chunks)
      })
    }
  }
}
