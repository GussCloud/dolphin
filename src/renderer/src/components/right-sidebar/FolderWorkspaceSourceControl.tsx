import { useMemo, useState } from 'react'
import RepoBadgeLabel from '@/components/repo/RepoBadgeLabel'
import { Badge } from '@/components/ui/badge'
import { translate } from '@/i18n/i18n'
import { cn } from '@/lib/utils'
import { getWorktreeGitIdentityDisplay } from '@/lib/worktree-git-identity-display'
import { useAppStore } from '@/store'
import { getAttachedWorktreesForFolderWorkspace } from './folder-workspace-attached-worktrees'
import {
  getFolderWorkspaceGitMembers,
  resolveSelectedFolderWorkspaceMember,
  type FolderWorkspaceGitMember
} from './folder-workspace-git-members'
import { SourceControlPanel } from './source-control/panel/panel'
import { SourceControlScopeProvider } from './source-control/listing/source-control-scope'
import { useFolderWorkspaceMemberGitStatus } from './use-folder-workspace-member-git-status'
import { FolderWorkspaceBatchBar } from './FolderWorkspaceBatchBar'

/** Source Control for a folder workspace: pick a member repo, then the regular panel runs for it. */
export function FolderWorkspaceSourceControl(): React.JSX.Element {
  const activeWorktreeId = useAppStore((s) => s.activeWorktreeId)
  const activeWorkspaceKey = useAppStore((s) => s.activeWorkspaceKey)
  const folderWorkspaces = useAppStore((s) => s.folderWorkspaces)
  const workspaceLineageByChildKey = useAppStore((s) => s.workspaceLineageByChildKey)
  const worktreeLineageById = useAppStore((s) => s.worktreeLineageById)
  const worktreesByRepo = useAppStore((s) => s.worktreesByRepo)
  const repos = useAppStore((s) => s.repos)
  const panelVisible = useAppStore(
    (s) => s.rightSidebarOpen && s.rightSidebarTab === 'source-control'
  )
  const [selectedWorktreeId, setSelectedWorktreeId] = useState<string | null>(null)

  const members = useMemo(() => {
    const { childWorktrees } = getAttachedWorktreesForFolderWorkspace({
      activeWorkspaceKey,
      activeWorktreeId,
      folderWorkspaces,
      workspaceLineageByChildKey,
      worktreeLineageById,
      worktreesByRepo
    })
    return getFolderWorkspaceGitMembers(
      childWorktrees,
      new Map(repos.map((repo) => [repo.id, repo]))
    )
  }, [
    activeWorkspaceKey,
    activeWorktreeId,
    folderWorkspaces,
    repos,
    workspaceLineageByChildKey,
    worktreeLineageById,
    worktreesByRepo
  ])
  const refreshMembers = useFolderWorkspaceMemberGitStatus(members, panelVisible)
  const selected = resolveSelectedFolderWorkspaceMember(members, selectedWorktreeId)

  if (!selected) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="text-sm font-medium text-foreground">
          {translate(
            'auto.components.rightSidebar.FolderWorkspaceSourceControl.emptyTitle',
            'No Git projects in this workspace'
          )}
        </div>
        <div className="mt-2 max-w-[16rem] text-xs leading-5 text-muted-foreground">
          {translate(
            'auto.components.rightSidebar.FolderWorkspaceSourceControl.emptyCopy',
            'Create a workspace with several projects, or attach worktrees to this one, to see their changes here.'
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {members.length > 1 ? (
        <FolderWorkspaceBatchBar members={members} onFinished={refreshMembers} />
      ) : null}
      <div
        className="scrollbar-sleek max-h-40 shrink-0 overflow-y-auto border-b border-border py-1"
        role="listbox"
        aria-label={translate(
          'auto.components.rightSidebar.FolderWorkspaceSourceControl.membersLabel',
          'Projects'
        )}
      >
        {members.map((member) => (
          <FolderWorkspaceMemberRow
            key={member.worktree.id}
            member={member}
            isCurrent={member.worktree.id === selected.worktree.id}
            onSelect={() => setSelectedWorktreeId(member.worktree.id)}
          />
        ))}
      </div>
      <div className="min-h-0 flex-1">
        {/* Why: keyed so switching members remounts the panel instead of carrying one repo's local state into another. */}
        <SourceControlScopeProvider key={selected.worktree.id} worktreeId={selected.worktree.id}>
          <SourceControlPanel />
        </SourceControlScopeProvider>
      </div>
    </div>
  )
}

function FolderWorkspaceMemberRow({
  member,
  isCurrent,
  onSelect
}: {
  member: FolderWorkspaceGitMember
  isCurrent: boolean
  onSelect: () => void
}): React.JSX.Element {
  const changeCount = useAppStore((s) => s.gitStatusByWorktree[member.worktree.id]?.length ?? 0)
  const identity = getWorktreeGitIdentityDisplay(member.worktree)
  const identityLabel =
    identity?.kind === 'branch' ? identity.branchName : (identity?.sourceControlLabel ?? '')

  return (
    <button
      type="button"
      role="option"
      aria-selected={isCurrent}
      data-current={isCurrent ? 'true' : undefined}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-1 text-left text-[13px] hover:bg-accent',
        isCurrent && 'bg-accent'
      )}
      onClick={onSelect}
    >
      <RepoBadgeLabel
        name={member.repo.displayName}
        color={member.repo.badgeColor}
        className="shrink-0 font-medium"
      />
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
        {identityLabel}
      </span>
      {changeCount > 0 && <Badge variant="secondary">{changeCount}</Badge>}
    </button>
  )
}
