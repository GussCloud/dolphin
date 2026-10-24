import { describe, expect, it, vi } from 'vitest'
import type { AutonomousGoal } from '../../shared/autonomous-goal-types'
import { AUTONOMOUS_COORDINATOR_MAIL_NUDGE } from '../../shared/autonomous-coordinator-prompt'
import {
  AUTONOMOUS_GOAL_MAIL_MAX_NUDGES,
  AUTONOMOUS_GOAL_MAIL_RENUDGE_MS,
  AUTONOMOUS_GOAL_MAIL_STRANDED_MS,
  startAutonomousGoalMailWatchdog,
  type AutonomousGoalMailWatchdogPorts
} from './autonomous-goal-mail-watchdog'

const goal: AutonomousGoal = {
  id: 'goal_1',
  objective: 'Ship',
  agent: 'claude',
  workerAgent: 'claude',
  maxConcurrent: 2,
  status: 'active',
  paneKey: 'pane-1',
  worktreeId: 'wt-coord',
  runId: 'run_1',
  notes: [],
  rotations: 0,
  createdAt: 0,
  updatedAt: 0
}

function harness(overrides: Partial<AutonomousGoalMailWatchdogPorts> = {}) {
  let clock = 0
  const state: {
    unread: string | null
    status: 'working' | 'permission' | 'idle' | null
    inputAt: number | undefined
    goalStatus: AutonomousGoal['status']
  } = { unread: 'msg_1', status: 'idle', inputAt: undefined, goalStatus: goal.status }
  const sendNudge = vi.fn(async () => true)
  const markBlocked = vi.fn()
  const watchdog = startAutonomousGoalMailWatchdog({
    listGoals: () => [{ ...goal, status: state.goalStatus }],
    oldestUnreadRunMessageId: () => state.unread,
    resolveTerminalHandle: () => 'term_coord',
    readAgentStatus: async () => state.status,
    readLastInputAt: () => state.inputAt,
    sendNudge,
    markBlocked,
    now: () => clock,
    every: () => () => {},
    ...overrides
  })
  const advance = async (ms: number) => {
    clock += ms
    await watchdog.check()
  }
  return { state, sendNudge, markBlocked, watchdog, advance }
}

describe('autonomous goal mail watchdog', () => {
  it('nudges an idle coordinator once mail has sat unread past the grace period', async () => {
    const { sendNudge, watchdog, advance } = harness()
    await watchdog.check()
    await advance(AUTONOMOUS_GOAL_MAIL_STRANDED_MS - 1)
    expect(sendNudge).not.toHaveBeenCalled()
    await advance(1)
    expect(sendNudge).toHaveBeenCalledExactlyOnceWith(
      'term_coord',
      AUTONOMOUS_COORDINATOR_MAIL_NUDGE
    )
  })

  it('stays quiet when the mail is handled in time', async () => {
    const { state, sendNudge, watchdog, advance } = harness()
    await watchdog.check()
    state.unread = null
    await advance(AUTONOMOUS_GOAL_MAIL_STRANDED_MS * 2)
    expect(sendNudge).not.toHaveBeenCalled()
  })

  it('never types into a working or permission-blocked coordinator', async () => {
    const { state, sendNudge, watchdog, advance } = harness()
    await watchdog.check()
    for (const status of ['working', 'permission', null] as const) {
      state.status = status
      await advance(AUTONOMOUS_GOAL_MAIL_STRANDED_MS)
    }
    expect(sendNudge).not.toHaveBeenCalled()
  })

  it('restarts the grace period when the user types into the pane', async () => {
    const { state, sendNudge, watchdog, advance } = harness()
    await watchdog.check()
    await advance(AUTONOMOUS_GOAL_MAIL_STRANDED_MS - 10)
    state.inputAt = 123
    await advance(10)
    expect(sendNudge).not.toHaveBeenCalled()
    await advance(AUTONOMOUS_GOAL_MAIL_STRANDED_MS)
    expect(sendNudge).toHaveBeenCalledOnce()
  })

  it('re-nudges on a slow cadence, then marks the goal blocked instead of looping', async () => {
    const { sendNudge, markBlocked, watchdog, advance } = harness()
    await watchdog.check()
    await advance(AUTONOMOUS_GOAL_MAIL_STRANDED_MS)
    await advance(AUTONOMOUS_GOAL_MAIL_RENUDGE_MS - 1)
    expect(sendNudge).toHaveBeenCalledOnce()
    for (let i = 0; i < AUTONOMOUS_GOAL_MAIL_MAX_NUDGES + 2; i += 1) {
      await advance(AUTONOMOUS_GOAL_MAIL_RENUDGE_MS)
    }
    expect(sendNudge).toHaveBeenCalledTimes(AUTONOMOUS_GOAL_MAIL_MAX_NUDGES)
    expect(markBlocked).toHaveBeenCalledOnce()
  })

  it('does not wake a usage-limited goal', async () => {
    const { state, sendNudge, watchdog, advance } = harness()
    state.goalStatus = 'usageLimited'
    await watchdog.check()
    await advance(AUTONOMOUS_GOAL_MAIL_STRANDED_MS * 2)
    expect(sendNudge).not.toHaveBeenCalled()
  })
})
