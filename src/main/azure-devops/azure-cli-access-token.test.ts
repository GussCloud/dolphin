import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAzureCliAccessTokenCache,
  getAzureCliAccessToken,
  parseAzureCliAccessToken
} from './azure-cli-access-token'

const runAzureCliJsonMock = vi.hoisted(() => vi.fn())

vi.mock('./azure-cli-runner', () => ({ runAzureCliJson: runAzureCliJsonMock }))

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
