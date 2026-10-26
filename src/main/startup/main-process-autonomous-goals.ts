import { agentHookServer } from '../agent-hooks/server'
import {
  createRpcAgentPaneTerminalSend,
  deliverAgentPanePlainText
} from '../agent-pane-text-delivery'
import { getAgentPromptSubmitDelayMs } from '../../shared/agent-prompt-injection'
import { buildAutonomousCoordinatorResumePrompt } from '../../shared/autonomous-coordinator-prompt'
import { readCoordinatorContext } from '../autonomous-goals/autonomous-goal-context-probe'
import { startAutonomousGoalRotation } from '../autonomous-goals/autonomous-goal-rotation'
import { startAutonomousGoalUsageResume } from '../autonomous-goals/autonomous-goal-usage-resume'
import { startAutonomousGoalNotifier } from '../autonomous-goals/autonomous-goal-notifier'
import { startAutonomousGoalMailWatchdog } from '../autonomous-goals/autonomous-goal-mail-watchdog'
import { startAutonomousGoalCleanup } from '../autonomous-goals/autonomous-goal-cleanup'
import { createAutonomousGoalCleanupRpcPorts } from '../autonomous-goals/autonomous-goal-cleanup-ports'
import { startAutonomousGoalRendererBroadcast } from '../autonomous-goals/autonomous-goal-renderer-broadcast'
import { dispatchMainProcessNotification } from '../ipc/notifications'
import type { Store } from '../persistence'
import { resolveWorkspaceDisplayName } from '../workspace-display-name'
import { getAutonomousGoalStore } from '../autonomous-goals/autonomous-goal-store-instance'
import { isAutonomousGoalOpen } from '../../shared/autonomous-goal-types'
import { readLatestTerminalInputAt } from '../terminal-client-input-clock'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'
import { isAgentPromptStalledError } from '../runtime/agent-prompt-submission-verification'

/** Starts session rotation and usage-window resume for this host's open autonomous goals. */
export function startMainProcessAutonomousGoals(
  appStore: Store,
  runtime: DolphinRuntimeService
): () => void {
  const dispatcher = new RpcDispatcher({ runtime })
  const sendTerminal = createRpcAgentPaneTerminalSend(
    (request) => dispatcher.dispatch(request),
    'autonomous-goal-rotation'
  )
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
  const store = getAutonomousGoalStore()
  const sendPrompt = (terminal: string, text: string) =>
    deliverAgentPanePlainText({ sendTerminal, wait }, terminal, text)
  // Why: no stale row-handle fallback — a pane the runtime no longer has live must not be typed into.
  const resolveTerminalHandle = (paneKey: string): string | null =>
    runtime.getLiveTerminalHandleForPaneKey(paneKey)
  const readLastInputAt = (terminal: string): number | undefined => {
    const ptyId = runtime.resolveLiveLeafForHandle(terminal)?.ptyId
    return ptyId ? readLatestTerminalInputAt(ptyId) : undefined
  }
  const stopUsageResume = startAutonomousGoalUsageResume({
    listGoals: () => store.list(),
    subscribe: (listener) => store.subscribe(listener),
    markActive: (goalId) => store.update(goalId, { status: 'active', usageResumeAt: undefined }),
    resolveTerminalHandle,
    sendPrompt
  })
  const stopNotifier = startAutonomousGoalNotifier({
    listGoals: () => store.list(),
    subscribe: (listener) => store.subscribe(listener),
    notify: (request) => {
      const worktreeLabel = request.worktreeId
        ? resolveWorkspaceDisplayName(appStore, request.worktreeId)
        : null
      void Promise.resolve(
        dispatchMainProcessNotification({ ...request, ...(worktreeLabel ? { worktreeLabel } : {}) })
      ).catch((error: unknown) => console.warn('[autonomous-goals] notification failed', error))
    }
  })
  const stopRotation = startAutonomousGoalRotation({
    subscribeEnrichedStatus: (listener) => agentHookServer.subscribeEnrichedStatus(listener),
    subscribePaneStatusClear: (listener) => agentHookServer.subscribePaneStatusClear(listener),
    findOpenGoalByPane: (paneKey) => store.findOpenByPane(paneKey),
    readContext: readCoordinatorContext,
    resolveTerminalHandle,
    readLastInputAt,
    sendPrompt: (terminal, text) =>
      deliverAgentPanePlainText({ sendTerminal, wait }, terminal, text),
    sendCommand: async (terminal, command) => {
      const typed = await sendTerminal({
        terminal,
        text: command,
        enter: false,
        requireAgentStatus: 'sendable'
      })
      if (typed !== 'accepted') {
        return typed
      }
      await wait(getAgentPromptSubmitDelayMs(process.platform, Buffer.byteLength(command, 'utf8')))
      const submitted = await sendTerminal({
        terminal,
        enter: true,
        requireAgentStatus: 'sendable'
      })
      return submitted === 'accepted' ? 'accepted' : 'partly-sent'
    },
    buildResumePrompt: (goal) => {
      const tasks = runtime
        .getOrchestrationDb()
        .listTasks({ runId: goal.runId })
        .map((task) => ({ id: task.id, status: task.status, spec: task.task_title ?? task.spec }))
      return buildAutonomousCoordinatorResumePrompt(goal, tasks)
    },
    recordRotation: (goalId) => {
      const goal = store.get(goalId)
      if (goal) {
        store.update(goalId, { rotations: goal.rotations + 1, lastRotatedAt: Date.now() })
      }
    }
  })
  const mailWatchdog = startAutonomousGoalMailWatchdog({
    listGoals: () => store.list(),
    oldestUnreadRunMessageId: (runId) =>
      runtime.getOrchestrationDb().getUnreadRunMailbox(runId, 1)[0]?.id ?? null,
    resolveTerminalHandle,
    readAgentStatus: async (terminal) => (await runtime.getTerminalAgentStatus(terminal)).status,
    readLastInputAt,
    sendNudge: async (terminal, text) => {
      try {
        await runtime.sendTerminalAgentPrompt(terminal, text)
        return true
      } catch (error) {
        // Why: a stalled verdict still wrote the nudge; only an unwritable pane counts as unsent.
        return isAgentPromptStalledError(error)
      }
    },
    markBlocked: (goalId, text) => {
      store.addNote(goalId, 'blocker', text)
      store.update(goalId, { status: 'blocked' })
    }
  })
  const cleanup = startAutonomousGoalCleanup({
    listGoals: () => store.list(),
    subscribe: (listener) => store.subscribe(listener),
    ...createAutonomousGoalCleanupRpcPorts({
      dispatch: (request) => dispatcher.dispatch(request),
      runtime
    }),
    recordCleanup: (goalId, record) => {
      store.update(goalId, { cleanup: record })
    }
  })
  const stopBroadcast = startAutonomousGoalRendererBroadcast(
    [
      (notify) => store.subscribe(notify),
      // Why: Tasks and workers live in the Run DB, which the goal store never sees.
      (notify) =>
        runtime.subscribeOrchestrationProgress(() => {
          if (store.list().some(isAutonomousGoalOpen)) {
            notify()
          }
        })
    ],
    () => runtime.notifyAutonomousGoalsChanged()
  )
  return () => {
    stopBroadcast()
    cleanup.stop()
    mailWatchdog.stop()
    stopRotation()
    stopUsageResume()
    stopNotifier()
  }
}
