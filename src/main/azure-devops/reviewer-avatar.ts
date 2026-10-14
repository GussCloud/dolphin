import type { AzureDevOpsReviewerAvatarResult } from '../../shared/azure-devops-pull-request-board'
import { getAzureBoardsOrganizationUrl } from '../azure-boards/azure-boards-scope'
import { resolveAzureDevOpsAuthHeaders } from './azure-devops-credential'

const AVATAR_TIMEOUT_MS = 15_000
const MAX_AVATAR_BYTES = 512 * 1024
const MAX_CACHED_AVATARS = 500

// Insertion order doubles as eviction order.
const avatarCache = new Map<string, string>()

/** @internal - exposed for tests only */
export function _resetAzureDevOpsReviewerAvatarCache(): void {
  avatarCache.clear()
}

// Why: the request carries the user's credentials, so only the org's own avatar endpoints qualify.
export function isAllowedAzureDevOpsAvatarUrl(url: string, organizationUrl: string): boolean {
  const org = organizationUrl.replace(/\/+$/, '')
  const underAvatarPath =
    url.startsWith(`${org}/_api/_common/identityImage`) ||
    url.startsWith(`${org}/_apis/GraphProfile/MemberAvatars/`)
  if (!underAvatarPath) {
    return false
  }
  try {
    return new URL(url).origin === new URL(org).origin
  } catch {
    return false
  }
}

function remember(url: string, dataUri: string): void {
  if (avatarCache.size >= MAX_CACHED_AVATARS) {
    const oldest = avatarCache.keys().next()
    if (!oldest.done) {
      avatarCache.delete(oldest.value)
    }
  }
  avatarCache.set(url, dataUri)
}

async function fetchAvatar(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: await resolveAzureDevOpsAuthHeaders(),
    // Why: the allowlist vets only this URL; a redirect would carry the token to an unvetted host.
    redirect: 'error',
    signal: AbortSignal.timeout(AVATAR_TIMEOUT_MS)
  })
  if (!response.ok) {
    await response.body?.cancel()
    throw new Error(`Avatar request failed: HTTP ${response.status}`)
  }
  // Why: a sign-in that no longer works ends in 200 with the login HTML; the content type tells it from an image.
  const contentType = (response.headers.get('content-type') ?? '').split(';')[0].trim()
  if (!contentType.startsWith('image/')) {
    await response.body?.cancel()
    throw new Error(`Avatar response is not an image (${contentType || 'unknown'}).`)
  }
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_AVATAR_BYTES) {
    await response.body?.cancel()
    throw new Error('Avatar is too large.')
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new Error('Avatar is too large.')
  }
  return `data:${contentType};base64,${bytes.toString('base64')}`
}

export async function getAzureDevOpsReviewerAvatar(
  url: unknown
): Promise<AzureDevOpsReviewerAvatarResult> {
  if (typeof url !== 'string' || !url) {
    return { ok: false, error: 'Invalid avatar URL.' }
  }
  try {
    const organizationUrl = await getAzureBoardsOrganizationUrl()
    if (!organizationUrl || !isAllowedAzureDevOpsAvatarUrl(url, organizationUrl)) {
      return { ok: false, error: 'Avatar URL is not an Azure DevOps avatar of this organization.' }
    }
    const hit = avatarCache.get(url)
    if (hit) {
      return { ok: true, dataUri: hit }
    }
    const dataUri = await fetchAvatar(url)
    remember(url, dataUri)
    return { ok: true, dataUri }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
