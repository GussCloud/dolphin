import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import {
  DEEPSEEK_ANTHROPIC_BASE_URL,
  DEEPSEEK_PROVIDER_ENV_KEY,
  DEFAULT_DEEPSEEK_MODEL_SLOTS
} from '../../shared/deepseek-claude-provider'
import {
  DEEPSEEK_MISSING_API_KEY_MESSAGE,
  DEEPSEEK_SSH_UNSUPPORTED_MESSAGE,
  DEEPSEEK_UNREADABLE_API_KEY_MESSAGE,
  DEEPSEEK_WSL_HOME_MESSAGE,
  resolveDeepSeekLaunchEnv,
  type DeepSeekLaunchEnvDeps
} from './deepseek-launch-env'
import { isDeepSeekLaunchRequest } from './deepseek-launch-request'

const HOST_HOME = join('/', 'home', 'me')

function deps(overrides: Partial<DeepSeekLaunchEnvDeps> = {}): DeepSeekLaunchEnvDeps {
  return {
    readApiKey: () => 'sk-ds',
    homeDir: () => HOST_HOME,
    resolveWslHome: (distro) => `\\\\wsl.localhost\\${distro}\\home\\me`,
    defaultWslDistro: () => 'Ubuntu',
    ...overrides
  }
}

const hostArgs = { connectionId: null, target: { runtime: 'host' as const }, modelSlots: undefined }

describe('resolveDeepSeekLaunchEnv', () => {
  it('builds the provider env with a host config dir under the home directory', () => {
    const { env, configHome } = resolveDeepSeekLaunchEnv(
      { ...hostArgs, modelSlots: { main: 'deepseek-pro' } },
      deps()
    )
    const configDir = join(HOST_HOME, '.claude-deepseek')
    expect(configHome).toEqual({
      processConfigDir: configDir,
      hostConfigDir: configDir,
      wslDistro: null
    })
    expect(env).toMatchObject({
      ANTHROPIC_BASE_URL: DEEPSEEK_ANTHROPIC_BASE_URL,
      ANTHROPIC_AUTH_TOKEN: 'sk-ds',
      CLAUDE_CONFIG_DIR: configDir,
      ANTHROPIC_MODEL: 'deepseek-pro',
      ANTHROPIC_DEFAULT_HAIKU_MODEL: DEFAULT_DEEPSEEK_MODEL_SLOTS.haiku,
      [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek'
    })
  })

  it('gives a WSL process the Linux config dir and main the UNC one', () => {
    const { env, configHome } = resolveDeepSeekLaunchEnv(
      { ...hostArgs, target: { runtime: 'wsl', wslDistro: 'Debian' } },
      deps()
    )
    expect(env.CLAUDE_CONFIG_DIR).toBe('/home/me/.claude-deepseek')
    expect(configHome.processConfigDir).toBe('/home/me/.claude-deepseek')
    expect(configHome.wslDistro).toBe('Debian')
    expect(configHome.hostConfigDir).toBe(
      join('\\\\wsl.localhost\\Debian\\home\\me', '.claude-deepseek')
    )
  })

  it('falls back to the default distro when the target names none', () => {
    const { configHome } = resolveDeepSeekLaunchEnv(
      { ...hostArgs, target: { runtime: 'wsl' } },
      deps()
    )
    expect(configHome.wslDistro).toBe('Ubuntu')
  })

  it('refuses SSH before reading the key', () => {
    let keyRead = false
    expect(() =>
      resolveDeepSeekLaunchEnv(
        { ...hostArgs, connectionId: 'ssh-1' },
        deps({
          readApiKey: () => {
            keyRead = true
            return 'sk'
          }
        })
      )
    ).toThrow(DEEPSEEK_SSH_UNSUPPORTED_MESSAGE)
    expect(keyRead).toBe(false)
  })

  it('refuses a launch without a key, or with an unreadable one', () => {
    expect(() => resolveDeepSeekLaunchEnv(hostArgs, deps({ readApiKey: () => null }))).toThrow(
      DEEPSEEK_MISSING_API_KEY_MESSAGE
    )
    expect(() =>
      resolveDeepSeekLaunchEnv(
        hostArgs,
        deps({
          readApiKey: () => {
            throw new Error('decrypt')
          }
        })
      )
    ).toThrow(DEEPSEEK_UNREADABLE_API_KEY_MESSAGE)
  })

  it('refuses a WSL launch whose home cannot be resolved', () => {
    expect(() =>
      resolveDeepSeekLaunchEnv(
        { ...hostArgs, target: { runtime: 'wsl' } },
        deps({ resolveWslHome: () => null })
      )
    ).toThrow(DEEPSEEK_WSL_HOME_MESSAGE)
  })
})

describe('isDeepSeekLaunchRequest', () => {
  it('matches the DeepSeek agents and marked teammate panes only', () => {
    const marked = { [DEEPSEEK_PROVIDER_ENV_KEY]: 'deepseek' }
    expect(isDeepSeekLaunchRequest({ launchAgent: 'deepseek', env: undefined })).toBe(true)
    expect(isDeepSeekLaunchRequest({ launchAgent: 'deepseek-agent-teams', env: {} })).toBe(true)
    expect(isDeepSeekLaunchRequest({ launchAgent: undefined, env: marked })).toBe(true)
    expect(isDeepSeekLaunchRequest({ launchAgent: 'claude', env: {} })).toBe(false)
    expect(isDeepSeekLaunchRequest({ launchAgent: 'claude-agent-teams', env: undefined })).toBe(
      false
    )
    expect(
      isDeepSeekLaunchRequest({
        launchAgent: 'claude',
        env: { [DEEPSEEK_PROVIDER_ENV_KEY]: 'other' }
      })
    ).toBe(false)
  })
})
