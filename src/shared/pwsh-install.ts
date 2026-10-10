export const PWSH_WINGET_INSTALL_ARGS = [
  'install',
  '--id',
  'Microsoft.PowerShell',
  '--source',
  'winget',
  '--accept-package-agreements',
  '--accept-source-agreements'
] as const

export const PWSH_WINGET_INSTALL_COMMAND = `winget ${PWSH_WINGET_INSTALL_ARGS.join(' ')}`

export const PWSH_DOWNLOAD_URL = 'https://aka.ms/powershell-release?tag=stable'

export type PwshInstallResult =
  | { status: 'installed'; pwshAvailable: boolean }
  | { status: 'failed'; message: string }
  | { status: 'timed-out' }
  | { status: 'winget-unavailable' }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
