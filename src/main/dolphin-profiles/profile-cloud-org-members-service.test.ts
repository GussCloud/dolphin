import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { DolphinOrgMembersRoster } from '../../shared/dolphin-profiles'
import { DolphinCloudRequestError } from './profile-cloud-client'

const {
  runWithFreshDolphinCloudSessionMock,
  listDolphinCloudOrgMembersMock,
  inviteDolphinCloudOrgMemberMock,
  revokeDolphinCloudOrgInviteMock,
  changeDolphinCloudOrgMemberRoleMock,
  removeDolphinCloudOrgMemberMock
} = vi.hoisted(() => ({
  runWithFreshDolphinCloudSessionMock: vi.fn(),
  listDolphinCloudOrgMembersMock: vi.fn(),
  inviteDolphinCloudOrgMemberMock: vi.fn(),
  revokeDolphinCloudOrgInviteMock: vi.fn(),
  changeDolphinCloudOrgMemberRoleMock: vi.fn(),
  removeDolphinCloudOrgMemberMock: vi.fn()
}))

let userDataPath = ''

vi.mock('electron', () => ({
  app: { getPath: () => userDataPath }
}))

vi.mock('./profile-cloud-session-refresh', () => ({
  runWithFreshDolphinCloudSessionMock,
  runWithFreshDolphinCloudSession: runWithFreshDolphinCloudSessionMock
}))

vi.mock('./profile-cloud-org-members-client', () => ({
  listDolphinCloudOrgMembers: listDolphinCloudOrgMembersMock,
  inviteDolphinCloudOrgMember: inviteDolphinCloudOrgMemberMock,
  revokeDolphinCloudOrgInvite: revokeDolphinCloudOrgInviteMock,
  changeDolphinCloudOrgMemberRole: changeDolphinCloudOrgMemberRoleMock,
  removeDolphinCloudOrgMember: removeDolphinCloudOrgMemberMock
}))

import {
  changeDolphinProfileOrgMemberRole,
  inviteDolphinProfileOrgMember,
  listDolphinProfileOrgMembers,
  removeDolphinProfileOrgMember,
  revokeDolphinProfileOrgInvite
} from './profile-cloud-org-members-service'

const fakeSession = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 3_600_000,
  capabilities: { flags: {}, refreshedAt: 1 }
}

// Why: mirror the real contract — invoke the operation with a live session and
// surface its resolved value; business 4xx are returned by the operation as
// values, never thrown, so the session layer never sees them.
function runOperationDirectly(): void {
  runWithFreshDolphinCloudSessionMock.mockImplementation(
    async (
      _config: unknown,
      _active: unknown,
      _path: unknown,
      op: (session: unknown) => unknown
    ) => ({
      status: 'ok',
      value: await op(fakeSession)
    })
  )
}

function configureCloudEnv(): void {
  vi.stubEnv('DOLPHIN_CLOUD_API_URL', 'https://dolphin-cloud.example')
  vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', 'desktop-client')
}

const roster: DolphinOrgMembersRoster = {
  members: [{ userId: 'user-1', email: 'nina@example.com', role: 'owner' }],
  pendingInvites: [],
  viewerRole: 'owner',
  canManageMembers: true
}

