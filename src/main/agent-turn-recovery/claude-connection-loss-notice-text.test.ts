import { describe, expect, it } from 'vitest'
import { buildNotificationOptions } from '../ipc/notification-options'
import { claudeConnectionLossExhaustedTelegramText } from './claude-connection-loss-notice-text'

describe('auto-retry exhausted notice text', () => {
  it('counts the retries that were typed', () => {
    const text = claudeConnectionLossExhaustedTelegramText('feature-x', 3)
    expect(text).toContain('3 automatic retries')
    expect(text).toContain('(feature-x)')
  })

  it('does not claim retries ran when none could be typed', () => {
    const text = claudeConnectionLossExhaustedTelegramText(null, 0)
    expect(text).not.toMatch(/\d+ automatic retries/)
    expect(text).toContain('could not retry automatically')
  })

  it('desktop body follows the same split', () => {
    const request = {
      source: 'agent-auto-retry-exhausted' as const,
      worktreeLabel: 'feature-x',
      agentType: 'claude' as const,
      agentState: 'done' as const
    }
    expect(buildNotificationOptions({ ...request, autoRetryAttempts: 0 }).body).toContain(
      'could not retry automatically'
    )
    expect(buildNotificationOptions({ ...request, autoRetryAttempts: 2 }).body).toContain(
      'Automatic retries did not recover'
    )
  })
})
