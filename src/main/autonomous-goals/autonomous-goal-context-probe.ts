// Reads how full a coordinator's context window is from the tail of its own transcript, at turn end
// only: no model call, no polling, and a bounded read however long the session has run.
import { open } from 'node:fs/promises'
import { z } from 'zod'
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

const TokenCount = z.number().finite().nonnegative().catch(0).default(0)

const ClaudeAssistantLine = z.object({
  type: z.literal('assistant'),
  isSidechain: z.boolean().optional(),
  message: z.object({
    usage: z.object({
      input_tokens: TokenCount,
      cache_creation_input_tokens: TokenCount,
      cache_read_input_tokens: TokenCount,
      output_tokens: TokenCount
    })
  })
})

const CodexTokenCountLine = z.object({
  payload: z.object({
    type: z.literal('token_count'),
    info: z.object({
      last_token_usage: z.unknown(),
      model_context_window: TokenCount
    })
  })
})

function parseLine(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

/** The newest main-thread assistant response's input is the live context size. */
export function readClaudeContextFromLines(
  lines: readonly string[]
): CoordinatorContextReading | null {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const entry = ClaudeAssistantLine.safeParse(parseLine(lines[index]))
    if (!entry.success || entry.data.isSidechain === true) {
      continue
    }
    const usage = entry.data.message.usage
    const tokens: AgentSessionTokenUsage = {
      inputTokens: usage.input_tokens,
      cacheCreationInputTokens: usage.cache_creation_input_tokens,
      cacheReadInputTokens: usage.cache_read_input_tokens,
      outputTokens: usage.output_tokens
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
    const entry = CodexTokenCountLine.safeParse(parseLine(lines[index]))
    const last = entry.success ? normalizeRawUsage(entry.data.payload.info.last_token_usage) : null
    if (!entry.success || !last) {
      continue
    }
    const window = entry.data.payload.info.model_context_window
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
