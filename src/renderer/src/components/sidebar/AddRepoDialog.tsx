import React, { useCallback, useState } from 'react'
import { useAppStore } from '@/store'
import { useRemoteRepo } from './AddRepoSteps'
import { useCreateRepo } from './useCreateRepo'
import { AddRepoDialogStepContent } from './AddRepoDialogStepContent'
import type { AddRepoDialogStep } from './add-repo-dialog-types'
import { useAddRepoCloneFlow } from './useAddRepoCloneFlow'
import { useAddRepoLocalFolderFlow } from './useAddRepoLocalFolderFlow'
import { useAddRepoServerPathFlow } from './useAddRepoServerPathFlow'
import { useAddRepoHostSelection } from './use-add-repo-host-selection'
import { useCompleteGitRepoAdd } from './use-complete-git-repo-add'
import { useCreateProjectDefaults } from './useCreateProjectDefaults'
import { useAddRepoDialogReset } from './use-add-repo-dialog-reset'
import { AddRepoDialogChrome } from './AddRepoDialogChrome'
import { AddRepoHostSelectorSlot } from './AddRepoHostSelectorSlot'
import { useAddRepoNestedReviewController } from './useAddRepoNestedReviewController'
import {
  useAddRepoHostedController,
  type AddRepoDialogHostedController
} from './use-add-repo-hosted-controller'
import { routeAddRepoBrowse } from './add-repo-browse-authority'
import { useAddRepoAccountStep } from './use-add-repo-account-step'
import { useProjectStartAccounts } from '../project-accounts/use-project-start-accounts'
import { ProjectStartAccountsPanel } from '../project-accounts/ProjectStartAccountsPanel'
import { isWebClientLocation } from '@/lib/web-client-location'

