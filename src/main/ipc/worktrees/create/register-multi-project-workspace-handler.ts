import { ipcMain } from 'electron'
import type {
  MultiProjectMemberAddResult,
  MultiProjectWorkspaceCreateResult
} from '../../../../shared/multi-project-workspace-types'
import {
  MultiProjectMemberAddArgs,
  MultiProjectWorkspaceCreateArgs,
  parseProjectGroupIpcArgs
} from '../../repos/repo-ipc-arg-schemas'
import type { WorktreeIpcContext } from '../worktree-ipc-context'
import { addMultiProjectWorkspaceMember } from './multi-project-member-addition'
import { createMultiProjectWorkspace } from './multi-project-workspace-creation'
import { setMultiProjectWorkspaceCreator } from '../../../runtime/multi-project-workspace-create-port'

export function registerMultiProjectWorkspaceHandler(context: WorktreeIpcContext): void {
  setMultiProjectWorkspaceCreator((args, creatorProvenance) =>
    createMultiProjectWorkspace(context, args, creatorProvenance)
  )
  ipcMain.handle(
    'worktrees:createMultiProject',
    async (_event, rawArgs: unknown): Promise<MultiProjectWorkspaceCreateResult> => {
      const args = parseProjectGroupIpcArgs(
        MultiProjectWorkspaceCreateArgs,
        rawArgs,
        'invalid_multi_project_workspace_create_args'
      )
      return createMultiProjectWorkspace(context, args)
    }
  )
}

export function registerMultiProjectMemberHandler(context: WorktreeIpcContext): void {
  ipcMain.handle(
    'worktrees:addMultiProjectMember',
    async (_event, rawArgs: unknown): Promise<MultiProjectMemberAddResult> => {
      const args = parseProjectGroupIpcArgs(
        MultiProjectMemberAddArgs,
        rawArgs,
        'invalid_multi_project_member_add_args'
      )
      return addMultiProjectWorkspaceMember(context, args)
    }
  )
}
