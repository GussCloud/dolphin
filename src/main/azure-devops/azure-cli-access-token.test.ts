import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as Runner from './azure-cli-runner'
import {
  clearAzureCliAccessTokenCache,
  getAzureCliAccessToken,
  parseAzureCliAccessToken
} from './azure-cli-access-token'

const runAzureCliJsonMock = vi.hoisted(() => vi.fn())
const sessionMocks = vi.hoisted(() => ({
  record: vi.fn(),
  renew: vi.fn(),
  shouldRenew: vi.fn()
}))

vi.mock('./azure-cli-runner', async () => {
  const actual = await vi.importActual<typeof Runner>('./azure-cli-runner')
  return { AzureCliCommandError: actual.AzureCliCommandError, runAzureCliJson: runAzureCliJsonMock }
})
vi.mock('./azure-cli-session-store', () => ({ recordAzureCliTokenExpiry: sessionMocks.record }))
vi.mock('./azure-cli-session-renewal', () => ({
  renewAzureCliSession: sessionMocks.renew,
  shouldRenewAzureCliSession: sessionMocks.shouldRenew
}))

const inSeconds = (seconds: number): number => Math.floor(Date.now() / 1000) + seconds

describe('parseAzureCliAccessToken', () => {
  it('prefers the timezone-safe expires_on epoch', () => {
    expect(
      parseAzureCliAccessToken(
        { accessToken: 'tok', expires_on: 1_900_000_000, expiresOn: '2000-01-01 00:00:00' },
        0
      )
    ).toEqual({ accessToken: 'tok', expiresAtMs: 1_900_000_000_000 })
  })

  it('rejects payloads without a token', () => {
    expect(parseAzureCliAccessToken({ expires_on: 1 }, 0)).toBeNull()
    expect(parseAzureCliAccessToken(null, 0)).toBeNull()
  })
})

describe('getAzureCliAccessToken', () => {
  beforeEach(() => {
    clearAzureCliAccessTokenCache()
    runAzureCliJsonMock.mockReset()
    vi.clearAllMocks()
    sessionMocks.renew.mockResolvedValue(false)
    sessionMocks.shouldRenew.mockReturnValue(false)
  })

  it('persists the validity of each issued token', async () => {
    runAzureCliJsonMock.mockResolvedValue({ accessToken: 'tok', expires_on: 1_900_000_000 })
    await getAzureCliAccessToken()
    expect(sessionMocks.record).toHaveBeenCalledWith(1_900_000_000_000)
  })

  it('starts a session renewal when the CLI refuses to issue a token', async () => {
    const { AzureCliCommandError } = await import('./azure-cli-runner')
    runAzureCliJsonMock.mockRejectedValue(
      new AzureCliCommandError(['account'], {
        code: 1,
        signal: null,
        timedOut: false,
        stdout: '',
        stderr: 'AADSTS700082: The refresh token has expired'
      })
    )
    await expect(getAzureCliAccessToken()).rejects.toThrow('AADSTS700082')
    expect(sessionMocks.renew).toHaveBeenCalledOnce()
  })

  it('requests the Azure DevOps resource once and reuses the unexpired token', async () => {
    runAzureCliJsonMock.mockResolvedValue({ accessToken: 'tok', expires_on: inSeconds(3600) })
    await expect(getAzureCliAccessToken()).resolves.toBe('tok')
    await expect(getAzureCliAccessToken()).resolves.toBe('tok')
    expect(runAzureCliJsonMock).toHaveBeenCalledTimes(1)
    expect(runAzureCliJsonMock.mock.calls[0]?.[0]).toEqual([
      'account',
      'get-access-token',
      '--resource',
      '499b84ac-1321-427f-aa17-267ca6975798'
    ])
  })

  it('refreshes a token inside the expiry safety margin', async () => {
    runAzureCliJsonMock
      .mockResolvedValueOnce({ accessToken: 'old', expires_on: inSeconds(60) })
      .mockResolvedValueOnce({ accessToken: 'new', expires_on: inSeconds(3600) })
    await expect(getAzureCliAccessToken()).resolves.toBe('old')
    await expect(getAzureCliAccessToken()).resolves.toBe('new')
  })

  it('propagates a signed-out CLI as a rejection', async () => {
    runAzureCliJsonMock.mockRejectedValue(new Error('Please run az login'))
    await expect(getAzureCliAccessToken()).rejects.toThrow('az login')
  })
})
