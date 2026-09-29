import type { FolderWorkspace } from './folder-workspace-types'
import type { TaskSourceContext } from './task-source-context'
import type { TuiAgent } from './tui-agent'
import type { CreateWorktreeResult, SetupDecision } from './worktree/create-types'

/**
 * A groupless folder workspace whose folder is a fresh container holding one new worktree per
 * selected project, all on the same branch name. Members attach to the workspace through lineage.
 */
export type MultiProjectWorkspaceCreateArgs = {
  name: string
  repoIds: string[]
  setupDecision?: SetupDecision
  linkedTask?: FolderWorkspace['linkedTask']
  linkedTaskSourceContext?: TaskSourceContext | null
  createdWithAgent?: TuiAgent
  pendingFirstAgentMessageRename?: boolean
}

export type MultiProjectWorkspaceCreateResult = {
  folderWorkspace: FolderWorkspace
  members: CreateWorktreeResult[]
}
