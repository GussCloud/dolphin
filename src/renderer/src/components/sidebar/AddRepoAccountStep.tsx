import { DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import { ProjectAccountSelect } from '../project-accounts/ProjectAccountSelect'
import { CommitIdentityFields } from '../project-accounts/CommitIdentityFields'
import {
  azureDevOpsAccountOptions,
  githubAccountOptions,
  selectionFromValue,
  selectionValue
} from '../project-accounts/project-account-options'
import { resolveNewProjectAccountSettings } from '../project-accounts/new-project-account-settings'
import type { AddRepoAccountStepState } from './use-add-repo-account-step'

export function AddRepoAccountStep({
  state
}: {
  state: AddRepoAccountStepState
}): React.JSX.Element {
  const { repo, plan, draft, saving } = state
  const { target, inventory, azureAccounts } = plan
  const options =
    target.provider === 'github'
      ? githubAccountOptions(inventory, target.host)
      : azureDevOpsAccountOptions(azureAccounts)
  const canContinue = !saving && resolveNewProjectAccountSettings(draft.draft) !== null

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {translate(
            'auto.components.sidebar.AddRepoAccountStep.title',
            'Account and commit author'
          )}
        </DialogTitle>
        <DialogDescription>
          {translate(
            'auto.components.sidebar.AddRepoAccountStep.description',
            'Choose how Dolphin signs in and who authors commits for {{project}}.',
            { project: repo.displayName }
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3 pt-1">
        <ProjectAccountSelect
          provider={target.provider}
          host={target.host}
          options={options}
          value={selectionValue(draft.draft.selection)}
          disabled={saving}
          error={plan.error}
          onChange={(value) => {
            const next = selectionFromValue(value, target, { inventory, azureAccounts })
            if (next) {
              draft.setSelection(next)
            }
          }}
        />
        <CommitIdentityFields
          draft={draft.draft.identity}
          onChange={draft.setIdentity}
          disabled={saving}
        />
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="ghost" disabled={saving} onClick={state.onSkip}>
            {translate('auto.components.sidebar.AddRepoAccountStep.skip', 'Use defaults')}
          </Button>
          <Button type="button" disabled={!canContinue} onClick={state.onContinue}>
            {translate('auto.components.sidebar.AddRepoAccountStep.continue', 'Continue')}
          </Button>
        </div>
      </div>
    </>
  )
}
