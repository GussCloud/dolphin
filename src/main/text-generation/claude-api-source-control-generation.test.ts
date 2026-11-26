import { describe, expect, it, vi } from 'vitest'
import { generateBranchName } from './source-control-text-generation-requests'
import { prepareLocalCommitMessageAgentEnv } from './commit-message-agent-environment'
import {
  getCommitMessageAgentSpec,
  resolveCommitMessageAgentChoice
} from '../../shared/commit-message-agent-spec'
import {
  CLAUDE_API_ACCOUNT_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_KEY,
  CLAUDE_API_PROVIDER_ENV_VALUE
} from '../../shared/claude-api-provider'
import type { ClaudeManagedAccount } from '../../shared/managed-account-types'
import { prepareClaudeApiLaunch, type ClaudeApiLaunchDeps } from '../claude-api/claude-api-launch'

vi.mock('electron', () => ({ app: { getPath: () => '/user-data' } }))

const params = { agentId: 'claude-api' as const, model: 'sonnet' }
const context = { firstPrompt: 'Fix login flow' }
const MARKED_ENV = { [CLAUDE_API_PROVIDER_ENV_KEY]: CLAUDE_API_PROVIDER_ENV_VALUE }
// Fake keys, one per account, so the test sees which account was billed.
const KEYS: Record<string, string> = {
  api1: 'sk-ant-fake-api1-0000000000000000',
  api2: 'sk-ant-fake-api2-0000000000000000'
}

function apiAccount(id: string): ClaudeManagedAccount {
  return {
    id,
    email: '',
    authMethod: 'api-key',
    managedAuthPath: `/managed/${id}`,
    managedAuthRuntime: 'host',
    createdAt: 1,
    updatedAt: 1,
    lastAuthenticatedAt: 1
  }
}

const PLAN: ClaudeManagedAccount = {
  ...apiAccount('plan'),
  email: 'me@example.com',
  authMethod: 'subscription-oauth'
}

describe('Claude API source control generation', () => {
  it("offers Claude's models and default (Sonnet, low effort), without plan-side discovery", () => {
    const plain = getCommitMessageAgentSpec('claude')
    const spec = getCommitMessageAgentSpec('claude-api')
    expect(spec?.binary).toBe('claude')
    expect(spec?.models).toEqual(plain?.models)
    expect(spec?.defaultModelId).toBe('sonnet')
    expect(spec?.models.find((model) => model.id === 'sonnet')?.defaultThinkingLevel).toBe('low')
    expect(spec?.modelSource).toBe('static')
    expect(spec?.modelDiscovery).toBeUndefined()
    const args = spec?.buildArgs({ prompt: '', model: 'sonnet', thinkingLevel: 'low' }) ?? []
    expect(args).toEqual(expect.arrayContaining(['-p', '--model', 'sonnet', '--effort', 'low']))
  })

  it('generates with claude-api when the default agent is either API-key agent', () => {
    expect(resolveCommitMessageAgentChoice(null, 'claude-api', [])).toBe('claude-api')
    expect(resolveCommitMessageAgentChoice(null, 'claude-api-agent-teams', [])).toBe('claude-api')
  })

  it.each([
    [
      'over SSH',
      {
        kind: 'remote' as const,
        cwd: '/repo',
        missingBinaryLocation: 'remote PATH',
        execute: vi.fn()
      },
      'not on an SSH host'
    ],
    [
      'inside WSL',
      { kind: 'local' as const, cwd: '/repo', wslDistro: 'Ubuntu', env: MARKED_ENV },
      'not inside WSL'
    ],
    ['without its env', { kind: 'local' as const, cwd: '/repo' }, 'nothing was run']
  ])('never runs claude on the plan login %s', async (_case, target, message) => {
    const spawnAgent = vi.fn()
    const result = await generateBranchName({ context, params, target, spawnAgent })
    expect(result).toMatchObject({ success: false, error: expect.stringContaining(message) })
    expect(spawnAgent).not.toHaveBeenCalled()
    if (target.kind === 'remote') {
      expect(target.execute).not.toHaveBeenCalled()
    }
  })

  it('spawns claude once the API account env is in place', async () => {
    const spawnAgent = vi.fn(() => {
      throw new Error('spawned')
    })
    await generateBranchName({
      context,
      params,
      target: { kind: 'local', cwd: '/repo', env: MARKED_ENV },
      spawnAgent
    }).catch(() => undefined)
    expect(spawnAgent).toHaveBeenCalledWith(expect.objectContaining({ binary: 'claude' }))
  })
})

