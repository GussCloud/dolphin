import { describe, expect, it } from 'vitest'
import { findMacReleaseEnvProblems } from './verify-macos-release-env.mjs'

const signing = { CSC_LINK: 'base64', CSC_KEY_PASSWORD: 'secret' }
const apiKey = {
  APPLE_API_KEY: '/tmp/AuthKey_TEST.p8',
  APPLE_API_KEY_ID: 'TEST',
  APPLE_API_ISSUER: 'issuer'
}
const appleId = {
  APPLE_ID: 'dev@example.com',
  APPLE_APP_SPECIFIC_PASSWORD: 'app-password',
  APPLE_TEAM_ID: 'TEAM'
}
const fileExists = () => true

describe('findMacReleaseEnvProblems', () => {
  it('accepts signing plus App Store Connect API key notarization', () => {
    expect(findMacReleaseEnvProblems({ ...signing, ...apiKey }, fileExists)).toEqual([])
  })

  it('accepts signing plus Apple ID notarization', () => {
    expect(findMacReleaseEnvProblems({ ...signing, ...appleId }, fileExists)).toEqual([])
  })

  it('refuses a build with no notarization credentials at all', () => {
    expect(findMacReleaseEnvProblems(signing, fileExists)).toEqual([
      'APPLE_API_KEY is not set',
      'APPLE_API_KEY_ID is not set',
      'APPLE_API_ISSUER is not set'
    ])
  })

  it('refuses a partial Apple ID set instead of falling back to the API key', () => {
    expect(
      findMacReleaseEnvProblems({ ...signing, ...apiKey, APPLE_ID: 'dev@example.com' }, fileExists)
    ).toEqual(['APPLE_APP_SPECIFIC_PASSWORD is not set', 'APPLE_TEAM_ID is not set'])
  })

  it('refuses an API key that is a value rather than an existing file', () => {
    expect(findMacReleaseEnvProblems({ ...signing, ...apiKey }, () => false)).toEqual([
      'APPLE_API_KEY must be the path to an existing .p8 file'
    ])
  })

  it('refuses a build without the Developer ID certificate', () => {
    expect(findMacReleaseEnvProblems({ ...apiKey, CSC_LINK: ' ' }, fileExists)).toEqual([
      'CSC_LINK is not set',
      'CSC_KEY_PASSWORD is not set'
    ])
  })
})
