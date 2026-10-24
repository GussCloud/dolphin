// Session rotation for autonomous-goal coordinators: before the context window fills, ask for a
// short handoff note, reset the session in place, and resume from stored state. Replaces the
// agent's own auto-compaction, which summarizes lossily and mid-task.
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import { isChildAttributedHookEvent } from '../agent-hooks/server/server-child-attribution'
import type { AgentStatusClearIpcPayload } from '../../shared/agent-status-types'
import type { AgentPaneTextResult } from '../agent-pane-text-delivery'
import {
  isAutonomousGoalAgent,
  type AutonomousGoal,
  type AutonomousGoalAgent
} from '../../shared/autonomous-goal-types'
import {
  AUTONOMOUS_COORDINATOR_HANDOFF_REQUEST,
  AUTONOMOUS_COORDINATOR_RESET_COMMAND
} from '../../shared/autonomous-coordinator-prompt'
import type { CoordinatorContextReading } from './autonomous-goal-context-probe'

/** Below every supported window and well below where the CLIs auto-compact. */
export const AUTONOMOUS_GOAL_ROTATE_AT_CONTEXT_TOKENS = 120_000
/** Share of a stated window to rotate at when it is smaller than the absolute bound. */
export const AUTONOMOUS_GOAL_ROTATE_AT_WINDOW_SHARE = 0.6
/** Without a readable transcript (SSH, WSL), rotate on turn count instead. */
export const AUTONOMOUS_GOAL_ROTATE_FALLBACK_TURNS = 40
export const AUTONOMOUS_GOAL_ROTATION_COOLDOWN_MS = 10 * 60_000
export const AUTONOMOUS_GOAL_HANDOFF_TIMEOUT_MS = 3 * 60_000
/** Time for the CLI to finish its reset before the resume prompt is typed. */
export const AUTONOMOUS_GOAL_RESET_SETTLE_MS = 5_000

export type AutonomousGoalRotationPorts = {
  subscribeEnrichedStatus: (
    listener: (payload: EnrichedAgentHookEventPayload) => void
  ) => () => void
  subscribePaneStatusClear: (listener: (clear: AgentStatusClearIpcPayload) => void) => () => void
  findOpenGoalByPane: (paneKey: string) => AutonomousGoal | null
  readContext: (
    agent: AutonomousGoalAgent,
    transcriptPath: string
  ) => Promise<CoordinatorContextReading | null>
  resolveTerminalHandle: (paneKey: string) => string | null
  /** Last user input on the terminal from any surface; undefined when unknown. */
  readLastInputAt: (terminal: string) => number | undefined
  /** Paste then Enter, refused when no agent is in the foreground. */
  sendPrompt: (terminal: string, text: string) => Promise<AgentPaneTextResult>
  /** Typed (not pasted) so the CLI reads it as a slash command. */
  sendCommand: (terminal: string, command: string) => Promise<AgentPaneTextResult>
  buildResumePrompt: (goal: AutonomousGoal) => string
  recordRotation: (goalId: string) => void
  now?: () => number
  schedule?: (run: () => void, ms: number) => () => void
}

type PaneRotationState = {
  turnsSinceRotation: number
  lastDoneStamp?: number
  lastRotatedAt?: number
  phase: 'idle' | 'handoff' | 'resetting'
  inputSnapshot?: number
  cancelTimer?: () => void
}

function defaultSchedule(run: () => void, ms: number): () => void {
  const timer = setTimeout(run, ms)
  return () => clearTimeout(timer)
}

export function rotationThreshold(reading: CoordinatorContextReading): number {
  return reading.windowTokens
    ? Math.min(
        AUTONOMOUS_GOAL_ROTATE_AT_CONTEXT_TOKENS,
        Math.floor(reading.windowTokens * AUTONOMOUS_GOAL_ROTATE_AT_WINDOW_SHARE)
      )
    : AUTONOMOUS_GOAL_ROTATE_AT_CONTEXT_TOKENS
}

function isCompletedLeadTurn(enriched: EnrichedAgentHookEventPayload): boolean {
  const payload = enriched.payload
  return (
    payload.state === 'done' &&
    payload.sessionBoundary !== true &&
    payload.interrupted !== true &&
    (payload.mainAgent === undefined || payload.mainAgent.state === 'done')
  )
}

