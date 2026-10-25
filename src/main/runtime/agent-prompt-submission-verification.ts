export { AGENT_PROMPT_EFFECT_TIMEOUT_MS } from '../../shared/orchestration-timing-budgets'
import { AGENT_PROMPT_EFFECT_TIMEOUT_MS } from '../../shared/orchestration-timing-budgets'
import type { TuiAgent } from '../../shared/tui-agent'

export const AGENT_PROMPT_HOOK_EFFECT_TIMEOUT_MS = AGENT_PROMPT_EFFECT_TIMEOUT_MS
const AGENT_PROMPT_EFFECT_POLL_MS = 50

const HOOK_OBSERVED_TURN_START_AGENTS = new Set<TuiAgent>(['antigravity', 'codex', 'kimi'])

/** The prompt bytes are written before verification, so this only ever means "not observed". */
export const AGENT_PROMPT_STALLED_ERROR = 'agent_prompt_stalled'

export type AgentPromptActivity = Readonly<{
  generation: number
  permissionSequence: number
  workingSequence: number
  /** When the hook's current `working` turn began; reaches the runtime with no window and no
   *  title coverage. Pinned across same-state pings, so a refresh alone cannot move it. */
  explicitWorkingStartedAt: number | null
  /** PTY bytes seen on this pane; delivery evidence when a turn-start edge cannot be observed. */
  outputSequence: number
  status: 'working' | 'permission' | 'idle' | null
}>

export type AgentPromptWaitTextCache = {
  outputSequence?: number
  waitText?: string
}

export type AgentPromptTurnStartEvidence =
  | { kind: 'lifecycle'; workingSequence: number }
  | { kind: 'hook'; workingStartedAt: number }

type AgentPromptVerificationOptions = {
  baseline: AgentPromptActivity
  readActivity: () => AgentPromptActivity
  /** Accept only a turn start reserved for this request. */
  acceptTurnStart?: (evidence: AgentPromptTurnStartEvidence) => boolean
  /** Hook evidence is valid only when the baseline was captured before this request's Enter. */
  allowHookEvidence?: boolean
  /** Existing-turn output proves legacy delivery, but not a durable new-turn receipt. */
  allowOutputEvidence?: boolean
  signal?: AbortSignal
  timeoutMs?: number
}

export function resolveAgentPromptEffectTimeoutMs(agent: TuiAgent | null | undefined): number {
  return agent && HOOK_OBSERVED_TURN_START_AGENTS.has(agent)
    ? AGENT_PROMPT_HOOK_EFFECT_TIMEOUT_MS
    : AGENT_PROMPT_EFFECT_TIMEOUT_MS
}

/** Only these providers expose a turn-start signal Dolphin can settle a prompt receipt against. */
export function isTerminalSendSettlementAgent(
  agent: TuiAgent | null | undefined
): agent is 'antigravity' | 'claude' | 'codex' {
  return agent === 'antigravity' || agent === 'claude' || agent === 'codex'
}

export function isAgentPromptStalledError(error: unknown): boolean {
  if (error instanceof Error && error.message === AGENT_PROMPT_STALLED_ERROR) {
    return true
  }
  // Why: a relayed submission surfaces the same verdict as an RPC error code, not a message.
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === AGENT_PROMPT_STALLED_ERROR
  )
}

export function readAgentPromptWaitText(
  cache: AgentPromptWaitTextCache,
  outputSequence: number,
  readWaitText: () => string
): string {
  if (cache.outputSequence === outputSequence && cache.waitText !== undefined) {
    return cache.waitText
  }
  const waitText = readWaitText()
  cache.outputSequence = outputSequence
  cache.waitText = waitText
  return waitText
}

export async function verifyAgentPromptSubmission(
  options: AgentPromptVerificationOptions
): Promise<void> {
  throwIfAgentPromptAborted(options.signal)
  assertPromptNotBlocked(options.baseline, options.baseline)

  const deadline = Date.now() + (options.timeoutMs ?? AGENT_PROMPT_EFFECT_TIMEOUT_MS)
  while (Date.now() < deadline) {
    const current = options.readActivity()
    assertSamePromptGeneration(options.baseline, current)
    assertPromptNotBlocked(options.baseline, current)
    if (
      agentPromptEffectAccepted(
        options.baseline,
        current,
        options.acceptTurnStart,
        options.allowHookEvidence,
        options.allowOutputEvidence
      )
    ) {
      return
    }
    await waitForAgentPromptPoll(options.signal)
  }

  const current = options.readActivity()
  assertSamePromptGeneration(options.baseline, current)
  assertPromptNotBlocked(options.baseline, current)
  if (
    agentPromptEffectAccepted(
      options.baseline,
      current,
      options.acceptTurnStart,
      options.allowHookEvidence,
      options.allowOutputEvidence
    )
  ) {
    return
  }
  throw new Error(AGENT_PROMPT_STALLED_ERROR)
}

