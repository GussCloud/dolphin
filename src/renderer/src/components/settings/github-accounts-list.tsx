import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Terminal, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { OnboardingInlineCommandTerminal } from '@/components/onboarding/OnboardingInlineCommandTerminal'
import { useAppStore } from '@/store'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import type { GhAuthAccount } from '../../../../shared/github/auth-types'
import { listGhHostAccounts } from '../project-accounts/project-account-client'
import {
  ghAuthLoginCommand,
  ghAuthLogoutCommand,
  normalizeGhHostInput
} from '../project-accounts/gh-account-commands'

type GitHubAccountsListProps = {
  /** Re-runs the card's preflight so its status follows logins added or removed here. */
  onAccountsChanged: () => void
}

export function GitHubAccountsList({
  onAccountsChanged
}: GitHubAccountsListProps): React.JSX.Element {
  const activeRuntimeEnvironmentId = useAppStore(
    (s) => s.settings?.activeRuntimeEnvironmentId ?? null
  )
  const runtimeTarget = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId }),
    [activeRuntimeEnvironmentId]
  )
  const confirm = useConfirmationDialog()
  const [accounts, setAccounts] = useState<GhAuthAccount[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [addingHost, setAddingHost] = useState<string | null>(null)
  const [command, setCommand] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    setError(null)
    try {
      const inventory = await listGhHostAccounts(runtimeTarget)
      if (generation === loadGenerationRef.current) {
        setAccounts(inventory.accounts)
      }
    } catch (err) {
      if (generation === loadGenerationRef.current) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }
  }, [runtimeTarget])

  useEffect(() => {
    void load()
  }, [load])

  const hosts = useMemo(() => {
    const byHost = new Map<string, GhAuthAccount[]>()
    for (const account of accounts ?? []) {
      byHost.set(account.host, [...(byHost.get(account.host) ?? []), account])
    }
    return [...byHost.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [accounts])

  const removeAccount = async (account: GhAuthAccount): Promise<void> => {
    const logout = ghAuthLogoutCommand(account.host, account.user)
    if (!logout) {
      return
    }
    const confirmed = await confirm({
      title: translate(
        'auto.components.settings.githubAccountsList.removeTitle',
        'Remove GitHub account?'
      ),
      description: translate(
        'auto.components.settings.githubAccountsList.removeDescription',
        'Runs gh auth logout for {{user}} on {{host}}. Projects bound to it fall back to the default account.',
        { user: account.user, host: account.host }
      ),
      confirmLabel: translate(
        'auto.components.settings.githubAccountsList.removeConfirm',
        'Remove'
      ),
      confirmVariant: 'destructive'
    })
    if (confirmed) {
      setCommand(logout)
    }
  }

  const hostDraftValid = addingHost !== null && normalizeGhHostInput(addingHost) !== null
  const startLogin = (): void => {
    const login = addingHost === null ? null : ghAuthLoginCommand(addingHost)
    if (login) {
      setCommand(login)
      setAddingHost(null)
    }
  }

  return (
    <div className="space-y-2">
      {hosts.length === 0 && accounts !== null ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.githubAccountsList.empty',
            'No GitHub accounts signed in.'
          )}
        </p>
      ) : null}
      {hosts.map(([host, hostAccounts]) => (
        <div key={host} className="space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground">{host}</div>
          <ul className="space-y-1">
            {hostAccounts.map((account) => (
              <li
                key={`${account.host}/${account.user}`}
                className="flex items-center gap-2 text-xs"
              >
                <span className="min-w-0 truncate font-mono">{account.user}</span>
                {account.active ? (
                  <Badge variant="secondary">
                    {translate('auto.components.settings.githubAccountsList.active', 'Active')}
                  </Badge>
                ) : null}
                {account.source === 'env' ? (
                  <Badge variant="outline">
                    {account.envToken ??
                      translate(
                        'auto.components.settings.githubAccountsList.envToken',
                        'Environment token'
                      )}
                  </Badge>
                ) : null}
                <span className="flex-1" />
                {account.source === 'keyring' ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={command !== null}
                    onClick={() => void removeAccount(account)}
                    aria-label={translate(
                      'auto.components.settings.githubAccountsList.removeAria',
                      'Remove {{user}} on {{host}}',
                      { user: account.user, host: account.host }
                    )}
                    title={translate(
                      'auto.components.settings.githubAccountsList.removeConfirm',
                      'Remove'
                    )}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {addingHost !== null ? (
        <div className="flex items-center gap-2">
          <Input
            value={addingHost}
            onChange={(event) => setAddingHost(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                event.preventDefault()
                startLogin()
              } else if (event.key === 'Escape') {
                setAddingHost(null)
              }
            }}
            aria-label={translate(
              'auto.components.settings.githubAccountsList.hostLabel',
              'GitHub host'
            )}
            aria-invalid={!hostDraftValid || undefined}
            className="h-8 flex-1"
            autoFocus
          />
          <Button type="button" size="sm" disabled={!hostDraftValid} onClick={startLogin}>
            <Terminal className="size-3.5" />
            {translate('auto.components.settings.githubAccountsList.signIn', 'Sign in')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setAddingHost(null)}>
            {translate('auto.components.settings.githubAccountsList.cancel', 'Cancel')}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={command !== null}
          onClick={() => setAddingHost('github.com')}
        >
          <Plus className="size-3.5" />
          {translate('auto.components.settings.githubAccountsList.add', 'Add account')}
        </Button>
      )}
      {command ? (
        <OnboardingInlineCommandTerminal
          worktreeId="github-accounts-terminal"
          command={command}
          title={translate(
            'auto.components.settings.githubAccountsList.terminalTitle',
            'GitHub CLI'
          )}
          ariaLabel={translate(
            'auto.components.settings.githubAccountsList.terminalAria',
            'GitHub account command'
          )}
          description={translate(
            'auto.components.settings.githubAccountsList.terminalDescription',
            'Press Enter to run the command. Dolphin re-checks accounts when it ends.'
          )}
          autoScrollIntoView
          onCommandFinished={(exitCode) => {
            void load()
            onAccountsChanged()
            if (exitCode === 0) {
              setCommand(null)
            }
          }}
          onTerminalExit={() => setCommand(null)}
        />
      ) : null}
    </div>
  )
}