export function startAutonomousGoalRotation(ports: AutonomousGoalRotationPorts): () => void {
  const schedule = ports.schedule ?? defaultSchedule
  const now = ports.now ?? Date.now
  const panes = new Map<string, PaneRotationState>()

  function paneState(paneKey: string): PaneRotationState {
    let state = panes.get(paneKey)
    if (!state) {
      state = { turnsSinceRotation: 0, phase: 'idle' }
      panes.set(paneKey, state)
    }
    return state
  }

  function abort(state: PaneRotationState): void {
    state.cancelTimer?.()
    state.cancelTimer = undefined
    state.phase = 'idle'
    state.inputSnapshot = undefined
  }

  function forget(paneKey: string): void {
    const state = panes.get(paneKey)
    if (state) {
      abort(state)
    }
    panes.delete(paneKey)
  }

  /** The user typed into the pane since we last did: they own the turn now. */
  function userTookOver(terminal: string, state: PaneRotationState): boolean {
    return ports.readLastInputAt(terminal) !== state.inputSnapshot
  }

  async function shouldRotate(
    goal: AutonomousGoal,
    enriched: EnrichedAgentHookEventPayload,
    state: PaneRotationState
  ): Promise<boolean> {
    if (
      state.lastRotatedAt !== undefined &&
      now() - state.lastRotatedAt < AUTONOMOUS_GOAL_ROTATION_COOLDOWN_MS
    ) {
      return false
    }
    const transcriptPath = enriched.providerSession?.transcriptPath
    // Why: an SSH or WSL transcript lives on the other host; its turns still count.
    if (enriched.connectionId === null && transcriptPath) {
      const reading = await ports.readContext(goal.agent, transcriptPath)
      if (reading) {
        return reading.contextTokens >= rotationThreshold(reading)
      }
    }
    return state.turnsSinceRotation >= AUTONOMOUS_GOAL_ROTATE_FALLBACK_TURNS
  }

  async function beginHandoff(paneKey: string, state: PaneRotationState): Promise<void> {
    const terminal = ports.resolveTerminalHandle(paneKey)
    if (!terminal) {
      return
    }
    state.phase = 'handoff'
    let result: AgentPaneTextResult
    try {
      result = await ports.sendPrompt(terminal, AUTONOMOUS_COORDINATOR_HANDOFF_REQUEST)
    } catch {
      result = 'unknown'
    }
    if (result !== 'accepted' || panes.get(paneKey) !== state || state.phase !== 'handoff') {
      abort(state)
      return
    }
    state.inputSnapshot = ports.readLastInputAt(terminal)
    // Why: the note is optional; a coordinator that never answers still gets rotated.
    state.cancelTimer = schedule(
      () => void reset(paneKey, state),
      AUTONOMOUS_GOAL_HANDOFF_TIMEOUT_MS
    )
  }

  async function reset(paneKey: string, state: PaneRotationState): Promise<void> {
    state.cancelTimer?.()
    state.cancelTimer = undefined
    const goal = ports.findOpenGoalByPane(paneKey)
    const terminal = ports.resolveTerminalHandle(paneKey)
    if (
      !goal ||
      !terminal ||
      panes.get(paneKey) !== state ||
      state.phase !== 'handoff' ||
      userTookOver(terminal, state)
    ) {
      abort(state)
      return
    }
    state.phase = 'resetting'
    const cleared = await ports
      .sendCommand(terminal, AUTONOMOUS_COORDINATOR_RESET_COMMAND[goal.agent])
      .catch((): AgentPaneTextResult => 'unknown')
    if (cleared !== 'accepted') {
      abort(state)
      return
    }
    state.cancelTimer = schedule(() => void resume(paneKey, state), AUTONOMOUS_GOAL_RESET_SETTLE_MS)
  }

  async function resume(paneKey: string, state: PaneRotationState): Promise<void> {
    state.cancelTimer = undefined
    const goal = ports.findOpenGoalByPane(paneKey)
    const terminal = ports.resolveTerminalHandle(paneKey)
    if (!goal || !terminal || panes.get(paneKey) !== state || state.phase !== 'resetting') {
      abort(state)
      return
    }
    // Why: built after the handoff landed, so the note written by the old session is included.
    const resumed = await ports
      .sendPrompt(terminal, ports.buildResumePrompt(goal))
      .catch((): AgentPaneTextResult => 'unknown')
    abort(state)
    if (resumed === 'accepted') {
      state.turnsSinceRotation = 0
      state.lastRotatedAt = now()
      ports.recordRotation(goal.id)
    }
  }

  async function onCompletedTurn(
    enriched: EnrichedAgentHookEventPayload,
    goal: AutonomousGoal
  ): Promise<void> {
    const state = paneState(enriched.paneKey)
    if (state.lastDoneStamp === enriched.stateStartedAt) {
      return
    }
    state.lastDoneStamp = enriched.stateStartedAt
    if (state.phase === 'handoff') {
      await reset(enriched.paneKey, state)
      return
    }
    if (state.phase !== 'idle') {
      return
    }
    state.turnsSinceRotation += 1
    // Why: a usage-limited goal is paused on purpose; rotating it would spend quota to wake it.
    if (goal.status === 'usageLimited' || !(await shouldRotate(goal, enriched, state))) {
      return
    }
    if (state.phase === 'idle' && panes.get(enriched.paneKey) === state) {
      await beginHandoff(enriched.paneKey, state)
    }
  }

  function onStatus(enriched: EnrichedAgentHookEventPayload): void {
    if (
      enriched.isReplay === true ||
      enriched.providerSessionOnly === true ||
      !isAutonomousGoalAgent(enriched.source) ||
      isChildAttributedHookEvent(enriched) ||
      !isCompletedLeadTurn(enriched)
    ) {
      return
    }
    const goal = ports.findOpenGoalByPane(enriched.paneKey)
    if (!goal) {
      return
    }
    void onCompletedTurn(enriched, goal).catch((error: unknown) => {
      console.warn('[autonomous-goals] rotation failed', error)
      const state = panes.get(enriched.paneKey)
      if (state) {
        abort(state)
      }
    })
  }

  function onPaneClear(clear: AgentStatusClearIpcPayload): void {
    if ('paneKey' in clear) {
      forget(clear.paneKey)
    }
  }

  const disposers = [
    ports.subscribeEnrichedStatus(onStatus),
    ports.subscribePaneStatusClear(onPaneClear)
  ]
  return () => {
    for (const dispose of disposers) {
      dispose()
    }
    for (const paneKey of panes.keys()) {
      forget(paneKey)
    }
  }
}
