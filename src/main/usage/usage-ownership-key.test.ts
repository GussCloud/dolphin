import { describe, expect, it } from 'vitest'
import {
  compactLegacyUsageOwnershipKeys,
  isCompactUsageOwnershipKey,
  toUsageOwnershipKey
} from './usage-ownership-key'

describe('toUsageOwnershipKey', () => {
  it('maps raw keys to stable 16-char digests and is idempotent', () => {
    const key = toUsageOwnershipKey('msg_01ABC:req_011XYZ')
    expect(key).toHaveLength(16)
    expect(isCompactUsageOwnershipKey(key)).toBe(true)
    expect(toUsageOwnershipKey('msg_01ABC:req_011XYZ')).toBe(key)
    expect(toUsageOwnershipKey(key)).toBe(key)
    expect(toUsageOwnershipKey('msg_01ABC:req_011XYW')).not.toBe(key)
  })

  it('never treats a raw Claude or Codex key as already compact', () => {
    for (const raw of [
      'msg:msg_1',
      'uuid:abc',
      'a:b',
      '2026-05-26T12:00:00.000Z|1,0,0,0,1|1,0,0,0,1'
    ]) {
      expect(isCompactUsageOwnershipKey(raw)).toBe(false)
    }
  })
})

describe('compactLegacyUsageOwnershipKeys', () => {
  it('migrates raw keys once and leaves compact or empty lists alone', () => {
    const migrated = compactLegacyUsageOwnershipKeys(['a:1', 'a:2', 'a:1'])
    expect(migrated).toEqual([toUsageOwnershipKey('a:1'), toUsageOwnershipKey('a:2')])
    expect(compactLegacyUsageOwnershipKeys(migrated ?? [])).toBeNull()
    expect(compactLegacyUsageOwnershipKeys([])).toBeNull()
  })
})
