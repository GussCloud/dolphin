import { describe, expect, it } from 'vitest'

import {
  emptyDolphindActivationRecord,
  dolphindGcPinnedDirNames,
  parseDolphindActivationRecord,
  serializeDolphindActivationRecord,
  withActivatedVersion,
  withRolledBackVersion,
  type DolphindStateSnapshot
} from './dolphind-activation-record'

const SNAPSHOT: DolphindStateSnapshot = {
  dirName: 'pre-0.2.0+bb01-1000',
  takenBeforeVersion: '0.2.0+bb01',
  readableByVersion: '0.1.0+aa01',
  takenAt: '2026-01-01T00:00:00.000Z'
}
const NOW = new Date('2026-01-02T00:00:00.000Z')

describe('dolphind activation record', () => {
  it('round-trips through the host', () => {
    const record = withActivatedVersion(
      { ...emptyDolphindActivationRecord(), active: '0.1.0+aa01' },
      '0.2.0+bb01',
      SNAPSHOT,
      NOW
    )
    const parsed = parseDolphindActivationRecord(serializeDolphindActivationRecord(record))
    expect(parsed).toEqual({ state: 'ok', record })
  })

  it('reports an absent record as absent', () => {
    expect(parseDolphindActivationRecord(null)).toEqual({ state: 'absent' })
    expect(parseDolphindActivationRecord('   ')).toEqual({ state: 'absent' })
  })

  it('reports a newer schema as unreadable, never as absent', () => {
    const parsed = parseDolphindActivationRecord(JSON.stringify({ schemaVersion: 2, active: 'x' }))
    expect(parsed.state).toBe('unreadable')
  })

  it('reports corrupt JSON as unreadable, never as absent', () => {
    expect(parseDolphindActivationRecord('{not json').state).toBe('unreadable')
  })

  it('names the outgoing version as the rollback target', () => {
    const record = withActivatedVersion(
      { ...emptyDolphindActivationRecord(), active: '0.1.0+aa01' },
      '0.2.0+bb01',
      SNAPSHOT,
      NOW
    )
    expect(record).toMatchObject({ active: '0.2.0+bb01', previous: '0.1.0+aa01' })
  })

  it('does not let a re-deploy of the active version erase the rollback target', () => {
    const before = {
      ...emptyDolphindActivationRecord(),
      active: '0.2.0+bb01',
      previous: '0.1.0+aa01',
      snapshot: SNAPSHOT
    }
    const after = withActivatedVersion(before, '0.2.0+bb01', null, NOW)
    expect(after).toMatchObject({ active: '0.2.0+bb01', previous: '0.1.0+aa01' })
    expect(after.snapshot).toEqual(SNAPSHOT)
  })

  it('clears the rollback target after rolling back, so it cannot walk into the bad build', () => {
    const before = {
      ...emptyDolphindActivationRecord(),
      active: '0.2.0+bb01',
      previous: '0.1.0+aa01',
      snapshot: SNAPSHOT
    }
    expect(withRolledBackVersion(before, NOW)).toMatchObject({
      active: '0.1.0+aa01',
      previous: null,
      snapshot: null
    })
  })

  it('pins the active version, the rollback target and the live daemon"s bundle against GC', () => {
    const pinned = dolphindGcPinnedDirNames(
      {
        ...emptyDolphindActivationRecord(),
        active: '0.3.0+cc01',
        previous: '0.2.0+bb01'
      },
      '0.1.0+aa01'
    )
    expect(pinned).toEqual(['dolphind-0.3.0+cc01', 'dolphind-0.2.0+bb01', 'dolphind-0.1.0+aa01'])
  })

  it('deduplicates pins when the live daemon came from the active bundle', () => {
    const pinned = dolphindGcPinnedDirNames(
      { ...emptyDolphindActivationRecord(), active: '0.3.0+cc01', previous: null },
      '0.3.0+cc01'
    )
    expect(pinned).toEqual(['dolphind-0.3.0+cc01'])
  })
})
