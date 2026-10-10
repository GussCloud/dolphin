import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { WINDOWS_GIT_BASH_SHELL } from '../../../../shared/windows-terminal-shell'
import {
  SettingsRow,
  SettingsSegmentedControl,
  SettingsSubsectionHeader
} from './SettingsFormControls'
import { SearchableSetting } from './SearchableSetting'
import { translate } from '@/i18n/i18n'
import { ShellIcon } from '../tab-bar/shell-icons'
import { PowerShell7InstallPanel } from './PowerShell7InstallPanel'

type TerminalWindowsShellSectionProps = {
  updateSettings: (updates: Partial<GlobalSettings>) => void
  windowsShell: string
  gitBashAvailable: boolean
  pwshAvailable: boolean
  pwshCapabilitiesLoading: boolean
  /** Explicit 'powershell.exe' pins Windows PowerShell 5.1 even when PowerShell 7 exists. */
  powerShellImplementation: GlobalSettings['terminalWindowsPowerShellImplementation']
  /** The install targets this machine, so it is hidden while Settings edits a remote host. */
  isLocalTerminalHost: boolean
}

function windowsShellLabel(shell: string, label: string): React.JSX.Element {
  return (
    <span className="inline-flex items-center justify-center gap-1.5">
      <ShellIcon shell={shell} size={12} />
      <span>{label}</span>
    </span>
  )
}

export function TerminalWindowsShellSection({
  updateSettings,
  windowsShell,
  gitBashAvailable,
  pwshAvailable,
  pwshCapabilitiesLoading,
  powerShellImplementation,
  isLocalTerminalHost
}: TerminalWindowsShellSectionProps): React.JSX.Element {
  const usesPwsh = pwshAvailable && powerShellImplementation !== 'powershell.exe'
  const powerShellLabel = usesPwsh
    ? translate('auto.components.settings.TerminalWindowsShellSection.powerShell7', 'PowerShell 7')
    : translate('auto.components.settings.TerminalPane.eb7fc4d98a', 'PowerShell')
  const showGitBashOption = gitBashAvailable || windowsShell === WINDOWS_GIT_BASH_SHELL
  // Why: selecting WSL here would omit its required distro, but an existing WSL default must stay visible.
  const showWslOption = windowsShell === 'wsl.exe'

  return (
    <section key="windows-shell" className="space-y-3">
      <SettingsSubsectionHeader
        title={translate('auto.components.settings.TerminalPane.87e678a8af', 'Windows Shell')}
        description={translate(
          'auto.components.settings.TerminalPane.a55eee649f',
          'Default shell for new terminal panes on Windows.'
        )}
      />

      <div className="divide-y divide-border/40">
        <SearchableSetting
          title={translate('auto.components.settings.TerminalPane.27e301f22c', 'Default Shell')}
          description={translate(
            'auto.components.settings.TerminalPane.bd68f3170d',
            'Choose the default shell for new terminal panes on Windows.'
          )}
          keywords={[
            'terminal',
            'windows',
            'shell',
            'powershell',
            'cmd',
            'command prompt',
            'git bash',
            'bash.exe',
            'default'
          ]}
        >
          <SettingsRow
            label={translate('auto.components.settings.TerminalPane.27e301f22c', 'Default Shell')}
            description={translate(
              'auto.components.settings.TerminalPane.09bf02de9a',
              'Shell used when opening a new terminal pane. Takes effect for new terminals.'
            )}
            control={
              <SettingsSegmentedControl
                ariaLabel={translate(
                  'auto.components.settings.TerminalPane.27e301f22c',
                  'Default Shell'
                )}
                value={windowsShell}
                onChange={(value) => updateSettings({ terminalWindowsShell: value })}
                options={[
                  {
                    value: 'powershell.exe',
                    label: windowsShellLabel('powershell.exe', powerShellLabel),
                    ariaLabel: powerShellLabel
                  },
                  {
                    value: 'cmd.exe',
                    label: windowsShellLabel(
                      'cmd.exe',
                      translate(
                        'auto.components.settings.TerminalPane.0f1b8669e6',
                        'Command Prompt'
                      )
                    ),
                    ariaLabel: translate(
                      'auto.components.settings.TerminalPane.0f1b8669e6',
                      'Command Prompt'
                    )
                  },
                  ...(showGitBashOption
                    ? [
                        {
                          value: WINDOWS_GIT_BASH_SHELL,
                          label: windowsShellLabel(
                            WINDOWS_GIT_BASH_SHELL,
                            translate(
                              'auto.components.settings.TerminalPane.f61ac77f16',
                              'Git Bash'
                            )
                          ),
                          ariaLabel: translate(
                            'auto.components.settings.TerminalPane.f61ac77f16',
                            'Git Bash'
                          ),
                          disabled: !gitBashAvailable
                        }
                      ]
                    : []),
                  ...(showWslOption
                    ? [
                        {
                          value: 'wsl.exe',
                          label: windowsShellLabel(
                            'wsl.exe',
                            translate('auto.components.settings.TerminalPane.b637dd57a7', 'WSL')
                          ),
                          ariaLabel: translate(
                            'auto.components.settings.TerminalPane.b637dd57a7',
                            'WSL'
                          ),
                          disabled: true
                        }
                      ]
                    : [])
                ]}
              />
            }
          />
        </SearchableSetting>
      </div>
      {usesPwsh ? (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.TerminalWindowsShellSection.pwshRecommended',
            'PowerShell 7 is installed and recommended: new PowerShell terminals use it.'
          )}
        </p>
      ) : null}
      {isLocalTerminalHost ? (
        <PowerShell7InstallPanel
          pwshAvailable={pwshAvailable}
          capabilitiesLoading={pwshCapabilitiesLoading}
        />
      ) : null}
    </section>
  )
}