function agentPromptEffectAccepted(
  baseline: AgentPromptActivity,
  current: AgentPromptActivity,
  acceptTurnStart?: (evidence: AgentPromptTurnStartEvidence) => boolean,
  allowHookEvidence = true,
  allowOutputEvidence = true
): boolean {
  if (current.workingSequence > baseline.workingSequence) {
    return (
      acceptTurnStart?.({
        kind: 'lifecycle',
        workingSequence: current.workingSequence
      }) ?? true
    )
  }
  if (allowHookEvidence && observedHookWorkingAfterBaseline(baseline, current)) {
    return (
      acceptTurnStart?.({
        kind: 'hook',
        workingStartedAt: current.explicitWorkingStartedAt!
      }) ?? true
    )
  }
  return allowOutputEvidence && observedDeliveryEvidence(baseline, current)
}

// Why: hook status reaches the runtime directly, so it survives a hidden window and headless serve —
// the synthetic-title route that feeds workingSequence does not (#16095). Only a turn that started
// after the baseline counts, so a same-state ping on the turn already running is not evidence.
function observedHookWorkingAfterBaseline(
  baseline: AgentPromptActivity,
  current: AgentPromptActivity
): boolean {
  return (
    current.explicitWorkingStartedAt !== null &&
    current.explicitWorkingStartedAt > (baseline.explicitWorkingStartedAt ?? 0)
  )
}

// Why: a `→working` edge is unreachable for an agent that is already working, so the honest proof
// that the prompt landed is the pane emitting bytes after Enter. An idle agent still owes a real
// turn start, which keeps a swallowed Enter detectable.
function observedDeliveryEvidence(
  baseline: AgentPromptActivity,
  current: AgentPromptActivity
): boolean {
  return baseline.status === 'working' && current.outputSequence > baseline.outputSequence
}

function assertSamePromptGeneration(
  baseline: AgentPromptActivity,
  current: AgentPromptActivity
): void {
  if (current.generation !== baseline.generation) {
    throw new Error('terminal_handle_stale')
  }
}

function assertPromptNotBlocked(baseline: AgentPromptActivity, current: AgentPromptActivity): void {
  if (current.status === 'permission' || current.permissionSequence > baseline.permissionSequence) {
    throw new Error('agent_prompt_blocked')
  }
}

function throwIfAgentPromptAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error('request_aborted')
  }
}

async function waitForAgentPromptPoll(signal?: AbortSignal): Promise<void> {
  if (!signal) {
    await new Promise((resolve) => setTimeout(resolve, AGENT_PROMPT_EFFECT_POLL_MS))
    return
  }
  await new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new Error('request_aborted'))
    }
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, AGENT_PROMPT_EFFECT_POLL_MS)
    signal.addEventListener('abort', onAbort, { once: true })
    if (signal.aborted) {
      onAbort()
    }
  })
}

/**
 * Verifies a submitted prompt, re-sending Enter once when no turn has started after `retryAfterMs`:
 * a composer drawn before Enter is live drops the first one. `resubmit` returns false to skip the
 * retry (e.g. the user typed meanwhile); the overall deadline stays `timeoutMs`.
 */
export async function verifyAgentPromptSubmissionWithRetry(
  options: AgentPromptVerificationOptions & {
    retryAfterMs: number | undefined
    resubmit: () => boolean
  }
): Promise<void> {
  const totalMs = options.timeoutMs ?? AGENT_PROMPT_EFFECT_TIMEOUT_MS
  if (options.retryAfterMs === undefined || options.retryAfterMs >= totalMs) {
    await verifyAgentPromptSubmission(options)
    return
  }
  const startedAt = Date.now()
  try {
    await verifyAgentPromptSubmission({ ...options, timeoutMs: options.retryAfterMs })
    return
  } catch (error) {
    if (!isAgentPromptStalledError(error) || !options.resubmit()) {
      throw error
    }
  }
  await verifyAgentPromptSubmission({
    ...options,
    timeoutMs: Math.max(0, totalMs - (Date.now() - startedAt))
  })
}

/** Offsets after the first Enter, matching the 3 s per-agent retry and then backing off. */
export const QUEUED_PROMPT_SUBMIT_RETRY_DELAYS_MS = [3_000, 5_000, 10_000] as const

/**
 * Re-sends Enter for a queued prompt whose receipt returned before any turn could start.
 * Why: a Dispatch accepts its receipt at once (observation timeout 0), so the bounded retry in
 * `verifyAgentPromptSubmissionWithRetry` never ran and a dropped first Enter left the brief in the
 * composer until the user pressed Enter. Stops at the first turn start, a permission prompt or a
 * replaced process; `resubmit` refuses after user typing. Resolves whether a turn started.
 */
export async function retryUnstartedQueuedPromptSubmit(options: {
  baseline: AgentPromptActivity
  readActivity: () => AgentPromptActivity
  resubmit: () => boolean
  firstDelayMs: number
  sleep?: (ms: number) => Promise<void>
}): Promise<boolean> {
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const scale = options.firstDelayMs / QUEUED_PROMPT_SUBMIT_RETRY_DELAYS_MS[0]
  for (const delayMs of QUEUED_PROMPT_SUBMIT_RETRY_DELAYS_MS) {
    await sleep(Math.round(delayMs * scale))
    const current = options.readActivity()
    if (
      current.generation !== options.baseline.generation ||
      current.status === 'permission' ||
      current.permissionSequence > options.baseline.permissionSequence
    ) {
      return false
    }
    if (agentPromptEffectAccepted(options.baseline, current, undefined, true, false)) {
      return true
    }
    if (!options.resubmit()) {
      return false
    }
  }
  return false
}