describe('prepareLocalCommitMessageAgentEnv for claude-api', () => {
  function deps(overrides: Partial<ClaudeApiLaunchDeps> = {}): ClaudeApiLaunchDeps {
    return {
      readApiKey: (id) => KEYS[id] ?? null,
      configDirFor: (account) => `/profiles/${account.id}/config`,
      holdsSession: () => false,
      worktreeSource: () => ({
        getWorktreeMeta: () => undefined,
        getAllWorktreeMeta: () => ({ 'repo-1::/repo/wt': { agentAccountId: 'api2' } })
      }),
      prepareProfile: vi.fn(async () => undefined),
      ...overrides
    }
  }
  const settings = {
    claudeManagedAccounts: [PLAN, apiAccount('api1'), apiAccount('api2')],
    claudeApiDefaultAccountId: 'api1'
  }
  const resolvers = (launchDeps: ClaudeApiLaunchDeps) => ({
    prepareForClaudeApiLaunch: (
      target: { runtime?: 'host' | 'wsl'; wslDistro?: string | null } | undefined,
      launch: { workspacePath?: string; worktreeId?: string } | undefined
    ) =>
      prepareClaudeApiLaunch(
        {
          connectionId: null,
          target: target ?? {},
          settings,
          launchEnv: undefined,
          command: undefined,
          launch: launch ?? {}
        },
        launchDeps
      )
  })

  it('bills the account the workspace pins, with its key and profile, and drops inherited auth', async () => {
    vi.stubEnv('ANTHROPIC_AUTH_TOKEN', 'inherited-plan-token')
    vi.stubEnv('ANTHROPIC_BASE_URL', 'https://proxy.invalid')
    // Dolphin started from a DeepSeek pane: its model slots must not reach api.anthropic.com.
    vi.stubEnv('ANTHROPIC_MODEL', 'deepseek-flash[1m]')
    vi.stubEnv('ANTHROPIC_DEFAULT_SONNET_MODEL', 'deepseek-flash[1m]')
    vi.stubEnv('CLAUDE_CODE_SUBAGENT_MODEL', 'deepseek-flash')
    try {
      const result = await prepareLocalCommitMessageAgentEnv(
        'claude-api',
        resolvers(deps()),
        { runtime: 'host' },
        { workspacePath: '/repo/wt' }
      )
      expect(result.ok).toBe(true)
      const env = result.ok ? (result.env ?? {}) : {}
      expect(env.ANTHROPIC_API_KEY).toBe(KEYS.api2)
      expect(env.CLAUDE_CONFIG_DIR).toBe('/profiles/api2/config')
      expect(env[CLAUDE_API_ACCOUNT_ENV_KEY]).toBe('api2')
      expect(env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
      expect(env.ANTHROPIC_BASE_URL).toBeUndefined()
      expect(env.ANTHROPIC_MODEL).toBeUndefined()
      expect(env.ANTHROPIC_DEFAULT_SONNET_MODEL).toBeUndefined()
      expect(env.CLAUDE_CODE_SUBAGENT_MODEL).toBeUndefined()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('uses the default account outside a pinned workspace', async () => {
    const result = await prepareLocalCommitMessageAgentEnv('claude-api', resolvers(deps()), {
      runtime: 'host'
    })
    expect(result.ok && result.env?.[CLAUDE_API_ACCOUNT_ENV_KEY]).toBe('api1')
  })

  it.each([
    ['in WSL', { runtime: 'wsl' as const, wslDistro: 'Ubuntu' }, deps(), 'cannot start in WSL'],
    [
      'without a key',
      { runtime: 'host' as const },
      deps({ readApiKey: () => null }),
      'has no API key'
    ]
  ])(
    'refuses %s with the reason, before anything runs',
    async (_case, target, launchDeps, reason) => {
      const result = await prepareLocalCommitMessageAgentEnv(
        'claude-api',
        resolvers(launchDeps),
        target
      )
      expect(result).toEqual({ ok: false, error: expect.stringContaining(reason) })
    }
  )

  it('refuses without a Claude API resolver instead of using the plain claude env', async () => {
    await expect(prepareLocalCommitMessageAgentEnv('claude-api', undefined)).resolves.toEqual({
      ok: false,
      error: 'Claude API text generation is not available in this process.'
    })
  })
})
