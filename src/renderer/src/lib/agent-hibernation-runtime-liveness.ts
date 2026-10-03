import type { AppState } from '@/store/types'
import { callRuntimeRpc } from '@/runtime/runtime-rpc-client'
import { toRuntimeWorktreeSelector } from '@/runtime/runtime-worktree-selector'
import type {
  RuntimeTerminalListResult,
  RuntimeTerminalSummary
} from '../../../shared/runtime-types'
import { getRuntimeEnvironmentIdForWorktree } from './worktree-runtime-owner'
import { getEntryTabId } from './agent-hibernation-pane-eligibility'

export type RuntimePtyLivenessSample = {
  runtimeLivePtyIdsByWorktreeId: Record<string, string[]>
  runtimeLivenessRequiredWorktreeIds: string[]
}

export function getRuntimeLivenessTargetWorktrees(
  state: AppState,
  targetWorktreeId?: string
): Map<string, string> {
  const targets = new Map<string, string>()
  const worktreeIds = targetWorktreeId
    ? Object.hasOwn(state.tabsByWorktree, targetWorktreeId)
      ? [targetWorktreeId]
      : []
    : Object.keys(state.tabsByWorktree)
  for (const worktreeId of worktreeIds) {
    const runtimeEnvironmentId = getRuntimeEnvironmentIdForWorktree(state, worktreeId)
    if (runtimeEnvironmentId) {
      targets.set(worktreeId, runtimeEnvironmentId)
    }
  }
  return targets
}

function getTypedRuntimePtyId(terminal: RuntimeTerminalSummary): string | null {
  if (terminal.ptyId) {
    return terminal.ptyId
  }
  if (terminal.tabId.startsWith('pty:') && terminal.tabId === terminal.leafId) {
    return terminal.tabId.slice('pty:'.length) || null
  }
  return null
}

export async function collectRuntimePtyLiveness(
  state: AppState,
  targetWorktreeId?: string
): Promise<RuntimePtyLivenessSample> {
  const targets = getRuntimeLivenessTargetWorktrees(state, targetWorktreeId)
  const runtimeLivePtyIdsByWorktreeId: Record<string, string[]> = {}
  const runtimeLivenessRequiredWorktreeIds = [...targets.keys()]
  if (targets.size === 0) {
    // Why: an all-local install has nothing to ask, so it must not pay the status scan below.
    return { runtimeLivePtyIdsByWorktreeId, runtimeLivenessRequiredWorktreeIds }
  }
  const completedTabIds = new Set<string>()
  for (const entry of Object.values(state.agentStatusByPaneKey)) {
    const tabId = entry?.state === 'done' ? getEntryTabId(entry) : null
    if (tabId) {
      completedTabIds.add(tabId)
    }
  }
  await Promise.all(
    [...targets].map(async ([worktreeId, runtimeEnvironmentId]) => {
      if (!state.tabsByWorktree[worktreeId]?.some((tab) => completedTabIds.has(tab.id))) {
        // Skipped owners still require host evidence if an agent completes during this pass.
        return
      }
      try {
        const result = await callRuntimeRpc<RuntimeTerminalListResult>(
          { kind: 'environment', environmentId: runtimeEnvironmentId },
          'terminal.list',
          {
            worktree: toRuntimeWorktreeSelector(worktreeId),
            limit: 10_000,
            requireFreshPtyLiveness: true,
            includeVisualLayouts: false
          },
          { timeoutMs: 10_000 }
        )
        if (result.truncated) {
          return
        }
        const ptyIds = new Set<string>()
        for (const terminal of result.terminals) {
          if (!terminal.connected || terminal.worktreeId !== worktreeId) {
            continue
          }
          const ptyId = getTypedRuntimePtyId(terminal)
          if (ptyId) {
            ptyIds.add(ptyId)
          }
        }
        runtimeLivePtyIdsByWorktreeId[worktreeId] = [...ptyIds].sort()
      } catch {
        // Why: stale runtime liveness is unsafe for all-or-nothing hibernation;
        // omitting the worktree makes the planner fail closed for this pass.
      }
    })
  )
  return { runtimeLivePtyIdsByWorktreeId, runtimeLivenessRequiredWorktreeIds }
}
