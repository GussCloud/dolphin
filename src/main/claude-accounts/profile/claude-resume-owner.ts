// Decides where a `claude --resume <id>` must run: the CLI finds a conversation only under its own
// config dir, so resuming anywhere else fails with "No conversation found", and on a host whose zsh
// wraps `claude` in an account menu the launch must not stop at that menu either.
import { resolve } from 'node:path'
import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'
import { getClaudeAccountConfigDir } from '../claude-account-config-dir'
import { claudeConfigDirSessionMtime } from './claude-session-profile'

/** Marks a launch whose config dir was chosen because it holds the resumed transcript. */
export const RESUME_OWNER_PROVENANCE_SUFFIX = ':resume-owner'

export type ClaudeResumeOwner =
  | { kind: 'none' }
  | { kind: 'account'; account: ClaudeManagedAccount }
  /** `~/.claude` or a folder of the user's account menu that Dolphin has not linked. */
  | { kind: 'folder'; configDir: string; isSystem: boolean }

export type ClaudeResumeOwnerInput = {
  sessionId: string
  /** The account this launch would use anyway (project pin or active account); null: system. */
  intended: ClaudeManagedAccount | null
  accounts: readonly ClaudeManagedAccount[]
  systemDir: string
  /** Config dirs the user's shell account menu names, read-only. */
  menuFolders: () => readonly string[]
  sessionMtime?: (configDir: string, sessionId: string) => number | null
}

type Candidate = { owner: ClaudeResumeOwner; mtime: number }

export function resolveClaudeResumeOwner(input: ClaudeResumeOwnerInput): ClaudeResumeOwner {
  const mtimeOf = input.sessionMtime ?? claudeConfigDirSessionMtime
  if (
    input.intended &&
    mtimeOf(getClaudeAccountConfigDir(input.intended), input.sessionId) !== null
  ) {
    return { kind: 'none' }
  }
  const candidates: Candidate[] = []
  const seen = new Set<string>()
  const consider = (configDir: string, owner: ClaudeResumeOwner): void => {
    const key = resolve(configDir)
    if (seen.has(key)) {
      return
    }
    seen.add(key)
    const mtime = mtimeOf(configDir, input.sessionId)
    if (mtime !== null) {
      candidates.push({ owner, mtime })
    }
  }
  // Why accounts first: a linked account on ~/.claude owns the same file as the system dir, and
  // naming the account is what lets the launch skip the shell menu with its identity known.
  for (const account of input.accounts) {
    if (account.managedAuthRuntime !== 'wsl' && account.id !== input.intended?.id) {
      consider(getClaudeAccountConfigDir(account), { kind: 'account', account })
    }
  }
  consider(input.systemDir, { kind: 'folder', configDir: input.systemDir, isSystem: true })
  if (candidates.length === 0) {
    for (const folder of input.menuFolders()) {
      consider(folder, { kind: 'folder', configDir: folder, isSystem: false })
    }
  }
  // Why newest: a transcript copied into two dirs keeps growing only where it is resumed.
  const best = candidates.reduce<Candidate | null>(
    (winner, candidate) => (!winner || candidate.mtime > winner.mtime ? candidate : winner),
    null
  )
  return best?.owner ?? { kind: 'none' }
}
