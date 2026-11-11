// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Repo } from '../../../../shared/repo-types'
import { useAddRepoAccountStep } from './use-add-repo-account-step'
import {
  EMPTY_PROJECT_START_ACCOUNTS,
  type ProjectStartAccounts
} from '../project-accounts/project-start-accounts'

const { storeState, planMock } = vi.hoisted(() => {
  const repos: Repo[] = []
  return { storeState: { repos, updateRepo: vi.fn() }, planMock: vi.fn() }
})

vi.mock('@/store', () => ({ useAppStore: { getState: () => storeState } }))
vi.mock('@/runtime/runtime-rpc-client', () => ({
  getActiveRuntimeTarget: () => ({ kind: 'local' })
}))
vi.mock('../project-accounts/added-repo-account-plan', () => ({
  planAddedRepoAccountStep: planMock
}))
vi.mock('sonner', () => ({ toast: { warning: vi.fn() } }))

const REPO: Repo = {
  id: 'repo-1',
  path: '/projects/app',
  displayName: 'app',
  badgeColor: '#000000',
  addedAt: 0
}
const PLAN = {
  target: { provider: 'github', host: 'github.com' },
  inventory: null,
  azureAccounts: [],
  error: null
}

let container: HTMLDivElement
let root: Root
let hook: ReturnType<typeof useAddRepoAccountStep>
const setStep = vi.fn()
const onGitRepoReady = vi.fn(async () => {})
let startAccounts: ProjectStartAccounts = EMPTY_PROJECT_START_ACCOUNTS

function Harness(): null {
  hook = useAddRepoAccountStep(null, setStep, onGitRepoReady, {
    getStartAccounts: () => startAccounts
  })
  return null
}

beforeEach(async () => {
  container = document.createElement('div')
  root = createRoot(container)
  storeState.repos = [REPO]
  storeState.updateRepo
    .mockReset()
    .mockImplementation(async (_id: string, update: Partial<Repo>) => {
      storeState.repos = [{ ...REPO, ...update }]
      return true
    })
  planMock.mockReset()
  startAccounts = EMPTY_PROJECT_START_ACCOUNTS
  setStep.mockReset()
  onGitRepoReady.mockClear()
  await act(async () => root.render(<Harness />))
})

afterEach(() => {
  act(() => root.unmount())
})

describe('useAddRepoAccountStep', () => {
  it('finishes the add exactly as before when there is nothing to choose', async () => {
    planMock.mockResolvedValueOnce(null)
    await act(async () => hook.offer('repo-1', 'local_folder_picker'))
    expect(onGitRepoReady).toHaveBeenCalledWith('repo-1', 'local_folder_picker', undefined)
    expect(setStep).not.toHaveBeenCalled()
  })

  it('pauses on the account step, then saves the choice before finishing', async () => {
    planMock.mockResolvedValueOnce(PLAN)
    await act(async () => hook.offer('repo-1', 'local_folder_picker'))
    expect(setStep).toHaveBeenCalledWith('account')
    expect(onGitRepoReady).not.toHaveBeenCalled()

    await act(async () => {
      hook.state!.draft.setSelection({
        provider: 'github',
        ghAccount: { host: 'github.com', user: 'work-login' }
      })
      hook.state!.draft.setIdentity({ name: 'Dev', email: 'dev@example.test' })
    })
    await act(async () => hook.state!.onContinue())
    expect(storeState.updateRepo).toHaveBeenCalledWith(
      'repo-1',
      {
        ghAccount: { host: 'github.com', user: 'work-login' },
        commitIdentity: { name: 'Dev', email: 'dev@example.test' }
      },
      { hostId: 'local' }
    )
    expect(onGitRepoReady).toHaveBeenCalledTimes(1)
  })

  it('saves the first-screen accounts without asking again, matched to the remote', async () => {
    storeState.repos = [
      {
        ...REPO,
        gitRemoteIdentity: {
          canonicalKey: 'github.com/corp/app',
          remoteName: 'origin',
          remoteUrl: 'https://github.com/corp/app.git'
        }
      }
    ]
    startAccounts = {
      ghAccount: { host: 'github.com', user: 'ana-corp' },
      azureDevOpsAccountId: 'ado-corp',
      agentAccountId: 'claude-corp',
      suggestedIdentity: { name: 'Ana', email: 'ana@corp.example' }
    }
    await act(async () => hook.offer('repo-1', 'local_folder_picker'))
    expect(planMock).not.toHaveBeenCalled()
    expect(setStep).not.toHaveBeenCalled()
    expect(storeState.updateRepo).toHaveBeenCalledWith(
      'repo-1',
      {
        ghAccount: { host: 'github.com', user: 'ana-corp' },
        agentAccountId: 'claude-corp',
        commitIdentity: { name: 'Ana', email: 'ana@corp.example' }
      },
      { hostId: 'local' }
    )
    expect(onGitRepoReady).toHaveBeenCalledTimes(1)
  })

  it('never rebinds a project that already had accounts', async () => {
    storeState.repos = [{ ...REPO, agentAccountId: 'claude-old' }]
    startAccounts = { ...EMPTY_PROJECT_START_ACCOUNTS, agentAccountId: 'claude-corp' }
    planMock.mockResolvedValueOnce(null)
    await act(async () => hook.offer('repo-1', 'local_folder_picker'))
    expect(storeState.updateRepo).not.toHaveBeenCalled()
  })

  it('"Use defaults" finishes without saving anything', async () => {
    planMock.mockResolvedValueOnce(PLAN)
    await act(async () => hook.offer('repo-1', 'local_folder_picker'))
    await act(async () => hook.state!.onSkip())
    expect(storeState.updateRepo).not.toHaveBeenCalled()
    expect(onGitRepoReady).toHaveBeenCalledTimes(1)
  })

  it('closing the dialog on the step finishes like "Use defaults"', async () => {
    planMock.mockResolvedValueOnce(PLAN)
    await act(async () => hook.offer('repo-1', 'local_folder_picker'))
    await act(async () => hook.reset())
    expect(storeState.updateRepo).not.toHaveBeenCalled()
    expect(onGitRepoReady).toHaveBeenCalledWith('repo-1', 'local_folder_picker', undefined)
  })

  it('finishes only once when the dialog closes after Continue', async () => {
    planMock.mockResolvedValueOnce(PLAN)
    await act(async () => hook.offer('repo-1', 'local_folder_picker'))
    await act(async () => {
      hook.state!.onContinue()
      hook.reset()
    })
    expect(onGitRepoReady).toHaveBeenCalledTimes(1)
    await act(async () => hook.reset())
    expect(onGitRepoReady).toHaveBeenCalledTimes(1)
  })
})
