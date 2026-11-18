import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { Repo } from '../../../../shared/repo-types'
import type { DolphinRuntimeService } from '../../dolphin-runtime'
import { RpcDispatcher } from '../dispatcher'
import { REPO_METHODS } from './repo'

describe('repo.list snapshot reads', () => {
  it('answers unchanged while the repos stay the same, and the legacy reply when no id is sent', async () => {
    let repos: Repo[] = [
      { id: 'repo-1', path: '/r', displayName: 'api', badgeColor: '#fff', addedAt: 1 }
    ]
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: repo.list reads only these runtime members.
    const runtime = {
      getRuntimeId: () => 'test-runtime',
      listRepos: () => repos
    } as unknown as DolphinRuntimeService
    const dispatcher = new RpcDispatcher({ runtime, methods: REPO_METHODS })
    const snapshotIdOf = (reply: unknown) =>
      z.object({ snapshotId: z.string() }).parse(reply).snapshotId
    const result = async (params?: unknown) => {
      const response = await dispatcher.dispatch({
        id: 'req-1',
        authToken: 'tok',
        method: 'repo.list',
        params
      })
      return response.ok ? response.result : null
    }

    const legacy = await result()
    const first = await result({ afterSnapshotId: null })
    const repeat = await result({ afterSnapshotId: snapshotIdOf(first) })
    repos = [{ id: 'repo-1', path: '/r', displayName: 'api-2', badgeColor: '#fff', addedAt: 1 }]
    const changed = await result({ afterSnapshotId: snapshotIdOf(first) })

    expect(legacy).toEqual({ repos: [expect.objectContaining({ displayName: 'api' })] })
    expect(first).toEqual({
      repos: [expect.objectContaining({ displayName: 'api' })],
      snapshotId: snapshotIdOf(first)
    })
    expect(repeat).toEqual({ unchanged: true, snapshotId: snapshotIdOf(first) })
    expect(changed).toMatchObject({ repos: [expect.objectContaining({ displayName: 'api-2' })] })
    expect(snapshotIdOf(changed)).not.toBe(snapshotIdOf(first))
  })
})
