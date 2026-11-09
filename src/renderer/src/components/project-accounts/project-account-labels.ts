import { translate } from '@/i18n/i18n'
import type { ProjectAccountProvider } from './project-account-provider'

/** One label for "no binding" everywhere a provider's default account is shown. */
export function defaultAccountLabel(provider: ProjectAccountProvider): string {
  return provider === 'github'
    ? translate(
        'auto.components.projectAccounts.account.githubDefault',
        'Default account (gh’s active login)'
      )
    : translate('auto.components.projectAccounts.account.azureDefault', 'Default sign-in')
}
