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
import { getAutonomousGoalStore } from '../autonomous-goals/autonomous-goal-store-instance'
import { lastInputAtByPty } from '../ipc/pty/delivery/visibility-state'
import { readClientTerminalInputAt } from '../terminal-client-input-clock'
import type { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import { RpcDispatcher } from '../runtime/rpc/dispatcher'

/** Starts session rotation and usage-window resume for this host's open autonomous goals. */
export function startMainProcessAutonomousGoals(runtime: DolphinRuntimeService): () => void {
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
  const stopUsageResume = startAutonomousGoalUsageResume({
    listGoals: () => store.list(),
    subscribe: (listener) => store.subscribe(listener),
    markActive: (goalId) => store.update(goalId, { status: 'active', usageResumeAt: undefined }),
    resolveTerminalHandle,
    sendPrompt
  })
  const stopRotation = startAutonomousGoalRotation({
    subscribeEnrichedStatus: (listener) => agentHookServer.subscribeEnrichedStatus(listener),
    subscribePaneStatusClear: (listener) => agentHookServer.subscribePaneStatusClear(listener),
    findOpenGoalByPane: (paneKey) => store.findOpenByPane(paneKey),
    readContext: readCoordinatorContext,
    resolveTerminalHandle,
    readLastInputAt: (terminal) => {
      const ptyId = runtime.resolveLiveLeafForHandle(terminal)?.ptyId
      if (!ptyId) {
        return undefined
      }
      const local = lastInputAtByPty.get(ptyId)
      const client = readClientTerminalInputAt(ptyId)
      return local === undefined ? client : client === undefined ? local : Math.max(local, client)
    },
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
  return () => {
    stopRotation()
    stopUsageResume()
  }
}
