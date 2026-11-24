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

describe('worktree create payload pinned agent account', () => {
  it('carries the pinned account on both transports and omits it when unset', () => {
    const pinned = { ...request, options: { agentAccountId: 'acct-pinned' } }
    expect(buildLocalWorktreeCreateArgs(pinned, attempt)).toMatchObject({
      agentAccountId: 'acct-pinned'
    })
    expect(buildRuntimeWorktreeCreateParams(pinned, attempt)).toMatchObject({
      agentAccountId: 'acct-pinned'
    })
    expect(buildRuntimeWorktreeCreateParams(request, attempt)).not.toHaveProperty('agentAccountId')
  })

  it('carries the permission policy on both transports and omits it when unset', () => {
    const policy = { mode: 'catalog' as const, categories: ['variable-target' as const] }
    const withPolicy = { ...request, options: { agentPermissionPolicy: policy } }
    expect(buildLocalWorktreeCreateArgs(withPolicy, attempt)).toMatchObject({
      agentPermissionPolicy: policy
    })
    expect(buildRuntimeWorktreeCreateParams(withPolicy, attempt)).toMatchObject({
      agentPermissionPolicy: policy
    })
    expect(buildLocalWorktreeCreateArgs(request, attempt)).not.toHaveProperty(
      'agentPermissionPolicy'
    )
  })
})
