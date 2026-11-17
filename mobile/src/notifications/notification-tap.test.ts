import { describe, expect, it, vi } from 'vitest'
import { sha256 } from '@noble/hashes/sha256'
import type { HostCatalogEntry, HostCredentialStatus } from '../transport/types'
import { AZURE_DEVICE_LOGIN_URL } from './azure-device-code-push'
import { handleNotificationTap, type NotificationTapRequest } from './notification-tap'

vi.mock('react-native', () => ({ AppState: { currentState: 'background' } }))
vi.mock('../transport/host-store', () => ({ loadHostCatalog: vi.fn() }))
vi.mock('./push-tray-dismissal', () => ({ dismissPresentedPushNotification: vi.fn() }))
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => {}) }
}))

const publicKeyB64 = Buffer.alloc(32, 1).toString('base64')
const hostFingerprint = Buffer.from(sha256(Buffer.alloc(32, 1)))
  .toString('base64url')
  .slice(0, 16)
const attemptId = '0b6c3f0e-6b0e-4d4c-9a51-2f5c8d7e1a3b'

function catalog(credentialStatus: HostCredentialStatus = 'ready'): HostCatalogEntry[] {
  return [
    {
      id: 'host-1',
      name: 'Desk',
      endpoint: 'ws://desk',
      publicKeyB64,
      lastConnected: 0,
      credentialStatus,
      profile: null
    }
  ]
}

function remotePush(data: Record<string, string>): NotificationTapRequest {
  return { content: { data: { hostFingerprint, ...data } }, trigger: { type: 'push' } }
}

function effects(hosts: HostCatalogEntry[] = catalog(), disposed = false) {
  return {
    loadHosts: vi.fn(async () => hosts),
    isDisposed: vi.fn(() => disposed),
    clearLastResponse: vi.fn(),
    openRoute: vi.fn(),
    writeClipboard: vi.fn(async () => true),
    openUrl: vi.fn()
  }
}

const azureSignIn = remotePush({ notificationId: `azure-cli-device-code:${attemptId}:ABCD1234` })

describe('handleNotificationTap', () => {
  it('copies and opens the login page for an Azure sign-in push, without navigating', async () => {
    const tap = effects()

    await expect(handleNotificationTap(azureSignIn, tap)).resolves.toBe('azure-handled')

    expect(tap.writeClipboard).toHaveBeenCalledWith('ABCD1234')
    expect(tap.openUrl).toHaveBeenCalledWith(AZURE_DEVICE_LOGIN_URL)
    expect(tap.openRoute).not.toHaveBeenCalled()
    expect(tap.clearLastResponse).toHaveBeenCalledTimes(1)
  })

  it('routes other pushes to their worktree as before', async () => {
    const tap = effects()
    const request = remotePush({ notificationId: 'agent-1', worktreeId: 'wt-1', paneKey: 'p-1' })

    await expect(handleNotificationTap(request, tap)).resolves.toBe('navigated')

    expect(tap.openRoute).toHaveBeenCalledTimes(1)
    expect(tap.openRoute.mock.calls[0][0]).toMatchObject({ hostId: 'host-1' })
    expect(tap.openRoute.mock.calls[0][0].sessionTarget).not.toBeNull()
    expect(tap.writeClipboard).not.toHaveBeenCalled()
    expect(tap.openUrl).not.toHaveBeenCalled()
    expect(tap.clearLastResponse).toHaveBeenCalledTimes(1)
  })

  it('routes an older desktop’s sign-in push (no code) to the host', async () => {
    const tap = effects()
    const request = remotePush({ notificationId: `azure-cli-device-code:${attemptId}` })

    await expect(handleNotificationTap(request, tap)).resolves.toBe('navigated')

    expect(tap.openRoute).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: 'host-1', sessionTarget: null })
    )
    expect(tap.openUrl).not.toHaveBeenCalled()
  })

  it('sends a revoked host’s sign-in push to re-pairing instead of copy-and-open', async () => {
    const tap = effects(catalog('missing'))

    await expect(handleNotificationTap(azureSignIn, tap)).resolves.toBe('navigated')

    expect(tap.writeClipboard).not.toHaveBeenCalled()
    expect(tap.openUrl).not.toHaveBeenCalled()
    expect(tap.openRoute).toHaveBeenCalledWith(
      expect.objectContaining({ hostId: 'host-1', credentialRecovery: 're-pair' })
    )
  })

  it('does nothing visible when the catalog cannot load', async () => {
    const tap = effects()
    tap.loadHosts.mockRejectedValue(new Error('storage'))

    await expect(handleNotificationTap(azureSignIn, tap)).resolves.toBe('unrouted')

    expect(tap.openUrl).not.toHaveBeenCalled()
    expect(tap.openRoute).not.toHaveBeenCalled()
    expect(tap.clearLastResponse).toHaveBeenCalledTimes(1)
  })

  it('neither opens nor navigates once the layout is disposed', async () => {
    const tap = effects(catalog(), true)

    await expect(handleNotificationTap(azureSignIn, tap)).resolves.toBe('disposed')

    expect(tap.openUrl).not.toHaveBeenCalled()
    expect(tap.openRoute).not.toHaveBeenCalled()
    expect(tap.clearLastResponse).toHaveBeenCalledTimes(1)
  })
})
