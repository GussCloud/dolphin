import React, { useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { MultiProjectProjectPicker } from '@/components/new-workspace/MultiProjectProjectPicker'
import { translate } from '@/i18n/i18n'
import { seedMultiProjectMemberSetup } from '@/lib/multi-project-member-setup'
import { useAppStore } from '@/store'
import {
  ADD_MULTI_PROJECT_MEMBER_MODAL,
  getMultiProjectSharedBranchName,
  getMultiProjectWorkspaceMembers
} from './multi-project-workspace-members'

const AddMultiProjectMemberDialog = React.memo(function AddMultiProjectMemberDialog() {
  const activeModal = useAppStore((s) => s.activeModal)
  const modalData = useAppStore((s) => s.modalData)
  const closeModal = useAppStore((s) => s.closeModal)
  const isOpen = activeModal === ADD_MULTI_PROJECT_MEMBER_MODAL
  const folderWorkspaceId =
    typeof modalData.folderWorkspaceId === 'string' ? modalData.folderWorkspaceId : ''
  const workspaceName = useAppStore(
    (s) => s.folderWorkspaces.find((entry) => entry.id === folderWorkspaceId)?.name ?? ''
  )
  const memberKey = useAppStore((s) =>
    getMultiProjectWorkspaceMembers(s, folderWorkspaceId)
      .map((member) => `${member.repoId}\u0000${member.branch}`)
      .join('\u0001')
  )
  const { takenRepoIds, branchName } = useMemo(() => {
    const members = memberKey
      ? memberKey.split('\u0001').map((entry) => {
          const [repoId, branch] = entry.split('\u0000')
          return { repoId, branch }
        })
      : []
    return {
      takenRepoIds: new Set(members.map((member) => member.repoId)),
      branchName: getMultiProjectSharedBranchName(members)
    }
  }, [memberKey])
  const [adding, setAdding] = useState(false)

  const handlePick = async (repoIds: readonly string[]): Promise<void> => {
    setAdding(true)
    try {
      for (const repoId of repoIds) {
        const { member } = await useAppStore.getState().addMultiProjectWorkspaceMember({
          folderWorkspaceId,
          repoId,
          ...(branchName ? { branchName } : {})
        })
        seedMultiProjectMemberSetup([member])
      }
      closeModal()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setAdding(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !adding && closeModal()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.sidebar.AddMultiProjectMemberDialog.title',
              'Add a project to "{{value0}}"',
              { value0: workspaceName }
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.sidebar.AddMultiProjectMemberDialog.description',
              'The project gets a worktree on the branch this workspace already uses.'
            )}
          </DialogDescription>
        </DialogHeader>
        {adding ? (
          <p className="text-sm text-muted-foreground">
            {translate(
              'auto.components.sidebar.AddMultiProjectMemberDialog.adding',
              'Creating the worktree…'
            )}
          </p>
        ) : (
          <MultiProjectProjectPicker
            takenRepoIds={takenRepoIds}
            onPick={(repoIds) => void handlePick(repoIds)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
})

export default AddMultiProjectMemberDialog
