import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetAzureDevOpsReviewerAvatarCache,
  getAzureDevOpsReviewerAvatar,
  isAllowedAzureDevOpsAvatarUrl
} from './reviewer-avatar'

const mocks = vi.hoisted(() => ({ organizationUrl: vi.fn(), headers: vi.fn() }))

vi.mock('../azure-boards/azure-boards-scope', () => ({
  getAzureBoardsOrganizationUrl: mocks.organizationUrl
}))
vi.mock('./azure-devops-credential', () => ({ resolveAzureDevOpsAuthHeaders: mocks.headers }))

const ORG = 'https://dev.azure.com/evuptec'

describe('isAllowedAzureDevOpsAvatarUrl', () => {
  it.each([
    `${ORG}/_api/_common/identityImage?id=abc`,
    `${ORG}/_apis/GraphProfile/MemberAvatars/aad.xyz`
  ])('accepts %s', (url) => {
    expect(isAllowedAzureDevOpsAvatarUrl(url, ORG)).toBe(true)
    expect(isAllowedAzureDevOpsAvatarUrl(url, `${ORG}/`)).toBe(true)
  })

  it.each([
    'https://dev.azure.com/evuptec.evil.com/_api/_common/identityImage?id=1',
    'https://dev.azure.com/evuptecX/_api/_common/identityImage?id=1',
    'https://dev.azure.com/other/_api/_common/identityImage?id=1',
    'https://evil.com/https://dev.azure.com/evuptec/_api/_common/identityImage',
    `${ORG}/_apis/GraphProfile/MemberAvatars`,
    `${ORG}/_apis/git/pullrequests`,
    `${ORG}@evil.com/_api/_common/identityImage`,
    'file:///etc/passwd',
    ''
  ])('rejects %s', (url) => {
    expect(isAllowedAzureDevOpsAvatarUrl(url, ORG)).toBe(false)
  })
})

describe('getAzureDevOpsReviewerAvatar', () => {
  const fetchMock = vi.fn()
  const url = `${ORG}/_api/_common/identityImage?id=1`

  beforeEach(() => {
    _resetAzureDevOpsReviewerAvatarCache()
    mocks.organizationUrl.mockReset().mockResolvedValue(ORG)
    mocks.headers.mockReset().mockResolvedValue({ Authorization: 'Bearer t' })
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('rejects a foreign URL without sending a request', async () => {
    const result = await getAzureDevOpsReviewerAvatar(
      'https://dev.azure.com/evuptec.evil.com/_api/_common/identityImage'
    )
    expect(result.ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns a data URI and caches it', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png; x=1' } })
    )
    expect(await getAzureDevOpsReviewerAvatar(url)).toEqual({
      ok: true,
      dataUri: 'data:image/png;base64,AQID'
    })
    await getAzureDevOpsReviewerAvatar(url)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects non-image content', async () => {
    fetchMock.mockResolvedValue(
      new Response('<html>', { headers: { 'content-type': 'text/html' } })
    )
    expect((await getAzureDevOpsReviewerAvatar(url)).ok).toBe(false)
  })

  it('rejects an oversized image', async () => {
    fetchMock.mockResolvedValue(
      new Response(new Uint8Array(600 * 1024), { headers: { 'content-type': 'image/png' } })
    )
    expect((await getAzureDevOpsReviewerAvatar(url)).ok).toBe(false)
  })

  it('rejects a non-string argument', async () => {
    expect((await getAzureDevOpsReviewerAvatar(42)).ok).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
