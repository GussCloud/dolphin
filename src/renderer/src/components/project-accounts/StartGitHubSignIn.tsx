import { useState } from 'react'
import { Terminal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { OnboardingInlineCommandTerminal } from '@/components/onboarding/OnboardingInlineCommandTerminal'
import { translate } from '@/i18n/i18n'
import type { GhAccountBinding } from '../../../../shared/github/account-binding'
import type { GhAccountBindingInventory } from '../../../../shared/github/auth-types'
import {
  ghAuthLoginCommand,
  ghAuthSwitchCommand,
  normalizeGhHostInput
} from './gh-account-commands'

type Phase =
  | { kind: 'host' }
  | { kind: 'login'; host: string; command: string; previousActive: string | null; known: string[] }
  | { kind: 'restore'; command: string; added: GhAccountBinding | null }

type StartGitHubSignInProps = {
  inventory: GhAccountBindingInventory | null
  /** Re-reads gh's logins; resolves with the fresh inventory. */
  reload: () => Promise<GhAccountBindingInventory | null>
  onSignedIn: (binding: GhAccountBinding | null) => void
  onClose: () => void
}

function activeLogin(inventory: GhAccountBindingInventory | null, host: string): string | null {
  return inventory?.accounts.find((entry) => entry.host === host && entry.active)?.user ?? null
}

/** `gh auth login` in an inline terminal, then switches gh back so the PC default never changes. */
export function StartGitHubSignIn({
  inventory,
  reload,
  onSignedIn,
  onClose
}: StartGitHubSignInProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: 'host' })
  const [hostDraft, setHostDraft] = useState('github.com')
  const host = normalizeGhHostInput(hostDraft)

  const finishLogin = async (current: Extract<Phase, { kind: 'login' }>): Promise<void> => {
    const fresh = await reload()
    const added =
      fresh?.accounts.find(
        (entry) => entry.host === current.host && !current.known.includes(entry.user)
      ) ?? null
    const binding = added ? { host: added.host, user: added.user } : null
    const nowActive = activeLogin(fresh, current.host)
    const restore =
      current.previousActive && nowActive !== current.previousActive
        ? ghAuthSwitchCommand(current.host, current.previousActive)
        : null
    if (restore) {
      setPhase({ kind: 'restore', command: restore, added: binding })
      return
    }
    onSignedIn(binding)
    onClose()
  }

  if (phase.kind === 'host') {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={hostDraft}
          onChange={(event) => setHostDraft(event.target.value)}
          aria-label={translate(
            'auto.components.projectAccounts.startAccounts.githubHost',
            'GitHub host'
          )}
          aria-invalid={!host || undefined}
          className="h-8 flex-1"
          autoFocus
        />
        <Button
          type="button"
          size="sm"
          disabled={!host}
          onClick={() => {
            const command = host ? ghAuthLoginCommand(host) : null
            if (host && command) {
              setPhase({
                kind: 'login',
                host,
                command,
                previousActive: activeLogin(inventory, host),
                known: (inventory?.accounts ?? [])
                  .filter((entry) => entry.host === host)
                  .map((entry) => entry.user)
              })
            }
          }}
        >
          <Terminal className="size-3.5" />
          {translate('auto.components.projectAccounts.startAccounts.signIn', 'Sign in')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onClose}>
          {translate('auto.components.projectAccounts.startAccounts.cancel', 'Cancel')}
        </Button>
      </div>
    )
  }

  const restoring = phase.kind === 'restore'
  return (
    <OnboardingInlineCommandTerminal
      key={phase.command}
      worktreeId="add-project-github-accounts-terminal"
      command={phase.command}
      title={translate('auto.components.projectAccounts.startAccounts.terminalTitle', 'GitHub CLI')}
      ariaLabel={translate(
        'auto.components.projectAccounts.startAccounts.terminalAria',
        'GitHub account command'
      )}
      description={
        restoring
          ? translate(
              'auto.components.projectAccounts.startAccounts.restoreDescription',
              'gh made the new account active. Press Enter to keep your previous account as this PC’s default.'
            )
          : translate(
              'auto.components.projectAccounts.startAccounts.loginDescription',
              'Press Enter to sign in. Your current default account stays the default.'
            )
      }
      autoScrollIntoView
      onCommandFinished={(exitCode) => {
        if (phase.kind === 'login') {
          if (exitCode === 0) {
            void finishLogin(phase)
          }
          return
        }
        void reload().then(() => {
          onSignedIn(phase.added)
          onClose()
        })
      }}
      onTerminalExit={onClose}
    />
  )
}
