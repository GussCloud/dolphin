import { describe, expect, it, vi } from 'vitest'
import {
  CLAUDE_API_HOST_UPDATE_REQUIRED_CODE,
  DEEPSEEK_HOST_UPDATE_REQUIRED_CODE,
  ownCredentialsClaudeAgentHostRefusal,
  refuseOwnCredentialsClaudeLaunchWithoutHostSupport,
  runtimeParamsLaunchOwnCredentialsClaude
} from './own-credentials-claude-runtime-launch-gate'
import {
  AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY,
  DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
} from './protocol-version'
import { DEEPSEEK_PROVIDER_ENV_KEY, DEEPSEEK_PROVIDER_ENV_VALUE } from './deepseek-claude-provider'
import { CLAUDE_API_PROVIDER_ENV_KEY, CLAUDE_API_PROVIDER_ENV_VALUE } from './claude-api-provider'
import {
  CLAUDE_API_AGENT_RUNTIME_CAPABILITY,
  CLAUDE_API_HOST_UPDATE_REQUIRED_MESSAGE
} from './claude-api-runtime-capability'

function status(capabilities: string[]) {
  return vi.fn(async () => ({
    id: 'status.get',
    ok: true as const,
    result: { runtimeId: 'host', capabilities },
    _meta: { runtimeId: 'host' }
  }))
}

describe('runtimeParamsLaunchOwnCredentialsClaude', () => {
  it.each([
    ['terminal.create', { launchAgent: 'deepseek', command: 'claude' }],
    ['terminal.createAgentSession', { agent: 'deepseek-agent-teams' }],
    ['worktree.create', { startupCommand: 'claude', createdWithAgent: 'deepseek' }],
    ['worktree.create', { startupAgent: 'deepseek' }],
    ['worktree.create', { startupDraftPaste: { agent: 'deepseek', draft: 'x' } }],
    ['terminal.create', { env: { [DEEPSEEK_PROVIDER_ENV_KEY]: DEEPSEEK_PROVIDER_ENV_VALUE } }],
    [
      'worktree.create',
      {
        startupLaunchConfig: {
          agentArgs: '',
          agentEnv: { [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek' }
        }
      }
    ]
  ])('detects a DeepSeek launch in %s params', (_method, params) => {
    expect(runtimeParamsLaunchOwnCredentialsClaude(params)).toBe(true)
  })

  it.each([
    undefined,
    null,
    'deepseek',
    { launchAgent: 'claude', command: 'claude' },
    { agent: 'codex' },
    { createdWithAgent: 'claude-agent-teams' },
    { env: { [DEEPSEEK_PROVIDER_ENV_KEY]: 'other' } },
    { repo: 'deepseek' }
  ])('ignores non-DeepSeek params %#', (params) => {
    expect(runtimeParamsLaunchOwnCredentialsClaude(params)).toBe(false)
  })
})

describe('refuseOwnCredentialsClaudeLaunchWithoutHostSupport', () => {
  it('lets a DeepSeek launch through to a host that advertises DeepSeek', async () => {
    const readStatus = status([AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY])
    await expect(
      refuseOwnCredentialsClaudeLaunchWithoutHostSupport({
        method: 'terminal.create',
        params: { launchAgent: 'deepseek' },
        readStatus
      })
    ).resolves.toBeNull()
    expect(readStatus).toHaveBeenCalledTimes(1)
  })

  it('refuses a DeepSeek launch to an older host instead of letting it run plain claude', async () => {
    await expect(
      refuseOwnCredentialsClaudeLaunchWithoutHostSupport({
        method: 'worktree.create',
        params: { startupCommand: 'claude', createdWithAgent: 'deepseek' },
        readStatus: status(['agent-session.zcode-resume.v1'])
      })
    ).resolves.toEqual({
      id: 'worktree.create',
      ok: false,
      error: {
        code: DEEPSEEK_HOST_UPDATE_REQUIRED_CODE,
        message: DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
      },
      _meta: { runtimeId: 'host' }
    })
  })

  it('refuses when the host status carries no capability list', async () => {
    const readStatus = vi.fn(async () => ({
      id: 'status.get',
      ok: true as const,
      result: { runtimeId: 'host' },
      _meta: { runtimeId: 'host' }
    }))
    const refusal = await refuseOwnCredentialsClaudeLaunchWithoutHostSupport({
      method: 'terminal.createAgentSession',
      params: { agent: 'deepseek' },
      readStatus
    })
    expect(refusal?.error.code).toBe(DEEPSEEK_HOST_UPDATE_REQUIRED_CODE)
  })

  it('returns the status failure when the host cannot be asked', async () => {
    const refusal = await refuseOwnCredentialsClaudeLaunchWithoutHostSupport({
      method: 'terminal.create',
      params: { launchAgent: 'deepseek' },
      readStatus: async () => ({
        id: 'status.get',
        ok: false as const,
        error: { code: 'runtime_unavailable', message: 'down' }
      })
    })
    expect(refusal).toEqual({
      id: 'terminal.create',
      ok: false,
      error: { code: 'runtime_unavailable', message: 'down' }
    })
  })

  it('never probes the host for non-DeepSeek agents', async () => {
    const readStatus = status([])
    await expect(
      refuseOwnCredentialsClaudeLaunchWithoutHostSupport({
        method: 'terminal.create',
        params: { launchAgent: 'claude', command: 'claude' },
        readStatus
      })
    ).resolves.toBeNull()
    expect(readStatus).not.toHaveBeenCalled()
  })
})

describe('claude-api on a paired host', () => {
  const launches: unknown[] = [
    { launchAgent: 'claude-api', command: 'claude' },
    { createdWithAgent: 'claude-api', startupCommand: 'claude' },
    { env: { [CLAUDE_API_PROVIDER_ENV_KEY]: CLAUDE_API_PROVIDER_ENV_VALUE } }
  ]

  it.each(launches)('refuses %# on a host without the capability', async (params) => {
    expect(runtimeParamsLaunchOwnCredentialsClaude(params)).toBe(true)
    // Why DeepSeek's capability: a host that knows DeepSeek still predates the API-key agent.
    const refusal = await refuseOwnCredentialsClaudeLaunchWithoutHostSupport({
      method: 'terminal.create',
      params,
      readStatus: status([AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY])
    })
    expect(refusal?.error).toEqual({
      code: CLAUDE_API_HOST_UPDATE_REQUIRED_CODE,
      message: CLAUDE_API_HOST_UPDATE_REQUIRED_MESSAGE
    })
  })

  it('lets it through to a host that advertises the capability', async () => {
    await expect(
      refuseOwnCredentialsClaudeLaunchWithoutHostSupport({
        method: 'terminal.create',
        params: { launchAgent: 'claude-api' },
        readStatus: status([CLAUDE_API_AGENT_RUNTIME_CAPABILITY])
      })
    ).resolves.toBeNull()
  })

  it('refuses a federated worker of claude-api on an older host', () => {
    expect(
      ownCredentialsClaudeAgentHostRefusal('claude-api', [
        AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY
      ])
    ).toBe(CLAUDE_API_HOST_UPDATE_REQUIRED_MESSAGE)
    expect(
      ownCredentialsClaudeAgentHostRefusal('claude-api', [CLAUDE_API_AGENT_RUNTIME_CAPABILITY])
    ).toBeNull()
    expect(ownCredentialsClaudeAgentHostRefusal('claude', [])).toBeNull()
  })
})
