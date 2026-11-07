import { useId } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { DEFAULT_ACCOUNT_VALUE, type ProjectAccountOption } from './project-account-options'
import type { ProjectAccountProvider } from './project-account-provider'
import { defaultAccountLabel } from './project-account-labels'

type ProjectAccountSelectProps = {
  provider: ProjectAccountProvider
  host: string
  options: readonly ProjectAccountOption[]
  value: string
  /** Label for a bound value no longer offered (account removed or host unreachable). */
  unavailableLabel?: string | null
  loading?: boolean
  disabled?: boolean
  onChange: (value: string) => void
  onRefresh?: () => void
  /** Why the account list could not load; shown instead of silently offering only the default. */
  error?: string | null
}

function providerName(provider: ProjectAccountProvider): string {
  return provider === 'github' ? 'GitHub' : 'Azure DevOps'
}

export function ProjectAccountSelect({
  provider,
  host,
  options,
  value,
  unavailableLabel,
  loading,
  disabled,
  onChange,
  onRefresh,
  error
}: ProjectAccountSelectProps): React.JSX.Element {
  const labelId = useId()
  const valueOffered =
    value === DEFAULT_ACCOUNT_VALUE || options.some((option) => option.value === value)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <span id={labelId} className="text-[11px] font-medium text-muted-foreground">
          {translate('auto.components.projectAccounts.account.label', '{{provider}} account', {
            provider: providerName(provider)
          })}
        </span>
        {onRefresh ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onRefresh}
            disabled={loading || disabled}
            aria-label={translate(
              'auto.components.projectAccounts.account.refresh',
              'Refresh accounts'
            )}
            title={translate('auto.components.projectAccounts.account.refresh', 'Refresh accounts')}
          >
            <RefreshCw className={loading ? 'size-3.5 animate-spin' : 'size-3.5'} />
          </Button>
        ) : null}
      </div>
      <Select value={value} disabled={disabled || loading} onValueChange={onChange}>
        <SelectTrigger size="sm" className="w-full" aria-labelledby={labelId}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={DEFAULT_ACCOUNT_VALUE}>{defaultAccountLabel(provider)}</SelectItem>
          {!valueOffered ? (
            // Why: keep the bound value as an item so the trigger shows it; disabled so it cannot be re-picked.
            <SelectItem value={value} disabled>
              {unavailableLabel ??
                translate(
                  'auto.components.projectAccounts.account.unavailable',
                  'Unavailable account'
                )}
            </SelectItem>
          ) : null}
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {provider === 'github' ? (
        <p className="text-[11px] text-muted-foreground">
          {translate(
            'auto.components.projectAccounts.account.githubHostHint',
            'Logins on {{host}}. Default uses the active gh login.',
            { host }
          )}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {translate(
            'auto.components.projectAccounts.account.azureHint',
            'Default uses the sign-in configured in Settings → Integrations.'
          )}
        </p>
      )}
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}
