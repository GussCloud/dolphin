import { describe, expect, it, vi } from 'vitest'
import type { AppState } from '@/store/types'
import { buildAiVaultResumeStartupForWorktree } from './ai-vault-resume-command'

vi.mock('@/lib/new-workspace', () => ({
  CLIENT_PLATFORM: 'darwin'
}))

type ResumeState = Pick<
  AppState,
  | 'activeRepoId'
  | 'activeWorktreeId'
  | 'folderWorkspaces'
  | 'projectGroups'
  | 'projects'
  | 'repos'
  | 'settings'
  | 'worktreesByRepo'
>

function makeState(): ResumeState {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the resume builder reads only these slices.
  return {
    activeRepoId: 'repo-1',
    activeWorktreeId: 'repo-1::worktree-1',
    folderWorkspaces: [],
    projectGroups: [],
    repos: [{ id: 'repo-1', path: '/Users/ada/repo' }],
    projects: [{ id: 'repo-1', sourceRepoIds: ['repo-1'] }],
    settings: { agentDefaultArgs: {}, agentDefaultEnv: {} },
    worktreesByRepo: {
      'repo-1': [{ id: 'repo-1::worktree-1', repoId: 'repo-1', path: '/Users/ada/repo' }]
    }
  } as unknown as ResumeState
}

const DEEPSEEK_SESSION = {
  agent: 'deepseek' as const,
  sessionId: 'deepseek-session',
  cwd: '/Users/ada/repo',
  codexHome: null
}

describe('AI Vault resume for DeepSeek', () => {
  it('resumes through the startup plan so the pane launches as deepseek', () => {
    // Why: launchConfig is what makes the tab spawn carry launchAgent 'deepseek', the only
    // signal PTY spawn uses to inject the DeepSeek env instead of the Claude login.
    expect(
      buildAiVaultResumeStartupForWorktree({
        state: makeState(),
        worktreeId: 'repo-1::worktree-1',
        session: DEEPSEEK_SESSION
      })
    ).toMatchObject({
      command: expect.stringMatching(/^claude .*'--resume' 'deepseek-session'$/),
      launchConfig: { agentCommand: expect.stringMatching(/^claude/) },
      providerSession: { key: 'session_id', id: 'deepseek-session' }
    })
  })

  it("never reuses a runtime host's prebuilt command, which would launch as plain claude", () => {
    const startup = buildAiVaultResumeStartupForWorktree({
      state: makeState(),
      worktreeId: 'repo-1::worktree-1',
      session: {
        ...DEEPSEEK_SESSION,
        executionHostId: 'runtime:env-1',
        executionHostPlatform: 'linux',
        resumeCommand: "cd '/Users/ada/repo' && claude --resume 'deepseek-session'"
      }
    })

    expect(startup.launchConfig).toBeDefined()
    expect(startup.command).not.toBe("cd '/Users/ada/repo' && claude --resume 'deepseek-session'")
  })
})
