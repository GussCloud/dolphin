import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import { writeCredentialFileAtomic } from '../integration-credential-file'

// Last Azure DevOps token validity the CLI reported on this host. Its presence also
// records that a sign-in existed, which is what makes a failed token a lapsed session.
type StoredSession = { version: 1; tokenExpiresAtMs: number }

let cached: { tokenExpiresAtMs: number } | null | undefined

function sessionPath(): string {
  return join(homedir(), FORK_HOME_STATE_DIR_NAME, 'azure-cli-session.json')
}

function readFromDisk(): { tokenExpiresAtMs: number } | null {
  const path = sessionPath()
  if (!existsSync(path)) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    const expiresAt =
      parsed && typeof parsed === 'object' && 'tokenExpiresAtMs' in parsed
        ? parsed.tokenExpiresAtMs
        : null
    return typeof expiresAt === 'number' && Number.isFinite(expiresAt)
      ? { tokenExpiresAtMs: expiresAt }
      : null
  } catch (error) {
    console.warn('[azure-devops] ignoring unreadable Azure CLI session record', error)
    return null
  }
}

export function getAzureCliTokenExpiresAt(): number | null {
  if (cached === undefined) {
    cached = readFromDisk()
  }
  return cached?.tokenExpiresAtMs ?? null
}

export function recordAzureCliTokenExpiry(tokenExpiresAtMs: number): void {
  if (getAzureCliTokenExpiresAt() === tokenExpiresAtMs) {
    return
  }
  try {
    mkdirSync(join(homedir(), FORK_HOME_STATE_DIR_NAME), { recursive: true })
    const stored: StoredSession = { version: 1, tokenExpiresAtMs }
    writeCredentialFileAtomic(sessionPath(), Buffer.from(JSON.stringify(stored), 'utf-8'))
  } catch (error) {
    console.warn('[azure-devops] could not persist Azure CLI token validity', error)
  }
  cached = { tokenExpiresAtMs }
}

/** Called when the CLI has no account at all (`az logout`), so auto-renew stays quiet. */
export function forgetAzureCliSession(): void {
  if (getAzureCliTokenExpiresAt() === null) {
    return
  }
  rmSync(sessionPath(), { force: true })
  cached = null
}

/** @internal - tests need a clean cache between cases. */
export function _resetAzureCliSessionStoreCache(): void {
  cached = undefined
}
