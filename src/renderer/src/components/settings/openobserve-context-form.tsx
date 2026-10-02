import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useAppStore } from '@/store'
import { translate } from '@/i18n/i18n'
import { saveOpenObserveContext } from '@/lib/openobserve-host-client'
import {
  isOpenObserveAuthScheme,
  parseOpenObserveSaveContextInput,
  type OpenObserveAuthScheme
} from '../../../../shared/openobserve-cli'

const DEFAULT_CONTEXT_NAME = 'default'
const DEFAULT_ORG = 'default'

export type OpenObserveContextFormDefaults = {
  name: string | null
  baseUrl: string | null
  org: string | null
  authScheme: OpenObserveAuthScheme | null
}

type ContextField = 'name' | 'baseUrl' | 'org' | 'authScheme'

function invalidFieldMessage(field: ContextField): string {
  switch (field) {
    case 'name':
      return translate(
        'auto.components.settings.openObserveContextForm.invalidName',
        'Use letters, numbers, dots, dashes or underscores for the profile name.'
      )
    case 'baseUrl':
      return translate(
        'auto.components.settings.openObserveContextForm.invalidBaseUrl',
        'Enter the address of your OpenObserve instance, for example https://openobserve.example.com.'
      )
    case 'org':
      return translate(
        'auto.components.settings.openObserveContextForm.invalidOrg',
        'Enter the organization identifier shown in OpenObserve (often "default").'
      )
    case 'authScheme':
      return translate(
        'auto.components.settings.openObserveContextForm.invalidAuthScheme',
        'Choose how you sign in.'
      )
  }
}

function authSchemeHelp(scheme: OpenObserveAuthScheme): string {
  switch (scheme) {
    case 'basic':
      return translate(
        'auto.components.settings.openObserveContextForm.basicHelp',
        'Sign in with the email and password you use on the OpenObserve website.'
      )
    case 'token':
      return translate(
        'auto.components.settings.openObserveContextForm.tokenHelp',
        'Paste an access token. For instances with single sign-on, create a Service Account and use its token.'
      )
    case 'session':
      return translate(
        'auto.components.settings.openObserveContextForm.sessionHelp',
        'Sign in through a browser window. Use this when your company signs in with SSO.'
      )
  }
}

export function OpenObserveContextForm(props: {
  defaults: OpenObserveContextFormDefaults
  onSaved: () => void
  onCancel?: () => void
}): React.JSX.Element {
  const settings = useAppStore((s) => s.settings)
  const [name, setName] = useState(props.defaults.name ?? DEFAULT_CONTEXT_NAME)
  const [baseUrl, setBaseUrl] = useState(props.defaults.baseUrl ?? '')
  const [org, setOrg] = useState(props.defaults.org ?? DEFAULT_ORG)
  const [authScheme, setAuthScheme] = useState<OpenObserveAuthScheme>(
    props.defaults.authScheme ?? 'basic'
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invalidField, setInvalidField] = useState<ContextField | null>(null)

  const save = (): void => {
    const parsed = parseOpenObserveSaveContextInput({
      name,
      baseUrl,
      org,
      authScheme
    })
    if (!parsed.ok) {
      setInvalidField(parsed.field)
      setError(invalidFieldMessage(parsed.field))
      return
    }
    setSaving(true)
    setError(null)
    setInvalidField(null)
    void saveOpenObserveContext(settings, parsed.value)
      .then((result) => (result.ok ? props.onSaved() : setError(result.error)))
      .catch((caught: unknown) =>
        setError(caught instanceof Error ? caught.message : String(caught))
      )
      .finally(() => setSaving(false))
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <p className="text-xs text-muted-foreground">
        {translate(
          'auto.components.settings.openObserveContextForm.help',
          'Tell Dolphin where your OpenObserve instance is. Dolphin saves these details in the openobserve-cli configuration; your password or token is only typed in the sign-in step and stays in your system keychain.'
        )}
      </p>
      <div className="grid gap-3 min-[720px]:grid-cols-2">
        <div className="space-y-1 min-[720px]:col-span-2">
          <Label htmlFor="openobserve-base-url">
            {translate(
              'auto.components.settings.openObserveContextForm.baseUrlLabel',
              'Server address'
            )}
          </Label>
          <Input
            id="openobserve-base-url"
            className="h-8"
            value={baseUrl}
            autoComplete="url"
            placeholder={translate(
              'auto.components.settings.openObserveContextForm.baseUrlPlaceholder',
              'https://openobserve.example.com'
            )}
            aria-invalid={invalidField === 'baseUrl' || undefined}
            onChange={(event) => setBaseUrl(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="openobserve-org">
            {translate('auto.components.settings.openObserveContextForm.orgLabel', 'Organization')}
          </Label>
          <Input
            id="openobserve-org"
            className="h-8"
            value={org}
            aria-invalid={invalidField === 'org' || undefined}
            onChange={(event) => setOrg(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="openobserve-context-name">
            {translate('auto.components.settings.openObserveContextForm.nameLabel', 'Profile name')}
          </Label>
          <Input
            id="openobserve-context-name"
            className="h-8"
            value={name}
            aria-invalid={invalidField === 'name' || undefined}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>
          {translate(
            'auto.components.settings.openObserveContextForm.authSchemeLabel',
            'Sign-in method'
          )}
        </Label>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={authScheme}
          aria-label={translate(
            'auto.components.settings.openObserveContextForm.authSchemeLabel',
            'Sign-in method'
          )}
          onValueChange={(value) => {
            if (isOpenObserveAuthScheme(value)) {
              setAuthScheme(value)
            }
          }}
        >
          <ToggleGroupItem value="basic">
            {translate(
              'auto.components.settings.openObserveContextForm.schemeBasic',
              'Email and password'
            )}
          </ToggleGroupItem>
          <ToggleGroupItem value="token">
            {translate(
              'auto.components.settings.openObserveContextForm.schemeToken',
              'Access token'
            )}
          </ToggleGroupItem>
          <ToggleGroupItem value="session">
            {translate(
              'auto.components.settings.openObserveContextForm.schemeSession',
              'Browser (SSO)'
            )}
          </ToggleGroupItem>
        </ToggleGroup>
        <p className="text-xs text-muted-foreground">{authSchemeHelp(authScheme)}</p>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          {saving
            ? translate('auto.components.settings.openObserveContextForm.saving', 'Saving…')
            : translate('auto.components.settings.openObserveContextForm.save', 'Save')}
        </Button>
        {props.onCancel ? (
          <Button type="button" variant="ghost" size="sm" onClick={props.onCancel}>
            {translate('auto.components.settings.openObserveContextForm.cancel', 'Cancel')}
          </Button>
        ) : null}
      </div>
    </form>
  )
}
