import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  handlers,
  listDolphinProfileOrgMembersMock,
  inviteDolphinProfileOrgMemberMock,
  revokeDolphinProfileOrgInviteMock,
  changeDolphinProfileOrgMemberRoleMock,
  removeDolphinProfileOrgMemberMock
} = vi.hoisted(() => ({
  handlers: new Map<string, (_event: unknown, args?: unknown) => unknown>(),
  listDolphinProfileOrgMembersMock: vi.fn(),
  inviteDolphinProfileOrgMemberMock: vi.fn(),
  revokeDolphinProfileOrgInviteMock: vi.fn(),
  changeDolphinProfileOrgMemberRoleMock: vi.fn(),
  removeDolphinProfileOrgMemberMock: vi.fn()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (_event: unknown, args?: unknown) => unknown) => {
      handlers.set(channel, handler)
    })
  }
}))

vi.mock('../dolphin-profiles/profile-storage-paths', () => ({
  getProfileUserDataPath: () => '/tmp/dolphin-user-data'
}))

vi.mock('../dolphin-profiles/profile-cloud-org-members-service', () => ({
  listDolphinProfileOrgMembers: listDolphinProfileOrgMembersMock,
  inviteDolphinProfileOrgMember: inviteDolphinProfileOrgMemberMock,
  revokeDolphinProfileOrgInvite: revokeDolphinProfileOrgInviteMock,
  changeDolphinProfileOrgMemberRole: changeDolphinProfileOrgMemberRoleMock,
  removeDolphinProfileOrgMember: removeDolphinProfileOrgMemberMock
}))

import { registerDolphinProfileOrgMemberHandlers } from './dolphin-profile-org-members-handlers'

function invoke(channel: string, args?: unknown): unknown {
  const handler = handlers.get(channel)
  if (!handler) {
    throw new Error(`No handler for ${channel}`)
  }
  return handler({}, args)
}

describe('registerDolphinProfileOrgMemberHandlers', () => {
  beforeEach(() => {
    handlers.clear()
    listDolphinProfileOrgMembersMock.mockReset().mockResolvedValue({ status: 'ok', roster: {} })
    inviteDolphinProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    revokeDolphinProfileOrgInviteMock.mockReset().mockResolvedValue({ status: 'ok' })
    changeDolphinProfileOrgMemberRoleMock.mockReset().mockResolvedValue({ status: 'ok' })
    removeDolphinProfileOrgMemberMock.mockReset().mockResolvedValue({ status: 'ok' })
    registerDolphinProfileOrgMemberHandlers()
  })

  it('registers all five org-member channels', () => {
    expect([...handlers.keys()].sort()).toEqual(
      [
        'dolphinProfiles:orgInviteRevoke',
        'dolphinProfiles:orgMemberChangeRole',
        'dolphinProfiles:orgMemberInvite',
        'dolphinProfiles:orgMemberRemove',
        'dolphinProfiles:orgMembersList'
      ].sort()
    )
  })

  it('forwards a valid invite to the service with a trimmed email', async () => {
    await invoke('dolphinProfiles:orgMemberInvite', {
      orgId: 'org-1',
      email: '  new@example.com  ',
      role: 'admin'
    })
    expect(inviteDolphinProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/dolphin-user-data', {
      orgId: 'org-1',
      email: 'new@example.com',
      role: 'admin'
    })
  })

  it('rejects an invite with a missing org id', async () => {
    await expect(
      invoke('dolphinProfiles:orgMemberInvite', { email: 'a@b.com', role: 'member' })
    ).rejects.toThrow('invalid_dolphin_profile_org_selection')
    expect(inviteDolphinProfileOrgMemberMock).not.toHaveBeenCalled()
  })

  it('rejects an invite with an unknown role', async () => {
    await expect(
      invoke('dolphinProfiles:orgMemberInvite', { orgId: 'org-1', email: 'a@b.com', role: 'root' })
    ).rejects.toThrow('invalid_dolphin_org_role')
  })

  it('rejects a role change with a blank user id', async () => {
    await expect(
      invoke('dolphinProfiles:orgMemberChangeRole', { orgId: 'org-1', userId: '  ', role: 'admin' })
    ).rejects.toThrow('invalid_dolphin_org_member_user')
  })

  it('forwards remove and revoke with validated args', async () => {
    await invoke('dolphinProfiles:orgMemberRemove', { orgId: 'org-1', userId: 'user-2' })
    expect(removeDolphinProfileOrgMemberMock).toHaveBeenCalledWith('/tmp/dolphin-user-data', {
      orgId: 'org-1',
      userId: 'user-2'
    })
    await invoke('dolphinProfiles:orgInviteRevoke', { orgId: 'org-1', email: 'gone@b.com' })
    expect(revokeDolphinProfileOrgInviteMock).toHaveBeenCalledWith('/tmp/dolphin-user-data', {
      orgId: 'org-1',
      email: 'gone@b.com'
    })
  })
})
