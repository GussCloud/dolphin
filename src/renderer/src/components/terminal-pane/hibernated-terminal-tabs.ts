/**
 * A hibernated terminal tab: every pane's agent finished and was hibernated, so the tab holds
 * no live PTY — only frozen xterm frames, each backed by a passive sleeping record and a daemon
 * history checkpoint (`kill({ keepHistory: true })`) under the leaf's preserved PTY binding.
 *
 * Why it may park: remounting reattaches to that binding, replays the checkpoint, and issues the
 * record's `--resume` (the cold-restore path), so the record — not the xterm — is the restore
 * source. Reveal stays the wake trigger: a parked tab remounts on reveal, exactly when a mounted
 * hibernated pane would wake.
 */
import type { SleepingAgentSessionRecord } from '../../../../shared/agent-session-resume'
import { makePaneKey, isTerminalLeafId } from '../../../../shared/stable-pane-id'
import { parseAppSshPtyId } from '../../../../shared/ssh-pty-id'
import type { TerminalLayoutSnapshot, TerminalTab } from '../../../../shared/terminal-tab-types'
import { isPassiveCompletedHibernationEvidence } from '../../lib/sleeping-agent-pane-ownership'
import { createWorktreeRecordSelector } from '@/store/worktree-record-selector-cache'
import { terminalProviderHasAuthoritativeSnapshot } from '../terminal/terminal-provider-snapshot-capability'
import { isSnapshotBackedTerminalPty } from './terminal-hidden-view-parking'
import { collectLeafIds } from './terminal-pane-layout-tree'

const EMPTY_TAB_IDS: ReadonlySet<string> = new Set()

// Why optional: parking hosts run against partial store fixtures, and a missing slice simply
// means nothing is hibernated.
type HibernatedTerminalTabState = {
  tabsByWorktree?: Record<string, TerminalTab[]>
  ptyIdsByTabId?: Record<string, string[]>
  terminalLayoutsByTabId?: Record<string, TerminalLayoutSnapshot>
  sleepingAgentSessionsByPaneKey?: Record<string, SleepingAgentSessionRecord>
}

export function isHibernatedTerminalTab(
  state: HibernatedTerminalTabState,
  worktreeId: string,
  tab: Pick<TerminalTab, 'id' | 'ptyId'>
): boolean {
  if (tab.ptyId !== null || (state.ptyIdsByTabId?.[tab.id]?.length ?? 0) > 0) {
    return false
  }
  const layout = state.terminalLayoutsByTabId?.[tab.id]
  const leafIds = collectLeafIds(layout?.root)
  if (!layout || leafIds.length === 0) {
    return false
  }
  return leafIds.every((leafId) => {
    // Why stable leaves only: a legacy numeric pane key cannot name its record unambiguously.
    if (!isTerminalLeafId(leafId)) {
      return false
    }
    const record = state.sleepingAgentSessionsByPaneKey?.[makePaneKey(tab.id, leafId)]
    const boundPtyId = layout.ptyIdsByLeafId?.[leafId] ?? null
    // Why local daemon only: its checkpoint is what the remount replays; SSH and paired hosts
    // restore through other paths that do not promise the history survived the kill.
    return (
      record !== undefined &&
      record.worktreeId === worktreeId &&
      isPassiveCompletedHibernationEvidence(record) &&
      boundPtyId !== null &&
      parseAppSshPtyId(boundPtyId) === null &&
      isSnapshotBackedTerminalPty(boundPtyId, worktreeId) &&
      terminalProviderHasAuthoritativeSnapshot(boundPtyId)
    )
  })
}

/** Memoized on the slices it reads, so unrelated store writes reuse the previous set. */
export const selectHibernatedTerminalTabIds = createWorktreeRecordSelector<
  HibernatedTerminalTabState,
  ReadonlySet<string>
>({
  readSources: (state) => [
    state.tabsByWorktree,
    state.ptyIdsByTabId,
    state.terminalLayoutsByTabId,
    state.sleepingAgentSessionsByPaneKey
  ],
  empty: EMPTY_TAB_IDS,
  build: (state, worktreeId) => {
    let hibernated: Set<string> | null = null
    for (const tab of state.tabsByWorktree?.[worktreeId] ?? []) {
      if (isHibernatedTerminalTab(state, worktreeId, tab)) {
        hibernated ??= new Set()
        hibernated.add(tab.id)
      }
    }
    return hibernated ?? EMPTY_TAB_IDS
  }
})

/** Hidden hibernated tabs past the cold-park delay. Why no hot-retain: keeping one warm buys a
 *  frozen frame, never a faster wake — the resume spawns either way. Why no post-measure
 *  cool-down: hibernated tabs stay parked through measure windows, so there is no re-park churn. */
export function selectParkedHibernatedTerminalTabs(args: {
  candidates: readonly {
    id: string
    isVisible: boolean
    hasActivityTerminalPortal: boolean
    hiddenSinceMs: number | null
  }[]
  hibernatedTabIds: ReadonlySet<string>
  wakeRequestedTabIds: ReadonlySet<string>
  parkingEnabled: boolean
  nowMs: number
  coldParkDelayMs: number
}): Set<string> {
  const parked = new Set<string>()
  if (!args.parkingEnabled || args.hibernatedTabIds.size === 0) {
    return parked
  }
  for (const candidate of args.candidates) {
    if (
      args.hibernatedTabIds.has(candidate.id) &&
      !args.wakeRequestedTabIds.has(candidate.id) &&
      !candidate.isVisible &&
      !candidate.hasActivityTerminalPortal &&
      candidate.hiddenSinceMs !== null &&
      args.nowMs - candidate.hiddenSinceMs >= args.coldParkDelayMs
    ) {
      parked.add(candidate.id)
    }
  }
  return parked
}
