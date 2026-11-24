import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as ReactModule from 'react'
import type { Repo } from '../../../../shared/repo-types'
import type { ProjectStartAccounts } from '../project-accounts/project-start-accounts'

type PreflightStub = { azureDevOps?: { authMethod?: 'token' | 'azure-cli' } } | null

const noPreflight = vi.hoisted(() => (): PreflightStub => null)

const mocks = vi.hoisted(() => ({
  stateValues: [] as unknown[],
  stateSetters: [] as ReturnType<typeof vi.fn>[],
  stateIndex: 0,
  refValues: [] as unknown[],
  refIndex: 0,
  storeState: {
    settings: { activeRuntimeEnvironmentId: null as string | null },
    preflightStatus: noPreflight(),
    repos: [] as Repo[],
    projects: [],
    projectHostSetups: []
  },
  cloneRemote: vi.fn(),
  cloneLocal: vi.fn(),
  pickDirectory: vi.fn(),
  onCloneProgress: vi.fn(() => vi.fn()),
  callRuntimeRpc: vi.fn(),
  startCliSignIn: vi.fn(),
  fetchWorktrees: vi.fn(),
  onGitRepoReady: vi.fn()
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactModule>()
  return {
    ...actual,
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => fn,
    useEffect: (effect: () => void | (() => void)) => {
      effect()
    },
    useRef: <T>(value: T) => {
      const index = mocks.refIndex++
      return {
        current: index in mocks.refValues ? (mocks.refValues[index] as T) : value
      }
    },
    useState: <T>(initial: T | (() => T)) => {
      const index = mocks.stateIndex++
      const value =
        index in mocks.stateValues
          ? mocks.stateValues[index]
          : typeof initial === 'function'
            ? (initial as () => T)()
            : initial
      const setter = vi.fn()
      mocks.stateSetters[index] = setter
      return [value as T, setter]
    }
  }
})

vi.mock('@/store', () => {
  const useAppStore = Object.assign(
    (selector: (state: typeof mocks.storeState) => unknown) => selector(mocks.storeState),
    {
      getState: () => mocks.storeState,
      setState: (next: Partial<typeof mocks.storeState>) => {
        Object.assign(mocks.storeState, next)
      }
    }
  )
  return { useAppStore }
})

vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: () => ({ kind: 'local' }),
  callRuntimeRpc: mocks.callRuntimeRpc
}))

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn()
  }
}))

function makeRepo(overrides: Partial<Repo> = {}): Repo {
  return {
    id: 'repo-cloned',
    path: '/srv/dolphin',
    displayName: 'dolphin',
    badgeColor: '#999999',
    addedAt: 1,
    kind: 'git',
    ...overrides
  }
}

