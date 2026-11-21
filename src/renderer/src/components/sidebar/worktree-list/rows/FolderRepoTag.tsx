import React from 'react'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../../../shared/repo-types'
import { isFolderRepo } from '../../../../../../shared/repo-kind'

/** Small "folder" tag on a repo header whose project is a plain folder, not a git repo. */
export function FolderRepoTag({ repo }: { repo: Repo }): React.JSX.Element | null {
  if (!isFolderRepo(repo)) {
    return null
  }
  return (
    <span className="shrink-0 rounded border border-worktree-sidebar-border px-1 text-[10px] leading-4 font-medium text-worktree-sidebar-foreground/55">
      {translate('auto.components.sidebar.WorktreeList.folderRepoTag', 'folder')}
    </span>
  )
}
