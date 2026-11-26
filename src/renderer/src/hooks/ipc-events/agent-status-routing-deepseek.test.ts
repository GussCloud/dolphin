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

  it('follows the host stamp when the host sends one', () => {
    // A transcript-less OSC row from a current host: the stamp alone carries the identity.
    expect(
      resolveHookPayloadAgentType({ ...claudeRow, displayAgentType: 'deepseek' }, 'Claude Code')
        .agentType
    ).toBe('deepseek')
    // A stamp never re-labels a row whose harness is not Claude Code.
    expect(
      resolveHookPayloadAgentType(
        { ...claudeRow, agentType: 'codex', displayAgentType: 'deepseek' },
        undefined
      ).agentType
    ).toBe('codex')
  })

  it('follows a claude-api stamp, and keeps it for a transcript-less event on that row', () => {
    expect(
      resolveHookPayloadAgentType({ ...claudeRow, displayAgentType: 'claude-api' }, 'Claude Code')
        .agentType
    ).toBe('claude-api')
    expect(
      resolveHookPayloadAgentType(claudeRow, undefined, { existingAgentType: 'claude-api' })
        .agentType
    ).toBe('claude-api')
    // Without the host's account list a transcript path alone never claims the API identity.
    expect(
      resolveHookPayloadAgentType(claudeRow, 'Claude Code', {
        transcriptPath: '/data/claude-accounts/api-1/config/projects/x/s.jsonl',
        existingAgentType: 'claude-api'
      }).agentType
    ).toBe('claude')
  })

  it('still routes OpenClaude by title', () => {
    expect(resolveHookPayloadAgentType(claudeRow, 'OpenClaude').agentType).toBe('openclaude')
  })
})
