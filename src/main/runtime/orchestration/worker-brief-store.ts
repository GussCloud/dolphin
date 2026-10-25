import type { DolphinRuntimeService } from '../dolphin-runtime'
import {
  DOLPHIN_DISPATCH_STATUS_PREAMBLE_PREFIX,
  DOLPHIN_DISPATCH_STATUS_TASK_MARKER,
  DOLPHIN_WORKER_BRIEF_LEAD_LINE
} from '../../../shared/dolphin-dispatch-status-prompt'

// A worker's full dispatch brief, held on the host so the terminal only receives one short line.
// Why: on Windows a multi-line paste left Claude's composer holding the brief with every Enter
// ignored, while a single-line paste through the same path submitted; the brief itself (which
// carries the dispatch capability) now reaches the worker as tool output instead.
const MAX_HELD_BRIEFS = 200

export type HeldWorkerBrief = { brief: string; paneKey: string; taskId: string }

export class WorkerBriefStore {
  private readonly briefs = new Map<string, HeldWorkerBrief>()
  private readonly holdWaiters = new Map<string, Set<(brief: HeldWorkerBrief) => void>>()
  private readonly fetchWaiters = new Map<string, Set<() => void>>()
  private readonly fetched = new Set<string>()

  hold(dispatchId: string, entry: HeldWorkerBrief): void {
    this.briefs.delete(dispatchId)
    this.briefs.set(dispatchId, entry)
    // Why: re-reads after compaction stay possible; the cap only bounds a long-lived host.
    while (this.briefs.size > MAX_HELD_BRIEFS) {
      const oldest = this.briefs.keys().next().value
      if (oldest === undefined) {
        break
      }
      this.briefs.delete(oldest)
      this.fetched.delete(oldest)
    }
    for (const resolve of this.holdWaiters.get(dispatchId) ?? []) {
      resolve(entry)
    }
    this.holdWaiters.delete(dispatchId)
  }

  read(dispatchId: string): HeldWorkerBrief | undefined {
    return this.briefs.get(dispatchId)
  }

  /** A worker launched with the pointer can ask before its start has minted the brief. */
  async waitForHold(dispatchId: string, timeoutMs: number): Promise<HeldWorkerBrief | undefined> {
    const held = this.briefs.get(dispatchId)
    if (held || timeoutMs <= 0) {
      return held
    }
    return await new Promise((resolve) => {
      const waiters = this.holdWaiters.get(dispatchId) ?? new Set()
      const done = (brief: HeldWorkerBrief | undefined): void => {
        clearTimeout(timer)
        waiters.delete(done)
        resolve(brief)
      }
      const timer = setTimeout(() => done(undefined), timeoutMs)
      waiters.add(done)
      this.holdWaiters.set(dispatchId, waiters)
    })
  }

  markFetched(dispatchId: string): void {
    this.fetched.add(dispatchId)
    for (const resolve of this.fetchWaiters.get(dispatchId) ?? []) {
      resolve()
    }
    this.fetchWaiters.delete(dispatchId)
  }

  /** Resolves true once the worker read its brief: the proof a launch-carried pointer ran. */
  async waitForFetch(dispatchId: string, timeoutMs: number): Promise<boolean> {
    if (this.fetched.has(dispatchId)) {
      return true
    }
    if (timeoutMs <= 0) {
      return false
    }
    return await new Promise((resolve) => {
      const waiters = this.fetchWaiters.get(dispatchId) ?? new Set()
      const done = (fetched: boolean): void => {
        clearTimeout(timer)
        waiters.delete(onFetch)
        resolve(fetched)
      }
      const onFetch = (): void => done(true)
      const timer = setTimeout(() => done(false), timeoutMs)
      waiters.add(onFetch)
      this.fetchWaiters.set(dispatchId, waiters)
    })
  }
}

const stores = new WeakMap<DolphinRuntimeService, WorkerBriefStore>()

/** One store per runtime instance, so tests and multiple runtimes never share briefs. */
export function getWorkerBriefStore(runtime: DolphinRuntimeService): WorkerBriefStore {
  let store = stores.get(runtime)
  if (!store) {
    store = new WorkerBriefStore()
    stores.set(runtime, store)
  }
  return store
}

const POINTER_TASK_PREVIEW_MAX = 120

/**
 * One line in the compact form status readers already parse
 * (`<prefix> Your task ID is: <id> ... === TASK === <preview>`), so the sidebar label survives.
 * Why no shell metacharacters: the line rides a launch command, and cmd.exe keeps the `^` its
 * quoting adds inside double quotes; the preview is only a label, the brief carries the task.
 */
export function buildWorkerBriefPointer(args: {
  cli: string
  taskId: string
  dispatchId: string
  taskSpec: string
}): string {
  const firstLine = args.taskSpec.split(/\r?\n/).find((line) => line.trim()) ?? ''
  const preview = firstLine
    .replace(/[^\p{L}\p{N} .,:;_/+-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const clipped =
    preview.length > POINTER_TASK_PREVIEW_MAX
      ? `${preview.slice(0, POINTER_TASK_PREVIEW_MAX - 1).trimEnd()}...`
      : preview
  return `${DOLPHIN_DISPATCH_STATUS_PREAMBLE_PREFIX} Your task ID is: ${args.taskId} - run \`${args.cli} orchestration worker-brief --dispatch ${args.dispatchId} --json\` and follow the brief it returns. ${DOLPHIN_DISPATCH_STATUS_TASK_MARKER} ${clipped}`.trimEnd()
}

/** The worker's first message when it rides the agent's launch command, like the coordinator's. */
export function buildWorkerBriefLaunchPrompt(args: Parameters<typeof buildWorkerBriefPointer>[0]) {
  return `${DOLPHIN_WORKER_BRIEF_LEAD_LINE} ${buildWorkerBriefPointer(args)}`
}
