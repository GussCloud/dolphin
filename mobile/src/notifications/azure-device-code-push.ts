import { readDolphinPushPayload } from './push-payload'
import { resolveHostIdForFingerprint } from './push-host-fingerprint'
import type { HostCredentialStatus } from '../transport/types'

export type AzureDeviceCodePushHost = {
  readonly id: string
  readonly publicKeyB64: string
  readonly credentialStatus: HostCredentialStatus
}

// Why a constant: the page a tap opens must never come from push data, which a
// compromised gateway or plugin could shape into a phishing link.
// The payload is not host-signed, so a compromised gateway could still push its own code;
// accepted because that gateway already carries the notification text.
export const AZURE_DEVICE_LOGIN_URL = 'https://login.microsoft.com/device'

const AZURE_DEVICE_CODE_ID_PREFIX = 'azure-cli-device-code:'
const AZURE_DEVICE_CODE_PATTERN = /^[A-Z0-9]{8,12}$/

/**
 * The device code an Azure sign-in push carries, from a known host with ready credentials only.
 * Null for older desktops (`azure-cli-device-code:<attemptId>`), so their taps keep routing as before.
 */
export function readAzureDeviceCodeFromPush(
  data: unknown,
  hosts: readonly AzureDeviceCodePushHost[]
): string | null {
  const payload = readDolphinPushPayload(data)
  if (!payload || payload.kind === 'dismiss') {
    return null
  }
  const notificationId = payload.notificationId
  if (!notificationId?.startsWith(AZURE_DEVICE_CODE_ID_PREFIX)) {
    return null
  }
  const hostId = resolveHostIdForFingerprint(payload.hostFingerprint, hosts)
  // Same pairing rule as a routed tap: a host without usable credentials gets its recovery route.
  if (!hostId || hosts.find((host) => host.id === hostId)?.credentialStatus !== 'ready') {
    return null
  }
  const parts = notificationId.slice(AZURE_DEVICE_CODE_ID_PREFIX.length).split(':')
  if (parts.length !== 2 || parts[0].length === 0) {
    return null
  }
  const userCode = parts[1]
  return AZURE_DEVICE_CODE_PATTERN.test(userCode) ? userCode : null
}

export type AzureDeviceCodeTapActions = {
  writeClipboard: (text: string) => Promise<boolean>
  openUrl: (url: string) => void
}

/** True when the tap was an Azure sign-in push and was handled here, so the caller must not navigate. */
export async function handleAzureDeviceCodePushTap(
  data: unknown,
  hosts: readonly AzureDeviceCodePushHost[],
  actions: AzureDeviceCodeTapActions
): Promise<boolean> {
  const userCode = readAzureDeviceCodeFromPush(data, hosts)
  if (!userCode) {
    return false
  }
  // A failed copy still opens the login page, where the code can be typed by hand.
  try {
    if (!(await actions.writeClipboard(userCode))) {
      console.warn('[push] the clipboard did not accept the Azure device code')
    }
  } catch (error) {
    console.warn('[push] could not copy the Azure device code', error)
  }
  actions.openUrl(AZURE_DEVICE_LOGIN_URL)
  return true
}
