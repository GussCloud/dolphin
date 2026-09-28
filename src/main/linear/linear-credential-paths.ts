import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const LEGACY_WORKSPACE_ID = 'legacy'

function getDolphinDir(): string {
  return join(homedir(), FORK_HOME_STATE_DIR_NAME)
}

function getLegacyTokenPath(): string {
  return join(getDolphinDir(), 'linear-token.enc')
}

export function getLegacyViewerPath(): string {
  return join(getDolphinDir(), 'linear-viewer.json')
}

export function getWorkspaceFilePath(): string {
  return join(getDolphinDir(), 'linear-workspaces.json')
}

function getWorkspaceTokenDir(): string {
  return join(getDolphinDir(), 'linear-tokens')
}

export function getWorkspaceTokenPath(workspaceId: string): string {
  if (workspaceId === LEGACY_WORKSPACE_ID) {
    return getLegacyTokenPath()
  }
  return join(getWorkspaceTokenDir(), `${Buffer.from(workspaceId).toString('base64url')}.enc`)
}

export function ensureDolphinDir(): void {
  const dir = getDolphinDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

export function ensureWorkspaceTokenDir(): void {
  const dir = getWorkspaceTokenDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
