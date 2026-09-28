import { describe, expect, it } from 'vitest'
import { resolveMultiProjectWorktreeRepoIds } from './multi-project-worktree-selection'

describe('resolveMultiProjectWorktreeRepoIds', () => {
  it('returns null when disabled or nothing is eligible', () => {
    expect(resolveMultiProjectWorktreeRepoIds({ enabled: false, repoIds: null }, ['a'])).toBeNull()
    expect(resolveMultiProjectWorktreeRepoIds({ enabled: true, repoIds: null }, [])).toBeNull()
  })

  it('treats a null pick as every eligible project', () => {
    expect(
      resolveMultiProjectWorktreeRepoIds({ enabled: true, repoIds: null }, ['a', 'b'])
    ).toEqual(['a', 'b'])
  })

  it('keeps only picks that are still eligible, falling back to all when none are', () => {
    expect(
      resolveMultiProjectWorktreeRepoIds({ enabled: true, repoIds: ['b', 'gone'] }, ['a', 'b'])
    ).toEqual(['b'])
    expect(
      resolveMultiProjectWorktreeRepoIds({ enabled: true, repoIds: ['gone'] }, ['a', 'b'])
    ).toEqual(['a', 'b'])
  })
})
