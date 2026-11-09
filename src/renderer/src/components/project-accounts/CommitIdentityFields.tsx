import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import {
  EMPTY_COMMIT_IDENTITY_DRAFT,
  evaluateCommitIdentityDraft,
  type CommitIdentityDraft
} from './commit-identity-draft'
import { commitAuthorKey } from '../../../../shared/source-control-account-types'
import {
  GIT_CONFIG_AUTHOR_VALUE,
  commitAuthorOptions,
  withCommitAuthor
} from './commit-author-options'

type CommitIdentityFieldsProps = {
  draft: CommitIdentityDraft
  onChange: (draft: CommitIdentityDraft) => void
  disabled?: boolean
}

/** Picks the commit author from the authors registered in Dolphin, or registers a new one. */
export function CommitIdentityFields({
  draft,
  onChange,
  disabled
}: CommitIdentityFieldsProps): React.JSX.Element {
  const labelId = useId()
  const savedAuthors = useAppStore((state) => state.settings?.commitAuthors)
  const repos = useAppStore((state) => state.repos)
  const updateSettingsOrThrow = useAppStore((state) => state.updateSettingsOrThrow)
  const [adding, setAdding] = useState(false)

  const draftResult = evaluateCommitIdentityDraft(draft)
  const current = draftResult.status === 'valid' ? draftResult.identity : null
  const options = commitAuthorOptions(
    savedAuthors,
    repos.map((repo) => repo.commitIdentity),
    current
  )
  const value = current ? commitAuthorKey(current) : GIT_CONFIG_AUTHOR_VALUE

  return (
    <div className="space-y-1.5">
      <span id={labelId} className="text-[11px] font-medium text-muted-foreground">
        {translate('auto.components.projectAccounts.commitAuthor.label', 'Commit author')}
      </span>
      <div className="flex gap-2">
        <Select
          value={value}
          disabled={disabled}
          onValueChange={(next) => {
            const picked = options.find((option) => option.value === next)
            onChange(picked ? { ...picked.identity } : EMPTY_COMMIT_IDENTITY_DRAFT)
          }}
        >
          <SelectTrigger size="sm" className="min-w-0 flex-1" aria-labelledby={labelId}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GIT_CONFIG_AUTHOR_VALUE}>
              {translate(
                'auto.components.projectAccounts.commitAuthor.gitConfig',
                'Git config identity (default)'
              )}
            </SelectItem>
            {options.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || adding}
          onClick={() => setAdding(true)}
        >
          <Plus />
          {translate('auto.components.projectAccounts.commitAuthor.add', 'New author')}
        </Button>
      </div>
      {adding ? (
        <NewCommitAuthorForm
          disabled={disabled}
          onCancel={() => setAdding(false)}
          onSave={async (identity) => {
            await updateSettingsOrThrow({
              commitAuthors: withCommitAuthor(
                useAppStore.getState().settings?.commitAuthors,
                identity
              )
            })
            onChange({ ...identity })
            setAdding(false)
          }}
        />
      ) : (
        <p className="text-[11px] text-muted-foreground">
          {translate(
            'auto.components.projectAccounts.commitAuthor.pickerHint',
            'The default keeps your git config identity.'
          )}
        </p>
      )}
    </div>
  )
}

function NewCommitAuthorForm({
  disabled,
  onCancel,
  onSave
}: {
  disabled?: boolean
  onCancel: () => void
  onSave: (identity: { name: string; email: string }) => Promise<void>
}): React.JSX.Element {
  const [draft, setDraft] = useState<CommitIdentityDraft>(EMPTY_COMMIT_IDENTITY_DRAFT)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const result = evaluateCommitIdentityDraft(draft)
  // Why: flag fields only once typed in, so a fresh form is not painted red.
  const touched = draft.name.trim() !== '' || draft.email.trim() !== ''
  const nameInvalid = touched && result.status === 'incomplete' && !draft.name.trim()
  const emailInvalid =
    result.status === 'invalid' ||
    (touched && result.status === 'incomplete' && !draft.email.trim())

  const save = async (): Promise<void> => {
    if (result.status !== 'valid') {
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(result.identity)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
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
          disabled={disabled || saving}
          autoFocus
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
          disabled={disabled || saving}
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
        <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={onCancel}>
          {translate('auto.components.projectAccounts.commitAuthor.cancel', 'Cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={disabled || saving || result.status !== 'valid'}
          onClick={() => void save()}
        >
          {translate('auto.components.projectAccounts.commitAuthor.addConfirm', 'Add author')}
        </Button>
      </div>
    </div>
  )
}
