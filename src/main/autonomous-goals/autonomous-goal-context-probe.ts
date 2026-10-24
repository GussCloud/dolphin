// Reads how full a coordinator's context window is from the tail of its own transcript, at turn end
// only: no model call, no polling, and a bounded read however long the session has run.
import { open } from 'node:fs/promises'
import {
  contextTokensFromUsage,
  type AgentSessionTokenUsage
} from '../../shared/agent-session-context-usage'
import type { AutonomousGoalAgent } from '../../shared/autonomous-goal-types'
import { normalizeRawUsage } from '../codex-usage/codex-usage-token-delta'

const TAIL_BYTES = 512 * 1024

export type CoordinatorContextReading = {
  contextTokens: number
  /** The provider's window when the transcript states it (Codex does; Claude does not). */
  windowTokens?: number
}

async function readTail(path: string): Promise<string> {
  const handle = await open(path, 'r')
  try {
    const { size } = await handle.stat()
    const length = Math.min(size, TAIL_BYTES)
    const buffer = Buffer.alloc(length)
    await handle.read(buffer, 0, length, size - length)
    return buffer.toString('utf8')
  } finally {
    await handle.close()
  }
}

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function numberField(record: object, key: string): number {
  const value = key in record ? Reflect.get(record, key) : undefined
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function objectField(record: unknown, key: string): object | null {
  if (typeof record !== 'object' || record === null || !(key in record)) {
    return null
  }
  const value: unknown = Reflect.get(record, key)
  return typeof value === 'object' && value !== null ? value : null
}

/** The newest main-thread assistant response's input is the live context size. */
export function readClaudeContextFromLines(
  lines: readonly string[]
): CoordinatorContextReading | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const entry = parseLine(lines[index])
    if (
      typeof entry !== 'object' ||
      entry === null ||
      Reflect.get(entry, 'type') !== 'assistant' ||
      Reflect.get(entry, 'isSidechain') === true
    ) {
      continue
    }
    const usage = objectField(objectField(entry, 'message'), 'usage')
    if (!usage) {
      continue
    }
    const tokens: AgentSessionTokenUsage = {
      inputTokens: numberField(usage, 'input_tokens'),
      cacheCreationInputTokens: numberField(usage, 'cache_creation_input_tokens'),
      cacheReadInputTokens: numberField(usage, 'cache_read_input_tokens'),
      outputTokens: numberField(usage, 'output_tokens')
    }
    return { contextTokens: contextTokensFromUsage(tokens) }
  }
  return null
}

/** Codex states the last request's usage and the model window on each `token_count` event. */
export function readCodexContextFromLines(
  lines: readonly string[]
): CoordinatorContextReading | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const payload = objectField(parseLine(lines[index]), 'payload')
    if (!payload || Reflect.get(payload, 'type') !== 'token_count') {
      continue
    }
    const info = objectField(payload, 'info')
    const last = normalizeRawUsage(info ? Reflect.get(info, 'last_token_usage') : null)
    if (!info || !last) {
      continue
    }
    const window = numberField(info, 'model_context_window')
    return {
      contextTokens: last.inputTokens + last.outputTokens,
      ...(window > 0 ? { windowTokens: window } : {})
    }
  }
  return null
}

const CONTEXT_READERS: Record<
  AutonomousGoalAgent,
  (lines: readonly string[]) => CoordinatorContextReading | null
> = {
  claude: readClaudeContextFromLines,
  codex: readCodexContextFromLines
}

export async function readCoordinatorContext(
  agent: AutonomousGoalAgent,
  transcriptPath: string
): Promise<CoordinatorContextReading | null> {
  let tail: string
  try {
    tail = await readTail(transcriptPath)
  } catch {
    return null
  }
  // Why: the first line of a mid-file tail is usually cut; parseLine drops it.
  const lines = tail.split('\n').filter((line) => line.trim().length > 0)
  return CONTEXT_READERS[agent](lines)
}
