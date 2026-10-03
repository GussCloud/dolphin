import { useAppStore } from '@/store'
import {
  getEffectiveAgentHibernationIdleMs,
  planAgentHibernationCandidates,
  type AgentHibernationCandidate,
  type AgentHibernationPlannerSnapshot
} from './agent-hibernation-planner'
import {
  confirmAgentHibernationCandidates,
  type AgentHibernationConfirmationState
} from './agent-hibernation-confirmation'
import type { AppState } from '@/store/types'
import { getAllDrivers } from './pane-manager/mobile-driver-state'
import {
  getForegroundTerminalTabIds,
  getForegroundTerminalTabLastSeenAtById
} from './foreground-terminal-tabs'
import { getAgentHibernationOutputSignature } from './agent-hibernation-output-activity'
import {
  getHibernationBoundaryResolvedAtByPaneKey,
  getHibernationPtyBindingFirstSeenAtByPaneKey,
  observeHibernationPtyBindings
} from './agent-hibernation-pane-age'
import { mergePendingTerminalInputActivity } from './terminal-input-activity-coalescing'
import {
  getKnownExecutionHostIdForWorktree,
  getRuntimeEnvironmentIdForWorktree
} from './worktree-runtime-owner'
import {
  collectRuntimePtyLiveness,
  getRuntimeLivenessTargetWorktrees,
  type RuntimePtyLivenessSample
} from './agent-hibernation-runtime-liveness'
import {
  orderByHeaviestSession,
  type HostMemoryPressureLevel
} from './agent-hibernation-memory-pressure'
import {
  readSessionMemoryByPaneKey,
  sampleHostMemoryPressure
} from './agent-hibernation-host-memory-sampling'

export const AGENT_HIBERNATION_TICK_MS = 60 * 1000

type IntervalHandle = ReturnType<typeof setInterval>

type AgentHibernationCoordinatorOptions = {
  intervalMs?: number
  now?: () => number
}

type AgentHibernationCoordinatorState = {
  interval: IntervalHandle | null
  intervalMs: number
  confirmationState: AgentHibernationConfirmationState
  tickInFlight: boolean
  shuttingDownCandidateIds: Set<string>
  now: () => number
}

const coordinator: AgentHibernationCoordinatorState = {
  interval: null,
  intervalMs: AGENT_HIBERNATION_TICK_MS,
  confirmationState: {},
  tickInFlight: false,
  shuttingDownCandidateIds: new Set(),
  now: () => Date.now()
}

// Why: known-local only; a worktree whose host is not yet known is not shortened.
function getHostLocalWorktreeIds(
  state: AppState,
  tabsByWorktree: AppState['tabsByWorktree']
): string[] {
  return Object.keys(tabsByWorktree).filter(
    (worktreeId) => getKnownExecutionHostIdForWorktree(state, worktreeId) === 'local'
  )
}

