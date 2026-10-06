import type { DolphinCloudAuthConfig } from '../dolphin-profiles/profile-cloud-auth-config'
import { DolphinCloudRequestError } from '../dolphin-profiles/profile-cloud-client'
import {
  cloudBearerRequestInit,
  extractErrorCode
} from '../dolphin-profiles/profile-cloud-org-members-client'
import type { DolphinCloudSession } from '../dolphin-profiles/profile-cloud-session-store'
import { cancelUnreadResponseBody } from '../lib/unread-response-body'
import type { WorkPresenceSnapshot } from './work-presence-snapshot'

export type WorkPresencePutResponse = { heartbeatMs: number | null }

function workPresenceUrl(config: DolphinCloudAuthConfig): string {
  return `${config.apiBaseUrl}/v1/desktop/work-presence`
}

async function readHeartbeatMs(response: Response): Promise<number | null> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'heartbeatMs' in body) {
      const value = body.heartbeatMs
      return typeof value === 'number' && Number.isFinite(value) ? value : null
    }
  } catch {
    // An unreadable success body still counts as accepted; the default cadence applies.
  }
  return null
}

export async function putDolphinCloudWorkPresence(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  snapshot: WorkPresenceSnapshot
): Promise<WorkPresencePutResponse> {
  const response = await fetch(
    workPresenceUrl(config),
    cloudBearerRequestInit('PUT', session.accessToken, snapshot)
  )
  if (!response.ok) {
    throw new DolphinCloudRequestError(response.status, await extractErrorCode(response))
  }
  return { heartbeatMs: await readHeartbeatMs(response) }
}

export async function deleteDolphinCloudWorkPresence(
  config: DolphinCloudAuthConfig,
  session: DolphinCloudSession,
  machineId: string
): Promise<void> {
  const response = await fetch(
    `${workPresenceUrl(config)}?machineId=${encodeURIComponent(machineId)}`,
    cloudBearerRequestInit('DELETE', session.accessToken)
  )
  if (!response.ok) {
    throw new DolphinCloudRequestError(response.status, await extractErrorCode(response))
  }
  await cancelUnreadResponseBody(response)
}
