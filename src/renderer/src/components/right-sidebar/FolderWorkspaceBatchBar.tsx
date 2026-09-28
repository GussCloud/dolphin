import { useState } from 'react'
import { ArrowDown, ArrowUp, Check, LoaderCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { translate } from '@/i18n/i18n'
import { getConnectionId } from '@/lib/connection-context'
import { commitRuntimeGit } from '@/runtime/runtime-git-client'
import { useAppStore } from '@/store'
import { getRightSidebarWorktreeRuntimeSettings } from './file-explorer-runtime-owner'
import {
  runFolderWorkspaceBatch,
  type FolderWorkspaceBatchDeps,
  type FolderWorkspaceBatchKind,
  type FolderWorkspaceBatchOutcome
} from './folder-workspace-batch-git'
import type { FolderWorkspaceGitMember } from './folder-workspace-git-members'

const EMPTY_ENTRIES: never[] = []

function buildBatchDeps(): FolderWorkspaceBatchDeps {
  const connectionIdFor = (member: FolderWorkspaceGitMember): string | undefined =>
    getConnectionId(member.worktree.id) ?? undefined
  return {
    getStatusEntries: (worktreeId) =>
      useAppStore.getState().gitStatusByWorktree[worktreeId] ?? EMPTY_ENTRIES,
    getUpstreamStatus: (worktreeId) => useAppStore.getState().remoteStatusesByWorktree[worktreeId],
    commit: async (member, message) => {
      const result = await commitRuntimeGit(
        {
          settings: getRightSidebarWorktreeRuntimeSettings(member.worktree.id),
          worktreeId: member.worktree.id,
          worktreePath: member.worktree.path,
          connectionId: connectionIdFor(member)
        },
        message
      )
      if (!result.success) {
        throw new Error(result.error ?? 'Commit failed')
      }
    },
    push: (member, publish) =>
      useAppStore
        .getState()
        .pushBranch(
          member.worktree.id,
          member.worktree.path,
          publish,
          connectionIdFor(member),
          member.worktree.pushTarget
        ),
    pull: (member) =>
      useAppStore
        .getState()
        .pullBranch(
          member.worktree.id,
          member.worktree.path,
          connectionIdFor(member),
          member.worktree.pushTarget
        )
  }
}

function reportBatchOutcomes(outcomes: readonly FolderWorkspaceBatchOutcome[]): void {
  const done = outcomes.filter((outcome) => outcome.status === 'done').length
  const failed = outcomes.filter((outcome) => outcome.status === 'failed')
  if (failed.length > 0) {
    toast.error(
      translate(
        'auto.components.rightSidebar.FolderWorkspaceBatchBar.failed',
        '{{value0}} of {{value1}} projects failed',
        { value0: failed.length, value1: outcomes.length }
      ),
      { description: failed.map((outcome) => `${outcome.repoName}: ${outcome.error}`).join('\n') }
    )
    return
  }
  toast.success(
    done === 0
      ? translate(
          'auto.components.rightSidebar.FolderWorkspaceBatchBar.nothingToDo',
          'Nothing to do in any project'
        )
      : translate(
          'auto.components.rightSidebar.FolderWorkspaceBatchBar.done',
          'Done in {{value0}} of {{value1}} projects',
          { value0: done, value1: outcomes.length }
        )
  )
}

/** Commit, push or pull every member at once; each repo's own panel stays the place to fix one. */
export function FolderWorkspaceBatchBar({
  members,
  onFinished
}: {
  members: readonly FolderWorkspaceGitMember[]
  onFinished: () => void
}): React.JSX.Element {
  const [message, setMessage] = useState('')
  const [running, setRunning] = useState<FolderWorkspaceBatchKind | null>(null)

  const run = async (kind: FolderWorkspaceBatchKind): Promise<void> => {
    setRunning(kind)
    try {
      const outcomes = await runFolderWorkspaceBatch(
        kind,
        members,
        buildBatchDeps(),
        message.trim()
      )
      if (kind === 'commit' && outcomes.some((outcome) => outcome.status === 'done')) {
        setMessage('')
      }
      reportBatchOutcomes(outcomes)
    } finally {
      setRunning(null)
      onFinished()
    }
  }
  const spinner = <LoaderCircle className="animate-spin" />

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-b border-border px-3 py-2">
      <Input
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder={translate(
          'auto.components.rightSidebar.FolderWorkspaceBatchBar.messagePlaceholder',
          'Commit message for all projects'
        )}
        disabled={running !== null}
      />
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="xs"
          disabled={running !== null || message.trim().length === 0}
          onClick={() => void run('commit')}
        >
          {running === 'commit' ? spinner : <Check />}
          {translate(
            'auto.components.rightSidebar.FolderWorkspaceBatchBar.commitAll',
            'Commit all'
          )}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={running !== null}
          onClick={() => void run('pull')}
        >
          {running === 'pull' ? spinner : <ArrowDown />}
          {translate('auto.components.rightSidebar.FolderWorkspaceBatchBar.pullAll', 'Pull all')}
        </Button>
        <Button
          type="button"
          size="xs"
          variant="outline"
          disabled={running !== null}
          onClick={() => void run('push')}
        >
          {running === 'push' ? spinner : <ArrowUp />}
          {translate('auto.components.rightSidebar.FolderWorkspaceBatchBar.pushAll', 'Push all')}
        </Button>
      </div>
    </div>
  )
}
