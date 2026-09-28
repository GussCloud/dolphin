import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import {
  createCompatibleRuntimeStatusResponseIfNeeded,
  type RuntimeEnvironmentCallRequest
} from '../../runtime/runtime-compatibility-test-fixture'
import { clearRuntimeCompatibilityCacheForTests } from '../../runtime/runtime-rpc-client'
import { createTestStore } from './store-test-helpers'

const runtimeEnvironmentCall = vi.fn()
const runtimeEnvironmentTransportCall = vi.fn()

beforeEach(() => {
  clearRuntimeCompatibilityCacheForTests()
  runtimeEnvironmentCall.mockReset()
  runtimeEnvironmentTransportCall.mockReset()
  runtimeEnvironmentTransportCall.mockImplementation((args: RuntimeEnvironmentCallRequest) => {
    return createCompatibleRuntimeStatusResponseIfNeeded(args) ?? runtimeEnvironmentCall(args)
  })
  vi.stubGlobal('window', {
    api: {
      runtimeEnvironments: { call: runtimeEnvironmentTransportCall }
    }
  })
})

describe('repo slice runtime project groups', () => {
  it('keeps runtime copies of a grouped canonical project in the same project group', async () => {
    const gitRemoteIdentity = {
      canonicalKey: 'github.com/gusscloud/dolphin',
      remoteName: 'origin',
      remoteUrl: 'https://github.com/gusscloud/dolphin.git'
    }
    const localDolphin: Repo = {
      id: 'local-dolphin',
      path: '/Users/alice/gusscloud/dolphin',
      displayName: 'dolphin',
      badgeColor: '#000',
      addedAt: 1,
      executionHostId: 'local',
      gitRemoteIdentity,
      projectGroupId: 'group-dolphin'
    }
    const runtimeDolphin: Repo = {
      id: 'runtime-dolphin',
      path: '/vercel/sandbox/dolphin',
      displayName: 'dolphin',
      badgeColor: '#111',
      addedAt: 2,
      gitRemoteIdentity
    }
    runtimeEnvironmentCall.mockResolvedValue({
      id: 'rpc-runtime-dolphin',
      ok: true,
      result: { repos: [runtimeDolphin] },
      _meta: { runtimeId: 'runtime-remote' }
    })
    const store = createTestStore()
    store.setState({
      settings: { activeRuntimeEnvironmentId: 'env-1' } as never,
      repos: [localDolphin]
    })

    await store.getState().fetchRepos()

    expect(store.getState().repos).toEqual([
      localDolphin,
      {
        ...runtimeDolphin,
        executionHostId: 'runtime:env-1',
        projectGroupId: 'group-dolphin'
      }
    ])
  })
})
