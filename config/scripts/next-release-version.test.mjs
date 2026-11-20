import { describe, expect, it } from 'vitest'
import {
  androidVersionCode,
  bumpVersion,
  latestRcTag,
  nextBetaVersion,
  promotedVersionFromRcTag,
  rcTagsOfLine,
  resolveRelease
} from './next-release-version.mjs'

const published = (tag_name, extra = {}) => ({ tag_name, draft: false, ...extra })

describe('bumpVersion', () => {
  it('bumps each level and resets lower ones', () => {
    expect(bumpVersion('0.2.55', 'patch')).toBe('0.2.56')
    expect(bumpVersion('0.2.55', 'minor')).toBe('0.3.0')
    expect(bumpVersion('0.2.55', 'major')).toBe('1.0.0')
    expect(() => bumpVersion('0.2.55', 'huge')).toThrow(/bump/)
  })
})

describe('nextBetaVersion', () => {
  it('starts a new line at rc.1 and continues an existing one', () => {
    expect(nextBetaVersion({ latestStable: '0.2.55', rcTags: [] }).version).toBe('0.2.56-rc.1')
    const rcTags = rcTagsOfLine(['v0.2.56-rc.1', 'v0.2.56-rc.3', 'v0.2.55'], '')
    expect(nextBetaVersion({ latestStable: '0.2.55', rcTags }).version).toBe('0.2.56-rc.4')
  })

  it('counts rc numbers that only git history still records', () => {
    const version = nextBetaVersion({
      latestStable: '0.2.55',
      rcTags: [],
      gitHighestRc: (base) => (base === '0.2.56' ? 5 : null)
    }).version
    expect(version).toBe('0.2.56-rc.6')
  })

  it('keeps the rc stream monotonic when a higher line is still open', () => {
    const rcTags = rcTagsOfLine(['v0.3.0-rc.1'], '')
    expect(nextBetaVersion({ latestStable: '0.2.55', bump: 'patch', rcTags }).version).toBe(
      '0.3.0-rc.2'
    )
  })

  it('ignores rc lines a stable release already shipped', () => {
    const rcTags = rcTagsOfLine(['v0.2.55-rc.4'], '')
    expect(nextBetaVersion({ latestStable: '0.2.55', rcTags }).version).toBe('0.2.56-rc.1')
  })
})

describe('promotion', () => {
  it('maps an rc tag to its stable version', () => {
    expect(promotedVersionFromRcTag('v0.2.56-rc.2', '')).toBe('0.2.56')
    expect(promotedVersionFromRcTag('mobile-android-v0.0.66-rc.1', 'mobile-android-')).toBe(
      '0.0.66'
    )
    expect(() => promotedVersionFromRcTag('v0.2.56', '')).toThrow(/rc tag/)
  })

  it('picks the newest published rc of a line', () => {
    const releases = [
      published('v0.2.56-rc.2'),
      published('v0.2.56-rc.10'),
      { tag_name: 'v0.2.57-rc.1', draft: true },
      published('mobile-android-v0.0.66-rc.1')
    ]
    expect(latestRcTag(releases, '')).toBe('v0.2.56-rc.10')
    expect(latestRcTag(releases, 'mobile-android-')).toBe('mobile-android-v0.0.66-rc.1')
  })
})

describe('androidVersionCode', () => {
  it('rises with semver and ranks a stable above its rcs', () => {
    const order = ['0.0.66-rc.1', '0.0.66-rc.2', '0.0.66', '0.0.67-rc.1', '0.1.0-rc.1', '1.0.0']
    const codes = order.map(androidVersionCode)
    expect([...codes].sort((a, b) => a - b)).toEqual(codes)
    expect(new Set(codes).size).toBe(codes.length)
    expect(androidVersionCode('0.0.66-rc.1')).toBe(6601)
    expect(androidVersionCode('0.0.66')).toBe(6699)
    expect(androidVersionCode('209.99.999')).toBeLessThanOrEqual(2_100_000_000)
  })

  it('refuses versions outside the layout', () => {
    expect(() => androidVersionCode('0.100.0')).toThrow(/layout/)
    expect(() => androidVersionCode('0.0.1-rc.99')).toThrow(/layout/)
    expect(() => androidVersionCode('0.0.1-beta.1')).toThrow(/Cannot/)
  })
})

describe('resolveRelease', () => {
  const releases = [
    published('v0.2.55'),
    published('v0.2.54'),
    published('mobile-android-v0.0.65'),
    published('mobile-android-latest')
  ]

  it('computes desktop and mobile betas', () => {
    expect(resolveRelease({ line: 'desktop', bump: 'patch', releases })).toEqual({
      version: '0.2.56-rc.1',
      tag: 'v0.2.56-rc.1',
      rc_tag: '',
      prerelease: 'true'
    })
    expect(
      resolveRelease({ line: 'mobile', bump: 'minor', releases, mobileAppVersion: '0.0.65' })
    ).toEqual({
      version: '0.1.0-rc.1',
      tag: 'mobile-android-v0.1.0-rc.1',
      rc_tag: '',
      prerelease: 'true',
      marketing_version: '0.1.0',
      android_version_code: '100001'
    })
  })

  it('treats a failed run draft as a used rc number', () => {
    const withDraft = [...releases, { tag_name: 'v0.2.56-rc.1', draft: true }]
    expect(resolveRelease({ line: 'desktop', bump: 'patch', releases: withDraft }).tag).toBe(
      'v0.2.56-rc.2'
    )
  })

  it('promotes the latest rc to a stable that does not exist yet', () => {
    const withRc = [...releases, published('v0.2.56-rc.1'), published('v0.2.56-rc.2')]
    expect(resolveRelease({ line: 'desktop', promote: 'latest', releases: withRc })).toEqual({
      version: '0.2.56',
      tag: 'v0.2.56',
      rc_tag: 'v0.2.56-rc.2',
      prerelease: 'false'
    })
    const mobile = resolveRelease({
      line: 'mobile',
      promote: 'latest',
      releases: [...releases, published('mobile-android-v0.0.66-rc.1')]
    })
    expect(mobile).toMatchObject({ tag: 'mobile-android-v0.0.66', android_version_code: '6699' })
  })

  it('refuses to promote an unpublished, already released or outdated rc', () => {
    expect(() =>
      resolveRelease({
        line: 'desktop',
        promote: 'v0.2.56-rc.1',
        releases: [...releases, { tag_name: 'v0.2.56-rc.1', draft: true }]
      })
    ).toThrow(/not a published release/)
    expect(() =>
      resolveRelease({
        line: 'desktop',
        promote: 'v0.2.55-rc.1',
        releases: [...releases, published('v0.2.55-rc.1')]
      })
    ).toThrow(/not newer/)
    expect(() =>
      resolveRelease({
        line: 'desktop',
        promote: 'v0.2.54-rc.1',
        releases: [published('v0.2.55'), published('v0.2.54-rc.1')]
      })
    ).toThrow(/not newer/)
    expect(() => resolveRelease({ line: 'desktop', promote: 'latest', releases })).toThrow(
      /No published desktop rc/
    )
  })
})
