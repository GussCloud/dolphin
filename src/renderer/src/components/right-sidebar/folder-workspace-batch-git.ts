import type { GitStatusEntry, GitUpstreamStatus } from '../../../../shared/git-status-types'
import type { FolderWorkspaceGitMember } from './folder-workspace-git-members'

export type FolderWorkspaceBatchKind = 'commit' | 'push' | 'pull'

export type FolderWorkspaceBatchOutcome = {
  worktreeId: string
  repoName: string
  status: 'done' | 'skipped' | 'failed'
  error?: string
}

export type FolderWorkspaceBatchDeps = {
  getStatusEntries: (worktreeId: string) => readonly GitStatusEntry[]
  getUpstreamStatus: (worktreeId: string) => GitUpstreamStatus | undefined
  commit: (member: FolderWorkspaceGitMember, message: string) => Promise<void>
  push: (member: FolderWorkspaceGitMember, publish: boolean) => Promise<void>
  pull: (member: FolderWorkspaceGitMember) => Promise<void>
}

/** Why skip: a member with nothing to do is not a failure, and running git there is wasted work. */
function skipReason(
  kind: FolderWorkspaceBatchKind,
  member: FolderWorkspaceGitMember,
  deps: FolderWorkspaceBatchDeps
): string | null {
  const entries = deps.getStatusEntries(member.worktree.id)
  if (entries.some((entry) => entry.conflictStatus === 'unresolved')) {
    return 'has unresolved conflicts'
  }
  const upstream = deps.getUpstreamStatus(member.worktree.id)
  if (kind === 'commit') {
    return entries.some((entry) => entry.area === 'staged') ? null : 'nothing staged'
  }
  if (kind === 'push') {
    return !upstream || !upstream.hasUpstream || upstream.ahead > 0 ? null : 'nothing to push'
  }
  return upstream?.hasUpstream ? null : 'no upstream branch'
}

/**
 * Runs one git operation across the members one at a time and reports each outcome. A failure
 * never stops the rest: the user fixes that repo in its own panel and re-runs the batch.
 */
export async function runFolderWorkspaceBatch(
  kind: FolderWorkspaceBatchKind,
  members: readonly FolderWorkspaceGitMember[],
  deps: FolderWorkspaceBatchDeps,
  message = ''
): Promise<FolderWorkspaceBatchOutcome[]> {
  const outcomes: FolderWorkspaceBatchOutcome[] = []
  for (const member of members) {
    const base = { worktreeId: member.worktree.id, repoName: member.repo.displayName }
    const reason = skipReason(kind, member, deps)
    if (reason) {
      outcomes.push({ ...base, status: 'skipped', error: reason })
      continue
    }
    try {
      if (kind === 'commit') {
        await deps.commit(member, message)
      } else if (kind === 'push') {
        await deps.push(member, deps.getUpstreamStatus(member.worktree.id)?.hasUpstream !== true)
      } else {
        await deps.pull(member)
      }
      outcomes.push({ ...base, status: 'done' })
    } catch (error) {
      outcomes.push({
        ...base,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
  return outcomes
}
