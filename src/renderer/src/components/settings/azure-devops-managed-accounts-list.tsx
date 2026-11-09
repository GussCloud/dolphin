import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useConfirmationDialog } from '@/components/confirmation-dialog-context'
import { useAppStore } from '@/store'
import { getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'
import { translate } from '@/i18n/i18n'
import { defaultAccountLabel } from '../project-accounts/project-account-labels'
import type { AzureDevOpsManagedAccount } from '../../../../shared/source-control-account-types'
import {
  addAzureDevOpsManagedAccount,
  listAzureDevOpsManagedAccounts,
  managedAzureDevOpsAccountsSupported,
  removeAzureDevOpsManagedAccount
} from '../project-accounts/project-account-client'

type AzureDevOpsManagedAccountsListProps = {
  /** Login of the global sign-in that projects without a binding keep using. */
  defaultAccountLogin: string | null
}

export function AzureDevOpsManagedAccountsList({
  defaultAccountLogin
}: AzureDevOpsManagedAccountsListProps): React.JSX.Element {
  const activeRuntimeEnvironmentId = useAppStore(
    (s) => s.settings?.activeRuntimeEnvironmentId ?? null
  )
  const runtimeTarget = useMemo(
    () => getActiveRuntimeTarget({ activeRuntimeEnvironmentId }),
    [activeRuntimeEnvironmentId]
  )
  const confirm = useConfirmationDialog()
  const supported = managedAzureDevOpsAccountsSupported(runtimeTarget)
  const [accounts, setAccounts] = useState<AzureDevOpsManagedAccount[]>([])
  const [adding, setAdding] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const loadGenerationRef = useRef(0)

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current
    try {
      const next = await listAzureDevOpsManagedAccounts(runtimeTarget)
      if (generation === loadGenerationRef.current) {
        setAccounts(next)
        setError(null)
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

  const add = async (): Promise<void> => {
    setAdding(true)
    setError(null)
    try {
      const result = await addAzureDevOpsManagedAccount()
      if (result.ok) {
        toast.success(
          translate('auto.components.settings.azureDevOpsManagedAccounts.added', 'Account added'),
          { description: result.account.login }
        )
      } else if (result.error !== 'cancelled') {
        setError(result.error)
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setAdding(false)
    }
  }

  const remove = async (account: AzureDevOpsManagedAccount): Promise<void> => {
    const confirmed = await confirm({
      title: translate(
        'auto.components.settings.azureDevOpsManagedAccounts.removeTitle',
        'Remove Azure DevOps account?'
      ),
      description: translate(
        'auto.components.settings.azureDevOpsManagedAccounts.removeDescription',
        'Signs {{login}} out of Dolphin. Projects bound to it fall back to the default account.',
        { login: account.login }
      ),
      confirmLabel: translate(
        'auto.components.settings.azureDevOpsManagedAccounts.remove',
        'Remove'
      ),
      confirmVariant: 'destructive'
    })
    if (!confirmed) {
      return
    }
    setRemovingId(account.id)
    try {
      await removeAzureDevOpsManagedAccount(account.id)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRemovingId(null)
    }
  }

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-medium text-muted-foreground">
        {translate('auto.components.settings.azureDevOpsManagedAccounts.title', 'Accounts')}
      </div>
      <ul className="space-y-1">
        <li className="flex items-center gap-2 text-xs">
          <span className="shrink-0">{defaultAccountLabel('azure-devops')}</span>
          <span className="min-w-0 truncate text-muted-foreground">
            {defaultAccountLogin ??
              translate(
                'auto.components.settings.azureDevOpsManagedAccounts.defaultUnset',
                'Not signed in'
              )}
          </span>
        </li>
        {accounts.map((account) => (
          <li key={account.id} className="flex items-center gap-2 text-xs">
            <span className="min-w-0 truncate">{account.login}</span>
            <span className="flex-1" />
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              disabled={!supported || removingId !== null || adding}
              onClick={() => void remove(account)}
              aria-label={translate(
                'auto.components.settings.azureDevOpsManagedAccounts.removeAria',
                'Remove {{login}}',
                { login: account.login }
              )}
              title={translate(
                'auto.components.settings.azureDevOpsManagedAccounts.remove',
                'Remove'
              )}
            >
              {removingId === account.id ? <Loader2 className="animate-spin" /> : <Trash2 />}
            </Button>
          </li>
        ))}
      </ul>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      {supported ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={adding}
            onClick={() => void add()}
          >
            {adding ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />}
            {adding
              ? translate(
                  'auto.components.settings.azureDevOpsManagedAccounts.adding',
                  'Finish sign-in in the Microsoft window…'
                )
              : translate('auto.components.settings.azureDevOpsManagedAccounts.add', 'Add account')}
          </Button>
          {adding ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void window.api.azureDevOps.cancelCliSignIn()}
            >
              {translate('auto.components.settings.azureDevOpsManagedAccounts.cancel', 'Cancel')}
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          {translate(
            'auto.components.settings.azureDevOpsManagedAccounts.desktopOnly',
            'Extra Azure DevOps accounts are managed on the desktop app’s own machine, not on a remote runtime.'
          )}
        </p>
      )}
    </div>
  )
}
