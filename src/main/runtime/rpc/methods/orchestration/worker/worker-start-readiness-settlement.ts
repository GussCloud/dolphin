import type { DolphinRuntimeService } from '../../../../dolphin-runtime'
import type { OrchestrationDb } from '../../../../orchestration/db'
import type { RunRow, TaskRow } from '../../../../orchestration/types'
import type { WorkerStartModeReceipt } from '../../orchestration-worker-start-mode'
import {
  buildWorkerDispatchPreamble,
  deliverWorkerDispatchPreamble
} from './deliver-worker-dispatch-preamble'
import { getWorkerBriefStore } from '../../../../orchestration/worker-brief-store'
import type { WorkerStartupBlock } from './worker-brief-launch'
import type { OrchestrationWorkerLaunchReceipt } from './worker-launch-preferences'
import {
  describeUnfetchedWorkerBrief,
  describeUnobservedWorkerTurnStart,
  observeWorkerTurnStart,
  type WorkerTurnStartObservation
} from './worker-start-turn-observation'
import {
  monitorWorkerSetup,
  type createStructuredWorkerSessionForWorktree,
  type WorkerEffect,
  type WorkerSetupReceipt
} from './worker-topology'

/**
 * Delivers the dispatch preamble and settles the worker's start state on the strongest
 * evidence available: `ready` only with a positive turn-start (or a provider that cannot
 * prove one), `start_unknown` when observation is supported and nothing started.
 */
