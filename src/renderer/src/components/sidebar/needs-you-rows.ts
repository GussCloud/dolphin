import type { DashboardSnapshotState } from '@/components/dashboard/build-dashboard-snapshot'
import {
  createDashboardBucketCountsCache,
  selectActiveDashboardWorkspaces,
  type DashboardBucketCountsCache
} from '@/components/dashboard/build-dashboard-bucket-counts'
import type { ActiveDashboardWorkspace } from '@/components/dashboard/dashboard-snapshot-workspaces'
import { selectDashboardOrchestration } from '@/components/dashboard/dashboard-orchestration-selection'
import { dashboardRowBucketProjection } from '@/components/dashboard/dashboard-row-bucket'
import type { DashboardAgentRowWithLineage } from '@/components/dashboard/agent-row-lineage'
import {
  finishWorktreeAgentRowsCachePass,
  selectWorktreeAgentRowsCached,
  startWorktreeAgentRowsCachePass
} from '@/components/dashboard/worktree-agent-rows-cache'
import { parseInteractivePrompt } from '@/components/native-chat/native-chat-interactive-prompt'
import { branchName } from '@/lib/git-utils'
import { EMPTY_WORKTREE_AGENT_ORCHESTRATION } from './worktree-agent-orchestration-batch'

export type NeedsYouKind = 'blocked' | 'waiting'

/** One agent the user has to answer, as the "Needs you" sidebar section renders it. */
export type NeedsYouRow = {
  paneKey: string
  tabId: string
  worktreeId: string
  kind: NeedsYouKind
  /** When the agent entered its current blocked/waiting state. */
  stateStartedAt: number
  workspaceName: string
  projectName: string
  /** Empty for folder workspaces, which have no branch. */
  branch: string
  /** The question or approval the agent is waiting on; absent when the status carries none. */
  promptText?: string
}

type WorktreeNeedsYouMemo = {
  rows: readonly unknown[]
  acknowledgedAgentsByPaneKey: unknown
  workspace: ActiveDashboardWorkspace
  needsYou: NeedsYouRow[]
}

export type NeedsYouRowsCache = DashboardBucketCountsCache & {
  needsYouByWorktree: Map<string, WorktreeNeedsYouMemo>
  lastRows: NeedsYouRow[]
}

const EMPTY_NEEDS_YOU_ROWS: NeedsYouRow[] = []

export function createNeedsYouRowsCache(): NeedsYouRowsCache {
  return {
    ...createDashboardBucketCountsCache(),
    needsYouByWorktree: new Map(),
    lastRows: EMPTY_NEEDS_YOU_ROWS
  }
}

function promptTextFromStatus(row: DashboardAgentRowWithLineage): string | undefined {
  const card = parseInteractivePrompt(row.entry.interactivePrompt, row.entry.toolName)
  if (card?.kind === 'question') {
    const question = card.prompt.questions[0]?.question.trim()
    return question || undefined
  }
  if (card?.kind === 'approval') {
    const { title, detail } = card.approval
    return detail ? `${title} ${detail}` : title
  }
  return undefined
}

function collectWorktreeNeedsYou(
  rows: DashboardAgentRowWithLineage[],
  acknowledgedAgentsByPaneKey: Record<string, number> | undefined,
  workspace: ActiveDashboardWorkspace,
  cache: NeedsYouRowsCache | undefined
): NeedsYouRow[] {
  const worktreeId = workspace.worktree.id
  const memo = cache?.needsYouByWorktree.get(worktreeId)
  if (
    memo &&
    memo.rows === rows &&
    memo.acknowledgedAgentsByPaneKey === acknowledgedAgentsByPaneKey &&
    memo.workspace === workspace
  ) {
    return memo.needsYou
  }
  let needsYou: NeedsYouRow[] = EMPTY_NEEDS_YOU_ROWS
  for (const row of rows) {
    // Why: same exclusion as the sidebar bucket count, so the section and the "Needs You" badge agree.
    if (row.rowSource === 'subagent') {
      continue
    }
    const { bucket, dotState } = dashboardRowBucketProjection(row, acknowledgedAgentsByPaneKey)
    if (bucket !== 'attention' || (dotState !== 'blocked' && dotState !== 'waiting')) {
      continue
    }
    if (needsYou === EMPTY_NEEDS_YOU_ROWS) {
      needsYou = []
    }
    const promptText = promptTextFromStatus(row)
    needsYou.push({
      paneKey: row.paneKey,
      tabId: row.tab.id,
      worktreeId,
      kind: dotState,
      stateStartedAt: row.entry.stateStartedAt || row.startedAt,
      workspaceName: workspace.worktree.displayName,
      projectName: workspace.projectName,
      branch: branchName(workspace.worktree.branch),
      ...(promptText ? { promptText } : {})
    })
  }
  cache?.needsYouByWorktree.set(worktreeId, {
    rows,
    acknowledgedAgentsByPaneKey,
    workspace,
    needsYou
  })
  return needsYou
}

function sameRows(a: readonly NeedsYouRow[], b: readonly NeedsYouRow[]): boolean {
  return a.length === b.length && a.every((row, index) => row === b[index])
}

/**
 * Every top-level agent in the dashboard's "attention" bucket, across all hosts and workspaces.
 *
 * Reuses the bucket-count pipeline (workspace memo, per-worktree row cache) and adds a
 * per-worktree memo of the attention rows, so an unrelated status write rebuilds one worktree
 * and returns the previous array by identity when nothing in the section moved.
 */
export function buildNeedsYouRows(
  state: DashboardSnapshotState,
  now: number,
  cache?: NeedsYouRowsCache,
  generation?: unknown
): NeedsYouRow[] {
  const activeWorkspaces = selectActiveDashboardWorkspaces(state, cache)
  const { singletonOrchestration, orchestrationByWorktree } = selectDashboardOrchestration(
    state,
    activeWorkspaces
  )
  if (cache) {
    startWorktreeAgentRowsCachePass(cache)
  }
  let collected: NeedsYouRow[] = EMPTY_NEEDS_YOU_ROWS
  for (const workspace of activeWorkspaces) {
    const worktreeId = workspace.worktree.id
    const rows = selectWorktreeAgentRowsCached({
      state,
      worktreeId,
      orchestration:
        singletonOrchestration ??
        orchestrationByWorktree?.get(worktreeId) ??
        EMPTY_WORKTREE_AGENT_ORCHESTRATION,
      now,
      generation,
      cache
    })
    const needsYou = collectWorktreeNeedsYou(
      rows,
      state.acknowledgedAgentsByPaneKey,
      workspace,
      cache
    )
    if (needsYou.length > 0) {
      collected = collected === EMPTY_NEEDS_YOU_ROWS ? [...needsYou] : collected.concat(needsYou)
    }
  }
  if (cache) {
    for (const worktreeId of cache.needsYouByWorktree.keys()) {
      if (!cache.seenWorktreeIds.has(worktreeId)) {
        cache.needsYouByWorktree.delete(worktreeId)
      }
    }
    finishWorktreeAgentRowsCachePass(cache)
  }
  // Why oldest first: the longest wait is the most costly, and new arrivals append below
  // instead of shifting the card the user is about to click.
  collected.sort(
    (a, b) => a.stateStartedAt - b.stateStartedAt || a.paneKey.localeCompare(b.paneKey)
  )
  if (!cache) {
    return collected
  }
  const stable = sameRows(cache.lastRows, collected) ? cache.lastRows : collected
  cache.lastRows = stable
  return stable
}
