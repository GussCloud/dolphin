import { describe, expect, it } from 'vitest'
import {
  DOLPHIN_SESSION_ADDRESS_PREFIX,
  formatDolphinSessionAddress,
  isDolphinSessionId,
  parseDolphinSessionAddress
} from './dolphin-session-address'
import { testDolphinSessionId } from './dolphin-session-address-test-fixture'

const SESSION_ID = testDolphinSessionId('0b7e4c2a-5f1d-4e8a-9c3b-2d6f8a1e4b70')
const ADDRESS = `session:${SESSION_ID}`

describe('Dolphin session address', () => {
  it('addresses a Dolphin session id as session:<id> and parses the bare id back', () => {
    expect(DOLPHIN_SESSION_ADDRESS_PREFIX).toBe('session:')
    expect(formatDolphinSessionAddress(SESSION_ID)).toBe(ADDRESS)
    expect(parseDolphinSessionAddress(ADDRESS)).toBe(SESSION_ID)
    const parsed = parseDolphinSessionAddress(ADDRESS)
    expect(parsed && formatDolphinSessionAddress(parsed)).toBe(ADDRESS)
  })

  it('reads only the addressed spelling when parsing an address', () => {
    // A bare id is what the columns store, not an address.
    expect(parseDolphinSessionAddress(SESSION_ID)).toBeNull()
    expect(parseDolphinSessionAddress(null)).toBeNull()
    expect(parseDolphinSessionAddress(undefined)).toBeNull()
    expect(parseDolphinSessionAddress('')).toBeNull()
  })

  it.each([
    ['an unknown prefix', `pane:${SESSION_ID}`],
    ['the Run mailbox namespace', 'run:run_123'],
    ['the Dispatch mailbox namespace', 'dispatch:ctx_123'],
    ['an empty prefix', `:${SESSION_ID}`],
    ['an empty id', 'session:'],
    ['an id with a separator', `session:${SESSION_ID}:extra`],
    ['an id the session predicate rejects', 'session:short'],
    ['a terminal handle', 'term_4f2c9a']
  ])('refuses %s', (_label, value) => {
    expect(parseDolphinSessionAddress(value)).toBeNull()
  })

  it.each([
    ['a PTY terminal handle', 'term_4f2c9a1b-7d3e-4a5f-8b6c-9d0e1f2a3b4c'],
    ['a short PTY terminal handle', 'term_4f2c9a'],
    ['a structured-worker handle', 'structworker_4f2c9a1b-7d3e-4a5f-8b6c-9d0e1f2a3b4c']
  ])('never treats %s as a Dolphin session id', (_label, handle) => {
    // Handles share the session-id charset, so the session-record predicate alone would accept them.
    expect(isDolphinSessionId(handle)).toBe(false)
    expect(parseDolphinSessionAddress(`session:${handle}`)).toBeNull()
  })

  it('validates a Dolphin session id with the session-record predicate', () => {
    expect(isDolphinSessionId(SESSION_ID)).toBe(true)
    expect(isDolphinSessionId('has space in it')).toBe(false)
    expect(isDolphinSessionId('x'.repeat(129))).toBe(false)
  })
})
