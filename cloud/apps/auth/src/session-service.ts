import { randomUUID } from 'node:crypto'
import type { AuthConfig } from './config.js'
import { hashToken, randomToken } from './secrets.js'
import type { AuthStore, UserRow } from './store.js'

export type CloudIdentity = {
  cloudProfileId: string
  userId: string
  email: string
  displayName?: string
  activeOrgId: string
  activeOrgName: string
}

/** Every user gets one personal org; the relay binds `org` to it, so it must be stable. */
export function identityFor(user: UserRow): CloudIdentity {
  return {
    cloudProfileId: `prof_${user.id}`,
    userId: user.id,
    email: user.email,
    ...(user.display_name ? { displayName: user.display_name } : {}),
    activeOrgId: `org_${user.id}`,
    activeOrgName: 'Personal'
  }
}

export function organizationsFor(identity: CloudIdentity) {
  return [{ orgId: identity.activeOrgId, name: identity.activeOrgName, role: 'Owner' }]
}

export function capabilitiesFor(config: AuthConfig, now: number) {
  return { flags: { ...config.capabilityFlags }, refreshedAt: now }
}

/** The session shape the desktop validates in profile-cloud-client.ts (times in epoch ms). */
export function issueSession(store: AuthStore, config: AuthConfig, user: UserRow, now = Date.now()) {
  const accessToken = randomToken('at')
  const refreshToken = randomToken('rt')
  const expiresAt = now + config.accessTokenTtlMs
  store.insertSession({
    id: randomUUID(),
    user_id: user.id,
    access_hash: hashToken(accessToken),
    refresh_hash: hashToken(refreshToken),
    access_expires_at: expiresAt,
    refresh_expires_at: now + config.refreshTokenTtlMs
  })
  const cloud = identityFor(user)
  return {
    accessToken,
    refreshToken,
    expiresAt,
    cloud,
    organizations: organizationsFor(cloud),
    capabilities: capabilitiesFor(config, now)
  }
}