export default React.memo(function AddRepoDialog({
  hosted
}: {
  hosted?: AddRepoDialogHostedController
}) {
  const isOpen = useAppStore((s) => (hosted ? hosted.open : s.activeModal === 'add-repo'))
  // Why: hosted mode never receives dropped paths through modalData — that
  // channel belongs to the store-modal instance.
  const droppedLocalPath = useAppStore((s) =>
    !hosted && typeof s.modalData.droppedLocalPath === 'string' ? s.modalData.droppedLocalPath : ''
  )
  const addRepoPath = useAppStore((s) => s.addRepoPath)
  const scanNestedRepos = useAppStore((s) => s.scanNestedRepos)
  const cancelNestedRepoScan = useAppStore((s) => s.cancelNestedRepoScan)
  const importNestedRepos = useAppStore((s) => s.importNestedRepos)
  const repos = useAppStore((s) => s.repos)
  const fetchWorktrees = useAppStore((s) => s.fetchWorktrees)
  const setHideDefaultBranchWorkspace = useAppStore((s) => s.setHideDefaultBranchWorkspace)
  const settings = useAppStore((s) => s.settings)
  const { closeModal, closeForFolderHandoff, finishProjectAdd, handleOpenSshSettings } =
    useAddRepoHostedController(hosted)
  const [step, setStep] = useState<AddRepoDialogStep>('add')
  const [isAdding, setIsAdding] = useState(false)
  const [addProjectBusyLabel, setAddProjectBusyLabel] = useState<string | null>(null)
  const completeGitRepoAdd = useCompleteGitRepoAdd({
    closeModal,
    setHideDefaultBranchWorkspace,
    finishProjectAdd
  })
  const hostSelection = useAddRepoHostSelection({ isOpen, setStep })
  const selectedRuntimeEnvironmentId =
    hostSelection.selectedParsedHost?.kind === 'runtime'
      ? hostSelection.selectedParsedHost.environmentId
      : null
  // Why desktop only: the panel signs in on this PC's gh, az and Claude, which a web client is not.
  const isLocalHost =
    isOpen && hostSelection.selectedParsedHost?.kind === 'local' && !isWebClientLocation()
  const startAccounts = useProjectStartAccounts(isLocalHost)
  const {
    nestedScan,
    nestedSelectedPaths,
    nestedGroupName,
    nestedScanInProgress,
    nestedScanId,
    setNestedSelectedPaths,
    setNestedGroupName,
    setNestedScanInProgress,
    getNestedRepoRuntimeKind,
    showNestedRepoReview,
    setActiveNestedScanId,
    handleStopNestedScan,
    resetNestedRepoReviewState,
    showRemoteNestedRepoReview,
    trackRemoteNestedScanResult,
    handleImportNestedRepos,
    handleOpenNestedRootFolder,
    resetNestedImportFlow,
    trackNestedBackAction
  } = useAddRepoNestedReviewController({
    reviewRuntimeEnvironmentId: selectedRuntimeEnvironmentId,
    cancelNestedRepoScan,
    closeModal: closeForFolderHandoff,
    fetchWorktrees,
    importNestedRepos,
    onGitRepoReady: completeGitRepoAdd,
    setIsAdding,
    activeRuntimeEnvironmentId: selectedRuntimeEnvironmentId,
    setStep
  })
  const {
    sshTargets,
    selectedTargetId,
    remotePath,
    remoteError,
    isAddingRemote,
    isScanningNested: isScanningRemoteNested,
    setSelectedTargetId,
    setRemotePath,
    setRemoteError,
    resetRemoteState,
    handleOpenRemoteStep,
    handleAddRemoteRepo,
    handleConnectTarget,
    stopRemoteNestedScan
  } = useRemoteRepo(
    fetchWorktrees,
    setStep,
    // Why: useRemoteRepo closes only for the non-git → confirm-dialog handoff.
    closeForFolderHandoff,
    (repoId, executionHostId) => completeGitRepoAdd(repoId, 'ssh_remote_path', executionHostId),
    scanNestedRepos,
    showRemoteNestedRepoReview,
    trackRemoteNestedScanResult
  )
  const {
    createName,
    createParent,
    createError,
    isCreating,
    setCreateName,
    setCreateParent,
    setCreateError,
    createIdentity,
    resetCreateState,
    handlePickParent,
    handleCreate
  } = useCreateRepo(
    fetchWorktrees,
    closeForFolderHandoff,
    (repoId, executionHostId) => completeGitRepoAdd(repoId, 'create_project', executionHostId),
    {
      hostId: hostSelection.selectedHostId,
      runtimeEnvironmentId: selectedRuntimeEnvironmentId,
      sshTargetId: hostSelection.selectedSshTargetId,
      startAccounts: startAccounts.accounts
    }
  )

  const {
    createDefaultParent,
    createGitAvailability,
    createRuntimeParentStatus,
    createParentDefaultPending,
    resetCreateDefaultState,
    markCreateParentTouched
  } = useCreateProjectDefaults({
    step,
    activeRuntimeEnvironmentId: selectedRuntimeEnvironmentId,
    sshTargetId: hostSelection.selectedSshTargetId,
    createParent,
    setCreateParent
  })

  const {
    cloneUrl,
    cloneDestination,
    cloneError,
    cloneProgress,
    isCloning,
    setCloneUrl,
    setCloneDestination,
    setCloneError,
    resetCloneFlow,
    handlePickDestination,
    handleClone,
    projectAccounts: cloneProjectAccounts
  } = useAddRepoCloneFlow({
    step,
    activeRuntimeEnvironmentId: selectedRuntimeEnvironmentId,
    sshTargetId: hostSelection.selectedSshTargetId,
    workspaceDir: settings?.workspaceDir,
    fetchWorktrees,
    onGitRepoReady: completeGitRepoAdd,
    startAccounts: startAccounts.accounts
  })

  const accounts = useAddRepoAccountStep(
    selectedRuntimeEnvironmentId,
    setStep,
    completeGitRepoAdd,
    {
      getStartAccounts: startAccounts.get
    }
  )
  const isRuntimeEnvironmentActive = Boolean(selectedRuntimeEnvironmentId)
  const selectedHostKind = hostSelection.selectedParsedHost?.kind
  const { handleBrowse, resetLocalFolderFlow } = useAddRepoLocalFolderFlow({
    isOpen,
    droppedLocalPath,
    activeRuntimeEnvironmentId: selectedRuntimeEnvironmentId,
    addRepoPath,
    // Why: this flow's closes are all folder/non-git outcomes that navigate.
    closeModal: closeForFolderHandoff,
    fetchWorktrees,
    scanNestedRepos,
    setActiveNestedScanId,
    setNestedScanInProgress,
    showNestedRepoReview,
    onGitRepoReady: completeGitRepoAdd,
    offerAccountStep: accounts.offer,
    onFolderRepoAdded: accounts.applyStartToFolder,
    setIsAdding,
    setAddProjectBusyLabel
  })
  const {
    serverPath,
    isAddingServerPath,
    setServerPath,
    resetServerPathFlow,
    handleAddServerPath
  } = useAddRepoServerPathFlow({
    addRepoPath,
    activeRuntimeEnvironmentId: selectedRuntimeEnvironmentId,
    // Why: closes only after a folder add, which activates the folder workspace.
    closeModal: closeForFolderHandoff,
    fetchWorktrees,
    getNestedRepoRuntimeKind,
    scanNestedRepos,
    setActiveNestedScanId,
    setNestedScanInProgress,
    showNestedRepoReview,
    onGitRepoReady: accounts.offer,
    setAddProjectBusyLabel
  })

  const resetState = useAddRepoDialogReset({
    isOpen,
    selectedHostId: hostSelection.selectedHostId,
    setStep,
    setIsAdding,
    setAddProjectBusyLabel,
    resets: {
      resetLocalFolderFlow,
      resetServerPathFlow,
      resetCloneFlow,
      resetAccountStep: accounts.reset,
      resetNestedImportFlow,
      resetNestedRepoReviewState,
      resetCreateDefaultState,
      resetCreateState,
      resetRemoteState
    }
  })

  const handleBack = useCallback(() => {
    if (step === 'nested') {
      trackNestedBackAction()
    }
    resetState()
  }, [resetState, step, trackNestedBackAction])

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        if (step === 'nested' && !isAdding) {
          trackNestedBackAction()
        }
        closeModal()
        resetState()
      }
    },
    [closeModal, isAdding, resetState, step, trackNestedBackAction]
  )

  return (
    <AddRepoDialogChrome
      isOpen={isOpen}
      step={step}
      isAdding={isAdding}
      onBack={handleBack}
      onCloseAutoFocus={hosted?.onCloseAutoFocus}
      onOpenChange={handleOpenChange}
    >
      <AddRepoDialogStepContent
        step={step}
        isRuntimeEnvironmentActive={isRuntimeEnvironmentActive}
        activeRuntimeEnvironmentId={selectedRuntimeEnvironmentId}
        isSshLikely={false}
        repoCount={repos.length}
        isAdding={isAdding}
        addProjectBusyLabel={addProjectBusyLabel}
        nestedScanInProgress={nestedScanInProgress}
        nestedScanId={nestedScanId}
        serverPath={serverPath}
        isAddingServerPath={isAddingServerPath}
        cloneUrl={cloneUrl}
        cloneDestination={cloneDestination}
        cloneError={cloneError}
        cloneProgress={cloneProgress}
        isCloning={isCloning}
        sshTargets={sshTargets}
        selectedTargetId={selectedTargetId}
        selectedSshTargetId={hostSelection.selectedSshTargetId}
        selectedHostLabel={
          hostSelection.hostOptions.find((host) => host.id === hostSelection.selectedHostId)
            ?.label ?? null
        }
        lockSshTargetSelection={hostSelection.selectedParsedHost?.kind === 'ssh'}
        remotePath={remotePath}
        remoteError={remoteError}
        isAddingRemote={isAddingRemote}
        isScanningRemoteNested={isScanningRemoteNested}
        nestedScan={nestedScan}
        nestedSelectedPaths={nestedSelectedPaths}
        nestedGroupName={nestedGroupName}
        createName={createName}
        createParent={createParent}
        createError={createError}
        isCreating={isCreating}
        hostSelector={
          <AddRepoHostSelectorSlot
            hostSelection={hostSelection}
            accounts={isLocalHost ? <ProjectStartAccountsPanel state={startAccounts} /> : null}
          />
        }
        showRemoteAction={false}
        actionsDisabled={!hostSelection.selectedHostId}
        browseHostKind={selectedHostKind ?? 'runtime'}
        createDefaultParent={createDefaultParent}
        createGitAvailability={createGitAvailability}
        createRuntimeParentStatus={createRuntimeParentStatus}
        createParentDefaultPending={createParentDefaultPending}
        manualCreateParentEntry={isRuntimeEnvironmentActive || selectedHostKind === 'ssh'}
        onBrowse={() =>
          routeAddRepoBrowse(hostSelection.selectedParsedHost, {
            browseLocal: () => void handleBrowse(),
            browseRuntime: () => setStep('server-path'),
            browseSsh: (targetId) => void handleOpenRemoteStep(targetId)
          })
        }
        onOpenCloneStep={() => {
          if (!hostSelection.selectedHostId) {
            return
          }
          setCloneError(null)
          setStep('clone')
        }}
        onOpenCreateStep={() => {
          if (!hostSelection.selectedHostId) {
            return
          }
          setCreateError(null)
          setStep('create')
        }}
        onOpenRemoteStep={handleOpenRemoteStep}
        onStopNestedScan={handleStopNestedScan}
        onServerPathChange={setServerPath}
        onAddServerPath={(kind) => void handleAddServerPath(kind)}
        onSelectTarget={(id) => {
          setSelectedTargetId(id)
          setRemoteError(null)
        }}
        onRemotePathChange={(value) => {
          setRemotePath(value)
          setRemoteError(null)
        }}
        onAddRemoteRepo={handleAddRemoteRepo}
        onOpenSshSettings={handleOpenSshSettings}
        onConnectTarget={handleConnectTarget}
        onStopRemoteNestedScan={stopRemoteNestedScan}
        onCloneUrlChange={(value) => {
          setCloneUrl(value)
          setCloneError(null)
        }}
        onCloneDestinationChange={(value) => {
          setCloneDestination(value)
          setCloneError(null)
        }}
        onPickCloneDestination={handlePickDestination}
        onClone={handleClone}
        cloneProjectAccounts={cloneProjectAccounts}
        accountStep={accounts.state}
        createIdentity={createIdentity}
        onNestedGroupNameChange={setNestedGroupName}
        onNestedSelectedPathsChange={setNestedSelectedPaths}
        onImportNestedRepos={(mode) => void handleImportNestedRepos(mode)}
        onOpenNestedRootFolder={() => void handleOpenNestedRootFolder()}
        onCreateNameChange={(value) => {
          setCreateName(value)
          setCreateError(null)
        }}
        onCreateParentChange={(value) => {
          markCreateParentTouched(value)
          setCreateParent(value)
          setCreateError(null)
        }}
        onPickCreateParent={() => {
          void handlePickParent().then((dir) => {
            if (dir) {
              markCreateParentTouched(dir)
            }
          })
        }}
        onCreate={handleCreate}
      />
    </AddRepoDialogChrome>
  )
})
