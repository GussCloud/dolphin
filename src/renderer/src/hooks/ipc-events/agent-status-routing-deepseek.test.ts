import { describe, expect, it } from 'vitest'
import type { ParsedAgentStatusPayload } from '../../../../shared/agent-status-types'
import { resolveHookPayloadAgentType } from './agent-status-routing'

const claudeRow: ParsedAgentStatusPayload = { state: 'working', prompt: 'p', agentType: 'claude' }

describe('resolveHookPayloadAgentType for DeepSeek panes', () => {
  it('re-labels a Claude hook whose transcript lives in the DeepSeek config dir', () => {
    const resolved = resolveHookPayloadAgentType(claudeRow, 'Claude Code', {
      transcriptPath: '/home/me/.claude-deepseek/projects/x/s.jsonl'
    })
    expect(resolved.agentType).toBe('deepseek')
  })

  it('keeps a real Claude session as Claude even in a pane that was DeepSeek', () => {
    const resolved = resolveHookPayloadAgentType(claudeRow, 'Claude Code', {
      transcriptPath: '/home/me/.claude/projects/x/s.jsonl',
      existingAgentType: 'deepseek'
    })
    expect(resolved.agentType).toBe('claude')
  })

  it('keeps the DeepSeek label for a transcript-less event on a DeepSeek row', () => {
    expect(
      resolveHookPayloadAgentType(claudeRow, undefined, { existingAgentType: 'deepseek' }).agentType
    ).toBe('deepseek')
    expect(resolveHookPayloadAgentType(claudeRow, undefined).agentType).toBe('claude')
  })

  it('still routes OpenClaude by title', () => {
    expect(resolveHookPayloadAgentType(claudeRow, 'OpenClaude').agentType).toBe('openclaude')
  })
})
