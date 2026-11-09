import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Repo } from '../../../../shared/repo-types'
import type {
  AzureDevOpsManagedAccount,
  CommitIdentity
} from '../../../../shared/source-control-account-types'
import { Button } from '../ui/button'
import { SearchableSetting } from './SearchableSetting'
import { useAppStore } from '../../store'
import { getRepoOwnerRoutedSettings } from '@/lib/repo-runtime-owner'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { searchKeywords } from './settings-search-keywords'
import { listAzureDevOpsManagedAccounts } from '../project-accounts/project-account-client'
import {
  azureDevOpsAccountOptions,
  selectionFromValue,
  selectionValue
} from '../project-accounts/project-account-options'
import { ProjectAccountSelect } from '../project-accounts/ProjectAccountSelect'
import { CommitIdentityFields } from '../project-accounts/CommitIdentityFields'
import { TerminalGitAccountWarnings } from '../project-accounts/TerminalGitAccountWarnings'
import {
  commitIdentityDraftFrom,
  evaluateCommitIdentityDraft,
  type CommitIdentityDraft
} from '../project-accounts/commit-identity-draft'
import { isRepoAccountFieldEnforced } from '../project-accounts/repo-account-echo'

type RepoAccountUpdate = {
  azureDevOpsAccountId?: string | null
  commitIdentity?: CommitIdentity | null
}

type RepositoryAccountIdentitySectionProps = {
  repo: Repo
  /** True when the repo's remote is Azure DevOps; GitHub binding stays in its own section. */
  azureDevOpsRemote: boolean
  updateRepo: (repoId: string, updates: RepoAccountUpdate) => unknown
  forceVisible?: boolean
}

const AZURE_TARGET = { provider: 'azure-devops', host: 'dev.azure.com' } as const

export function RepositoryAccountIdentitySection({
  repo,
  azureDevOpsRemote,
  updateRepo,
  forceVisible
}: RepositoryAccountIdentitySectionProps): React.JSX.Element {
  const settings = useAppStore((state) => state.settings)
  const activeRuntimeEnvironmentId =
    getRepoOwnerRoutedSettings(settings, repo)?.activeRuntimeEnvironmentId ?? null
  const runtimeTarget = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId }),
    [activeRuntimeEnvironmentId]
  )
  const [azureAccounts, setAzureAccounts] = useState<AzureDevOpsManagedAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notEnforced, setNotEnforced] = useState(false)
  const [draft, setDraft] = useState<CommitIdentityDraft>(() =>
    commitIdentityDraftFrom(repo.commitIdentity)
  )
  const loadGenerationRef = useRef(0)

  const loadAccounts = useCallback(async () => {
    if (!azureDevOpsRemote) {
      return
    }
    const generation = ++loadGenerationRef.current
    setLoading(true)
    try {
      const next = await listAzureDevOpsManagedAccounts(runtimeTarget)
      if (generation === loadGenerationRef.current) {
        setAzureAccounts(next)
      }
    } catch (err) {
      if (generation === loadGenerationRef.current) {
        setError(err instanceof Error ? err.message : String(err))
      }
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false)
      }
    }
  }, [azureDevOpsRemote, runtimeTarget])

  useEffect(() => {
    void loadAccounts()
  }, [loadAccounts])

  const save = async (update: RepoAccountUpdate): Promise<void> => {
    setSaving(true)
    setError(null)
    setNotEnforced(false)
    try {
      const result = await Promise.resolve(updateRepo(repo.id, update))
      if (result === false) {
        setError(
          translate(
            'auto.components.settings.RepositoryAccountIdentitySection.saveFailed',
            'Could not save the project account settings.'
          )
        )
        return
      }
      const echoed = useAppStore.getState().repos.find((entry) => entry.id === repo.id)
      const enforced =
        update.azureDevOpsAccountId !== undefined
          ? isRepoAccountFieldEnforced('azureDevOpsAccountId', update.azureDevOpsAccountId, echoed)
          : isRepoAccountFieldEnforced('commitIdentity', update.commitIdentity ?? null, echoed)
      setNotEnforced(!enforced)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const draftResult = evaluateCommitIdentityDraft(draft)
  const savedIdentity = repo.commitIdentity ?? null
  const draftIdentity = draftResult.status === 'valid' ? draftResult.identity : null
  const draftChanged =
    (draftIdentity?.name ?? '') !== (savedIdentity?.name ?? '') ||
    (draftIdentity?.email ?? '') !== (savedIdentity?.email ?? '')
  const canSaveIdentity =
    !saving && (draftResult.status === 'valid' || draftResult.status === 'empty') && draftChanged

  const sectionTitle = azureDevOpsRemote
    ? translate(
        'auto.components.settings.RepositoryAccountIdentitySection.title',
        'Account and Commit Author'
      )
    : translate(
        'auto.components.settings.RepositoryAccountIdentitySection.authorTitle',
        'Commit Author'
      )

  const azureSelection = {
    provider: 'azure-devops' as const,
    azureDevOpsAccountId: repo.azureDevOpsAccountId ?? null
  }

  return (
    <SearchableSetting
      title={sectionTitle}
      description={translate(
        'auto.components.settings.RepositoryAccountIdentitySection.description',
        'Choose the account and the commit author this project uses.'
      )}
      keywords={searchKeywords([
        repo.displayName,
        'azure devops',
        'account',
        'commit author',
        'git identity',
        'email'
      ])}
      className="space-y-3"
      forceVisible={forceVisible}
    >
      <div className="space-y-1">
        <div className="text-sm font-semibold">{sectionTitle}</div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.RepositoryAccountIdentitySection.pickerDescription',
            'Commits Dolphin and this project’s terminals create use the author below.'
          )}
        </p>
      </div>

      {azureDevOpsRemote ? (
        <ProjectAccountSelect
          provider="azure-devops"
          host={AZURE_TARGET.host}
          options={azureDevOpsAccountOptions(azureAccounts)}
          value={selectionValue(azureSelection)}
          loading={loading}
          disabled={saving}
          onRefresh={() => void loadAccounts()}
          onChange={(value) => {
            const next = selectionFromValue(value, AZURE_TARGET, {
              inventory: null,
              azureAccounts
            })
            if (next?.provider === 'azure-devops' && value !== selectionValue(azureSelection)) {
              void save({ azureDevOpsAccountId: next.azureDevOpsAccountId })
            }
          }}
        />
      ) : null}

      <TerminalGitAccountWarnings
        repoId={repo.id}
        runtimeTarget={runtimeTarget}
        bindingKey={JSON.stringify([
          repo.ghAccount ?? null,
          repo.azureDevOpsAccountId ?? null,
          repo.commitIdentity ?? null
        ])}
      />

      <CommitIdentityFields draft={draft} onChange={setDraft} disabled={saving} />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!canSaveIdentity}
          onClick={() => void save({ commitIdentity: draftIdentity })}
        >
          {translate(
            'auto.components.settings.RepositoryAccountIdentitySection.save',
            'Save author'
          )}
        </Button>
      </div>

      {notEnforced ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.RepositoryAccountIdentitySection.notEnforced',
            'Saved, but not enforced by this runtime (mixed-version host).'
          )}
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </SearchableSetting>
  )
}