describe('Dolphin cloud org members service (configured)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-org-members-'))
    runWithFreshDolphinCloudSessionMock.mockReset()
    listDolphinCloudOrgMembersMock.mockReset()
    inviteDolphinCloudOrgMemberMock.mockReset()
    revokeDolphinCloudOrgInviteMock.mockReset()
    changeDolphinCloudOrgMemberRoleMock.mockReset()
    removeDolphinCloudOrgMemberMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('DOLPHIN_CLOUD_DEV_AUTH', '')
    vi.stubEnv('DOLPHIN_CLOUD_API_URL', '')
    vi.stubEnv('DOLPHIN_CLOUD_CLIENT_ID', '')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('reports unconfigured when cloud sign-in is not set up', async () => {
    await expect(listDolphinProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'unconfigured'
    })
    expect(runWithFreshDolphinCloudSessionMock).not.toHaveBeenCalled()
  })

  it('returns the roster from the client', async () => {
    configureCloudEnv()
    runOperationDirectly()
    listDolphinCloudOrgMembersMock.mockResolvedValue(roster)

    await expect(listDolphinProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'ok',
      roster
    })
    expect(listDolphinCloudOrgMembersMock).toHaveBeenCalledWith(
      expect.any(Object),
      fakeSession,
      'org-1'
    )
  })

  it('maps a 409 already_member invite conflict', async () => {
    configureCloudEnv()
    runOperationDirectly()
    inviteDolphinCloudOrgMemberMock.mockRejectedValue(
      new DolphinCloudRequestError(409, 'already_member')
    )

    await expect(
      inviteDolphinProfileOrgMember(userDataPath, {
        orgId: 'org-1',
        email: 'a@b.com',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_member' })
  })

  it('maps a 403 role change to forbidden', async () => {
    configureCloudEnv()
    runOperationDirectly()
    changeDolphinCloudOrgMemberRoleMock.mockRejectedValue(new DolphinCloudRequestError(403))

    await expect(
      changeDolphinProfileOrgMemberRole(userDataPath, {
        orgId: 'org-1',
        userId: 'user-2',
        role: 'admin'
      })
    ).resolves.toEqual({ status: 'forbidden' })
  })

  it('maps a 400 cannot_remove_self to an invalid result', async () => {
    configureCloudEnv()
    runOperationDirectly()
    removeDolphinCloudOrgMemberMock.mockRejectedValue(
      new DolphinCloudRequestError(400, 'cannot_remove_self')
    )

    await expect(
      removeDolphinProfileOrgMember(userDataPath, { orgId: 'org-1', userId: 'user-1' })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_remove_self' })
  })

  it('maps a 404 revoke to not-found', async () => {
    configureCloudEnv()
    runOperationDirectly()
    revokeDolphinCloudOrgInviteMock.mockRejectedValue(new DolphinCloudRequestError(404))

    await expect(
      revokeDolphinProfileOrgInvite(userDataPath, { orgId: 'org-1', email: 'gone@b.com' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('reports reconnect-required when the session layer cannot refresh', async () => {
    configureCloudEnv()
    runWithFreshDolphinCloudSessionMock.mockResolvedValue({ status: 'reconnect-required' })

    await expect(listDolphinProfileOrgMembers(userDataPath, 'org-1')).resolves.toEqual({
      status: 'reconnect-required'
    })
  })
})

describe('Dolphin cloud org members service (dev auth)', () => {
  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-org-members-dev-'))
    runWithFreshDolphinCloudSessionMock.mockReset()
    vi.unstubAllEnvs()
    vi.stubEnv('DOLPHIN_CLOUD_DEV_AUTH', '1')
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('serves an in-memory roster the caller can manage', async () => {
    const result = await listDolphinProfileOrgMembers(userDataPath, 'dev-list-org')
    if (result.status !== 'ok') {
      throw new Error(`Expected ok, got ${result.status}`)
    }
    expect(result.roster.canManageMembers).toBe(true)
    expect(result.roster.viewerRole).toBe('owner')
    expect(result.roster.members[0]).toMatchObject({ role: 'owner' })
    expect(result.roster.members.some((member) => member.userId === null)).toBe(true)
    expect(result.roster.pendingInvites.length).toBeGreaterThan(0)
    expect(runWithFreshDolphinCloudSessionMock).not.toHaveBeenCalled()
  })

  it('mutates the dev roster across invite and revoke', async () => {
    const orgId = 'dev-mutate-org'
    await expect(
      inviteDolphinProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@dolphin.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'ok' })

    const afterInvite = await listDolphinProfileOrgMembers(userDataPath, orgId)
    if (afterInvite.status !== 'ok') {
      throw new Error('expected ok')
    }
    expect(afterInvite.roster.pendingInvites.some((i) => i.email === 'fresh@dolphin.local')).toBe(
      true
    )

    await expect(
      inviteDolphinProfileOrgMember(userDataPath, {
        orgId,
        email: 'fresh@dolphin.local',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'conflict', reason: 'already_invited' })

    await expect(
      revokeDolphinProfileOrgInvite(userDataPath, { orgId, email: 'fresh@dolphin.local' })
    ).resolves.toEqual({ status: 'ok' })
    await expect(
      revokeDolphinProfileOrgInvite(userDataPath, { orgId, email: 'fresh@dolphin.local' })
    ).resolves.toEqual({ status: 'not-found' })
  })

  it('blocks changing the dev owner (self) role', async () => {
    const orgId = 'dev-self-org'
    const list = await listDolphinProfileOrgMembers(userDataPath, orgId)
    if (list.status !== 'ok') {
      throw new Error('expected ok')
    }
    const self = list.roster.members.find((member) => member.role === 'owner')
    await expect(
      changeDolphinProfileOrgMemberRole(userDataPath, {
        orgId,
        userId: self?.userId ?? 'dev-user',
        role: 'member'
      })
    ).resolves.toEqual({ status: 'invalid', reason: 'cannot_change_own_role' })
  })
})
