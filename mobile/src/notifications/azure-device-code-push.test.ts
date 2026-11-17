import { describe, expect, it, vi } from 'vitest'
import { sha256 } from '@noble/hashes/sha256'
import {
  AZURE_DEVICE_LOGIN_URL,
  handleAzureDeviceCodePushTap,
  readAzureDeviceCodeFromPush
} from './azure-device-code-push'
import { getNotificationNavigationTarget } from './notification-routing'
import { pushNotificationRouteData } from './push-receive'

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
const otherHostFingerprint = Buffer.from(sha256(Buffer.alloc(32, 2)))
  .toString('base64url')
  .slice(0, 16)
const hosts = [{ id: 'host-1', publicKeyB64, credentialStatus: 'ready' as const }]
const attemptId = '0b6c3f0e-6b0e-4d4c-9a51-2f5c8d7e1a3b'

// FCM carries every value as a string, flat in `data`.
function fcmData(fields: Record<string, string>): Record<string, string> {
  return { hostFingerprint, title: 'Azure sign-in', ...fields }
}

function azurePush(notificationId: string): Record<string, string> {
  return fcmData({ notificationId })
}

describe('readAzureDeviceCodeFromPush', () => {
  it('reads the code from a known host’s Azure sign-in push', () => {
    expect(
      readAzureDeviceCodeFromPush(azurePush(`azure-cli-device-code:${attemptId}:ABCD1234EF`), hosts)
    ).toBe('ABCD1234EF')
  })

  it('reads the code from the APNs nested shape', () => {
    const data = {
      aps: { alert: { title: 'Azure sign-in' } },
      dolphin: { hostFingerprint, notificationId: `azure-cli-device-code:${attemptId}:ABCD1234` }
    }
    expect(readAzureDeviceCodeFromPush(data, hosts)).toBe('ABCD1234')
  })

  it.each([
    ['an older desktop’s id without a code', `azure-cli-device-code:${attemptId}`],
    ['a wrong prefix', `azure-cli-device:${attemptId}:ABCD1234`],
    ['a prefix with different case', `Azure-cli-device-code:${attemptId}:ABCD1234`],
    ['a lowercase code', `azure-cli-device-code:${attemptId}:abcd1234`],
    ['a code shorter than 8', `azure-cli-device-code:${attemptId}:ABC1234`],
    ['a code longer than 12', `azure-cli-device-code:${attemptId}:ABCDEFGH12345`],
    ['a code with a URL', `azure-cli-device-code:${attemptId}:https://evil.example`],
    ['a code with spaces', `azure-cli-device-code:${attemptId}:ABCD 1234`],
    ['a code with a newline', `azure-cli-device-code:${attemptId}:ABCD1234\n`],
    ['an extra segment', `azure-cli-device-code:${attemptId}:ABCD1234:EXTRA`],
    ['an empty attempt id', 'azure-cli-device-code::ABCD1234'],
    ['an empty code', `azure-cli-device-code:${attemptId}:`],
    ['an unrelated notification', 'agent-needs-input:pane-1']
  ])('ignores %s', (_label, notificationId) => {
    expect(readAzureDeviceCodeFromPush(azurePush(notificationId), hosts)).toBeNull()
  })

  it('ignores a push from a host this phone does not know', () => {
    const data = {
      hostFingerprint: otherHostFingerprint,
      notificationId: `azure-cli-device-code:${attemptId}:ABCD1234`
    }
    expect(readAzureDeviceCodeFromPush(data, hosts)).toBeNull()
  })

  it.each(['missing', 'temporarily-unavailable'] as const)(
    'ignores a push from a host whose credentials are %s',
    (credentialStatus) => {
      expect(
        readAzureDeviceCodeFromPush(azurePush(`azure-cli-device-code:${attemptId}:ABCD1234`), [
          { id: 'host-1', publicKeyB64, credentialStatus }
        ])
      ).toBeNull()
    }
  )

  it('ignores a push when the host catalog is unavailable', () => {
    expect(
      readAzureDeviceCodeFromPush(azurePush(`azure-cli-device-code:${attemptId}:ABCD1234`), [])
    ).toBeNull()
  })

  it('ignores data without a host fingerprint, even with a matching id', () => {
    const data = { hostId: 'host-1', notificationId: `azure-cli-device-code:${attemptId}:ABCD1234` }
    expect(readAzureDeviceCodeFromPush(data, hosts)).toBeNull()
  })

  it('ignores a dismissal for the sign-in push', () => {
    const data = fcmData({
      kind: 'dismiss',
      notificationId: `azure-cli-device-code:${attemptId}:ABCD1234`
    })
    expect(readAzureDeviceCodeFromPush(data, hosts)).toBeNull()
  })

  it('ignores non-object data', () => {
    expect(readAzureDeviceCodeFromPush(null, hosts)).toBeNull()
    expect(readAzureDeviceCodeFromPush('azure-cli-device-code:x:ABCD1234', hosts)).toBeNull()
  })
})

