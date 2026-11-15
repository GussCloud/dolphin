// Remembers the unmerged branches Dolphin kept when it removed a local worktree, across restarts, so
// the cleanup screen can offer to delete them later. Before this, the force-delete offer lived only
// in memory and those branches became untracked clutter after a restart.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getAppEnvironment } from '../../shared/app-environment'
import { LOCAL_EXECUTION_HOST_ID } from '../../shared/execution-host'
import type { PreservedBranchRecord } from '../../shared/preserved-branch-registry-types'
import { splitWorktreeId } from '../../shared/worktree/id'
import { writeFileAtomically } from '../codex-accounts/fs-utils'

const FILE_NAME = 'preserved-branches.json'
// Why a cap: a record is tiny, but nothing else bounds this file.
const MAX_RECORDS = 500

function registryPath(dir?: string): string {
  return join(dir ?? getAppEnvironment().getPath('userData'), FILE_NAME)
}

export function readPreservedBranchRecords(dir?: string): PreservedBranchRecord[] {
  const path = registryPath(dir)
  if (!existsSync(path)) {
    return []
  }
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf-8'))
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is PreservedBranchRecord =>
            Boolean(entry) &&
            typeof entry.repoId === 'string' &&
            typeof entry.branchName === 'string' &&
            typeof entry.head === 'string'
        )
      : []
  } catch {
    return []
  }
}

export function writePreservedBranchRecords(records: PreservedBranchRecord[], dir?: string): void {
  writeFileAtomically(
    registryPath(dir),
    `${JSON.stringify(records.slice(-MAX_RECORDS), null, 2)}\n`,
    { mode: 0o600 }
  )
}

function sameBranch(
  a: PreservedBranchRecord,
  b: Pick<PreservedBranchRecord, 'repoId' | 'branchName'>
) {
  return a.repoId === b.repoId && a.branchName === b.branchName
}

/** Called when a local worktree removal kept its unmerged branch. Best-effort. */
export function recordPreservedBranch(
  args: { worktreeId: string; hostId?: string; branchName: string; head: string },
  options: { dir?: string; now?: number } = {}
): void {
  // Why local only: an SSH project's branches live on that host, out of this file's reach.
  if (args.hostId && args.hostId !== LOCAL_EXECUTION_HOST_ID) {
    return
  }
  const parsed = splitWorktreeId(args.worktreeId)
  if (!parsed) {
    return
  }
  try {
    const record: PreservedBranchRecord = {
      repoId: parsed.repoId,
      worktreePath: parsed.worktreePath,
      branchName: args.branchName,
      head: args.head,
      preservedAt: options.now ?? Date.now()
    }
    const others = readPreservedBranchRecords(options.dir).filter(
      (entry) => !sameBranch(entry, record)
    )
    writePreservedBranchRecords([...others, record], options.dir)
  } catch (error) {
    console.warn('[worktrees] Could not remember a preserved branch', error)
  }
}

export function forgetPreservedBranch(
  branch: Pick<PreservedBranchRecord, 'repoId' | 'branchName'>,
  dir?: string
): void {
  const records = readPreservedBranchRecords(dir)
  const next = records.filter((entry) => !sameBranch(entry, branch))
  if (next.length !== records.length) {
    writePreservedBranchRecords(next, dir)
  }
}
