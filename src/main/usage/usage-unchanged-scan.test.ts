import { describe, expect, it } from 'vitest'
import { isUnchangedUsageScan } from './usage-unchanged-scan'

const a = { path: 'a' }
const b = { path: 'b' }

describe('isUnchangedUsageScan', () => {
  it('is true only when every cached entry was reused as-is, in order', () => {
    expect(
      isUnchangedUsageScan({ cached: [a, b], migrated: [a, b], processed: [a, b], parsedCount: 0 })
    ).toBe(true)
    expect(isUnchangedUsageScan({ cached: [], migrated: [], processed: [], parsedCount: 0 })).toBe(
      true
    )
  })

  it('is false after a parse, a deletion, a reorder or a key migration', () => {
    expect(
      isUnchangedUsageScan({ cached: [a], migrated: [a], processed: [a], parsedCount: 1 })
    ).toBe(false)
    expect(
      isUnchangedUsageScan({ cached: [a, b], migrated: [a, b], processed: [a], parsedCount: 0 })
    ).toBe(false)
    expect(
      isUnchangedUsageScan({ cached: [a, b], migrated: [a, b], processed: [b, a], parsedCount: 0 })
    ).toBe(false)
    const migratedA = { path: 'a' }
    expect(
      isUnchangedUsageScan({
        cached: [a],
        migrated: [migratedA],
        processed: [migratedA],
        parsedCount: 0
      })
    ).toBe(false)
  })
})
