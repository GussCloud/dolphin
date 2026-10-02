import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getOpenObserveCliStatus,
  parseOpenObserveContexts,
  parseOpenObserveSkillStatus,
  parseOpenObserveVersion
} from './openobserve-cli-status'
import type * as OpenObserveCliRunner from './openobserve-cli-runner'

const mocks = vi.hoisted(() => ({
  resolveOpenObserveCliProgram: vi.fn(),
  runOpenObserveCli: vi.fn()
}))

vi.mock('./openobserve-cli-runner', async (importOriginal) => ({
  ...(await importOriginal<typeof OpenObserveCliRunner>()),
  ...mocks
}))

const ok = (stdout: unknown): object => ({
  code: 0,
  signal: null,
  stdout: typeof stdout === 'string' ? stdout : JSON.stringify(stdout),
  stderr: '',
  timedOut: false
})

const failed = (code: number, stderr: unknown): object => ({
  code,
  signal: null,
  stdout: '',
  stderr: typeof stderr === 'string' ? stderr : JSON.stringify(stderr),
  timedOut: false
})

// Shapes captured from openobserve-cli v0.14.0.
const CONTEXTS = {
  has_more: false,
  items: [
    { base_url: 'https://o2.example.com', current: true, name: 'prod', org: 'acme' },
    { base_url: 'http://localhost:5080', current: false, name: 'local', org: 'default' }
  ]
}
const AUTH_OK = {
  authenticated: true,
  base_url: 'https://o2.example.com',
  context: 'prod',
  org: 'acme',
  scheme: 'basic',
  username: 'dev@example.com'
}
const SKILL = {
  embedded_version: 'v0.3.7',
  installs: [
    { agent: 'agents', status: 'not_installed' },
    { agent: 'claude-code', alignment: 'current', status: 'installed', version: 'v0.3.7' },
    { agent: 'codex', alignment: 'outdated', status: 'installed', version: 'v0.3.1' }
  ]
}

function mockCommands(responses: Record<string, object>): void {
  mocks.runOpenObserveCli.mockImplementation(async (args: string[]) => {
    const key = args.slice(0, 2).join(' ')
    const response = responses[key] ?? responses[args[0] ?? '']
    if (!response) {
      throw new Error(`unexpected command: ${args.join(' ')}`)
    }
    return response
  })
}

describe('openobserve-cli output parsers', () => {
  it('reads contexts and skips entries without a name', () => {
    expect(parseOpenObserveContexts({ items: [...CONTEXTS.items, { org: 'x' }] })).toEqual([
      { name: 'prod', baseUrl: 'https://o2.example.com', org: 'acme', current: true },
      { name: 'local', baseUrl: 'http://localhost:5080', org: 'default', current: false }
    ])
    expect(parseOpenObserveContexts(null)).toEqual([])
  })

  it('separates installed and outdated skill copies', () => {
    expect(parseOpenObserveSkillStatus(SKILL)).toEqual({
      installedAgents: ['claude-code', 'codex'],
      outdatedAgents: ['codex']
    })
    expect(parseOpenObserveSkillStatus({})).toBeNull()
  })

  it('extracts the version from the version banner', () => {
    expect(
      parseOpenObserveVersion('openobserve-cli v0.14.0 (commit beee359, built 2026-09-24)\n')
    ).toBe('v0.14.0')
    expect(parseOpenObserveVersion('unknown')).toBeNull()
  })
})

describe('getOpenObserveCliStatus', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
    mocks.resolveOpenObserveCliProgram.mockResolvedValue({ program: 'openobserve-cli', env: {} })
  })

  it('reports a missing CLI without spawning anything', async () => {
    mocks.resolveOpenObserveCliProgram.mockResolvedValue(null)
    await expect(getOpenObserveCliStatus()).resolves.toEqual({ installed: false })
    expect(mocks.runOpenObserveCli).not.toHaveBeenCalled()
  })

  it('combines version, contexts, sign-in and skill probes', async () => {
    mockCommands({
      version: ok('openobserve-cli v0.14.0 (commit beee359)\n'),
      'config contexts': ok(CONTEXTS),
      'auth status': ok(AUTH_OK),
      'skill status': ok(SKILL)
    })
    await expect(getOpenObserveCliStatus()).resolves.toEqual({
      installed: true,
      version: 'v0.14.0',
      contexts: parseOpenObserveContexts(CONTEXTS),
      activeContext: 'prod',
      baseUrl: 'https://o2.example.com',
      org: 'acme',
      authScheme: 'basic',
      authenticated: true,
      username: 'dev@example.com',
      authError: null,
      skill: { installedAgents: ['claude-code', 'codex'], outdatedAgents: ['codex'] }
    })
    // Why: an unreachable server must not hold the card for the CLI's 30s default.
    expect(mocks.runOpenObserveCli).toHaveBeenCalledWith(['auth', 'status', '--timeout', '10s'])
  })

  it('treats an empty context from `auth status` as not configured', async () => {
    mockCommands({
      version: ok('openobserve-cli v0.14.0'),
      'config contexts': ok({ has_more: false, items: [] }),
      'auth status': ok({
        authenticated: false,
        base_url: '',
        context: '',
        error: 'basic auth requires both an email and a password',
        org: 'default',
        scheme: 'basic',
        username: ''
      }),
      'skill status': ok(SKILL)
    })
    await expect(getOpenObserveCliStatus()).resolves.toMatchObject({
      installed: true,
      activeContext: null,
      baseUrl: null,
      authenticated: false,
      authError: 'basic auth requires both an email and a password'
    })
  })

  it('surfaces the structured stderr error when `auth status` fails', async () => {
    mockCommands({
      version: ok('openobserve-cli v0.14.0'),
      'config contexts': ok(CONTEXTS),
      'auth status': failed(8, {
        error: {
          category: 'network',
          message: 'request to https://o2.example.com/api/organizations failed',
          hint: 'The server could not be reached (DNS, TLS or timeout).'
        }
      }),
      'skill status': failed(1, 'boom')
    })
    await expect(getOpenObserveCliStatus()).resolves.toMatchObject({
      installed: true,
      authenticated: false,
      // Falls back to the saved current context so the card does not ask to reconfigure.
      activeContext: 'prod',
      baseUrl: 'https://o2.example.com',
      org: 'acme',
      authError:
        'request to https://o2.example.com/api/organizations failed. The server could not be reached (DNS, TLS or timeout).',
      skill: null
    })
  })
})
