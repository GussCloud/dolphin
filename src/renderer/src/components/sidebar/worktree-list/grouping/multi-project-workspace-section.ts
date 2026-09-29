import { Layers } from 'lucide-react'
import { translate } from '@/i18n/i18n'
import {
  compareFolderWorkspacesForDisplay,
  type RenderableFolderWorkspace
} from './folder-workspace-lanes'
import type { SectionAppendContext } from './group-sections'
import { buildFolderWorkspaceRow } from './row-builders'

export const MULTI_PROJECT_WORKSPACES_HEADER_KEY = 'multi-project-workspaces'

/** Workspaces that span several projects and belong to no project group. */
export function isGrouplessMultiProjectWorkspace(pair: RenderableFolderWorkspace): boolean {
  return pair.projectGroup === null
}

/**
 * Under Group by project, groupless multi-project workspaces have no group header to sit under,
 * so they get one section of their own. Their member worktrees still render under each project.
 */
export function appendMultiProjectWorkspaceSection(
  ctx: SectionAppendContext,
  folderWorkspaces: readonly RenderableFolderWorkspace[]
): void {
  const pairs = folderWorkspaces
    .filter(isGrouplessMultiProjectWorkspace)
    .sort((left, right) =>
      compareFolderWorkspacesForDisplay(left.folderWorkspace, right.folderWorkspace)
    )
  if (pairs.length === 0) {
    return
  }
  ctx.result.push({
    type: 'header',
    key: MULTI_PROJECT_WORKSPACES_HEADER_KEY,
    label: translate(
      'auto.components.sidebar.worktree.list.groups.multiProjectWorkspaces',
      'Multi-project workspaces'
    ),
    count: pairs.length,
    tone: 'text-foreground',
    icon: Layers
  })
  if (ctx.collapsedGroups.has(MULTI_PROJECT_WORKSPACES_HEADER_KEY)) {
    return
  }
  for (const pair of pairs) {
    ctx.result.push(buildFolderWorkspaceRow(pair, 1))
  }
}
