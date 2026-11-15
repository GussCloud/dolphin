// The account profile screen's reads and writes. Only the profile (or a folder the user linked)
// is ever written; the user's own Claude dir is only read.
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ClaudeProfileDetails } from '../../../shared/claude-profile-types'
import { writeFileAtomically } from '../../codex-accounts/fs-utils'
import {
  CLAUDE_PROFILE_MARKER,
  INHERITED_SHARED_STATE_KEYS,
  isolateClaudeProfileDir,
  readClaudeProfileMarker
} from '../pinned-config-dir/claude-pinned-config-layout'
import { asJsonObject, readJsonObjectFile, updateJsonObjectFile } from './claude-profile-json'
import {
  importIntoClaudeProfile,
  listClaudeProfileImportItems,
  type ClaudeProfileImportPaths
} from './claude-profile-import'
import { claudeConfigStatePath } from './claude-shell-selector-discovery'

export type ClaudeProfileTarget = {
  accountId: string
  configDir: string
  linked: boolean
  userConfigDir: string
  userStatePath: string
}

/**
 * Makes an isolated profile ready before the screen writes to it. Why here and not only at
 * launch: once the marker exists the launch no longer drops state the shared layout inherited.
 */
async function ensureIsolatedProfile(target: ClaudeProfileTarget): Promise<void> {
  if (target.linked) {
    return
  }
  mkdirSync(target.configDir, { recursive: true, mode: 0o700 })
  const isolation = isolateClaudeProfileDir(target.configDir, target.userConfigDir)
  const statePath = join(target.configDir, '.claude.json')
  if (isolation.firstIsolation && existsSync(statePath)) {
    await updateJsonObjectFile(statePath, (current) => {
      const next = { ...current }
      for (const key of INHERITED_SHARED_STATE_KEYS) {
        delete next[key]
      }
      return next
    })
  }
}

function importPaths(target: ClaudeProfileTarget): ClaudeProfileImportPaths {
  return {
    userConfigDir: target.userConfigDir,
    userStatePath: target.userStatePath,
    profileDir: target.configDir
  }
}

function readInstructions(configDir: string): string | null {
  try {
    return readFileSync(join(configDir, 'CLAUDE.md'), 'utf-8')
  } catch {
    return null
  }
}

export async function describeClaudeProfile(
  target: ClaudeProfileTarget
): Promise<ClaudeProfileDetails> {
  await ensureIsolatedProfile(target)
  const marker = target.linked ? null : readClaudeProfileMarker(target.configDir)
  return {
    accountId: target.accountId,
    configDir: target.configDir,
    linked: target.linked,
    reviewPending: marker?.reviewPending === true,
    migratedCopied: marker?.copied ?? [],
    instructions: readInstructions(target.configDir),
    mcpServers: Object.keys(
      asJsonObject(readJsonObjectFile(claudeConfigStatePath(target.configDir))?.mcpServers)
    ),
    importItems: target.linked ? [] : listClaudeProfileImportItems(importPaths(target))
  }
}

export async function saveClaudeProfileInstructions(
  target: ClaudeProfileTarget,
  content: string
): Promise<void> {
  await ensureIsolatedProfile(target)
  writeFileAtomically(join(target.configDir, 'CLAUDE.md'), content, { mode: 0o600 })
}

export function markClaudeProfileReviewed(target: ClaudeProfileTarget): void {
  const marker = target.linked ? null : readClaudeProfileMarker(target.configDir)
  if (!marker?.reviewPending) {
    return
  }
  writeFileAtomically(
    join(target.configDir, CLAUDE_PROFILE_MARKER),
    `${JSON.stringify({ ...marker, reviewPending: false }, null, 2)}\n`,
    { mode: 0o600 }
  )
}

export async function importIntoClaudeProfileTarget(
  target: ClaudeProfileTarget,
  ids: readonly string[]
) {
  if (target.linked) {
    throw new Error('A linked folder is yours to manage; Dolphin does not import into it.')
  }
  await ensureIsolatedProfile(target)
  return importIntoClaudeProfile(importPaths(target), ids)
}
