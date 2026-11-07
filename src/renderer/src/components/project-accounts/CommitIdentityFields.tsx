import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { evaluateCommitIdentityDraft, type CommitIdentityDraft } from './commit-identity-draft'

type CommitIdentityFieldsProps = {
  draft: CommitIdentityDraft
  onChange: (draft: CommitIdentityDraft) => void
  disabled?: boolean
  /** Shown as placeholders so a blank draft visibly means "git config identity". */
  fallback?: { name?: string; email?: string } | null
}

export function CommitIdentityFields({
  draft,
  onChange,
  disabled,
  fallback
}: CommitIdentityFieldsProps): React.JSX.Element {
  const result = evaluateCommitIdentityDraft(draft)
  const nameInvalid = result.status === 'incomplete' && !draft.name.trim()
  const emailInvalid =
    result.status === 'invalid' || (result.status === 'incomplete' && !draft.email.trim())

  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground">
        {translate('auto.components.projectAccounts.commitAuthor.label', 'Commit author')}
      </span>
      <div className="flex gap-2">
        <Input
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          placeholder={
            fallback?.name ||
            translate('auto.components.projectAccounts.commitAuthor.namePlaceholder', 'Name')
          }
          aria-label={translate('auto.components.projectAccounts.commitAuthor.name', 'Author name')}
          aria-invalid={nameInvalid || undefined}
          className="h-8 flex-1"
          disabled={disabled}
        />
        <Input
          type="email"
          value={draft.email}
          onChange={(event) => onChange({ ...draft, email: event.target.value })}
          placeholder={
            fallback?.email ||
            translate('auto.components.projectAccounts.commitAuthor.emailPlaceholder', 'Email')
          }
          aria-label={translate(
            'auto.components.projectAccounts.commitAuthor.email',
            'Author email'
          )}
          aria-invalid={emailInvalid || undefined}
          className="h-8 flex-1"
          disabled={disabled}
        />
      </div>
      <p className="text-[11px] text-muted-foreground">
        {result.status === 'incomplete'
          ? translate(
              'auto.components.projectAccounts.commitAuthor.incomplete',
              'Fill in both name and email, or leave both blank.'
            )
          : result.status === 'invalid'
            ? translate(
                'auto.components.projectAccounts.commitAuthor.invalid',
                'Enter a valid email address.'
              )
            : translate(
                'auto.components.projectAccounts.commitAuthor.hint',
                'Leave blank to use your git config identity.'
              )}
      </p>
    </div>
  )
}