describe('handleAzureDeviceCodePushTap', () => {
  function actions(writeClipboard: (text: string) => Promise<boolean> = async () => true) {
    return { writeClipboard: vi.fn(writeClipboard), openUrl: vi.fn() }
  }

  it('copies the code and opens the constant Microsoft login page', async () => {
    const tap = actions()
    const data = {
      ...azurePush(`azure-cli-device-code:${attemptId}:ABCD1234`),
      url: 'https://evil.example/device'
    }

    await expect(handleAzureDeviceCodePushTap(data, hosts, tap)).resolves.toBe(true)

    expect(tap.writeClipboard).toHaveBeenCalledWith('ABCD1234')
    expect(tap.openUrl).toHaveBeenCalledTimes(1)
    expect(tap.openUrl).toHaveBeenCalledWith('https://login.microsoft.com/device')
    expect(AZURE_DEVICE_LOGIN_URL).toBe('https://login.microsoft.com/device')
    expect(tap.writeClipboard.mock.invocationCallOrder[0]).toBeLessThan(
      tap.openUrl.mock.invocationCallOrder[0]
    )
  })

  it('still opens the login page when the copy rejects or is refused', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const rejected = actions(async () => {
      throw new Error('no clipboard')
    })
    await expect(
      handleAzureDeviceCodePushTap(
        azurePush(`azure-cli-device-code:${attemptId}:ABCD1234`),
        hosts,
        rejected
      )
    ).resolves.toBe(true)
    expect(rejected.openUrl).toHaveBeenCalledWith(AZURE_DEVICE_LOGIN_URL)

    const refused = actions(async () => false)
    await handleAzureDeviceCodePushTap(
      azurePush(`azure-cli-device-code:${attemptId}:ABCD1234`),
      hosts,
      refused
    )
    expect(refused.openUrl).toHaveBeenCalledWith(AZURE_DEVICE_LOGIN_URL)
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it('leaves an older desktop’s sign-in push to the existing route', async () => {
    const tap = actions()
    const data = azurePush(`azure-cli-device-code:${attemptId}`)

    await expect(handleAzureDeviceCodePushTap(data, hosts, tap)).resolves.toBe(false)

    expect(tap.writeClipboard).not.toHaveBeenCalled()
    expect(tap.openUrl).not.toHaveBeenCalled()
    expect(
      getNotificationNavigationTarget(pushNotificationRouteData(data, hosts, true), {
        knownHostIds: new Set(['host-1'])
      })
    ).not.toBeNull()
  })

  it('leaves other pushes to the existing route', async () => {
    const tap = actions()
    const data = fcmData({ notificationId: 'agent-1', worktreeId: 'wt-1', paneKey: 'pane-1' })

    await expect(handleAzureDeviceCodePushTap(data, hosts, tap)).resolves.toBe(false)

    expect(tap.writeClipboard).not.toHaveBeenCalled()
    expect(tap.openUrl).not.toHaveBeenCalled()
    expect(pushNotificationRouteData(data, hosts, true)).toEqual({
      hostId: 'host-1',
      paneKey: 'pane-1',
      worktreeId: 'wt-1'
    })
  })

  it('copies nothing and opens nothing for an unknown host', async () => {
    const tap = actions()
    const data = {
      hostFingerprint: otherHostFingerprint,
      notificationId: `azure-cli-device-code:${attemptId}:ABCD1234`
    }

    await expect(handleAzureDeviceCodePushTap(data, hosts, tap)).resolves.toBe(false)

    expect(tap.writeClipboard).not.toHaveBeenCalled()
    expect(tap.openUrl).not.toHaveBeenCalled()
  })
})
