import { useId, useState } from 'react'
import { KeyRound, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { translate } from '@/i18n/i18n'
import {
  claudeAccountDisplayName,
  isClaudeApiKeyAccount
} from '../../../../shared/claude-api-account'
import type { ClaudeRateLimitAccountsState } from '../../../../shared/managed-account-types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { getClaudeAccountErrorDescription } from './accounts-pane-action-errors'
import type { ClaudeAccountAction, ClaudeAccountActionRunner } from './accounts-pane-types'

const T = 'auto.components.settings.ClaudeApiAccounts'
const NO_COPY_VALUE = '__none__'
const NO_DEFAULT_VALUE = '__none__'

/** Which API account the `claude-api` agent bills when the workspace pins none. */
function ClaudeApiDefaultAccountSelect(props: {
  accounts: ClaudeRateLimitAccountsState['accounts']
  defaultAccountId: string | null
  onDefaultAccountChange: (accountId: string | null) => void
  disabled: boolean
}): React.JSX.Element | null {
  const selectId = useId()
  const apiAccounts = props.accounts.filter((account) => isClaudeApiKeyAccount(account))
  if (apiAccounts.length === 0) {
    return null
  }
  // Why: a stale id must read as "none chosen", the same way main refuses it.
  const value = apiAccounts.some((account) => account.id === props.defaultAccountId)
    ? (props.defaultAccountId ?? NO_DEFAULT_VALUE)
    : NO_DEFAULT_VALUE
  return (
    <div className="flex flex-col gap-1">
      <label id={selectId} className="text-xs text-muted-foreground">
        {translate(`${T}.defaultAccount`, 'Claude API agent uses')}
      </label>
      <Select
        value={value}
        disabled={props.disabled}
        onValueChange={(next) =>
          props.onDefaultAccountChange(next === NO_DEFAULT_VALUE ? null : next)
        }
      >
        <SelectTrigger
          size="sm"
          className="w-full"
          aria-labelledby={selectId}
          data-testid="claude-api-default-account"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_DEFAULT_VALUE}>
            {apiAccounts.length === 1
              ? translate(`${T}.defaultOnly`, 'The only API account')
              : translate(`${T}.defaultNone`, 'No default: pick one per workspace')}
          </SelectItem>
          {apiAccounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {claudeAccountDisplayName(account)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

/** Adds a Claude account billed to an Anthropic API key, optionally copying another profile. */
export function ClaudeApiAccountForm(props: {
  accounts: ClaudeRateLimitAccountsState['accounts']
  claudeAction: ClaudeAccountAction
  runClaudeAccountAction: ClaudeAccountActionRunner
  defaultAccountId: string | null
  onDefaultAccountChange: (accountId: string | null) => void
}): React.JSX.Element {
  const { accounts, claudeAction, runClaudeAccountAction } = props
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [copyFrom, setCopyFrom] = useState(NO_COPY_VALUE)
  const labelId = useId()
  const keyId = useId()
  const copyId = useId()
  const busy = claudeAction !== 'idle'
  const copyChoices = accounts.filter((account) => account.managedAuthRuntime !== 'wsl')

  const reset = (): void => {
    setOpen(false)
    setLabel('')
    setApiKey('')
    setCopyFrom(NO_COPY_VALUE)
  }

  const submit = (): void => {
    if (!label.trim() || !apiKey.trim()) {
      return
    }
    void runClaudeAccountAction('adding-api', async () => {
      const next = await window.api.claudeAccounts.addApiKeyAccount({
        label,
        apiKey,
        copyFromAccountId: copyFrom === NO_COPY_VALUE ? null : copyFrom
      })
      // Why only on success: a refused add keeps what the user typed for a retry.
      reset()
      return next
    })
  }

  return (
    <div
      className="space-y-2 rounded-md border border-border/70 px-3 py-2.5"
      data-testid="claude-api-accounts"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-medium">{translate(`${T}.title`, 'API accounts')}</p>
          <p className="text-xs text-muted-foreground">
            {translate(
              `${T}.description`,
              'Bill Claude to an Anthropic API key instead of your plan. Each API account has its own profile and key, and plain Claude launches never use it.'
            )}
          </p>
        </div>
        {open ? null : (
          <Button
            variant="outline"
            size="xs"
            onClick={() => setOpen(true)}
            disabled={busy}
            className="shrink-0"
          >
            <Plus className="size-3" />
            {translate(`${T}.add`, 'Add API account')}
          </Button>
        )}
      </div>
      <ClaudeApiDefaultAccountSelect
        accounts={accounts}
        defaultAccountId={props.defaultAccountId}
        onDefaultAccountChange={props.onDefaultAccountChange}
        disabled={busy}
      />
      {open ? (
        <form
          className="space-y-2 border-t border-border/50 pt-2"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor={labelId} className="text-xs text-muted-foreground">
              {translate(`${T}.name`, 'Name')}
            </label>
            <Input
              id={labelId}
              value={label}
              maxLength={80}
              disabled={busy}
              onChange={(event) => setLabel(event.target.value)}
              placeholder={translate(`${T}.namePlaceholder`, 'e.g. Work API')}
              className="h-7"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={keyId} className="text-xs text-muted-foreground">
              {translate(`${T}.key`, 'Anthropic API key')}
            </label>
            <Input
              id={keyId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={apiKey}
              disabled={busy}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={translate(`${T}.keyPlaceholder`, 'Paste your Anthropic API key')}
              className="h-7"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label id={copyId} className="text-xs text-muted-foreground">
              {translate(`${T}.copyFrom`, 'Copy profile from')}
            </label>
            <Select value={copyFrom} onValueChange={setCopyFrom} disabled={busy}>
              <SelectTrigger size="sm" className="w-full" aria-labelledby={copyId}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_COPY_VALUE}>
                  {translate(`${T}.copyNone`, 'Start with an empty profile')}
                </SelectItem>
                {copyChoices.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {claudeAccountDisplayName(account)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {translate(
                `${T}.copyHint`,
                'Copies instructions, settings, skills, agents, commands, MCP servers and plugins. Claude logins and Anthropic or cloud credentials are not copied; MCP servers and plugins are copied as they are, including their own tokens.'
              )}
            </p>
          </div>
          <div className="flex items-center justify-end gap-1.5">
            <Button type="button" variant="ghost" size="xs" onClick={reset} disabled={busy}>
              {translate(`${T}.cancel`, 'Cancel')}
            </Button>
            <Button type="submit" size="xs" disabled={busy || !label.trim() || !apiKey.trim()}>
              {claudeAction === 'adding-api' ? <Loader2 className="size-3 animate-spin" /> : null}
              {translate(`${T}.save`, 'Add account')}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}

/** Replaces an API account's key; the saved key is never read back into the renderer. */
export function ClaudeApiKeyReplaceButton(props: {
  accountId: string
  disabled: boolean
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const inputId = useId()

  const save = async (): Promise<void> => {
    if (!draft.trim()) {
      return
    }
    setSaving(true)
    try {
      await window.api.claudeAccounts.replaceApiKey({ accountId: props.accountId, apiKey: draft })
      setDraft('')
      setOpen(false)
      toast.success(translate(`${T}.replaced`, 'API key replaced.'))
    } catch (error) {
      toast.error(translate(`${T}.replaceFailed`, "Couldn't replace the API key."), {
        description: getClaudeAccountErrorDescription(error)
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setDraft('')
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="xs"
          disabled={props.disabled}
          className="h-6 px-2 text-muted-foreground hover:text-foreground"
        >
          <KeyRound className="size-3" />
          {translate(`${T}.replace`, 'Replace key')}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <div className="flex flex-col gap-2">
          <label htmlFor={inputId} className="text-xs text-muted-foreground">
            {translate(`${T}.newKey`, 'New Anthropic API key')}
          </label>
          <div className="flex items-center gap-2">
            <Input
              id={inputId}
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={draft}
              disabled={saving}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void save()
                }
              }}
              className="h-7 flex-1"
            />
            <Button
              size="xs"
              onClick={() => void save()}
              disabled={saving || !draft.trim()}
              className="h-7 shrink-0"
            >
              {saving ? <Loader2 className="size-3 animate-spin" /> : null}
              {translate(`${T}.replaceSave`, 'Save')}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
