import React from 'react'
import { FolderPlus } from 'lucide-react'
import { DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { openAddMultiProjectMemberDialog } from './multi-project-workspace-members'

/** Context-menu actions only a multi-project workspace has. */
export function MultiProjectWorkspaceMenuItems({
  folderWorkspaceId,
  disabled
}: {
  folderWorkspaceId: string | null
  disabled: boolean
}): React.JSX.Element | null {
  const isMultiProject = useAppStore((s) =>
    folderWorkspaceId
      ? (s.folderWorkspaces ?? []).some(
          (workspace) => workspace.id === folderWorkspaceId && workspace.kind === 'multi-project'
        )
      : false
  )
  if (!folderWorkspaceId || !isMultiProject) {
    return null
  }
  return (
    <>
      <DropdownMenuItem
        disabled={disabled}
        onSelect={() => openAddMultiProjectMemberDialog(folderWorkspaceId)}
      >
        <FolderPlus className="size-3.5" />
        {translate(
          'auto.components.sidebar.MultiProjectWorkspaceMenuItems.addProject',
          'Add Project…'
        )}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  )
}
