import { useId, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '../../store'
import type { Repo } from '../../../../shared/repo-types'
import {
  projectAgentAccountId,
  projectAgentAccountUpdate,
  type WorktreeAccountAgent
} from '../../../../shared/worktree-agent-account'
import { SearchableSetting } from './SearchableSetting'
import { searchKeywords } from './settings-search-keywords'
import { isWebClientLocation } from '@/lib/web-client-location'
import {
  PC_DEFAULT_VALUE,
  agentPcDefaultEmail,
  agentStartOptions
} from '../project-accounts/start-account-options'

type RepositoryAgentAccountSectionProps = {
  repo: Repo
  agent: WorktreeAccountAgent
  updateRepo: (
    repoId: string,
    updates: { claudeAccountId?: string | null; codexAccountId?: string | null }
  ) => unknown
  forceVisible?: boolean
}

const AGENT_COPY: Record<
  WorktreeAccountAgent,
  () => { title: string; description: string; systemDefault: string }
> = {
  claude: () => ({
    title: translate(
      'auto.components.settings.RepositoryAgentAccountSection.title',
      'Claude account'
    ),
    description: translate(
      'auto.components.settings.RepositoryAgentAccountSection.description',
      'Claude agents in this project use this account’s quota.'
    ),
    systemDefault: translate(
      'auto.components.projectAccounts.startAccounts.claudeDefault',
      'System Claude login (this PC’s default)'
    )
  }),
  codex: () => ({
    title: translate(
      'auto.components.settings.RepositoryAgentAccountSection.codexTitle',
      'Codex account'
    ),
    description: translate(
      'auto.components.settings.RepositoryAgentAccountSection.codexDescription',
      'Codex agents in this project use this account’s quota.'
    ),
    systemDefault: translate(
      'auto.components.projectAccounts.startAccounts.codexDefault',
      'System Codex login (this PC’s default)'
    )
  })
}

/** The project's default account for `agent`; a worktree created with its own pick keeps that pick. */
export function RepositoryAgentAccountSection({
  repo,
  agent,
  updateRepo,
  forceVisible
}: RepositoryAgentAccountSectionProps): React.JSX.Element {
  const labelId = useId()
  const settings = useAppStore((state) => state.settings)
  const [saving, setSaving] = useState(false)
  const options = agentStartOptions(agent, settings)
  const value = projectAgentAccountId(repo, agent) ?? PC_DEFAULT_VALUE
  const copy = AGENT_COPY[agent]()
  const offered = value === PC_DEFAULT_VALUE || options.some((option) => option.value === value)
  const pcDefaultEmail = agentPcDefaultEmail(agent, settings)

  return (
    <SearchableSetting
      title={copy.title}
      description={copy.description}
      keywords={searchKeywords([repo.displayName, agent, 'account', 'quota', 'agent'])}
      className="space-y-3"
      forceVisible={forceVisible}
    >
      <div className="space-y-1">
        <div id={labelId} className="text-sm font-semibold">
          {copy.title}
        </div>
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.RepositoryAgentAccountSection.hint',
            'Applies to agents started after the change. A worktree that picked its own account keeps it.'
          )}
        </p>
      </div>
      <Select
        value={value}
        disabled={saving}
        onValueChange={(next) => {
          setSaving(true)
          const accountId = next === PC_DEFAULT_VALUE ? null : next
          void Promise.resolve(
            updateRepo(repo.id, projectAgentAccountUpdate(agent, accountId))
          ).finally(() => setSaving(false))
        }}
      >
        <SelectTrigger size="sm" className="w-full" aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={PC_DEFAULT_VALUE}>
            {pcDefaultEmail
              ? translate(
                  'auto.components.projectAccounts.startAccounts.pcDefault',
                  '{{value0}} (this PC’s default)',
                  { value0: pcDefaultEmail }
                )
              : copy.systemDefault}
          </SelectItem>
          {offered ? null : (
            // Why: keep a removed account visible so the trigger explains the fallback.
            <SelectItem value={value} disabled>
              {translate(
                'auto.components.projectAccounts.account.unavailable',
                'Unavailable account'
              )}
            </SelectItem>
          )}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </SearchableSetting>
  )
}

/** Claude and Codex defaults for a local project (git or folder); SSH projects own their accounts. */
export function RepositoryAgentAccountSections(
  props: Omit<RepositoryAgentAccountSectionProps, 'agent'>
): React.JSX.Element | null {
  if (props.repo.connectionId || isWebClientLocation()) {
    return null
  }
  return (
    <>
      <RepositoryAgentAccountSection {...props} agent="claude" />
      <RepositoryAgentAccountSection {...props} agent="codex" />
    </>
  )
}
