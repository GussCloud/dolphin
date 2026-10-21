import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { writeFileAtomically } from '../codex-accounts/fs-utils'

/**
 * Last successful Windows profile PATH probe, so host git can start on it while the
 * next probe refreshes in the background instead of waiting up to 10s every launch.
 * Not secret and best effort: a missing or corrupt file only means one blocking probe.
 */

export const WINDOWS_SHELL_PATH_CACHE_FILE = 'windows-shell-path-cache.json'
const CACHE_SCHEME_VERSION = 1

export type PersistedShellPath = {
  load: (shellKey: string) => string[] | null
  save: (shellKey: string, segments: string[]) => void
}

function parseSegments(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) {
    return null
  }
  const segments: string[] = []
  for (const segment of value) {
    if (typeof segment !== 'string' || segment.length === 0 || segment.includes('\0')) {
      return null
    }
    segments.push(segment)
  }
  return segments
}

function parseCachedSegments(
  contents: string,
  appVersion: string,
  shellKey: string
): string[] | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(contents)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return null
  }
  const entry: Record<string, unknown> = { ...parsed }
  // Why app version: an update can change how the probe runs or what PATH it captures.
  if (
    entry.schemeVersion !== CACHE_SCHEME_VERSION ||
    entry.appVersion !== appVersion ||
    entry.shellKey !== shellKey
  ) {
    return null
  }
  return parseSegments(entry.segments)
}

export function createWindowsShellPathCache(
  userDataPath: string,
  appVersion: string
): PersistedShellPath {
  const filePath = join(userDataPath, WINDOWS_SHELL_PATH_CACHE_FILE)
  let lastWritten: string | null = null
  return {
    load: (shellKey) => {
      let contents: string
      try {
        contents = readFileSync(filePath, 'utf-8')
      } catch {
        return null
      }
      const segments = parseCachedSegments(contents, appVersion, shellKey)
      if (segments) {
        lastWritten = contents
      }
      return segments
    },
    save: (shellKey, segments) => {
      const contents = JSON.stringify({
        schemeVersion: CACHE_SCHEME_VERSION,
        appVersion,
        shellKey,
        segments
      })
      if (contents === lastWritten) {
        return
      }
      try {
        writeFileAtomically(filePath, contents)
        lastWritten = contents
      } catch {
        // Best effort: the next launch probes before git, as it did without a cache.
      }
    }
  }
}