function snapshotFromState(
  state: AppState,
  now: number,
  runtimeLiveness: RuntimePtyLivenessSample,
  hostMemoryPressureLevel: HostMemoryPressureLevel,
  targetWorktreeId?: string
): AgentHibernationPlannerSnapshot {
  const tabsByWorktree = targetWorktreeId
    ? { [targetWorktreeId]: state.tabsByWorktree[targetWorktreeId] ?? [] }
    : state.tabsByWorktree
  return {
    settings: state.settings,
    activeWorktreeId: state.activeWorktreeId,
    foregroundTerminalTabIds: getForegroundTerminalTabIds(),
    tabsByWorktree,
    terminalLayoutsByTabId: state.terminalLayoutsByTabId,
    ptyIdsByTabId: state.ptyIdsByTabId,
    runtimeLivePtyIdsByWorktreeId: runtimeLiveness.runtimeLivePtyIdsByWorktreeId,
    // Why: a workspace can gain tabs or resolve its runtime owner while the inventory above
    // is in flight, and the plan is built from this later state. Union the fresh targets in
    // so such a workspace is required-but-absent and the planner skips it, rather than
    // answering for the execution host from client PTYs. Union, never replace: dropping a
    // pre-await target would narrow the fail-closed set instead of widening it.
    runtimeLivenessRequiredWorktreeIds: [
      ...new Set([
        ...runtimeLiveness.runtimeLivenessRequiredWorktreeIds,
        ...getRuntimeLivenessTargetWorktrees(state, targetWorktreeId).keys()
      ])
    ],
    mobileLockedPtyIds: [...getAllDrivers()]
      .filter(([, driver]) => driver.kind === 'mobile')
      .map(([ptyId]) => ptyId),
    agentStatusByPaneKey: state.agentStatusByPaneKey,
    sleepingAgentSessionsByPaneKey: state.sleepingAgentSessionsByPaneKey,
    // Why: input stamps are coalesced, so planning must see the not-yet-flushed keystroke.
    lastTerminalInputAtByPaneKey: mergePendingTerminalInputActivity(
      state.lastTerminalInputAtByPaneKey
    ),
    foregroundTerminalLastSeenAtByTabId: getForegroundTerminalTabLastSeenAtById(),
    ptyBindingFirstSeenAtByPaneKey: getHibernationPtyBindingFirstSeenAtByPaneKey(),
    boundaryResolvedAtByPaneKey: getHibernationBoundaryResolvedAtByPaneKey(),
    hostMemoryPressureLevel,
    hostLocalWorktreeIds:
      hostMemoryPressureLevel === 'none' ? [] : getHostLocalWorktreeIds(state, tabsByWorktree),
    now
  }
}

async function currentCandidates(
  now: number,
  hostMemoryPressureLevel: HostMemoryPressureLevel,
  targetWorktreeId?: string
) {
  const runtimeLiveness = await collectRuntimePtyLiveness(useAppStore.getState(), targetWorktreeId)
  const freshState = useAppStore.getState()
  // Why: age the PTY bindings from the same state the plan is built from, so a pane
  // observed for the first time this pass cannot also be judged long-idle in it.
  observeHibernationPtyBindings({
    tabsByWorktree: freshState.tabsByWorktree,
    terminalLayoutsByTabId: freshState.terminalLayoutsByTabId,
    now,
    idleMs: getEffectiveAgentHibernationIdleMs(freshState.settings?.agentHibernationIdleMs)
  })
  return planAgentHibernationCandidates(
    snapshotFromState(freshState, now, runtimeLiveness, hostMemoryPressureLevel, targetWorktreeId)
  )
    .filter((candidate) => {
      const runtimeEnvironmentId = getRuntimeEnvironmentIdForWorktree(
        freshState,
        candidate.worktreeId
      )
      return !runtimeEnvironmentId || candidate.expectedRuntimePtyIds.length === 1
    })
    .map((candidate) => ({
      ...candidate,
      // Why: terminal output after the first stable tick can mean the session
      // is still alive even when agent status remains done; require it to stay quiet.
      signature: `${candidate.signature}|output:${getAgentHibernationOutputSignature(candidate.paneKeys)}`
    }))
}

