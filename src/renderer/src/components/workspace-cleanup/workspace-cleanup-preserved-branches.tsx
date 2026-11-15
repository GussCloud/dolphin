import React, { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, GitBranch, Loader2, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { translate } from '@/i18n/i18n'
import type { PreservedBranchListing } from '../../../../shared/preserved-branch-registry-types'
import { formatWorkspaceCleanupRelativeTime } from './workspace-cleanup-relative-time'

const T = 'auto.components.workspace.cleanup.preservedBranches'

function branchKey(branch: Pick<PreservedBranchListing, 'repoId' | 'branchName'>): string {
  return `${branch.repoId}\0${branch.branchName}`
}

/** Unmerged branches kept by earlier removals; each needs a second click to delete. */
export function WorkspaceCleanupPreservedBranches({
  now
}: {
  now: number
}): React.JSX.Element | null {
  const api = window.api.workspaceCleanup
  const [branches, setBranches] = useState<PreservedBranchListing[]>([])
  const [expanded, setExpanded] = useState(false)
  const [armedKey, setArmedKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!api.listPreservedBranches) {
      return
    }
    try {
      setBranches(await api.listPreservedBranches())
    } catch (error) {
      console.warn('[workspace-cleanup] Could not list kept branches', error)
    }
  }, [api])

  useEffect(() => {
    void load()
  }, [load])

  if (branches.length === 0 || !api.deletePreservedBranch) {
    return null
  }
  const deleteBranch = async (branch: PreservedBranchListing): Promise<void> => {
    const key = branchKey(branch)
    setDeletingKey(key)
    try {
      await api.deletePreservedBranch?.({ repoId: branch.repoId, branchName: branch.branchName })
      toast.success(
        translate(`${T}.deleted`, 'Branch {{value0}} deleted.', { value0: branch.branchName })
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setDeletingKey(null)
      setArmedKey(null)
      await load()
    }
  }

  return (
    <div className="border-t border-border px-5 py-2">
      <Button
        variant="ghost"
        size="xs"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
        <GitBranch className="size-3" />
        {translate(`${T}.title`, 'Kept branches with unmerged work ({{value0}})', {
          value0: branches.length
        })}
      </Button>
      {expanded ? (
        <div className="scrollbar-sleek max-h-40 space-y-1 overflow-y-auto pt-1">
          <p className="text-xs text-muted-foreground">
            {translate(
              `${T}.note`,
              'Deleting a workspace kept these branches because they hold commits not merged anywhere. Deleting a branch here discards those commits.'
            )}
          </p>
          {branches.map((branch) => {
            const key = branchKey(branch)
            const armed = armedKey === key
            return (
              <div key={key} className="flex items-center justify-between gap-3 text-xs">
                <span className="min-w-0 truncate">
                  <span className="text-muted-foreground">{branch.repoName} · </span>
                  <span className="font-mono">{branch.branchName}</span>
                  <span className="text-muted-foreground">
                    {' · '}
                    {formatWorkspaceCleanupRelativeTime(branch.preservedAt, now)}
                  </span>
                </span>
                <Button
                  variant={armed ? 'destructive' : 'ghost'}
                  size="xs"
                  disabled={deletingKey !== null}
                  onClick={() => (armed ? void deleteBranch(branch) : setArmedKey(key))}
                >
                  {deletingKey === key ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <Trash2 className="size-3" />
                  )}
                  {armed
                    ? translate(`${T}.confirm`, 'Discard commits')
                    : translate(`${T}.delete`, 'Delete')}
                </Button>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
