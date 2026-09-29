import type {
  MultiProjectWorkspaceCreateArgs,
  MultiProjectWorkspaceCreateResult
} from '../../../../shared/multi-project-workspace-types'
import type { WorkspaceCreatorProvenance } from '../../../../shared/worktree/types'
import type { WorktreeIpcContext } from '../worktree-ipc-context'
import { createMultiProjectWorkspace } from './multi-project-workspace-creation'

// Why: the create needs the attached main window and store, which only the IPC layer holds;
// remote clients (mobile) reach the same create through the runtime RPC method.
let attachedContext: WorktreeIpcContext | null = null

export function setMultiProjectWorkspaceCreateContext(context: WorktreeIpcContext | null): void {
  attachedContext = context
}

export async function createMultiProjectWorkspaceForRemoteClient(
  args: MultiProjectWorkspaceCreateArgs,
  creatorProvenance: WorkspaceCreatorProvenance
): Promise<MultiProjectWorkspaceCreateResult> {
  if (!attachedContext) {
    throw new Error('multi_project_workspace_unavailable')
  }
  return createMultiProjectWorkspace(attachedContext, args, creatorProvenance)
}
