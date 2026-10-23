import { describe, expect, it } from 'vitest'
import { shareCompatibleTitleIdentityGroup } from './agent-title-owner'
import { getAgentResumeArgv, isResumableTuiAgent } from './agent-session-resume'
import {
  isClaudeHookAgentType,
  isClaudeTitleOfDeepSeekPane,
  isDeepSeekClaudeTranscriptPath,
  toHookHostAgentType
} from './deepseek-status-identity'
import { TUI_AGENT_CONFIG } from './tui-agent-config'
import {
  getTuiAgentDefaultSessionInstructions,
  TUI_AGENTS_WITH_SESSION_INSTRUCTIONS
} from './tui-agent-session-instructions'

describe('isDeepSeekClaudeTranscriptPath', () => {
  it('matches transcripts under the DeepSeek config dir on every host shape', () => {
    expect(
      isDeepSeekClaudeTranscriptPath('C:\\Users\\me\\.claude-deepseek\\projects\\x\\s.jsonl')
    ).toBe(true)
    expect(isDeepSeekClaudeTranscriptPath('/home/me/.claude-deepseek/projects/x/s.jsonl')).toBe(
      true
    )
  })

  it('does not match the real Claude dir or look-alike segments', () => {
    expect(isDeepSeekClaudeTranscriptPath('/home/me/.claude/projects/x/s.jsonl')).toBe(false)
    expect(isDeepSeekClaudeTranscriptPath('/home/me/.claude-deepseek-old/projects/s.jsonl')).toBe(
      false
    )
    expect(isDeepSeekClaudeTranscriptPath(undefined)).toBe(false)
  })
})

describe('DeepSeek hook host identity', () => {
  it('maps the re-labelled row back to the type the hook host holds', () => {
    expect(toHookHostAgentType('deepseek')).toBe('claude')
    expect(toHookHostAgentType('claude')).toBe('claude')
    expect(toHookHostAgentType('codex')).toBe('codex')
    expect(isClaudeHookAgentType('deepseek')).toBe(true)
    expect(isClaudeHookAgentType('openclaude')).toBe(false)
  })

  it('treats a Claude title in a DeepSeek pane as the same identity, not pane reuse', () => {
    expect(isClaudeTitleOfDeepSeekPane('claude', 'deepseek-agent-teams')).toBe(true)
    expect(shareCompatibleTitleIdentityGroup('claude', 'deepseek')).toBe(true)
    expect(shareCompatibleTitleIdentityGroup('claude', 'claude-agent-teams')).toBe(false)
    expect(shareCompatibleTitleIdentityGroup('codex', 'deepseek')).toBe(false)
  })
})

describe('DeepSeek agent registration', () => {
  it('launches the Claude Code CLI with the same configs as Claude and Claude Agent Teams', () => {
    expect(TUI_AGENT_CONFIG.deepseek).toEqual(TUI_AGENT_CONFIG.claude)
    expect(TUI_AGENT_CONFIG['deepseek-agent-teams']).toEqual(TUI_AGENT_CONFIG['claude-agent-teams'])
  })

  it('resumes through claude --resume so the DeepSeek launch env applies', () => {
    expect(isResumableTuiAgent('deepseek')).toBe(true)
    expect(getAgentResumeArgv('deepseek', { key: 'session_id', id: 'abc' })).toEqual([
      'claude',
      '--resume',
      'abc'
    ])
  })

  it('gives DeepSeek Agent Teams the Agent Teams session instructions', () => {
    expect(TUI_AGENTS_WITH_SESSION_INSTRUCTIONS).toContain('deepseek-agent-teams')
    expect(getTuiAgentDefaultSessionInstructions('deepseek-agent-teams')).toBe(
      getTuiAgentDefaultSessionInstructions('claude-agent-teams')
    )
  })
})
