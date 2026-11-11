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
import { SearchableSetting } from './SearchableSetting'
import { searchKeywords } from './settings-search-keywords'
import {
  PC_DEFAULT_VALUE,
  claudePcDefaultEmail,
  claudeStartOptions
} from '../project-accounts/start-account-options'

type RepositoryAgentAccountSectionProps = {
  repo: Repo
  updateRepo: (repoId: string, updates: { agentAccountId?: string | null }) => unknown
  forceVisible?: boolean
}

/** The project's default Claude account; a worktree created with its own pick keeps that pick. */
export function RepositoryAgentAccountSection({
  repo,
  updateRepo,
  forceVisible
}: RepositoryAgentAccountSectionProps): React.JSX.Element {
  const labelId = useId()
  const settings = useAppStore((state) => state.settings)
  const [saving, setSaving] = useState(false)
  const options = claudeStartOptions(settings)
  const value = repo.agentAccountId ?? PC_DEFAULT_VALUE
  const offered = value === PC_DEFAULT_VALUE || options.some((option) => option.value === value)
  const pcDefaultEmail = claudePcDefaultEmail(settings)

  const title = translate(
    'auto.components.settings.RepositoryAgentAccountSection.title',
    'Claude account'
  )
  return (
    <SearchableSetting
      title={title}
      description={translate(
        'auto.components.settings.RepositoryAgentAccountSection.description',
        'Claude agents in this project use this account’s quota.'
      )}
      keywords={searchKeywords([repo.displayName, 'claude', 'account', 'quota', 'agent'])}
      className="space-y-3"
      forceVisible={forceVisible}
    >
      <div className="space-y-1">
        <div id={labelId} className="text-sm font-semibold">
          {title}
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
          void Promise.resolve(
            updateRepo(repo.id, { agentAccountId: next === PC_DEFAULT_VALUE ? null : next })
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
              : translate(
                  'auto.components.projectAccounts.startAccounts.claudeDefault',
                  'System Claude login (this PC’s default)'
                )}
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
