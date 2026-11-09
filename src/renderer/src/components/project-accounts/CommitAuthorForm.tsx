import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import type { CommitIdentity } from '../../../../shared/source-control-account-types'
import {
  EMPTY_COMMIT_IDENTITY_DRAFT,
  commitIdentityDraftFrom,
  evaluateCommitIdentityDraft,
  type CommitIdentityDraft
} from './commit-identity-draft'

type CommitAuthorFormProps = {
  /** Author being edited; null registers a new one. */
  initial: CommitIdentity | null
  confirmLabel: string
  disabled?: boolean
  onConfirm: (identity: CommitIdentity) => Promise<void>
  onCancel?: () => void
  onRemove?: () => Promise<void>
}

/** Name + email of one registered commit author, for registering or correcting it. */
export function CommitAuthorForm({
  initial,
  confirmLabel,
  disabled,
  onConfirm,
  onCancel,
  onRemove
}: CommitAuthorFormProps): React.JSX.Element {
  const [draft, setDraft] = useState<CommitIdentityDraft>(() =>
    initial ? commitIdentityDraftFrom(initial) : EMPTY_COMMIT_IDENTITY_DRAFT
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const result = evaluateCommitIdentityDraft(draft)
  // Why: flag fields only once typed in, so a fresh form is not painted red.
  const touched = draft.name.trim() !== '' || draft.email.trim() !== ''
  const nameInvalid = touched && result.status === 'incomplete' && !draft.name.trim()
  const emailInvalid =
    result.status === 'invalid' ||
    (touched && result.status === 'incomplete' && !draft.email.trim())
  const unchanged =
    initial !== null &&
    result.status === 'valid' &&
    result.identity.name === initial.name &&
    result.identity.email === initial.email
  const locked = disabled || busy

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex gap-2">
        <Input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          placeholder={translate(
            'auto.components.projectAccounts.commitAuthor.namePlaceholder',
            'Name'
          )}
          aria-label={translate('auto.components.projectAccounts.commitAuthor.name', 'Author name')}
          aria-invalid={nameInvalid || undefined}
          className="h-8 flex-1"
          disabled={locked}
          autoFocus={initial === null}
        />
        <Input
          type="email"
          value={draft.email}
          onChange={(event) => setDraft({ ...draft, email: event.target.value })}
          placeholder={translate(
            'auto.components.projectAccounts.commitAuthor.emailPlaceholder',
            'Email'
          )}
          aria-label={translate(
            'auto.components.projectAccounts.commitAuthor.email',
            'Author email'
          )}
          aria-invalid={emailInvalid || undefined}
          className="h-8 flex-1"
          disabled={locked}
        />
      </div>
      {result.status === 'invalid' ? (
        <p className="text-[11px] text-destructive">
          {translate(
            'auto.components.projectAccounts.commitAuthor.invalid',
            'Enter a valid email address.'
          )}
        </p>
      ) : touched && result.status === 'incomplete' ? (
        <p className="text-[11px] text-muted-foreground">
          {translate(
            'auto.components.projectAccounts.commitAuthor.newIncomplete',
            'Fill in both name and email.'
          )}
        </p>
      ) : null}
      {error ? (
        <p className="text-[11px] text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end gap-2">
        {onRemove ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={locked}
            onClick={() => void run(onRemove)}
          >
            {translate('auto.components.projectAccounts.commitAuthor.remove', 'Remove')}
          </Button>
        ) : null}
        {onCancel ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onCancel}>
            {translate('auto.components.projectAccounts.commitAuthor.cancel', 'Cancel')}
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          disabled={locked || result.status !== 'valid' || unchanged}
          onClick={() => {
            if (result.status === 'valid') {
              void run(() => onConfirm(result.identity))
            }
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
