import type { Repo } from '../../../../shared/repo-types'
import type { Worktree } from '../../../../shared/worktree/types'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import { compareWorktreeDisplayName } from '@/lib/worktree-display-name-order'

export type FolderWorkspaceGitMember = {
  worktree: Worktree
  repo: Repo
}

/** The attached worktrees of a folder workspace that Source Control can act on, one per row. */
export function getFolderWorkspaceGitMembers(
  childWorktrees: readonly Worktree[],
  repoById: ReadonlyMap<string, Repo>
): FolderWorkspaceGitMember[] {
  const members: FolderWorkspaceGitMember[] = []
  for (const worktree of childWorktrees) {
    const repo = repoById.get(worktree.repoId)
    if (repo && isGitRepoKind(repo)) {
      members.push({ worktree, repo })
    }
  }
  // Why: activity order reshuffles rows while the user works; repo name order keeps them put.
  return members.sort(
    (left, right) =>
      left.repo.displayName.localeCompare(right.repo.displayName) ||
      compareWorktreeDisplayName(left.worktree, right.worktree)
  )
}

/** Keeps the user's pick while it is still a member, otherwise falls back to the first member. */
export function resolveSelectedFolderWorkspaceMember(
  members: readonly FolderWorkspaceGitMember[],
  selectedWorktreeId: string | null
): FolderWorkspaceGitMember | null {
  return members.find((member) => member.worktree.id === selectedWorktreeId) ?? members[0] ?? null
}
