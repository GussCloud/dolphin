import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceCleanupCandidate } from '../../../../shared/workspace-cleanup'
import { refreshUncheckedGitEvidence } from './workspace-cleanup-confirm-git-check'

vi.mock('@/lib/browser-uuid', () => ({ createBrowserUuid: () => 'scan-id' }))

function candidate(id: string, checkedAt: number | null, blockers: string[] = []) {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the fields this module reads are set.
  return {
    worktreeId: id,
    executionHostId: 'local',
    blockers,
    git: { clean: checkedAt ? true : null, upstreamAhead: null, upstreamBehind: null, checkedAt }
  } as unknown as WorkspaceCleanupCandidate
}

describe('refreshUncheckedGitEvidence', () => {
  it('reads git only for rows the broad scan never checked and swaps in the fresh rows', async () => {
    const scan = vi.fn(async () => ({ candidates: [candidate('b', 5, ['dirty-files'])] }))
    const result = await refreshUncheckedGitEvidence(
      [candidate('a', 1), candidate('b', null)],
      scan
    )

    expect(scan).toHaveBeenCalledWith({ worktreeIds: ['b'], scanId: 'scan-id' })
    expect(result.map((row) => [row.worktreeId, row.blockers])).toEqual([
      ['a', []],
      ['b', ['dirty-files']]
    ])
  })

  it('keeps the original rows when the read fails, and skips the read when all are checked', async () => {
    const failing = vi.fn(async () => {
      throw new Error('git timeout')
    })
    const rows = [candidate('b', null)]
    expect(await refreshUncheckedGitEvidence(rows, failing)).toEqual(rows)

    const unused = vi.fn()
    await refreshUncheckedGitEvidence([candidate('a', 1)], unused)
    expect(unused).not.toHaveBeenCalled()
  })
})
