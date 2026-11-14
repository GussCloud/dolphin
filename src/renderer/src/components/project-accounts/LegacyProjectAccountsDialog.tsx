import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { translate } from '@/i18n/i18n'
import { useAppStore } from '@/store'
import { isGitRepoKind } from '../../../../shared/repo-kind'
import type { Repo } from '../../../../shared/repo-types'
import { ProjectStartAccountsPanel } from './ProjectStartAccountsPanel'
import { projectRemoteTargetFromIdentityKey } from './project-account-provider'
import { projectStartBinding, startAgentAccounts } from './project-start-accounts'
import { useProjectStartAccounts } from './use-project-start-accounts'

function accountUpdates(repo: Repo, accounts: ReturnType<typeof useProjectStartAccounts>) {
  const picks = accounts.get()
  if (!isGitRepoKind(repo)) {
    return startAgentAccounts(picks)
  }
  const target = projectRemoteTargetFromIdentityKey(
    repo.gitRemoteIdentity?.canonicalKey,
    picks.ghAccount ? [picks.ghAccount.host] : []
  )
  return projectStartBinding(picks, target)
}

/** Body of the older-project accounts prompt; loaded only when that prompt opens. */
export default function LegacyProjectAccountsDialog({
  repo,
  onLater
}: {
  repo: Repo
  onLater: () => void
}): React.JSX.Element {
  const updateRepo = useAppStore((s) => s.updateRepo)
  const [saving, setSaving] = useState(false)
  const accounts = useProjectStartAccounts(true)

  const finish = async (updates: Partial<Repo>): Promise<void> => {
    setSaving(true)
    try {
      await updateRepo(repo.id, { ...updates, accountSetupReviewedAt: Date.now() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(isOpen) => (isOpen ? undefined : onLater())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {translate(
              'auto.components.projectAccounts.legacySetup.title',
              'Choose the accounts for {{value0}}',
              { value0: repo.displayName }
            )}
          </DialogTitle>
          <DialogDescription>
            {translate(
              'auto.components.projectAccounts.legacySetup.description',
              'This project was added before Dolphin could keep accounts per project. Pick which GitHub, Azure DevOps, Claude and Codex accounts and which commit author it uses, or keep this PC’s defaults.'
            )}
          </DialogDescription>
        </DialogHeader>
        <ProjectStartAccountsPanel state={accounts} />
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onLater} disabled={saving}>
            {translate('auto.components.projectAccounts.legacySetup.later', 'Later')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void finish({})} disabled={saving}>
            {translate(
              'auto.components.projectAccounts.legacySetup.keepDefaults',
              'Keep this PC’s defaults'
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => void finish(accountUpdates(repo, accounts))}
            disabled={saving}
          >
            {translate('auto.components.projectAccounts.legacySetup.save', 'Save accounts')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
