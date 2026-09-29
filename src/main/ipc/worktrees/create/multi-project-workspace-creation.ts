import { existsSync } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { getRepoExecutionHostId } from '../../../../shared/execution-host'
import type { FolderWorkspace } from '../../../../shared/folder-workspace-types'
import type {
  MultiProjectWorkspaceCreateArgs,
  MultiProjectWorkspaceCreateResult
} from '../../../../shared/multi-project-workspace-types'
import { WorktreeCreateCollisionError } from '../../../../shared/new-workspace/worktree-create-collision'
import type { Repo } from '../../../../shared/repo-types'
import type { CreateWorktreeResult } from '../../../../shared/worktree/create-types'
import type { WorkspaceCreatorProvenance } from '../../../../shared/worktree/types'
import { splitWorktreeId } from '../../../../shared/worktree/id'
import { folderWorkspaceKey } from '../../../../shared/workspace-scope'
import { planMultiProjectWorkspace } from './multi-project-workspace-plan'
import { getWorktreeMirrorDistro } from '../../../project-runtime-git-options'
import { notifyReposChanged } from '../../repos/repos-changed-notification'
import {
  computeWorkspaceRoot,
  getWorktreePathSettings,
  hasRepoWorktreeBasePath,
  sanitizeWorktreeName
} from '../../worktree-logic'
import { createLocalWorktree } from '../../worktree-remote'
import { executeWorktreeRemoval } from '../removal/execute-worktree-removal'
import type { WorktreeIpcContext } from '../worktree-ipc-context'

type CreatedMember = { repo: Repo; result: CreateWorktreeResult }

/**
 * Creates the folder workspace and one worktree per project. All or nothing: a failed member
 * removes the members already created, the workspace and its container folder.
 */
export async function createMultiProjectWorkspace(
  context: WorktreeIpcContext,
  args: MultiProjectWorkspaceCreateArgs,
  creatorProvenance: WorkspaceCreatorProvenance = { kind: 'host' }
): Promise<MultiProjectWorkspaceCreateResult> {
  const { store, mainWindow, runtime } = context
  const settings = store.getSettings()
  const plan = planMultiProjectWorkspace({
    containerName: args.name,
    repoIds: args.repoIds,
    repos: store.getRepos(),
    resolveWorkspaceRoot: (repo) =>
      computeWorkspaceRoot(repo.path, getWorktreePathSettings(repo, settings)),
    hasPinnedWorktreeLocation: (repo) =>
      hasRepoWorktreeBasePath(repo) || getWorktreeMirrorDistro(store, repo) !== undefined,
    sanitizeName: sanitizeWorktreeName,
    isCaseInsensitiveFs: process.platform === 'win32' || process.platform === 'darwin'
  })
  if (existsSync(plan.containerPath)) {
    throw new WorktreeCreateCollisionError(
      `"${plan.containerPath}" already exists. Pick a different workspace name.`
    )
  }
  await mkdir(plan.containerPath, { recursive: true })

  let folderWorkspace: FolderWorkspace | null = null
  const created: CreatedMember[] = []
  let failingRepo: Repo | null = null
  try {
    folderWorkspace = store.createFolderWorkspace({
      projectGroupId: null,
      kind: 'multi-project',
      name: args.name,
      folderPath: plan.containerPath,
      connectionId: null,
      linkedTask: args.linkedTask ?? null,
      ...(args.linkedTaskSourceContext
        ? { linkedTaskSourceContext: args.linkedTaskSourceContext }
        : {}),
      creatorProvenance,
      ...(args.createdWithAgent ? { createdWithAgent: args.createdWithAgent } : {}),
      ...(args.pendingFirstAgentMessageRename ? { pendingFirstAgentMessageRename: true } : {})
    })
    notifyReposChanged(mainWindow)
    for (const member of plan.members) {
      failingRepo = member.repo
      const result = await createLocalWorktree(
        {
          repoId: member.repo.id,
          name: args.name,
          ...(args.setupDecision ? { setupDecision: args.setupDecision } : {}),
          parentWorkspace: folderWorkspaceKey(folderWorkspace.id),
          telemetrySource: 'sidebar'
        },
        member.repo,
        store,
        mainWindow,
        runtime,
        { worktreePath: member.worktreePath }
      )
      created.push({ repo: member.repo, result })
    }
  } catch (error) {
    await rollBackMultiProjectWorkspace(context, created, folderWorkspace, plan.containerPath)
    const reason = error instanceof Error ? error.message : String(error)
    throw new Error(
      failingRepo
        ? `Could not create the worktree for "${failingRepo.displayName}": ${reason} Nothing was kept.`
        : reason
    )
  }
  return { folderWorkspace, members: created.map((member) => member.result) }
}

async function rollBackMultiProjectWorkspace(
  context: WorktreeIpcContext,
  created: readonly CreatedMember[],
  folderWorkspace: FolderWorkspace | null,
  containerPath: string
): Promise<void> {
  for (const { repo, result } of created.toReversed()) {
    const parsed = splitWorktreeId(result.worktree.id)
    try {
      await executeWorktreeRemoval(
        context,
        { worktreeId: result.worktree.id, force: true, skipArchive: true },
        repo,
        repo.id,
        parsed?.worktreePath ?? result.worktree.path,
        getRepoExecutionHostId(repo)
      )
    } catch (error) {
      console.warn('[multi-project-workspace] rollback could not remove a member', error)
    }
  }
  if (folderWorkspace) {
    try {
      await context.runtime.deleteFolderWorkspace(folderWorkspace.id)
    } catch (error) {
      console.warn('[multi-project-workspace] rollback could not delete the workspace', error)
    }
  }
  // Why: the container was verified absent before this create made it, so nothing else lives there.
  await rm(containerPath, { recursive: true, force: true }).catch((error: unknown) => {
    console.warn('[multi-project-workspace] rollback could not remove the container', error)
  })
}
