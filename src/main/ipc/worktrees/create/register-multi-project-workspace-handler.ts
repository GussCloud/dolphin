import { ipcMain } from 'electron'
import type { MultiProjectWorkspaceCreateResult } from '../../../../shared/multi-project-workspace-types'
import {
  MultiProjectWorkspaceCreateArgs,
  parseProjectGroupIpcArgs
} from '../../repos/repo-ipc-arg-schemas'
import type { WorktreeIpcContext } from '../worktree-ipc-context'
import { createMultiProjectWorkspace } from './multi-project-workspace-creation'

export function registerMultiProjectWorkspaceHandler(context: WorktreeIpcContext): void {
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
