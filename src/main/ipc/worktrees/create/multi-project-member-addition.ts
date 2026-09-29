import type {
  MultiProjectMemberAddArgs,
  MultiProjectMemberAddResult
} from '../../../../shared/multi-project-workspace-types'
import { splitWorktreeId } from '../../../../shared/worktree/id'
import { folderWorkspaceKey, parseWorkspaceKey } from '../../../../shared/workspace-scope'
import { getWorktreeMirrorDistro } from '../../../project-runtime-git-options'
import {
  computeWorkspaceRoot,
  getWorktreePathSettings,
  hasRepoWorktreeBasePath,
  sanitizeWorktreeName
} from '../../worktree-logic'
import { createLocalWorktree } from '../../worktree-remote'
import type { WorktreeIpcContext } from '../worktree-ipc-context'
import { planMultiProjectMemberAddition } from './multi-project-workspace-plan'

/** Adds one more project to a multi-project workspace, on the branch its members already share. */
export async function addMultiProjectWorkspaceMember(
  context: WorktreeIpcContext,
  args: MultiProjectMemberAddArgs
): Promise<MultiProjectMemberAddResult> {
  const { store, mainWindow, runtime } = context
  const workspace = store.getFolderWorkspace(args.folderWorkspaceId)
  if (workspace?.kind !== 'multi-project') {
    throw new Error('Multi-project workspace not found.')
  }
  const parentKey = folderWorkspaceKey(workspace.id)
  const existingMembers = Object.values(store.getAllWorkspaceLineage()).flatMap((lineage) => {
    const child = parseWorkspaceKey(lineage.childWorkspaceKey)
    const parsed = child?.type === 'worktree' ? splitWorktreeId(child.worktreeId) : null
    return lineage.parentWorkspaceKey === parentKey && parsed
      ? [{ repoId: parsed.repoId, worktreePath: parsed.worktreePath }]
      : []
  })
  const settings = store.getSettings()
  const member = planMultiProjectMemberAddition({
    containerPath: workspace.folderPath,
    repoId: args.repoId,
    existingMembers,
    repos: store.getRepos(),
    resolveWorkspaceRoot: (repo) =>
      computeWorkspaceRoot(repo.path, getWorktreePathSettings(repo, settings)),
    hasPinnedWorktreeLocation: (repo) =>
      hasRepoWorktreeBasePath(repo) || getWorktreeMirrorDistro(store, repo) !== undefined,
    sanitizeName: sanitizeWorktreeName,
    isCaseInsensitiveFs: process.platform === 'win32' || process.platform === 'darwin'
  })
  const result = await createLocalWorktree(
    {
      repoId: member.repo.id,
      name: workspace.name,
      ...(args.branchName ? { branchNameOverride: args.branchName } : {}),
      parentWorkspace: parentKey,
      telemetrySource: 'sidebar'
    },
    member.repo,
    store,
    mainWindow,
    runtime,
    { worktreePath: member.worktreePath }
  )
  return { member: result }
}