describe('useAddRepoCloneFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.stateIndex = 0
    mocks.stateSetters = []
    mocks.refIndex = 0
    mocks.refValues = []
    mocks.stateValues = ['https://github.com/gusscloud/dolphin.git', '/srv', false, null, null]
    mocks.storeState.repos = []
    mocks.storeState.projects = []
    mocks.storeState.projectHostSetups = []
    vi.stubGlobal('window', {
      api: {
        repos: {
          cloneRemote: mocks.cloneRemote,
          clone: mocks.cloneLocal,
          pickDirectory: mocks.pickDirectory,
          onCloneProgress: mocks.onCloneProgress
        },
        azureDevOps: { startCliSignIn: mocks.startCliSignIn }
      }
    })
  })

  it('clones through the selected SSH target', async () => {
    const repo = makeRepo({ connectionId: 'ssh-1' })
    mocks.cloneRemote.mockResolvedValue(repo)
    mocks.callRuntimeRpc.mockReset()
    mocks.fetchWorktrees.mockResolvedValue(true)
    const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')

    const result = useAddRepoCloneFlow({
      step: 'clone',
      activeRuntimeEnvironmentId: null,
      sshTargetId: 'ssh-1',
      workspaceDir: '/local/workspace',
      fetchWorktrees: mocks.fetchWorktrees,
      onGitRepoReady: mocks.onGitRepoReady
    })
    await result.handleClone()

    expect(mocks.cloneRemote).toHaveBeenCalledWith({
      connectionId: 'ssh-1',
      url: 'https://github.com/gusscloud/dolphin.git',
      destination: '/srv'
    })
    expect(mocks.cloneLocal).not.toHaveBeenCalled()
    expect(mocks.fetchWorktrees).toHaveBeenCalledWith(repo.id, {
      requireAuthoritative: true,
      executionHostId: 'ssh:ssh-1'
    })
    expect(mocks.storeState.repos).toContainEqual({
      ...repo,
      executionHostId: 'ssh:ssh-1'
    })
    expect(mocks.storeState.projects).toEqual(
      expect.arrayContaining([expect.objectContaining({ sourceRepoIds: [repo.id] })])
    )
    expect(mocks.storeState.projectHostSetups).toEqual(
      expect.arrayContaining([expect.objectContaining({ repoId: repo.id, path: repo.path })])
    )
    expect(mocks.onGitRepoReady).toHaveBeenCalledWith(repo.id, 'clone_url', 'ssh:ssh-1')
  })

  it("clones on this PC with the accounts panel's picks matched to the URL's provider", async () => {
    const repo = makeRepo()
    mocks.cloneLocal.mockResolvedValue({
      ...repo,
      ghAccount: { host: 'github.com', user: 'ana-corp' },
      claudeAccountId: 'claude-corp',
      codexAccountId: 'codex-corp',
      commitIdentity: { name: 'Ana', email: 'ana@corp.example' }
    })
    mocks.fetchWorktrees.mockResolvedValue(true)
    const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')

    const result = useAddRepoCloneFlow({
      step: 'clone',
      activeRuntimeEnvironmentId: null,
      sshTargetId: null,
      workspaceDir: '/local/workspace',
      fetchWorktrees: mocks.fetchWorktrees,
      onGitRepoReady: mocks.onGitRepoReady,
      startAccounts: {
        ghAccount: { host: 'github.com', user: 'ana-corp' },
        azureDevOpsAccountId: 'ado-corp',
        claudeAccountId: 'claude-corp',
        codexAccountId: 'codex-corp',
        commitIdentity: { name: 'Ana', email: 'ana@corp.example' }
      }
    })
    await result.handleClone()

    // Why no Azure account: the URL is a GitHub remote, which that account never authenticates.
    expect(mocks.cloneLocal).toHaveBeenCalledWith({
      url: 'https://github.com/gusscloud/dolphin.git',
      destination: '/srv',
      accountBinding: {
        ghAccount: { host: 'github.com', user: 'ana-corp' },
        claudeAccountId: 'claude-corp',
        codexAccountId: 'codex-corp',
        commitIdentity: { name: 'Ana', email: 'ana@corp.example' }
      }
    })
  })

  it('does not prefill SSH clone destinations from the local workspace directory', async () => {
    mocks.stateValues = ['https://github.com/gusscloud/dolphin.git', '', false, null, null]
    const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')

    const result = useAddRepoCloneFlow({
      step: 'clone',
      activeRuntimeEnvironmentId: null,
      sshTargetId: 'ssh-1',
      workspaceDir: '/private/tmp/dolphin-setup-e2e.hOWO1f',
      fetchWorktrees: mocks.fetchWorktrees,
      onGitRepoReady: mocks.onGitRepoReady
    })

    expect(result.cloneDestination).toBe('')
    expect(mocks.stateSetters[1]).not.toHaveBeenCalledWith('/private/tmp/dolphin-setup-e2e.hOWO1f')
  })

  it('strips Electron IPC wrappers from clone errors', async () => {
    const cloneError =
      'Clone failed: Destination already exists and is not empty: /srv/dolphin. Choose a different parent folder, delete the existing folder, or add the existing repository instead.'
    mocks.cloneRemote.mockRejectedValue(
      new Error(`Error invoking remote method 'repos:cloneRemote': Error: ${cloneError}`)
    )
    const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')

    const result = useAddRepoCloneFlow({
      step: 'clone',
      activeRuntimeEnvironmentId: null,
      sshTargetId: 'ssh-1',
      workspaceDir: '/local/workspace',
      fetchWorktrees: mocks.fetchWorktrees,
      onGitRepoReady: mocks.onGitRepoReady
    })
    await result.handleClone()

    expect(mocks.stateSetters[3]).toHaveBeenCalledWith(cloneError)
  })

  it('clones through the selected runtime environment', async () => {
    const repo = makeRepo({ id: 'runtime-repo' })
    const localRepo = makeRepo({
      id: repo.id,
      path: '/local/runtime-repo',
      executionHostId: 'local'
    })
    mocks.storeState.repos = [localRepo]
    mocks.callRuntimeRpc.mockResolvedValue({ repo })
    mocks.fetchWorktrees.mockResolvedValue(true)
    const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')

    const result = useAddRepoCloneFlow({
      step: 'clone',
      activeRuntimeEnvironmentId: 'env-1',
      sshTargetId: null,
      workspaceDir: '/local/workspace',
      fetchWorktrees: mocks.fetchWorktrees,
      onGitRepoReady: mocks.onGitRepoReady
    })
    await result.handleClone()

    expect(mocks.callRuntimeRpc).toHaveBeenCalledWith(
      { kind: 'environment', environmentId: 'env-1' },
      'repo.clone',
      {
        url: 'https://github.com/gusscloud/dolphin.git',
        destination: '/srv'
      },
      { timeoutMs: 10 * 60_000 }
    )
    expect(mocks.cloneLocal).not.toHaveBeenCalled()
    expect(mocks.cloneRemote).not.toHaveBeenCalled()
    expect(mocks.fetchWorktrees).toHaveBeenCalledWith(repo.id, {
      requireAuthoritative: true,
      executionHostId: 'runtime:env-1'
    })
    expect(mocks.storeState.repos).toContainEqual({
      ...repo,
      executionHostId: 'runtime:env-1'
    })
    expect(mocks.storeState.repos).toContainEqual(localRepo)
    expect(mocks.onGitRepoReady).toHaveBeenCalledWith(repo.id, 'clone_url', 'runtime:env-1')
  })

  describe('Azure DevOps sign-in after a failed clone', () => {
    const AZURE_URL = 'https://evup@dev.azure.com/evup/P/_git/app'
    const SIGN_IN_ERROR =
      'Clone failed: Azure DevOps did not accept the sign-in for this clone. Sign in to Azure DevOps and try again. Git reported: fatal: unable to get password from user'
    // Index of the sign-in error in the hook's useState order.
    const SIGN_IN_ERROR_STATE = 6

    beforeEach(() => {
      mocks.storeState.preflightStatus = { azureDevOps: { authMethod: 'azure-cli' } }
    })

    function failedCloneProps(host: {
      activeRuntimeEnvironmentId?: string | null
      sshTargetId?: string | null
      url?: string
      startAccounts?: ProjectStartAccounts
    }) {
      // Why reset: each call is a fresh render of the mocked hooks.
      mocks.stateIndex = 0
      mocks.refIndex = 0
      mocks.stateValues = [host.url ?? AZURE_URL, '/srv', false, SIGN_IN_ERROR, null]
      return {
        step: 'clone' as const,
        activeRuntimeEnvironmentId: host.activeRuntimeEnvironmentId ?? null,
        sshTargetId: host.sshTargetId ?? null,
        workspaceDir: '/local/workspace',
        fetchWorktrees: mocks.fetchWorktrees,
        onGitRepoReady: mocks.onGitRepoReady,
        ...(host.startAccounts ? { startAccounts: host.startAccounts } : {})
      }
    }

    it('retries the clone once after a device-code sign-in succeeds', async () => {
      mocks.startCliSignIn.mockResolvedValue({ ok: true })
      mocks.cloneLocal.mockResolvedValue(makeRepo())
      mocks.fetchWorktrees.mockResolvedValue(true)
      const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')
      const result = useAddRepoCloneFlow(failedCloneProps({}))

      expect(result.azureSignIn.available).toBe(true)
      await result.azureSignIn.signIn()

      expect(mocks.startCliSignIn).toHaveBeenCalledWith('device-code')
      expect(mocks.cloneLocal).toHaveBeenCalledTimes(1)
      expect(mocks.cloneLocal).toHaveBeenCalledWith({ url: AZURE_URL, destination: '/srv' })
    })

    it('does not retry or report an error when the sign-in is cancelled', async () => {
      mocks.startCliSignIn.mockResolvedValue({ ok: false, error: 'cancelled' })
      const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')
      const result = useAddRepoCloneFlow(failedCloneProps({}))
      await result.azureSignIn.signIn()

      expect(mocks.cloneLocal).not.toHaveBeenCalled()
      expect(mocks.stateSetters[SIGN_IN_ERROR_STATE]).not.toHaveBeenCalledWith('cancelled')
    })

    it('shows a failed sign-in without retrying the clone', async () => {
      mocks.startCliSignIn.mockResolvedValue({ ok: false, error: 'az is not installed' })
      const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')
      const result = useAddRepoCloneFlow(failedCloneProps({}))
      await result.azureSignIn.signIn()

      expect(mocks.cloneLocal).not.toHaveBeenCalled()
      expect(mocks.stateSetters[SIGN_IN_ERROR_STATE]).toHaveBeenCalledWith('az is not installed')
    })

    it('offers no sign-in for SSH, runtime or non-Azure clones', async () => {
      const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')
      expect(useAddRepoCloneFlow(failedCloneProps({})).azureSignIn.available).toBe(true)
      expect(
        useAddRepoCloneFlow(failedCloneProps({ sshTargetId: 'ssh-1' })).azureSignIn.available
      ).toBe(false)
      expect(
        useAddRepoCloneFlow(failedCloneProps({ activeRuntimeEnvironmentId: 'env-1' })).azureSignIn
          .available
      ).toBe(false)
      expect(
        useAddRepoCloneFlow(failedCloneProps({ url: 'https://github.com/acme/app.git' }))
          .azureSignIn.available
      ).toBe(false)
    })

    it('offers no sign-in unless Azure DevOps uses the Azure CLI and no managed account is chosen', async () => {
      const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')
      mocks.storeState.preflightStatus = { azureDevOps: { authMethod: 'token' } }
      expect(useAddRepoCloneFlow(failedCloneProps({})).azureSignIn.available).toBe(false)
      mocks.storeState.preflightStatus = null
      expect(useAddRepoCloneFlow(failedCloneProps({})).azureSignIn.available).toBe(false)

      mocks.storeState.preflightStatus = { azureDevOps: { authMethod: 'azure-cli' } }
      expect(
        useAddRepoCloneFlow(
          failedCloneProps({
            startAccounts: {
              ghAccount: null,
              azureDevOpsAccountId: 'ado-corp',
              claudeAccountId: null,
              codexAccountId: null,
              commitIdentity: null
            }
          })
        ).azureSignIn.available
      ).toBe(false)
    })

    it('clears a pending sign-in and its error when the dialog resets', async () => {
      const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')
      const result = useAddRepoCloneFlow(failedCloneProps({}))
      result.resetCloneFlow()
      expect(mocks.stateSetters[5]).toHaveBeenCalledWith(false)
      expect(mocks.stateSetters[SIGN_IN_ERROR_STATE]).toHaveBeenCalledWith(null)
    })

    it('offers no sign-in for a 403, which a new sign-in cannot fix', async () => {
      const { useAddRepoCloneFlow } = await import('./useAddRepoCloneFlow')
      const props = failedCloneProps({})
      mocks.stateValues[3] =
        "Clone failed: Azure DevOps did not accept the sign-in for this clone. Sign in to Azure DevOps and try again. Git reported: fatal: unable to access 'https://dev.azure.com/evup/P/_git/app/': The requested URL returned error: 403"
      expect(useAddRepoCloneFlow(props).azureSignIn.available).toBe(false)
    })
  })
})
