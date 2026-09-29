import type { ExecutionHostId } from './execution-host'
import type { TaskSourceContext } from './task-source-context'
import type { TuiAgent } from './tui-agent'
import type { DiffComment } from './diff-comment-types'
import type {
  WorkspaceCreatorProvenance,
  WorkspaceLinkedItem,
  WorkspaceStatus
} from './worktree/types'

export type WorkspaceScope =
  | { type: 'worktree'; worktreeId: string }
  | { type: 'folder'; folderWorkspaceId: string }

export type WorkspaceKey = `worktree:${string}` | `folder:${string}`

export type FolderWorkspace = {
  id: string
  /** Null for a multi-project workspace, which belongs to its member projects, not a group. */
  projectGroupId: string | null
  /** Marks a container holding one worktree per member project (members attach via lineage). */
  kind?: 'multi-project'
  name: string
  folderPath: string
  /** SSH target ID for folder workspaces whose folder path lives remotely. */
  connectionId?: string | null
  /** Renderer-owned host stamp for host-qualified folder catalogs. */
  executionHostId?: ExecutionHostId | null
  /** Authenticated client that created this workspace. Missing means unknown legacy origin. */
  creatorProvenance?: WorkspaceCreatorProvenance
  linkedTask: WorkspaceLinkedItem | null
  linkedTaskSourceContext?: TaskSourceContext | null
  comment: string
  isArchived: boolean
  isUnread: boolean
  isPinned: boolean
  sortOrder: number
  /** User-authored sidebar ordering. Higher values render earlier in Manual sort. */
  manualOrder?: number
  workspaceStatus?: WorkspaceStatus
  createdWithAgent?: TuiAgent
  pendingFirstAgentMessageRename?: boolean
  firstAgentMessageRenameError?: string | null
  lastActivityAt: number
  createdAt: number
  updatedAt: number
  diffComments?: DiffComment[]
}

export type FolderWorkspaceLinkedTask = WorkspaceLinkedItem
