import { useCallback, useEffect, useId, useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import {
  addAzureDevOpsManagedAccount,
  listAzureDevOpsManagedAccounts,
  listGhHostAccounts
} from './project-account-client'
import { githubAccountValue } from './project-account-options'
import {
  PC_DEFAULT_VALUE,
  azureStartOptions,
  claudePcDefaultEmail,
  claudeStartOptions,
  githubBindingFromValue,
  githubPcDefaultLogin,
  githubStartOptions,
  type StartAccountOption
} from './start-account-options'
import { StartGitHubSignIn } from './StartGitHubSignIn'
import { CommitIdentityFields } from './CommitIdentityFields'
import { commitIdentityDraftFrom, evaluateCommitIdentityDraft } from './commit-identity-draft'
import type { ProjectStartAccountsState } from './use-project-start-accounts'

const LOCAL_TARGET = getActiveRuntimeTarget({ activeRuntimeEnvironmentId: null })

type StartAccountRowProps = {
  label: string
  defaultLabel: string
  options: readonly StartAccountOption[]
  value: string | null
  busy: boolean
  addLabel: string
  onChange: (value: string | null) => void
  onAdd: () => void
}

function StartAccountRow(props: StartAccountRowProps): React.JSX.Element {
  const labelId = useId()
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_auto] items-center gap-2">
      <span id={labelId} className="truncate text-xs text-muted-foreground">
        {props.label}
      </span>
      <Select
        value={props.value ?? PC_DEFAULT_VALUE}
        disabled={props.busy}
        onValueChange={(next) => props.onChange(next === PC_DEFAULT_VALUE ? null : next)}
      >
        <SelectTrigger size="sm" className="w-full min-w-0" aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PC_DEFAULT_VALUE}>{props.defaultLabel}</SelectItem>
          {props.options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={props.busy}
        onClick={props.onAdd}
        aria-label={props.addLabel}
        title={props.addLabel}
      >
        {props.busy ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
      </Button>
    </div>
  )
}

function pcDefault(name: string | null, fallback: string): string {
  return name
    ? translate(
        'auto.components.projectAccounts.startAccounts.pcDefault',
        '{{value0}} (this PC’s default)',
        {
          value0: name
        }
      )
    : fallback
}

/** First-screen account picks for a project added on this PC; each later step inherits them. */
export function ProjectStartAccountsPanel({
  state
}: {
  state: ProjectStartAccountsState
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const fetchSettings = useAppStore((s) => s.fetchSettings)
  const [inventory, setInventory] = useState<GhAccountBindingInventory | null>(null)
  const [azureAccounts, setAzureAccounts] = useState<AzureDevOpsManagedAccount[]>([])
  const [signingInGitHub, setSigningInGitHub] = useState(false)
  const [adding, setAdding] = useState<'azure' | 'claude' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const { accounts, setGhAccount, setAzureDevOpsAccount, setAgentAccountId, setCommitIdentity } =
    state

  const reloadGitHub = useCallback(async () => {
    const next = await listGhHostAccounts(LOCAL_TARGET).catch(() => null)
    setInventory(next)
    return next
  }, [])
  useEffect(() => {
    void reloadGitHub()
    void listAzureDevOpsManagedAccounts(LOCAL_TARGET).then(setAzureAccounts, () => undefined)
  }, [reloadGitHub])

  const addAzure = async (): Promise<void> => {
    setAdding('azure')
    setError(null)
    const result = await addAzureDevOpsManagedAccount('in-app')
    setAdding(null)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setAzureAccounts((prev) => [...prev.filter((a) => a.id !== result.account.id), result.account])
    setAzureDevOpsAccount({ id: result.account.id, login: result.account.login })
  }

  const addClaude = async (): Promise<void> => {
    const before = new Set((settings?.claudeManagedAccounts ?? []).map((account) => account.id))
    setAdding('claude')
    setError(null)
    try {
      await window.api.claudeAccounts.add({ runtime: 'host', wslDistro: null })
      await fetchSettings()
      const added = useAppStore
        .getState()
        .settings?.claudeManagedAccounts.find(
          (account) => !before.has(account.id) && account.managedAuthRuntime !== 'wsl'
        )
      if (added) {
        setAgentAccountId(added.id)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(null)
    }
  }

  const azureLogin = (id: string): string =>
    azureAccounts.find((account) => account.id === id)?.login ?? ''

  return (
    <section className="space-y-2" data-add-project-accounts>
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {translate(
          'auto.components.projectAccounts.startAccounts.title',
          'Accounts for this project'
        )}
      </p>
      <StartAccountRow
        label={translate('auto.components.projectAccounts.startAccounts.githubLabel', 'GitHub')}
        defaultLabel={pcDefault(
          githubPcDefaultLogin(inventory),
          translate(
            'auto.components.projectAccounts.startAccounts.ghDefault',
            'Active gh login (this PC’s default)'
          )
        )}
        options={githubStartOptions(inventory)}
        value={accounts.ghAccount ? githubAccountValue(accounts.ghAccount) : null}
        busy={signingInGitHub}
        addLabel={translate(
          'auto.components.projectAccounts.startAccounts.addGitHub',
          'Add GitHub account'
        )}
        onChange={(value) => setGhAccount(value ? githubBindingFromValue(inventory, value) : null)}
        onAdd={() => setSigningInGitHub(true)}
      />
      {signingInGitHub ? (
        <StartGitHubSignIn
          inventory={inventory}
          reload={reloadGitHub}
          onSignedIn={(binding) => binding && setGhAccount(binding)}
          onClose={() => setSigningInGitHub(false)}
        />
      ) : null}
      <StartAccountRow
        label={translate(
          'auto.components.projectAccounts.startAccounts.azureDevOpsLabel',
          'Azure DevOps'
        )}
        defaultLabel={translate(
          'auto.components.projectAccounts.startAccounts.azureDefault',
          'Azure CLI sign-in (this PC’s default)'
        )}
        options={azureStartOptions(azureAccounts)}
        value={accounts.azureDevOpsAccountId}
        busy={adding === 'azure'}
        addLabel={translate(
          'auto.components.projectAccounts.startAccounts.addAzure',
          'Add Azure DevOps account'
        )}
        onChange={(id) => setAzureDevOpsAccount(id ? { id, login: azureLogin(id) } : null)}
        onAdd={() => void addAzure()}
      />
      <StartAccountRow
        label={translate('auto.components.projectAccounts.startAccounts.claudeLabel', 'Claude')}
        defaultLabel={pcDefault(
          claudePcDefaultEmail(settings),
          translate(
            'auto.components.projectAccounts.startAccounts.claudeDefault',
            'System Claude login (this PC’s default)'
          )
        )}
        options={claudeStartOptions(settings)}
        value={accounts.agentAccountId}
        busy={adding === 'claude'}
        addLabel={translate(
          'auto.components.projectAccounts.startAccounts.addClaude',
          'Add Claude account'
        )}
        onChange={setAgentAccountId}
        onAdd={() => void addClaude()}
      />
      {/* Why the shared picker: it lists every registered author as "Name <email>" and edits them. */}
      <div data-add-project-commit-author>
        <CommitIdentityFields
          draft={commitIdentityDraftFrom(accounts.commitIdentity)}
          onChange={(draft) => {
            const result = evaluateCommitIdentityDraft(draft)
            setCommitIdentity(result.status === 'valid' ? result.identity : null)
          }}
        />
      </div>
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  )
}