export async function deliverAndSettleWorkerStartReadiness(args: {
  runtime: DolphinRuntimeService
  db: OrchestrationDb
  run: RunRow
  task: TaskRow
  dispatchId: string
  dispatchDepth: number
  structuredSession: Awaited<ReturnType<typeof createStructuredWorkerSessionForWorktree>> | null
  terminalHandle: string
  coordinatorHandle: string
  dispatchCapability: string
  devMode: boolean | undefined
  requestId: string
  agent: string | null
  setupReceipt: WorkerSetupReceipt
  launchReceipt: OrchestrationWorkerLaunchReceipt
  mode: WorkerStartModeReceipt
  timeoutMs: number
  effects: WorkerEffect[]
  terminalRevealWarning: string | undefined
  /** The agent was launched with the `worker-brief` pointer: hold the brief, then await the fetch. */
  briefRidesLaunch?: {
    paneKey: string
    fetchTimeoutMs: number
    /** Resolves when a startup screen or exit holds the agent; the start then fails at once. */
    startupBlocked: Promise<WorkerStartupBlock | null>
    onFetched: () => void
  }
  /** Keeps the caller's failure receipt naming the stage that actually failed. */
  onStage: (stage: 'agent_readiness' | 'setup_wait' | 'dispatch_input' | 'turn_observation') => void
}): Promise<unknown> {
  const { runtime, db, run, task, structuredSession, terminalHandle, effects } = args

  args.onStage('dispatch_input')
  const briefArgs = {
    runtime,
    terminalHandle,
    dispatchId: args.dispatchId,
    dispatchDepth: args.dispatchDepth,
    taskId: task.id,
    taskSpec: task.spec,
    coordinatorHandle: args.coordinatorHandle,
    dispatchCapability: args.dispatchCapability,
    devMode: args.devMode
  }
  let promptDelivery: Awaited<ReturnType<typeof deliverWorkerDispatchPreamble>>
  if (args.briefRidesLaunch) {
    const store = getWorkerBriefStore(runtime)
    store.hold(args.dispatchId, {
      brief: buildWorkerDispatchPreamble(briefArgs),
      paneKey: args.briefRidesLaunch.paneKey,
      taskId: task.id
    })
    promptDelivery = undefined
  } else {
    promptDelivery = await deliverWorkerDispatchPreamble({
      ...briefArgs,
      structuredSession,
      requestId: args.requestId
    })
  }
  effects.push({
    kind: 'dispatch_input',
    role: 'agent',
    id: terminalHandle,
    state: 'accepted'
  })

  args.onStage('turn_observation')
  // The write above was accepted without waiting on provider hooks; now demand the positive
  // evidence the receipt claims is observable. A worker whose turn never starts must not be
  // reported ready — a wedged agent and a working one looked identical before this gate.
  // A structured preamble send is acknowledged by the provider or throws, so it is already
  // positive evidence; a launch-carried pointer is proven by the worker fetching its brief.
  const turnStart: WorkerTurnStartObservation = args.briefRidesLaunch
    ? {
        verdict: await awaitLaunchedBriefFetch(
          runtime,
          args.dispatchId,
          args.briefRidesLaunch,
          args.onStage
        )
      }
    : structuredSession
      ? { verdict: 'observed' }
      : await observeWorkerTurnStart({ runtime, terminalHandle, prompt: promptDelivery })
  const deliveredPrompt = turnStart.prompt ?? promptDelivery
  monitorWorkerSetup({
    runtime,
    db,
    runId: run.id,
    dispatchId: args.dispatchId,
    setupReceipt: args.setupReceipt,
    effects
  })
  // A worker report can settle the dispatch while turn observation is outstanding.
  const currentWorker = db.getWorkerDispatch(args.dispatchId)
  const alreadySettled = currentWorker && currentWorker.state !== 'starting'
  if (turnStart.verdict === 'unobserved' && !alreadySettled) {
    // Honest `unverifiable`: keep the dispatch capability and the terminal — the worker may
    // still recover and report (worker-report settlement reconnects a start_unknown worker) —
    // but never claim ready for a turn nobody observed.
    effects.push({
      kind: 'dispatch_input',
      role: 'agent',
      id: terminalHandle,
      state: 'turn_unobserved'
    })
    const reason = args.briefRidesLaunch
      ? describeUnfetchedWorkerBrief(args.agent)
      : describeUnobservedWorkerTurnStart(args.agent)
    const worker = db.markWorkerStartUnknown(
      args.dispatchId,
      'turn_start_unobserved',
      reason,
      effects
    )
    return {
      runId: run.id,
      taskId: task.id,
      dispatchId: args.dispatchId,
      state: 'outcome_unknown',
      stage: worker.stage,
      turnStart: turnStart.verdict,
      lastError: reason,
      setup: args.setupReceipt,
      launch: args.launchReceipt,
      mode: args.mode,
      timeoutMs: args.timeoutMs,
      effects,
      ...(deliveredPrompt ? { prompt: deliveredPrompt } : {}),
      residualResources: JSON.parse(worker.residual_resources) as unknown[],
      nextCommands: [
        `dolphin orchestration worker-show --dispatch ${args.dispatchId} --json`,
        `dolphin terminal read --terminal ${terminalHandle} --screen`,
        `dolphin orchestration worker-abandon --dispatch ${args.dispatchId} --json`
      ],
      ...(args.terminalRevealWarning ? { warning: args.terminalRevealWarning } : {})
    }
  }
  const worker = alreadySettled
    ? currentWorker
    : db.markWorkerDispatchReady(args.dispatchId, effects)
  // A completed task proves start succeeded; older callers use only 'ready' as start success.
  const reportedOutcome =
    worker.stage === 'settled' && (worker.state === 'succeeded' || worker.state === 'failed')
      ? worker.state
      : undefined
  return {
    runId: run.id,
    taskId: task.id,
    dispatchId: args.dispatchId,
    state: reportedOutcome ? 'ready' : worker.state,
    stage: worker.stage,
    ...(reportedOutcome ? { workerOutcome: reportedOutcome } : {}),
    turnStart: turnStart.verdict,
    setup: args.setupReceipt,
    launch: args.launchReceipt,
    mode: args.mode,
    timeoutMs: args.timeoutMs,
    effects,
    ...(deliveredPrompt ? { prompt: deliveredPrompt } : {}),
    residualResources: [],
    ...(args.terminalRevealWarning ? { warning: args.terminalRevealWarning } : {})
  }
}

/** The fetch proves the launch prompt ran; a startup screen seen first fails the start instead. */
async function awaitLaunchedBriefFetch(
  runtime: DolphinRuntimeService,
  dispatchId: string,
  launch: NonNullable<
    Parameters<typeof deliverAndSettleWorkerStartReadiness>[0]['briefRidesLaunch']
  >,
  onStage: (stage: WorkerStartupBlock['stage']) => void
): Promise<'observed' | 'unobserved'> {
  const fetched = getWorkerBriefStore(runtime).waitForFetch(dispatchId, launch.fetchTimeoutMs)
  const blocked = launch.startupBlocked.then(
    (block) => block ?? new Promise<never>(() => undefined)
  )
  const outcome = await Promise.race([fetched, blocked])
  if (typeof outcome !== 'boolean') {
    onStage(outcome.stage)
    throw outcome.error
  }
  if (outcome) {
    launch.onFetched()
  }
  return outcome ? 'observed' : 'unobserved'
}
