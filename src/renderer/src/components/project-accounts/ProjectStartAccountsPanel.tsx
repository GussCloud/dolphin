import { useCallback, useEffect, useId, useState } from 'react'
import { Plus, X } from 'lucide-react'
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
import { listAzureDevOpsManagedAccounts, listGhHostAccounts } from './project-account-client'
import { githubAccountValue } from './project-account-options'
import {
  PC_DEFAULT_VALUE,
  azureStartOptions,
  agentPcDefaultEmail,
  agentStartOptions,
  githubBindingFromValue,
  githubPcDefaultLogin,
  githubStartOptions,
  type StartAccountOption
} from './start-account-options'
import { StartGitHubSignIn } from './StartGitHubSignIn'
import { CommitIdentityFields } from './CommitIdentityFields'
import { commitIdentityDraftFrom, evaluateCommitIdentityDraft } from './commit-identity-draft'
import {
  projectAgentAccountId,
  type WorktreeAccountAgent
} from '../../../../shared/worktree-agent-account'
import type { ProjectStartAccountsState } from './use-project-start-accounts'
import { useStartAccountAdds } from './use-start-account-adds'

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
  /** While busy, the add button becomes a cancel button. */
  onCancel?: () => void
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
      {props.busy ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          disabled={!props.onCancel}
          onClick={props.onCancel}
          aria-label={translate(
            'auto.components.projectAccounts.startAccounts.cancelSignIn',
            'Cancel sign-in'
          )}
          title={translate(
            'auto.components.projectAccounts.startAccounts.cancelSignIn',
            'Cancel sign-in'
          )}
        >
          <X className="size-3.5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={props.onAdd}
          aria-label={props.addLabel}
          title={props.addLabel}
        >
          <Plus className="size-3.5" />
        </Button>
      )}
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

const START_AGENTS: readonly WorktreeAccountAgent[] = ['claude', 'codex']

const AGENT_ROW_COPY: Record<
  WorktreeAccountAgent,
  () => { label: string; systemDefault: string; add: string }
> = {
  claude: () => ({
    label: translate('auto.components.projectAccounts.startAccounts.claudeLabel', 'Claude'),
    systemDefault: translate(
      'auto.components.projectAccounts.startAccounts.claudeDefault',
      'System Claude login (this PC’s default)'
    ),
    add: translate('auto.components.projectAccounts.startAccounts.addClaude', 'Add Claude account')
  }),
  codex: () => ({
    label: translate('auto.components.projectAccounts.startAccounts.codexLabel', 'Codex'),
    systemDefault: translate(
      'auto.components.projectAccounts.startAccounts.codexDefault',
      'System Codex login (this PC’s default)'
    ),
    add: translate('auto.components.projectAccounts.startAccounts.addCodex', 'Add Codex account')
  })
}

/** First-screen account picks for a project added on this PC; each later step inherits them. */
export function ProjectStartAccountsPanel({
  state
}: {
  state: ProjectStartAccountsState
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [inventory, setInventory] = useState<GhAccountBindingInventory | null>(null)
  const [azureAccounts, setAzureAccounts] = useState<AzureDevOpsManagedAccount[]>([])
  const [signingInGitHub, setSigningInGitHub] = useState(false)
  const { accounts, setGhAccount, setAzureDevOpsAccount, setAgentAccount, setCommitIdentity } =
    state
  const adds = useStartAccountAdds({
    onAzureAdded: (account) => {
      setAzureAccounts((prev) => [...prev.filter((a) => a.id !== account.id), account])
      setAzureDevOpsAccount({ id: account.id, login: account.login })
    },
    onAgentAdded: setAgentAccount
  })

  const reloadGitHub = useCallback(async () => {
    const next = await listGhHostAccounts(LOCAL_TARGET).catch(() => null)
    setInventory(next)
    return next
  }, [])
  useEffect(() => {
    void reloadGitHub()
    void listAzureDevOpsManagedAccounts(LOCAL_TARGET).then(setAzureAccounts, () => undefined)
  }, [reloadGitHub])

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
        busy={adds.adding === 'azure'}
        onCancel={adds.cancel}
        addLabel={translate(
          'auto.components.projectAccounts.startAccounts.addAzure',
          'Add Azure DevOps account'
        )}
        onChange={(id) => setAzureDevOpsAccount(id ? { id, login: azureLogin(id) } : null)}
        onAdd={() => void adds.addAzure()}
      />
      {START_AGENTS.map((agent) => (
        <StartAccountRow
          key={agent}
          label={AGENT_ROW_COPY[agent]().label}
          defaultLabel={pcDefault(
            agentPcDefaultEmail(agent, settings),
            AGENT_ROW_COPY[agent]().systemDefault
          )}
          options={agentStartOptions(agent, settings)}
          value={projectAgentAccountId(accounts, agent) ?? null}
          busy={adds.adding === agent}
          addLabel={AGENT_ROW_COPY[agent]().add}
          onChange={(id) => setAgentAccount(agent, id)}
          onAdd={() => void adds.addAgent(agent)}
          onCancel={adds.cancel}
        />
      ))}
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
      {adds.error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {adds.error}
        </p>
      ) : null}
    </section>
  )
}
