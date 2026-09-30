import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetAzureCliSessionRenewal,
  hostCanOpenSignInBrowser,
  onAzureCliSessionRenewed,
  renewAzureCliSession
} from './azure-cli-session-renewal'

const mocks = vi.hoisted(() => ({
  preference: vi.fn(),
  expiresAt: vi.fn(),
  runAzureCli: vi.fn(),
  runAzureCliJson: vi.fn()
}))

vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: mocks.preference
}))
vi.mock('./azure-cli-session-store', () => ({ getAzureCliTokenExpiresAt: mocks.expiresAt }))
vi.mock('./azure-cli-runner', () => ({
  AzureCliNotInstalledError: class extends Error {},
  runAzureCli: mocks.runAzureCli,
  runAzureCliJson: mocks.runAzureCliJson
}))

const loginOk = { code: 0, signal: null, timedOut: false, stdout: '', stderr: '' }
const loginFailed = { code: 1, signal: null, timedOut: false, stdout: '', stderr: 'cancelled' }

describe('renewAzureCliSession', () => {
  beforeEach(() => {
    _resetAzureCliSessionRenewal()
    vi.clearAllMocks()
    mocks.preference.mockReturnValue({ method: 'azure-cli', autoRenewCliSession: true })
    mocks.expiresAt.mockReturnValue(1_000)
    mocks.runAzureCliJson.mockResolvedValue({ tenantId: 'tenant-1' })
    mocks.runAzureCli.mockResolvedValue(loginOk)
  })

  it('runs az login on the signed-in tenant and notifies listeners', async () => {
    const listener = vi.fn()
    onAzureCliSessionRenewed(listener)
    await expect(renewAzureCliSession(0)).resolves.toBe(true)
    expect(mocks.runAzureCli.mock.calls[0]?.[0]).toEqual([
      'login',
      '--tenant',
      'tenant-1',
      '--output',
      'none'
    ])
    expect(listener).toHaveBeenCalledOnce()
  })

  it('stays off unless the user opted in', async () => {
    mocks.preference.mockReturnValue({ method: 'azure-cli', autoRenewCliSession: false })
    await expect(renewAzureCliSession(0)).resolves.toBe(false)
    expect(mocks.runAzureCli).not.toHaveBeenCalled()
  })

  it('does not sign in a host that never had a session', async () => {
    mocks.expiresAt.mockReturnValue(null)
    await expect(renewAzureCliSession(0)).resolves.toBe(false)
    expect(mocks.runAzureCli).not.toHaveBeenCalled()
  })

  it('shares one login between concurrent callers', async () => {
    const [first, second] = await Promise.all([renewAzureCliSession(0), renewAzureCliSession(0)])
    expect([first, second]).toEqual([true, true])
    expect(mocks.runAzureCli).toHaveBeenCalledOnce()
  })

  it('waits out the cooldown after a dismissed sign-in', async () => {
    mocks.runAzureCli.mockResolvedValue(loginFailed)
    await expect(renewAzureCliSession(0)).resolves.toBe(false)
    const failedAt = Date.now()
    await expect(renewAzureCliSession(failedAt + 60_000)).resolves.toBe(false)
    expect(mocks.runAzureCli).toHaveBeenCalledOnce()
    mocks.runAzureCli.mockResolvedValue(loginOk)
    await expect(renewAzureCliSession(failedAt + 15 * 60_000)).resolves.toBe(true)
  })
})

describe('hostCanOpenSignInBrowser', () => {
  it('requires a display on Linux', () => {
    expect(hostCanOpenSignInBrowser('win32', {})).toBe(true)
    expect(hostCanOpenSignInBrowser('darwin', {})).toBe(true)
    expect(hostCanOpenSignInBrowser('linux', {})).toBe(false)
    expect(hostCanOpenSignInBrowser('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(true)
  })
})
