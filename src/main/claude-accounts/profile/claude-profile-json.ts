import { existsSync, readFileSync } from 'node:fs'
import { lock } from 'proper-lockfile'
import { writeFileAtomically } from '../../codex-accounts/fs-utils'

export type JsonObject = Record<string, unknown>

const LOCK_RETRIES = { retries: 20, factor: 1.3, minTimeout: 10, maxTimeout: 250, randomize: true }

/** `{}` for a missing file, null for one that is not a JSON object (left for its owner to repair). */
export function readJsonObjectFile(path: string): JsonObject | null {
  if (!existsSync(path)) {
    return {}
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? Object.fromEntries(Object.entries(parsed))
      : null
  } catch {
    return null
  }
}

export function asJsonObject(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {}
}

/** Rewrites a JSON file under Claude's own lock; a malformed file is left alone (returns false). */
export async function updateJsonObjectFile(
  path: string,
  update: (current: JsonObject) => JsonObject
): Promise<boolean> {
  if (!existsSync(path)) {
    writeFileAtomically(path, '{}\n', { mode: 0o600 })
  }
  // Why: Claude Code rewrites its JSON state under proper-lockfile (`<file>.lock`).
  const release = await lock(path, { realpath: false, retries: LOCK_RETRIES })
  try {
    const current = readJsonObjectFile(path)
    if (!current) {
      return false
    }
    writeFileAtomically(path, `${JSON.stringify(update(current), null, 2)}\n`, { mode: 0o600 })
    return true
  } finally {
    await release()
  }
}
