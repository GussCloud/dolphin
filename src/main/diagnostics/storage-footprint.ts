import { lstat, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  StorageFootprint,
  StorageFootprintEntry,
  StorageFootprintKind
} from '../../shared/runtime-diagnostics-types'

// Why a cap: a runaway history tree is exactly what this measures, so the walk must stay bounded.
const MAX_ENTRIES_PER_ROOT = 200_000

export type StorageFootprintRoot = { kind: StorageFootprintKind; path: string }

export function listStorageFootprintRoots(userDataPath: string): StorageFootprintRoot[] {
  return [
    { kind: 'terminal-history', path: join(userDataPath, 'terminal-history') },
    { kind: 'terminal-history-wsl', path: join(userDataPath, 'terminal-history-wsl') },
    { kind: 'codex-runtime-home', path: join(userDataPath, 'codex-runtime-home') },
    { kind: 'codex-accounts', path: join(userDataPath, 'codex-accounts') },
    { kind: 'logs', path: join(userDataPath, 'logs') }
  ]
}

export async function measureStorageFootprint(
  roots: readonly StorageFootprintRoot[],
  maxEntriesPerRoot = MAX_ENTRIES_PER_ROOT
): Promise<StorageFootprint> {
  // Why shared across roots: Codex homes hardlink the same rollout files, which must count once.
  const seenInodes = new Set<string>()
  const entries: StorageFootprintEntry[] = []
  for (const root of roots) {
    entries.push(await measureRoot(root, seenInodes, maxEntriesPerRoot))
  }
  return {
    entries,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0)
  }
}

async function measureRoot(
  root: StorageFootprintRoot,
  seenInodes: Set<string>,
  maxEntries: number
): Promise<StorageFootprintEntry> {
  const result: StorageFootprintEntry = {
    kind: root.kind,
    path: root.path,
    exists: false,
    bytes: 0,
    fileCount: 0,
    topLevelEntryCount: 0,
    truncated: false
  }
  let visited = 0
  const stack = [root.path]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) {
      break
    }
    if (visited >= maxEntries) {
      result.truncated = true
      break
    }
    visited += 1
    let stats: Awaited<ReturnType<typeof lstat>>
    try {
      stats = await lstat(current)
    } catch {
      continue
    }
    if (current === root.path) {
      result.exists = true
    }
    // Why lstat and no follow: a symlink into ~/.codex must not bill the user's own sessions to Orca.
    if (stats.isDirectory()) {
      let names: string[]
      try {
        names = await readdir(current)
      } catch {
        continue
      }
      if (current === root.path) {
        result.topLevelEntryCount = names.length
      }
      for (const name of names) {
        stack.push(join(current, name))
      }
      continue
    }
    if (!stats.isFile()) {
      continue
    }
    const inodeKey = `${stats.dev}:${stats.ino}`
    if (stats.nlink > 1 && stats.ino !== 0) {
      if (seenInodes.has(inodeKey)) {
        continue
      }
      seenInodes.add(inodeKey)
    }
    result.fileCount += 1
    result.bytes += stats.size
  }
  return result
}
