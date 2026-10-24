import { describe, expect, it } from 'vitest'
import {
  buildLocalWorktreeCreateArgs,
  buildRuntimeWorktreeCreateParams
} from './worktree-create-payload'

const request = {
  repoId: 'repo-1',
  name: 'goal',
  createdWithAgent: 'claude-agent-teams' as const
}
const attempt = { name: 'goal' }

describe('worktree create payload autonomous goal flag', () => {
  it('carries the flag on both transports only when set', () => {
    const flagged = { ...request, options: { autonomousGoalWorkspace: true } }
    expect(buildLocalWorktreeCreateArgs(flagged, attempt)).toMatchObject({
      autonomousGoalWorkspace: true
    })
    expect(buildRuntimeWorktreeCreateParams(flagged, attempt)).toMatchObject({
      autonomousGoalWorkspace: true
    })
    expect(buildLocalWorktreeCreateArgs(request, attempt)).not.toHaveProperty(
      'autonomousGoalWorkspace'
    )
  })
})
