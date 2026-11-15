import type { Automation, AutomationRun } from '../../shared/automations-types'

/** Removes a worktree without force; refuses (throws) when it holds uncommitted work. */
export type RemoveRunWorkspace = (workspaceId: string) => Promise<unknown>

/**
 * A run of a "new workspace per run" automation created its worktree only for that run. Once the
 * run completed, that worktree is removed unless it holds work: removal is never forced, so a dirty
 * tree stays (and shows in the cleanup screen), and an unmerged branch keeps its commits.
 * Failed runs keep their worktree for inspection.
 */
export function shouldRetireRunWorkspace(
  automation: Pick<Automation, 'workspaceMode'> | undefined,
  run: Pick<AutomationRun, 'status' | 'workspaceId'>
): run is Pick<AutomationRun, 'status'> & { workspaceId: string } {
  return (
    automation?.workspaceMode === 'new_per_run' &&
    run.status === 'completed' &&
    Boolean(run.workspaceId)
  )
}

export async function retireRunWorkspace(
  workspaceId: string,
  remove: RemoveRunWorkspace
): Promise<'removed' | 'kept'> {
  try {
    await remove(`id:${workspaceId}`)
    return 'removed'
  } catch (error) {
    // Why info, not error: a worktree kept because it has work is the intended outcome.
    console.info(
      `[automations] kept run workspace ${workspaceId}:`,
      error instanceof Error ? error.message : String(error)
    )
    return 'kept'
  }
}

/** Fire-and-forget retirement of `run`'s workspace when its automation owns one per run. */
export function scheduleRunWorkspaceRetirement(
  automations: readonly Automation[],
  run: AutomationRun,
  remove: RemoveRunWorkspace | null
): void {
  const automation = automations.find((candidate) => candidate.id === run.automationId)
  if (remove && shouldRetireRunWorkspace(automation, run)) {
    void retireRunWorkspace(run.workspaceId, remove)
  }
}
