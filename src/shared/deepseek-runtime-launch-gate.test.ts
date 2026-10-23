import { describe, expect, it, vi } from 'vitest'
import {
  DEEPSEEK_HOST_UPDATE_REQUIRED_CODE,
  refuseDeepSeekLaunchWithoutHostSupport,
  runtimeParamsLaunchDeepSeek
} from './deepseek-runtime-launch-gate'
import {
  AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY,
  DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
} from './protocol-version'
import { DEEPSEEK_PROVIDER_ENV_KEY, DEEPSEEK_PROVIDER_ENV_VALUE } from './deepseek-claude-provider'

function status(capabilities: string[]) {
  return vi.fn(async () => ({
    id: 'status.get',
    ok: true as const,
    result: { runtimeId: 'host', capabilities },
    _meta: { runtimeId: 'host' }
  }))
}

describe('runtimeParamsLaunchDeepSeek', () => {
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
    expect(runtimeParamsLaunchDeepSeek(params)).toBe(true)
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
    expect(runtimeParamsLaunchDeepSeek(params)).toBe(false)
  })
})

describe('refuseDeepSeekLaunchWithoutHostSupport', () => {
  it('lets a DeepSeek launch through to a host that advertises DeepSeek', async () => {
    const readStatus = status([AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY])
    await expect(
      refuseDeepSeekLaunchWithoutHostSupport({
        method: 'terminal.create',
        params: { launchAgent: 'deepseek' },
        readStatus
      })
    ).resolves.toBeNull()
    expect(readStatus).toHaveBeenCalledTimes(1)
  })

  it('refuses a DeepSeek launch to an older host instead of letting it run plain claude', async () => {
    await expect(
      refuseDeepSeekLaunchWithoutHostSupport({
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
    const refusal = await refuseDeepSeekLaunchWithoutHostSupport({
      method: 'terminal.createAgentSession',
      params: { agent: 'deepseek' },
      readStatus
    })
    expect(refusal?.error.code).toBe(DEEPSEEK_HOST_UPDATE_REQUIRED_CODE)
  })

  it('returns the status failure when the host cannot be asked', async () => {
    const refusal = await refuseDeepSeekLaunchWithoutHostSupport({
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
      refuseDeepSeekLaunchWithoutHostSupport({
        method: 'terminal.create',
        params: { launchAgent: 'claude', command: 'claude' },
        readStatus
      })
    ).resolves.toBeNull()
    expect(readStatus).not.toHaveBeenCalled()
  })
})
