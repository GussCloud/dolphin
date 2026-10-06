import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DolphinCloudAuthConfig } from '../dolphin-profiles/profile-cloud-auth-config'
import { DolphinCloudRequestError } from '../dolphin-profiles/profile-cloud-client'
import type { DolphinCloudSession } from '../dolphin-profiles/profile-cloud-session-store'
import { deleteDolphinCloudWorkPresence, putDolphinCloudWorkPresence } from './work-presence-client'
import { mapWorkPresencePutResult } from './work-presence-service'

const fetchMock = vi.fn()

// oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: The client reads only apiBaseUrl.
const config = { apiBaseUrl: 'https://api.example' } as DolphinCloudAuthConfig
const session: DolphinCloudSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: 999,
  capabilities: { flags: {}, refreshedAt: 1 }
}
const snapshot = {
  schemaVersion: 1 as const,
  machineId: 'm1',
  machineLabel: 'host',
  projects: []
}

function respond(status: number, body: unknown): void {
  fetchMock.mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  })
}

describe('work presence client', () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('PUTs the snapshot with the bearer token and reads heartbeatMs', async () => {
    respond(200, { organizationId: 'corg_1', heartbeatMs: 15_000 })
    await expect(putDolphinCloudWorkPresence(config, session, snapshot)).resolves.toEqual({
      heartbeatMs: 15_000
    })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example/v1/desktop/work-presence')
    expect(init.method).toBe('PUT')
    expect(init.redirect).toBe('error')
    expect(init.headers.authorization).toBe('Bearer access-token')
    expect(JSON.parse(init.body)).toEqual(snapshot)
  })

  it('throws the server error code on failure', async () => {
    respond(404, { error: 'no_organization' })
    await expect(putDolphinCloudWorkPresence(config, session, snapshot)).rejects.toMatchObject({
      statusCode: 404,
      errorCode: 'no_organization'
    })
  })

  it('DELETEs by machine id', async () => {
    respond(204, null)
    await deleteDolphinCloudWorkPresence(config, session, 'm 1')
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.example/v1/desktop/work-presence?machineId=m%201')
    expect(init.method).toBe('DELETE')
  })
})

describe('mapWorkPresencePutResult', () => {
  it('maps cloud call results onto publisher outcomes', () => {
    expect(mapWorkPresencePutResult({ status: 'ok', value: { heartbeatMs: 1 } })).toEqual({
      status: 'ok',
      heartbeatMs: 1
    })
    expect(mapWorkPresencePutResult({ status: 'reconnect-required' })).toEqual({
      status: 'signed-out'
    })
    expect(
      mapWorkPresencePutResult({
        status: 'request-error',
        error: new DolphinCloudRequestError(404, 'no_organization')
      })
    ).toEqual({ status: 'no-organization' })
    expect(
      mapWorkPresencePutResult({
        status: 'request-error',
        error: new DolphinCloudRequestError(503)
      })
    ).toEqual({ status: 'failed' })
    expect(mapWorkPresencePutResult({ status: 'failed', error: 'offline' })).toEqual({
      status: 'failed'
    })
  })
})
