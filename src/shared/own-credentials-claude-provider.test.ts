import { describe, expect, it } from 'vitest'
import { resolvePaneRelaunchAgent } from './own-credentials-claude-provider'

describe('resolvePaneRelaunchAgent', () => {
  it('keeps the API-key or DeepSeek agent the tab launched when the hook status says claude', () => {
    expect(resolvePaneRelaunchAgent('claude', 'claude-api')).toBe('claude-api')
    expect(resolvePaneRelaunchAgent('claude', 'claude-api-agent-teams')).toBe(
      'claude-api-agent-teams'
    )
    // The renderer re-labels an API-profile row `claude-api`; the tab's teams agent still wins.
    expect(resolvePaneRelaunchAgent('claude-api', 'claude-api-agent-teams')).toBe(
      'claude-api-agent-teams'
    )
    expect(resolvePaneRelaunchAgent('claude', 'deepseek')).toBe('deepseek')
  })

  it('follows the status when another agent took the pane, or when the tab is plain Claude', () => {
    expect(resolvePaneRelaunchAgent('codex', 'claude-api')).toBe('codex')
    expect(resolvePaneRelaunchAgent('claude', 'claude-agent-teams')).toBe('claude')
    expect(resolvePaneRelaunchAgent(null, 'claude-api')).toBe('claude-api')
    expect(resolvePaneRelaunchAgent(null, null)).toBeNull()
  })
})
