import {
  DOLPHIN_DISPATCH_STATUS_PREAMBLE_PREFIX,
  DOLPHIN_DISPATCH_STATUS_TASK_MARKER
} from '../../../shared/dolphin-dispatch-status-prompt'

// A worker's full dispatch brief, held on the host so the terminal only receives one short line.
// Why: on Windows a multi-line paste left Claude's composer holding the brief with every Enter
// ignored, while a single-line paste through the same path submitted; the brief itself (which
// carries the dispatch capability) now reaches the worker as tool output instead.
const MAX_HELD_BRIEFS = 200

export type HeldWorkerBrief = { brief: string; paneKey: string; taskId: string }

export class WorkerBriefStore {
  private readonly briefs = new Map<string, HeldWorkerBrief>()

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
    }
  }

  read(dispatchId: string): HeldWorkerBrief | undefined {
    return this.briefs.get(dispatchId)
  }
}

const stores = new WeakMap<object, WorkerBriefStore>()

/** One store per runtime instance, so tests and multiple runtimes never share briefs. */
export function getWorkerBriefStore(runtime: object): WorkerBriefStore {
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
 */
export function buildWorkerBriefPointer(args: {
  cli: string
  taskId: string
  dispatchId: string
  taskSpec: string
}): string {
  const firstLine = args.taskSpec.split(/\r?\n/).find((line) => line.trim()) ?? ''
  const preview = firstLine
    // oxlint-disable-next-line no-control-regex -- the pointer must stay one line with no C0 control or DEL.
    .replace(/[\x00-\x1f\x7f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const clipped =
    preview.length > POINTER_TASK_PREVIEW_MAX
      ? `${preview.slice(0, POINTER_TASK_PREVIEW_MAX - 1)}…`
      : preview
  return `${DOLPHIN_DISPATCH_STATUS_PREAMBLE_PREFIX} Your task ID is: ${args.taskId} (run \`${args.cli} orchestration worker-brief --dispatch ${args.dispatchId} --json\` and follow the brief it returns) ${DOLPHIN_DISPATCH_STATUS_TASK_MARKER} ${clipped}`.trimEnd()
}
