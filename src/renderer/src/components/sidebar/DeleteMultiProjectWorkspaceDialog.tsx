import React, { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import {
  DELETE_MULTI_PROJECT_WORKSPACE_MODAL,
  deleteMultiProjectWorkspace
} from './multi-project-workspace-delete'
import { getMultiProjectWorkspaceMembers } from './multi-project-workspace-members'

const DeleteMultiProjectWorkspaceDialog = React.memo(function DeleteMultiProjectWorkspaceDialog() {
  const activeModal = useAppStore((s) => s.activeModal)
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const isOpen = activeModal === DELETE_MULTI_PROJECT_WORKSPACE_MODAL
  const folderWorkspaceId =
    typeof modalData.folderWorkspaceId === 'string' ? modalData.folderWorkspaceId : ''
  const executionHostId =
    typeof modalData.executionHostId === 'string'
      ? // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: openMultiProjectDeleteDialogIfNeeded only stores an ExecutionHostId here.
        (modalData.executionHostId as ExecutionHostId)
      : undefined
  const workspaceName = useAppStore(
    (s) => s.folderWorkspaces.find((entry) => entry.id === folderWorkspaceId)?.name ?? ''
  )
  const memberNames = useAppStore((s) =>
    getMultiProjectWorkspaceMembers(s, folderWorkspaceId)
      .map((member) => member.displayName)
      .join('\u0000')
  )
  const members = memberNames ? memberNames.split('\u0000') : []
  const [removeMembers, setRemoveMembers] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const checkboxId = useId()

  const handleDelete = (): void => {
    setDeleting(true)
    void deleteMultiProjectWorkspace({
      folderWorkspaceId,
      ...(executionHostId ? { executionHostId } : {}),
      removeMembers
    }).finally(() => {
      setDeleting(false)
      closeModal()
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !deleting && closeModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.sidebar.DeleteMultiProjectWorkspaceDialog.title',
              'Delete "{{value0}}"?',
              { value0: workspaceName }
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.sidebar.DeleteMultiProjectWorkspaceDialog.description',
              'This workspace has a worktree in {{value0}} projects: {{value1}}.',
              { value0: members.length, value1: members.join(', ') }
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-2">
          <Checkbox
            id={checkboxId}
            checked={removeMembers}
            disabled={deleting}
            onCheckedChange={(checked) => setRemoveMembers(checked === true)}
          />
          <label htmlFor={checkboxId} className="text-sm leading-tight">
            {translate(
              'auto.components.sidebar.DeleteMultiProjectWorkspaceDialog.removeMembers',
              'Also delete its worktrees. Worktrees with uncommitted changes stop the delete.'
            )}
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={closeModal} disabled={deleting}>
            {translate(
              'auto.components.sidebar.DeleteMultiProjectWorkspaceDialog.cancel',
              'Cancel'
            )}
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            {translate(
              'auto.components.sidebar.DeleteMultiProjectWorkspaceDialog.delete',
              'Delete'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
})

export default DeleteMultiProjectWorkspaceDialog
