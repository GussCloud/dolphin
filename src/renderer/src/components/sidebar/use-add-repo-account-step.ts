import { useCallback, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import type { Repo } from '../../../../shared/repo-types'
import type { AddRepoExistingWorkspaceSource } from '../../../../shared/telemetry-events'
import { getRepoExecutionHostId, type ExecutionHostId } from '../../../../shared/execution-host'
import type { AddRepoDialogStep } from './add-repo-dialog-types'
import {
  planAddedRepoAccountStep,
  type AddedRepoAccountPlan
} from '../project-accounts/added-repo-account-plan'
import {
  isAccountBindingEchoed,
  resolveNewProjectAccountSettings,
  useNewProjectAccountDraft
} from '../project-accounts/new-project-account-settings'

export type GitRepoReady = (
  repoId: string,
  source: AddRepoExistingWorkspaceSource,
  executionHostId?: ExecutionHostId
) => Promise<void>

export type AddRepoAccountStepState = {
  repo: Repo
  plan: AddedRepoAccountPlan
  draft: ReturnType<typeof useNewProjectAccountDraft>
  saving: boolean
  onContinue: () => void
  onSkip: () => void
}

type Pending = {
  repo: Repo
  plan: AddedRepoAccountPlan
  source: AddRepoExistingWorkspaceSource
  executionHostId?: ExecutionHostId
}

function findAddedRepo(repoId: string, executionHostId?: ExecutionHostId): Repo | undefined {
  const repos = useAppStore.getState().repos
  return (
    repos.find(
      (repo) =>
        repo.id === repoId &&
        (executionHostId === undefined || getRepoExecutionHostId(repo) === executionHostId)
    ) ?? repos.find((repo) => repo.id === repoId)
  )
}

/** After an existing folder registers, offers the account + author step only when there is a choice. */
export function useAddRepoAccountStep(
  runtimeEnvironmentId: string | null,
  setStep: (step: AddRepoDialogStep) => void,
  onGitRepoReady: GitRepoReady
): {
  offer: GitRepoReady
  state: AddRepoAccountStepState | null
  reset: () => void
} {
  const runtimeTarget = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId: runtimeEnvironmentId }),
    [runtimeEnvironmentId]
  )
  const draft = useNewProjectAccountDraft()
  const resetDraft = draft.reset
  const [pending, setPending] = useState<Pending | null>(null)
  const [saving, setSaving] = useState(false)
  const generationRef = useRef(0)
  // Why: whoever claims the pending add (Continue, Use defaults, dismiss) is the only one to finish it.
  const pendingRef = useRef<Pending | null>(null)

  const offerAccountStep = useCallback<GitRepoReady>(
    async (repoId, source, executionHostId) => {
      const generation = ++generationRef.current
      const repo = findAddedRepo(repoId, executionHostId)
      const plan = repo ? await planAddedRepoAccountStep(repo, runtimeTarget) : null
      if (generation !== generationRef.current) {
        return
      }
      if (!repo || !plan) {
        await onGitRepoReady(repoId, source, executionHostId)
        return
      }
      resetDraft()
      pendingRef.current = { repo, plan, source, executionHostId }
      setPending(pendingRef.current)
      setStep('account')
    },
    [onGitRepoReady, resetDraft, runtimeTarget, setStep]
  )

  const resetAccountStep = useCallback(() => {
    generationRef.current++
    const unfinished = pendingRef.current
    pendingRef.current = null
    setPending(null)
    setSaving(false)
    resetDraft()
    // Why: closing the dialog on this step means "Use defaults"; never leave an added but unopened project.
    if (unfinished) {
      void onGitRepoReady(unfinished.repo.id, unfinished.source, unfinished.executionHostId)
    }
  }, [onGitRepoReady, resetDraft])

  const finish = async (apply: boolean): Promise<void> => {
    const current = pendingRef.current
    const settings = apply ? resolveNewProjectAccountSettings(draft.draft) : {}
    if (!current || !settings) {
      return
    }
    pendingRef.current = null
    setSaving(true)
    try {
      if (Object.keys(settings).length > 0) {
        const saved = await useAppStore
          .getState()
          .updateRepo(current.repo.id, settings, { hostId: getRepoExecutionHostId(current.repo) })
        const echoed = findAddedRepo(current.repo.id, current.executionHostId)
        if (saved === false || !echoed || !isAccountBindingEchoed(echoed, settings)) {
          toast.warning(
            translate(
              'auto.components.sidebar.useAddRepoAccountStep.notKept',
              'Project added, but the account and commit author were not kept. Set them in project settings.'
            )
          )
        }
      }
      await onGitRepoReady(current.repo.id, current.source, current.executionHostId)
    } finally {
      setSaving(false)
      setPending(null)
    }
  }

  const accountStep = pending
    ? {
        repo: pending.repo,
        plan: pending.plan,
        draft,
        saving,
        onContinue: () => void finish(true),
        onSkip: () => void finish(false)
      }
    : null

  return { offer: offerAccountStep, state: accountStep, reset: resetAccountStep }
}
