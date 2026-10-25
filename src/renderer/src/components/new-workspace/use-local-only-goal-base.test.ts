import { describe, expect, it } from 'vitest'
import { isLocalOnlyBaseRef } from './use-local-only-goal-base'

const local = (name: string) => ({ refName: name, localBranchName: name })
const remote = (remoteName: string, name: string) => ({
  refName: `${remoteName}/${name}`,
  localBranchName: name
})

describe('isLocalOnlyBaseRef', () => {
  it('flags a local branch with no remote ref of the same name', () => {
    expect(isLocalOnlyBaseRef('feature/x', [local('feature/x'), remote('origin', 'main')])).toBe(
      true
    )
  })

  it('accepts a local branch that also exists on any remote', () => {
    expect(
      isLocalOnlyBaseRef('feature/x', [local('feature/x'), remote('upstream', 'feature/x')])
    ).toBe(false)
  })

  it('accepts a remote ref picked directly', () => {
    expect(isLocalOnlyBaseRef('origin/main', [remote('origin', 'main'), local('main')])).toBe(false)
  })

  it('never warns when the base was not found', () => {
    expect(isLocalOnlyBaseRef('feature/x', [local('feature/xy')])).toBe(false)
  })
})
