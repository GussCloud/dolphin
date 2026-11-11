import { useCallback } from 'react'
import type { AddRepoDialogStep } from './add-repo-dialog-types'
import { useAddRepoHostChangeReset } from './use-add-repo-host-change-reset'

type AddRepoFlowResets = {
  resetLocalFolderFlow: () => void
  resetServerPathFlow: () => void
  resetCloneFlow: () => void
  resetAccountStep: () => void
  resetNestedImportFlow: () => void
  resetNestedRepoReviewState: () => void
  resetCreateDefaultState: () => void
  resetCreateState: () => void
  resetRemoteState: () => void
}

/** Full reset for Back/close, and the host-scoped reset when the dialog's host changes. */
export function useAddRepoDialogReset({
  isOpen,
  selectedHostId,
  setStep,
  setIsAdding,
  setAddProjectBusyLabel,
  resets
}: {
  isOpen: boolean
  selectedHostId: string | null
  setStep: (step: AddRepoDialogStep) => void
  setIsAdding: (adding: boolean) => void
  setAddProjectBusyLabel: (label: string | null) => void
  resets: AddRepoFlowResets
}): () => void {
  const {
    resetLocalFolderFlow,
    resetServerPathFlow,
    resetCloneFlow,
    resetAccountStep,
    resetNestedImportFlow,
    resetNestedRepoReviewState,
    resetCreateDefaultState,
    resetCreateState,
    resetRemoteState
  } = resets
  const resetState = useCallback(() => {
    // Why: kill the git clone process if one is running, so backing out
    // or closing the dialog doesn't leave a clone running on disk.
    void window.api.repos.cloneAbort()
    resetLocalFolderFlow()
    setStep('add')
    setIsAdding(false)
    setAddProjectBusyLabel(null)
    resetServerPathFlow()
    resetCloneFlow()
    resetAccountStep()
    resetNestedImportFlow()
    resetNestedRepoReviewState()
    resetCreateDefaultState()
    resetCreateState()
    resetRemoteState()
  }, [
    resetAccountStep,
    resetCloneFlow,
    resetLocalFolderFlow,
    resetNestedRepoReviewState,
    resetCreateDefaultState,
    resetServerPathFlow,
    resetNestedImportFlow,
    resetRemoteState,
    resetCreateState,
    setAddProjectBusyLabel,
    setIsAdding,
    setStep
  ])

  const resetHostScopedState = useCallback(() => {
    setIsAdding(false)
    setAddProjectBusyLabel(null)
    resetLocalFolderFlow()
    resetServerPathFlow()
    resetCloneFlow()
    resetCreateDefaultState()
    resetCreateState()
    resetRemoteState()
  }, [
    resetCloneFlow,
    resetCreateDefaultState,
    resetCreateState,
    resetRemoteState,
    resetLocalFolderFlow,
    resetServerPathFlow,
    setAddProjectBusyLabel,
    setIsAdding
  ])

  useAddRepoHostChangeReset({
    isOpen,
    selectedHostId,
    onResetClosed: resetState,
    onResetHostScopedState: resetHostScopedState
  })
  return resetState
}
