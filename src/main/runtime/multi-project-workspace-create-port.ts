import type {
  MultiProjectWorkspaceCreateArgs,
  MultiProjectWorkspaceCreateResult
} from '../../shared/multi-project-workspace-types'
import type { WorkspaceCreatorProvenance } from '../../shared/worktree/types'

type MultiProjectWorkspaceCreator = (
  args: MultiProjectWorkspaceCreateArgs,
  creatorProvenance: WorkspaceCreatorProvenance
) => Promise<MultiProjectWorkspaceCreateResult>

// Why a port: the create needs the main window and store the IPC layer holds, and importing it
// here would pull Electron into the runtime graph (config/runtime-electron-baseline.txt).
let creator: MultiProjectWorkspaceCreator | null = null

export function setMultiProjectWorkspaceCreator(next: MultiProjectWorkspaceCreator | null): void {
  creator = next
}

export async function createMultiProjectWorkspaceForRemoteClient(
  args: MultiProjectWorkspaceCreateArgs,
  creatorProvenance: WorkspaceCreatorProvenance
): Promise<MultiProjectWorkspaceCreateResult> {
  if (!creator) {
    throw new Error('multi_project_workspace_unavailable')
  }
  return creator(args, creatorProvenance)
}