async function hibernatePaneIfStillEligible(
  confirmedCandidate: AgentHibernationCandidate,
  hostMemoryPressureLevel: HostMemoryPressureLevel
): Promise<void> {
  const { id, worktreeId } = confirmedCandidate
  if (coordinator.shuttingDownCandidateIds.has(id)) {
    return
  }
  // Why: the confirmed pane can only be authorized by its owning worktree. A
  // global sweep here made C pane teardowns issue C×W fresh runtime listings.
  // Why: re-plan under the tick's pressure level so a pressure-eligible pane is not
  // rejected by its own re-validation; a pane that stopped qualifying still is.
  const candidates = await currentCandidates(coordinator.now(), hostMemoryPressureLevel, worktreeId)
  const stillEligible = candidates.some(
    (candidate) =>
      candidate.id === confirmedCandidate.id && candidate.signature === confirmedCandidate.signature
  )
  if (!stillEligible) {
    return
  }
  coordinator.shuttingDownCandidateIds.add(id)
  try {
    const state = useAppStore.getState()
    const runtimeEnvironmentId = getRuntimeEnvironmentIdForWorktree(state, worktreeId)
    await state.shutdownCompletedAgentPaneForHibernation(worktreeId, {
      paneKey: confirmedCandidate.paneKey,
      tabId: confirmedCandidate.tabId,
      leafId: confirmedCandidate.leafId,
      ptyId: confirmedCandidate.targetPtyIds[0],
      ...(runtimeEnvironmentId
        ? { expectedRuntimePtyId: confirmedCandidate.expectedRuntimePtyIds[0] }
        : {})
    })
  } catch (err) {
    console.warn('[agent-hibernation] failed to hibernate agent pane:', id, err)
  } finally {
    coordinator.shuttingDownCandidateIds.delete(id)
  }
}

export async function runAgentHibernationTick(): Promise<void> {
  if (coordinator.tickInFlight) {
    return
  }
  coordinator.tickInFlight = true
  try {
    // Why: hibernation off must not pay for a host-memory read every minute.
    const hostMemoryPressureLevel =
      useAppStore.getState().settings?.experimentalAgentHibernation === true
        ? await sampleHostMemoryPressure()
        : 'none'
    const plan = confirmAgentHibernationCandidates(
      coordinator.confirmationState,
      await currentCandidates(coordinator.now(), hostMemoryPressureLevel)
    )
    coordinator.confirmationState = plan.confirmationState
    const drainOrder =
      hostMemoryPressureLevel !== 'none' && plan.candidates.length > 1
        ? orderByHeaviestSession(
            plan.candidates,
            await readSessionMemoryByPaneKey(coordinator.now(), coordinator.intervalMs * 2)
          )
        : plan.candidates
    // Why: drain sequentially. Each shutdown re-runs a full runtime-liveness sweep and
    // then a stopExact RPC, so firing the whole confirmed set at once meant ~100
    // concurrent sweeps plus ~100 concurrent stops on the first pass after a backlog —
    // hundreds of near-simultaneous RPCs on an SSH runtime. Awaiting also makes
    // `tickInFlight` actually cover the drain; unawaited, it was cleared the moment the
    // promises were launched. Each candidate re-validates against a fresh plan at its own
    // turn, so a slow drain cannot act on stale confirmation.
    for (const candidate of drainOrder) {
      await hibernatePaneIfStillEligible(candidate, hostMemoryPressureLevel)
    }
  } finally {
    coordinator.tickInFlight = false
  }
}

export function startAgentHibernationCoordinator(
  options: AgentHibernationCoordinatorOptions = {}
): () => void {
  if (coordinator.interval !== null) {
    return stopAgentHibernationCoordinator
  }
  coordinator.now = options.now ?? (() => Date.now())
  const intervalMs = options.intervalMs ?? AGENT_HIBERNATION_TICK_MS
  coordinator.intervalMs = intervalMs
  // Why: ticks keep running while the window is hidden. Idle agents hold host RAM whether or
  // not anyone is looking, and an uninterrupted cadence keeps the "two consecutive ticks"
  // rule one interval apart — no visibility-triggered extra tick can shorten it.
  coordinator.interval = setInterval(() => {
    void runAgentHibernationTick()
  }, intervalMs)
  return stopAgentHibernationCoordinator
}

export function stopAgentHibernationCoordinator(): void {
  if (coordinator.interval !== null) {
    clearInterval(coordinator.interval)
    coordinator.interval = null
  }
  coordinator.confirmationState = {}
}

export function resetAgentHibernationCoordinatorForTests(): void {
  stopAgentHibernationCoordinator()
  coordinator.shuttingDownCandidateIds.clear()
  coordinator.tickInFlight = false
  coordinator.now = () => Date.now()
}
