import type { WorkspaceCleanupCandidate } from '../../../../shared/workspace-cleanup'
import { getWorkspaceCleanupCandidateIdentity } from '../../../../shared/workspace-cleanup-host-identity'
import { createBrowserUuid } from '@/lib/browser-uuid'
import { WORKSPACE_CLEANUP_GIT_EVIDENCE_MAX_TARGETS } from './workspace-cleanup-git-evidence'

type TargetedScan = (args: {
  worktreeIds: string[]
  scanId: string
}) => Promise<{ candidates: readonly WorkspaceCleanupCandidate[] }>

/** Rows whose git status the broad scan deferred: their approval would carry no git risk. */
export function hasUncheckedGit(candidate: WorkspaceCleanupCandidate): boolean {
  return candidate.git.checkedAt === null
}

/**
 * Reads git now for the rows about to be confirmed that were never checked, so the confirm
 * screen shows real risk instead of the deletion discovering it and refusing the row.
 * A row whose read fails keeps its original candidate; the deletion preflight still guards it.
 */
export async function refreshUncheckedGitEvidence(
  candidates: readonly WorkspaceCleanupCandidate[],
  scan: TargetedScan = (args) => window.api.workspaceCleanup.scan(args)
): Promise<WorkspaceCleanupCandidate[]> {
  const unchecked = [...new Set(candidates.filter(hasUncheckedGit).map((c) => c.worktreeId))]
  if (unchecked.length === 0) {
    return [...candidates]
  }
  const fresh = new Map<string, WorkspaceCleanupCandidate>()
  for (
    let index = 0;
    index < unchecked.length;
    index += WORKSPACE_CLEANUP_GIT_EVIDENCE_MAX_TARGETS
  ) {
    const worktreeIds = unchecked.slice(index, index + WORKSPACE_CLEANUP_GIT_EVIDENCE_MAX_TARGETS)
    try {
      const result = await scan({ worktreeIds, scanId: createBrowserUuid() })
      for (const candidate of result.candidates) {
        fresh.set(getWorkspaceCleanupCandidateIdentity(candidate), candidate)
      }
    } catch {
      // Why: keep going; unread rows stay as they were and the preflight decides.
    }
  }
  return candidates.map(
    (candidate) => fresh.get(getWorkspaceCleanupCandidateIdentity(candidate)) ?? candidate
  )
}
