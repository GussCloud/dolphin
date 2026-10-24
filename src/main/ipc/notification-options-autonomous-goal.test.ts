import { describe, expect, it } from 'vitest'
import { buildNotificationOptions } from './notification-options'

describe('autonomous goal notifications', () => {
  it('names the worktree and the event, and carries the goal detail', () => {
    expect(
      buildNotificationOptions({
        source: 'autonomous-goal',
        goalEvent: 'blocked',
        goalDetail: 'Pick a database',
        worktreeLabel: 'docs-site'
      })
    ).toEqual({ title: 'docs-site - Goal needs your decision', body: 'Pick a database' })
  })

  it('explains a usage pause when the goal gives no detail', () => {
    expect(
      buildNotificationOptions({ source: 'autonomous-goal', goalEvent: 'usageLimited' }).body
    ).toMatch(/usage window resets/)
  })
})
