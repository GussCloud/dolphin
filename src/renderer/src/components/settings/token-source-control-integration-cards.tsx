import { ExternalLink, GitPullRequestArrow } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { IntegrationCardDetails, IntegrationCardShell } from './integration-card-shell'
import { usePreflightCardStatuses } from './source-control-preflight-card-status'
import { translate } from '@/i18n/i18n'
import { tokenProviderStatusLabel } from './token-source-control-status'

export function GiteaIntegrationCard(): React.JSX.Element {
  const { statuses, unavailable, refresh } = usePreflightCardStatuses('gitea')
  const status = unavailable ? 'unavailable' : statuses.giteaStatus
  const configured = status === 'configured'

  return (
    <IntegrationCardShell
      icon={<GitPullRequestArrow className="size-5" />}
      name="Gitea"
      description={
        configured
          ? statuses.giteaAccount
            ? translate(
                'auto.components.settings.token.source.control.integration.cards.0b5242f8a2',
                '{{value0}} · Pull requests and commit statuses',
                { value0: statuses.giteaAccount }
              )
            : statuses.giteaBaseUrl
              ? translate(
                  'auto.components.settings.token.source.control.integration.cards.0b5242f8a2',
                  '{{value0}} · Pull requests and commit statuses',
                  { value0: statuses.giteaBaseUrl }
                )
              : translate(
                  'auto.components.settings.token.source.control.integration.cards.52f75876be',
                  'Pull requests and commit statuses for detected repositories'
                )
          : translate(
              'auto.components.settings.token.source.control.integration.cards.05863d2599',
              'Pull requests and commit statuses via the Gitea REST API.'
            )
      }
      checking={status === 'checking'}
      statusTone={configured ? 'connected' : 'attention'}
      statusLabel={tokenProviderStatusLabel({
        configured,
        hasAccount: Boolean(statuses.giteaAccount),
        status,
        optional: true
      })}
    >
      {status !== 'checking' && !configured ? (
        <IntegrationCardDetails>
          <p className="text-xs text-muted-foreground">
            {status === 'unavailable' ? (
              translate(
                'auto.components.settings.token.source.control.integration.cards.0613928cb3',
                'Gitea status is not available in this runtime yet.'
              )
            ) : status === 'not-configured' ? (
              <>
                {translate(
                  'auto.components.settings.token.source.control.integration.cards.fcbe0469fd',
                  'Public repositories are detected from their git remote. Set'
                )}{' '}
                <span className="font-mono text-[11px]">
                  {translate(
                    'auto.components.settings.token.source.control.integration.cards.6d5c2a3005',
                    'DOLPHIN_GITEA_TOKEN'
                  )}
                </span>{' '}
                {translate(
                  'auto.components.settings.token.source.control.integration.cards.6da9dfa5de',
                  'for private repositories, and set'
                )}{' '}
                <span className="font-mono text-[11px]">
                  {translate(
                    'auto.components.settings.token.source.control.integration.cards.709057ad91',
                    'DOLPHIN_GITEA_API_BASE_URL'
                  )}
                </span>{' '}
                {translate(
                  'auto.components.settings.token.source.control.integration.cards.60708f23da',
                  'only when Dolphin cannot derive the API URL from the remote.'
                )}
              </>
            ) : (
              translate(
                'auto.components.settings.token.source.control.integration.cards.19fb419c12',
                'Gitea credentials are configured but could not authenticate. Check the token, API base URL, and repository permissions, then restart Dolphin if environment variables changed.'
              )
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                window.api.shell.openUrl('https://docs.gitea.com/next/development/api-usage')
              }
            >
              <ExternalLink className="size-3.5 mr-1.5" />
              {translate(
                'auto.components.settings.token.source.control.integration.cards.1a9475dace',
                'Learn more'
              )}
            </Button>
            <Button variant="ghost" size="sm" onClick={refresh}>
              {translate(
                'auto.components.settings.token.source.control.integration.cards.793a06e899',
                'Re-check'
              )}
            </Button>
          </div>
        </IntegrationCardDetails>
      ) : null}
    </IntegrationCardShell>
  )
}
