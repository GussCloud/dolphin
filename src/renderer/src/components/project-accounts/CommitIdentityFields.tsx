import { useId, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  commitAuthorKey,
  type CommitIdentity
} from '../../../../shared/source-control-account-types'
import {
  EMPTY_COMMIT_IDENTITY_DRAFT,
  evaluateCommitIdentityDraft,
  type CommitIdentityDraft
} from './commit-identity-draft'
import {
  GIT_CONFIG_AUTHOR_VALUE,
  commitAuthorOptions,
  isSavedCommitAuthor,
  replaceCommitAuthor,
  withCommitAuthor,
  withoutCommitAuthor
} from './commit-author-options'
import { CommitAuthorForm } from './CommitAuthorForm'

type CommitIdentityFieldsProps = {
  draft: CommitIdentityDraft
  onChange: (draft: CommitIdentityDraft) => void
  disabled?: boolean
}

/** Picks the commit author from the authors registered in Dolphin; registers or corrects one. */
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

  // Why getState: a save in flight may have changed the list since this render.
  const saveAuthors = (next: (saved: CommitIdentity[] | undefined) => CommitIdentity[]) =>
    updateSettingsOrThrow({ commitAuthors: next(useAppStore.getState().settings?.commitAuthors) })

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
            setAdding(false)
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
        <CommitAuthorForm
          initial={null}
          confirmLabel={translate(
            'auto.components.projectAccounts.commitAuthor.addConfirm',
            'Add author'
          )}
          disabled={disabled}
          onCancel={() => setAdding(false)}
          onConfirm={async (identity) => {
            await saveAuthors((saved) => withCommitAuthor(saved, identity))
            onChange({ ...identity })
            setAdding(false)
          }}
        />
      ) : current ? (
        <CommitAuthorForm
          // Why key: picking another author must reset the fields to that author.
          key={value}
          initial={current}
          confirmLabel={translate(
            'auto.components.projectAccounts.commitAuthor.update',
            'Save changes'
          )}
          disabled={disabled}
          onConfirm={async (identity) => {
            await saveAuthors((saved) => replaceCommitAuthor(saved, current, identity))
            onChange({ ...identity })
          }}
          // Only saved entries can be removed; authors other projects use stay listed anyway.
          onRemove={
            isSavedCommitAuthor(savedAuthors, current)
              ? async () => {
                  await saveAuthors((saved) => withoutCommitAuthor(saved, current))
                  onChange(EMPTY_COMMIT_IDENTITY_DRAFT)
                }
              : undefined
          }
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
