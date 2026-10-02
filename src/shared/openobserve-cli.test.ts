import { describe, expect, it } from 'vitest'
import {
  normalizeOpenObserveBaseUrl,
  openObserveSignInCommand,
  parseOpenObserveSaveContextInput
} from './openobserve-cli'

describe('normalizeOpenObserveBaseUrl', () => {
  it.each([
    ['o2.example.com', 'https://o2.example.com'],
    ['  https://o2.example.com/// ', 'https://o2.example.com'],
    ['http://localhost:5080', 'http://localhost:5080'],
    ['https://example.com/openobserve/', 'https://example.com/openobserve']
  ])('normalizes %s', (input, expected) => {
    expect(normalizeOpenObserveBaseUrl(input)).toBe(expected)
  })

  it.each([
    '',
    'ftp://o2.example.com',
    'https://user:secret@o2.example.com',
    'https://o2.example.com/?org=x',
    'o2 example.com'
  ])('rejects %s', (input) => {
    expect(normalizeOpenObserveBaseUrl(input)).toBeNull()
  })
})

describe('parseOpenObserveSaveContextInput', () => {
  const valid = {
    name: 'prod',
    baseUrl: 'o2.example.com',
    org: 'acme',
    authScheme: 'basic' as const
  }

  it('trims and normalizes a valid preset', () => {
    expect(parseOpenObserveSaveContextInput({ ...valid, name: ' prod ', org: ' acme ' })).toEqual({
      ok: true,
      value: { name: 'prod', baseUrl: 'https://o2.example.com', org: 'acme', authScheme: 'basic' }
    })
  })

  it('names the first invalid field', () => {
    expect(parseOpenObserveSaveContextInput({ ...valid, name: '-x' })).toEqual({
      ok: false,
      field: 'name'
    })
    expect(parseOpenObserveSaveContextInput({ ...valid, baseUrl: 'mailto:x' })).toEqual({
      ok: false,
      field: 'baseUrl'
    })
    expect(parseOpenObserveSaveContextInput({ ...valid, org: '' })).toEqual({
      ok: false,
      field: 'org'
    })
  })
})

describe('openObserveSignInCommand', () => {
  it('uses the browser flow only for SSO sessions', () => {
    expect(openObserveSignInCommand('session')).toBe('openobserve-cli auth login --browser')
    expect(openObserveSignInCommand('token')).toBe('openobserve-cli auth login')
    expect(openObserveSignInCommand(null)).toBe('openobserve-cli auth login')
  })
})
