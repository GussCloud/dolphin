import { authorizationHeader, type AzureDevOpsFetch, type AzureDevOpsTokenKind } from './azure-devops-verifier.js'

const TIMEOUT_MS = 5_000
export const MAX_AVATAR_BYTES = 256 * 1024
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Subject descriptors look like `aad.<base64url>` / `msa.<…>`; anything else never reaches a URL.
const DESCRIPTOR = /^[a-z]{2,8}\.[A-Za-z0-9_\-=]{1,512}$/

// Raster formats only: an SVG served from the console's origin could run script when opened directly.
const SIGNATURES: [string, number[]][] = [
  ['image/png', [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]],
  ['image/jpeg', [0xff, 0xd8, 0xff]],
  ['image/gif', [0x47, 0x49, 0x46, 0x38]]
]

/** The image type from its first bytes, or null when it is not a PNG, JPEG, GIF or WebP. */
export function sniffImageType(bytes: Uint8Array): string | null {
  for (const [type, magic] of SIGNATURES) {
    if (magic.every((b, i) => bytes[i] === b)) {
      return type
    }
  }
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.subarray(from, to))
  return bytes.length > 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP' ? 'image/webp' : null
}

// Graph `byte[]` serializes as base64; an array of numbers is accepted too.
function bytesFromValue(value: unknown): Uint8Array | null {
  if (typeof value === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(value)) {
    return new Uint8Array(Buffer.from(value, 'base64'))
  }
  if (Array.isArray(value) && value.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return Uint8Array.from(value)
  }
  return null
}

export type AvatarFetchResult = { status: 'ok'; image: Uint8Array; type: string } | { status: 'failed'; reason: string }

/**
 * The signed-in user's Azure DevOps picture via Graph: identity id → subject descriptor → avatar.
 * https://learn.microsoft.com/en-us/rest/api/azure/devops/graph/avatars/get (scope vso.graph).
 */
export async function fetchAzureDevOpsAvatar(args: {
  organizationName: string
  identityId: string
  token: string
  tokenKind: AzureDevOpsTokenKind
  fetchImpl?: AzureDevOpsFetch
}): Promise<AvatarFetchResult> {
  if (!UUID.test(args.identityId)) {
    return { status: 'failed', reason: 'identity' }
  }
  const fetchImpl = args.fetchImpl ?? fetch
  const base = `https://vssps.dev.azure.com/${encodeURIComponent(args.organizationName)}/_apis/graph`
  const get = async (url: string): Promise<Response | null> => {
    try {
      const res = await fetchImpl(url, {
        headers: { accept: 'application/json', authorization: authorizationHeader(args.token, args.tokenKind) },
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })
      return res.ok ? res : null
    } catch {
      return null
    }
  }
  const descriptorRes = await get(`${base}/descriptors/${args.identityId}?api-version=7.1`)
  const descriptor: unknown = descriptorRes ? Reflect.get((await descriptorRes.json().catch(() => ({}))) ?? {}, 'value') : undefined
  if (typeof descriptor !== 'string' || !DESCRIPTOR.test(descriptor)) {
    return { status: 'failed', reason: descriptorRes ? 'descriptor-shape' : 'descriptor-request' }
  }
  const avatarRes = await get(`${base}/Subjects/${encodeURIComponent(descriptor)}/avatars?size=large&api-version=7.1`)
  if (!avatarRes) {
    return { status: 'failed', reason: 'avatar-request' }
  }
  // Why check first: base64 JSON is ~4/3 of the image, so anything far past that is not a profile picture.
  if (Number(avatarRes.headers.get('content-length') ?? 0) > MAX_AVATAR_BYTES * 2) {
    return { status: 'failed', reason: 'avatar-size' }
  }
  const contentType = avatarRes.headers.get('content-type') ?? ''
  let image: Uint8Array | null
  if (contentType.startsWith('image/')) {
    image = new Uint8Array(await avatarRes.arrayBuffer())
  } else {
    const body: unknown = await avatarRes.json().catch(() => null)
    image = body && typeof body === 'object' ? bytesFromValue(Reflect.get(body, 'value')) : null
  }
  if (!image || image.length === 0 || image.length > MAX_AVATAR_BYTES) {
    return { status: 'failed', reason: image ? 'avatar-size' : 'avatar-shape' }
  }
  const type = sniffImageType(image)
  return type ? { status: 'ok', image, type } : { status: 'failed', reason: 'avatar-type' }
}

export type AvatarCapture = (args: {
  userId: string
  organizationName: string
  identityId: string
  token: string
  tokenKind: AzureDevOpsTokenKind
}) => Promise<void>

/** Fetches and stores the picture after sign-in; failures only log, so sign-in never waits on or fails for it. */
export function createAvatarCapture(deps: {
  save: (userId: string, image: Uint8Array, type: string) => void
  fetchImpl?: AzureDevOpsFetch
  log?: (line: string) => void
}): AvatarCapture {
  const log = deps.log ?? ((line: string) => console.log(`[avatar] ${line}`))
  return async (args) => {
    const result = await fetchAzureDevOpsAvatar({ ...args, ...(deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {}) })
    if (result.status === 'ok') {
      deps.save(args.userId, result.image, result.type)
    } else {
      log(`azure-devops capture skipped user=${args.userId} reason=${result.reason}`)
    }
  }
}
