import { describe, expect, it } from 'vitest'
import { createIosBuildRecord, reusableIosBuild } from './ios-beta-build-record.mjs'

const SHA = 'a'.repeat(40)
const record = (overrides = {}) =>
  JSON.stringify({ version: '0.0.66', buildNumber: '7', sha: SHA, ...overrides })

describe('createIosBuildRecord', () => {
  it('keeps a well-formed record', () => {
    expect(createIosBuildRecord({ version: '0.0.66', buildNumber: '7', sha: SHA })).toEqual({
      version: '0.0.66',
      buildNumber: '7',
      sha: SHA
    })
  })

  it.each([
    [{ version: '0.0.66-rc.1' }, /X\.Y\.Z/],
    [{ buildNumber: '' }, /build number/],
    [{ buildNumber: '0' }, /build number/],
    [{ sha: 'abc123' }, /full commit sha/]
  ])('refuses %j', (overrides, message) => {
    expect(() =>
      createIosBuildRecord({ version: '0.0.66', buildNumber: '7', sha: SHA, ...overrides })
    ).toThrow(message)
  })
})

describe('reusableIosBuild', () => {
  const wanted = { version: '0.0.66', sha: SHA }

  it('reuses the build recorded for this version and commit', () => {
    expect(reusableIosBuild(record(), wanted)).toEqual({ buildNumber: '7' })
  })

  it('does not reuse a build of another commit', () => {
    expect(reusableIosBuild(record({ sha: 'b'.repeat(40) }), wanted).reason).toMatch(/commit/)
  })

  it('does not reuse a build of another version', () => {
    expect(reusableIosBuild(record({ version: '0.0.65' }), wanted).reason).toMatch(/0\.0\.65/)
  })

  it('does not reuse a record it cannot read', () => {
    expect(reusableIosBuild('not json', wanted).reason).toMatch(/unreadable/)
    expect(reusableIosBuild(record({ buildNumber: 'seven' }), wanted).reason).toMatch(/unreadable/)
  })
})
