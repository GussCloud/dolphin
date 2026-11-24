import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import type { AddRepoExistingWorkspaceSource } from '../../../../shared/telemetry-events'
import type { Repo } from '../../../../shared/repo-types'
import { getCloneDestinationAutoFill } from './clone-defaults'
import type { AddRepoDialogStep } from './add-repo-dialog-types'
import { translate } from '@/i18n/i18n'
import { extractIpcErrorMessage } from '@/lib/ipc-error'
import { upsertAddedRepoWithProjectHostSetup } from './add-repo-store-upsert'
import { worktreeRefreshOptions } from './add-repo-runtime-owner'
import type { ExecutionHostId } from '../../../../shared/execution-host'
import {
  accountBindingArg,
  isAccountBindingEchoed,
  useNewProjectAccountDraft,
  type CloneProjectAccounts
} from '../project-accounts/new-project-account-settings'
import type { ProjectStartAccounts } from '../project-accounts/project-start-accounts'
import { cloneAccountSettings } from './clone-account-settings'
import { commitIdentityDraftFrom } from '../project-accounts/commit-identity-draft'
import {
  canOfferCloneAzureSignIn,
  signInToAzureAndRetryClone,
  type CloneAzureSignIn
} from './clone-azure-sign-in'

export function useAddRepoCloneFlow({
  step,
  activeRuntimeEnvironmentId,
  sshTargetId,
  workspaceDir,
  fetchWorktrees,
  onGitRepoReady,
  startAccounts
}: {
  step: AddRepoDialogStep
  activeRuntimeEnvironmentId: string | null | undefined
  sshTargetId?: string | null
  workspaceDir: string | null | undefined
  fetchWorktrees: (
    repoId: string,
    options?: { requireAuthoritative?: boolean; executionHostId?: ExecutionHostId }
  ) => Promise<unknown>
  onGitRepoReady: (
    repoId: string,
    source: AddRepoExistingWorkspaceSource,
    executionHostId?: ExecutionHostId
  ) => Promise<void>
  /** First-screen picks: preselect the clone account and author, and carry the agent account. */
  startAccounts?: ProjectStartAccounts
}): {
  cloneUrl: string
  cloneDestination: string
  cloneError: string | null
  cloneProgress: { phase: string; percent: number } | null
  isCloning: boolean
  setCloneUrl: Dispatch<SetStateAction<string>>
  setCloneDestination: Dispatch<SetStateAction<string>>
  setCloneError: Dispatch<SetStateAction<string | null>>
  resetCloneFlow: () => void
  handlePickDestination: () => Promise<void>
  handleClone: () => Promise<void>
  projectAccounts: CloneProjectAccounts
  azureSignIn: CloneAzureSignIn
} {
  const [cloneUrl, setCloneUrl] = useState('')
  const [cloneDestination, setCloneDestination] = useState('')
  const [isCloning, setIsCloning] = useState(false)
  const [cloneError, setCloneError] = useState<string | null>(null)
  const [cloneProgress, setCloneProgress] = useState<{ phase: string; percent: number } | null>(
    null
  )
  const [isAzureSigningIn, setIsAzureSigningIn] = useState(false)
  const [azureSignInError, setAzureSignInError] = useState<string | null>(null)
  const azureAuthMethod = useAppStore((s) => s.preflightStatus?.azureDevOps?.authMethod)
  const hostToken = `${activeRuntimeEnvironmentId?.trim() ?? ''}:${sshTargetId?.trim() ?? ''}`
  const hostTokenRef = useRef(hostToken)
  hostTokenRef.current = hostToken
  // Why: monotonic ID so stale clone callbacks can detect they were superseded.
  const cloneGenRef = useRef(0)
  // Why: track whether we've already auto-filled for this entry into the clone step,
  // so a late settings hydration still gets a chance to set the default.
  const cloneStepAutoFilledRef = useRef(false)
  // Why: a retry after sign-in must clone what the user asked for when it started.
  const cloneInputsRef = useRef('')
  cloneInputsRef.current = `${cloneUrl.trim()}\n${cloneDestination.trim()}`
  const accountDraft = useNewProjectAccountDraft()
  const resetProjectAccounts = accountDraft.reset
  const projectAccounts: CloneProjectAccounts = {
    ...accountDraft,
    preferred: startAccounts ?? null
  }
  const seedIdentity = accountDraft.seedIdentity
  const startIdentity = startAccounts?.commitIdentity ?? null
  useEffect(() => {
    // Why seed, not set: an author already typed in the clone form wins over the first screen.
    if (step === 'clone' && startIdentity) {
      seedIdentity(commitIdentityDraftFrom(startIdentity))
    }
  }, [seedIdentity, startIdentity, step])

  useEffect(() => {
    if (!isCloning) {
      return
    }
    return window.api.repos.onCloneProgress(setCloneProgress)
  }, [isCloning])

  const cloneDestinationAutoFill = getCloneDestinationAutoFill({
    step,
    cloneDestination,
    activeRuntimeEnvironmentId,
    sshTargetId,
    workspaceDir,
    cloneStepAutoFilled: cloneStepAutoFilledRef.current
  })
  if (step !== 'clone') {
    cloneStepAutoFilledRef.current = false
  } else if (cloneDestinationAutoFill) {
    // Why: late settings hydration should still seed the local clone path,
    // but runtime/server clone flows must keep their destination user-entered.
    cloneStepAutoFilledRef.current = true
    setCloneDestination(cloneDestinationAutoFill.destination)
  }

  const resetCloneFlow = useCallback((): void => {
    cloneGenRef.current++
    setCloneUrl('')
    setCloneDestination('')
    setIsCloning(false)
    setCloneError(null)
    setCloneProgress(null)
    setIsAzureSigningIn(false)
    setAzureSignInError(null)
    resetProjectAccounts()
  }, [resetProjectAccounts])

  const handlePickDestination = useCallback(async (): Promise<void> => {
    if (activeRuntimeEnvironmentId?.trim() || sshTargetId?.trim()) {
      // Why: the native folder picker returns a client-local path. Runtime
      // and SSH clone destinations must be typed as paths on that host.
      toast.error(
        translate(
          'auto.components.sidebar.useAddRepoCloneFlow.0dc4d1b657',
          'Enter a host path for the clone destination.'
        )
      )
      return
    }
    const gen = cloneGenRef.current
    const dir = await window.api.repos.pickDirectory()
    if (dir && gen === cloneGenRef.current) {
      setCloneDestination(dir)
      setCloneError(null)
    }
  }, [activeRuntimeEnvironmentId, sshTargetId])

  const handleClone = useCallback(async (): Promise<void> => {
    const trimmedUrl = cloneUrl.trim()
    // Why: SSH clones run git on the remote, where per-project accounts are not applied.
    const accountSettings = sshTargetId?.trim()
      ? {}
      : cloneAccountSettings(
          trimmedUrl,
          cloneDestination.trim(),
          startAccounts,
          projectAccounts.draft
        )
    if (!trimmedUrl || !cloneDestination.trim() || !accountSettings) {
      return
    }
    const requestHostToken = hostTokenRef.current
    const gen = ++cloneGenRef.current
    setIsCloning(true)
    setCloneError(null)
    setAzureSignInError(null)
    setCloneProgress(null)
    try {
      const target = activeRuntimeEnvironmentId?.trim()
        ? { kind: 'environment' as const, environmentId: activeRuntimeEnvironmentId.trim() }
        : getActiveRuntimeTarget({
            ...useAppStore.getState().settings,
            activeRuntimeEnvironmentId: null
          })
      const repo = sshTargetId?.trim()
        ? await window.api.repos.cloneRemote({
            connectionId: sshTargetId.trim(),
            url: trimmedUrl,
            destination: cloneDestination.trim(),
            ...accountBindingArg(accountSettings)
          })
        : target.kind === 'environment'
          ? (
              await callRuntimeRpc<{ repo: Repo }>(
                target,
                'repo.clone',
                {
                  url: trimmedUrl,
                  destination: cloneDestination.trim(),
                  ...accountBindingArg(accountSettings)
                },
                { timeoutMs: 10 * 60_000 }
              )
            ).repo
          : await window.api.repos.clone({
              url: trimmedUrl,
              destination: cloneDestination.trim(),
              ...accountBindingArg(accountSettings)
            })
      if (gen !== cloneGenRef.current || requestHostToken !== hostTokenRef.current) {
        return
      }
      const { repo: ownedRepo } = upsertAddedRepoWithProjectHostSetup(repo, {
        runtimeEnvironmentId: activeRuntimeEnvironmentId,
        sshConnectionId: sshTargetId
      })
      toast.success(
        translate('auto.components.sidebar.useAddRepoCloneFlow.4d0013cc93', 'Repository cloned'),
        { description: ownedRepo.displayName }
      )
      // Why: once the repo exists, a transient non-authoritative refresh
      // should fall through to project reveal instead of leaving the add flow open.
      const ownerOptions = worktreeRefreshOptions(activeRuntimeEnvironmentId, sshTargetId)
      if (!isAccountBindingEchoed(repo, accountSettings)) {
        toast.warning(
          translate(
            'auto.components.sidebar.useAddRepoCloneFlow.accountsNotEnforced',
            'Cloned, but this host did not keep the account and commit author (older version).'
          )
        )
      }
      await fetchWorktrees(ownedRepo.id, ownerOptions)
      if (gen !== cloneGenRef.current || requestHostToken !== hostTokenRef.current) {
        return
      }
      await onGitRepoReady(ownedRepo.id, 'clone_url', ownerOptions.executionHostId)
    } catch (err) {
      if (gen !== cloneGenRef.current || requestHostToken !== hostTokenRef.current) {
        return
      }
      const message = extractIpcErrorMessage(err, String(err))
      setCloneError(message)
    } finally {
      if (gen === cloneGenRef.current && requestHostToken === hostTokenRef.current) {
        setIsCloning(false)
      }
    }
  }, [
    activeRuntimeEnvironmentId,
    cloneUrl,
    cloneDestination,
    fetchWorktrees,
    onGitRepoReady,
    projectAccounts.draft,
    sshTargetId,
    startAccounts
  ])

  const handleAzureSignIn = useCallback(async (): Promise<void> => {
    const gen = cloneGenRef.current
    const requestHostToken = hostTokenRef.current
    const requestInputs = cloneInputsRef.current
    setIsAzureSigningIn(true)
    setAzureSignInError(null)
    // Why no try: signInToAzureAndRetryClone settles every failure, and handleClone catches its own.
    const error = await signInToAzureAndRetryClone({
      startSignIn: () => window.api.azureDevOps.startCliSignIn('device-code'),
      isStillCurrent: () =>
        gen === cloneGenRef.current &&
        requestHostToken === hostTokenRef.current &&
        requestInputs === cloneInputsRef.current,
      retryClone: handleClone
    })
    setAzureSignInError(error)
    setIsAzureSigningIn(false)
  }, [handleClone])

  return {
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
    projectAccounts,
    azureSignIn: {
      available: canOfferCloneAzureSignIn({
        cloneUrl,
        cloneError,
        isCloning,
        runtimeEnvironmentId: activeRuntimeEnvironmentId,
        sshTargetId,
        authMethod: azureAuthMethod,
        // Why the current form: it is the binding the retry would send.
        azureDevOpsAccountId: cloneAccountSettings(
          cloneUrl.trim(),
          cloneDestination.trim(),
          startAccounts,
          projectAccounts.draft
        )?.azureDevOpsAccountId
      }),
      isSigningIn: isAzureSigningIn,
      error: azureSignInError,
      signIn: handleAzureSignIn
    }
  }
}
