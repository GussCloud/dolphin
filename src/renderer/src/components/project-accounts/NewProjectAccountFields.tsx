import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { CommitIdentityFields } from './CommitIdentityFields'
import { ProjectAccountSelect } from './ProjectAccountSelect'
import { listAzureDevOpsManagedAccounts, listGhHostAccounts } from './project-account-client'
import {
  azureDevOpsAccountOptions,
  githubAccountOptions,
  selectionFromValue,
  selectionValue
} from './project-account-options'
import { projectRemoteTargetFromUrl } from './project-account-provider'
import type { NewProjectAccountDraft } from './new-project-account-settings'
import type { CommitIdentityDraft } from './commit-identity-draft'
import type { ProjectAccountSelection } from './project-account-options'
import { preferredCloneSelection, type ProjectStartAccounts } from './project-start-accounts'

type NewProjectAccountFieldsProps = {
  /** Clone URL or the picked folder's remote; empty when the project has no remote yet. */
  remoteUrl: string
  runtimeEnvironmentId: string | null | undefined
  /** Distro the project will live in; its gh (not the Windows one) authenticates the clone. */
  wslDistro?: string | null
  draft: NewProjectAccountDraft
  onSelectionChange: (selection: ProjectAccountSelection | null) => void
  onIdentityChange: (identity: CommitIdentityDraft) => void
  disabled?: boolean
  /** First-screen picks; the matching provider's account is preselected once per remote. */
  preferred?: ProjectStartAccounts | null
}

export function NewProjectAccountFields({
  remoteUrl,
  runtimeEnvironmentId,
  wslDistro,
  draft,
  onSelectionChange,
  onIdentityChange,
  disabled,
  preferred
}: NewProjectAccountFieldsProps): React.JSX.Element {
  const runtimeTarget = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId: runtimeEnvironmentId ?? null }),
    [runtimeEnvironmentId]
  )
  const [inventory, setInventory] = useState<GhAccountBindingInventory | null>(null)
  const [azureAccounts, setAzureAccounts] = useState<AzureDevOpsManagedAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)

  const knownGitHubHosts = useMemo(
    () => (inventory?.accounts ?? []).map((account) => account.host),
    [inventory]
  )
  const target = projectRemoteTargetFromUrl(remoteUrl, knownGitHubHosts)
  const provider = target?.provider ?? null

  const load = useCallback(
    async (refreshCapability = false) => {
      const generation = ++loadGenerationRef.current
      setLoading(true)
      let error: string | null = null
      const [gh, azure] = await Promise.all([
        listGhHostAccounts(runtimeTarget, {
          refreshCapability,
          ...(wslDistro ? { wslDistro } : {})
        }).catch((err: unknown) => {
          error = err instanceof Error ? err.message : String(err)
          return null
        }),
        provider === 'azure-devops'
          ? listAzureDevOpsManagedAccounts(runtimeTarget).catch(() => [])
          : Promise.resolve<AzureDevOpsManagedAccount[]>([])
      ])
      if (generation === loadGenerationRef.current) {
        setInventory(gh)
        setAzureAccounts(azure)
        setLoadError(error)
        setLoading(false)
      }
    },
    [provider, runtimeTarget, wslDistro]
  )

  useEffect(() => {
    void load()
  }, [load])

  // Why: a URL edit can move the remote to another provider or host; never keep a stale binding.
  const selection = draft.selection
  const selectionStale =
    selection !== null &&
    (selection.provider !== provider ||
      (selection.provider === 'github' &&
        selection.ghAccount !== null &&
        selection.ghAccount.host.toLowerCase() !== target?.host.toLowerCase()))
  useEffect(() => {
    if (selectionStale) {
      onSelectionChange(null)
    }
  }, [onSelectionChange, selectionStale])

  const options = !target
    ? []
    : target.provider === 'github'
      ? githubAccountOptions(inventory, target.host)
      : azureDevOpsAccountOptions(azureAccounts)

  const preferredSelection = preferred ? preferredCloneSelection(preferred, target) : null
  const preferredValue = preferredSelection ? selectionValue(preferredSelection) : null
  const preferredOffered =
    preferredValue !== null &&
    options.some((option) => option.value === preferredValue && !option.disabled)
  const targetKey = target ? `${target.provider}:${target.host}` : null
  const preselectedForRef = useRef<string | null>(null)
  useEffect(() => {
    // Why once per remote: a later pick of the default account must not be overridden.
    if (!preferredSelection || !preferredOffered || selection !== null) {
      return
    }
    if (preselectedForRef.current !== targetKey) {
      preselectedForRef.current = targetKey
      onSelectionChange(preferredSelection)
    }
  }, [onSelectionChange, preferredOffered, preferredSelection, selection, targetKey])

  return (
    <div className="space-y-3">
      {target ? (
        <ProjectAccountSelect
          provider={target.provider}
          host={target.host}
          options={options}
          value={selectionValue(selectionStale ? null : selection)}
          loading={loading}
          disabled={disabled}
          onRefresh={() => void load(true)}
          error={loadError}
          onChange={(value) => {
            const next = selectionFromValue(value, target, { inventory, azureAccounts })
            if (next) {
              onSelectionChange(next)
            }
          }}
        />
      ) : null}
      <CommitIdentityFields
        draft={draft.identity}
        onChange={onIdentityChange}
        disabled={disabled}
      />
    </div>
  )
}
