// The list of chunk files the daemon entry can load, written next to daemon-entry.js by the
// main build (config/build-plugins/daemon-host-chunk-manifest.ts) and read when the relocated
// daemon host is materialized (daemon-host-manifest.ts). Pure and dependency-free so the build
// config can import it without pulling the main-process graph.

export const DAEMON_HOST_CHUNK_MANIFEST_NAME = 'daemon-entry.host-chunks.json'

const FORMAT_VERSION = 1

export type DaemonHostChunkManifest = {
  formatVersion: typeof FORMAT_VERSION
  /** Paths relative to daemon-entry.js's directory, posix-separated, e.g. `chunks/x-abc.js`. */
  chunks: string[]
}

export function serializeDaemonHostChunkManifest(chunks: readonly string[]): string {
  const manifest: DaemonHostChunkManifest = {
    formatVersion: FORMAT_VERSION,
    chunks: [...chunks].sort()
  }
  return `${JSON.stringify(manifest, null, 2)}\n`
}

// Only plain files under chunks/: anything else could copy from outside the bundle.
function isSafeChunkPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^chunks\/[^/\\]+\.js$/.test(value) &&
    !value.includes('..') &&
    !value.includes(':')
  )
}

/** The chunk list, or null for any unreadable shape -- null means "copy every chunk". */
export function parseDaemonHostChunkManifest(text: string): readonly string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const formatVersion: unknown = Reflect.get(parsed, 'formatVersion')
  const chunks: unknown = Reflect.get(parsed, 'chunks')
  if (formatVersion !== FORMAT_VERSION || !Array.isArray(chunks)) {
    return null
  }
  const safe = chunks.filter(isSafeChunkPath)
  return safe.length === chunks.length ? safe : null
}
