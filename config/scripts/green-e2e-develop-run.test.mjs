import { describe, expect, it } from 'vitest'
import { findGreenRun } from './green-e2e-develop-run.mjs'

const SHA = 'a'.repeat(40)
const OTHER = 'b'.repeat(40)
const run = (databaseId, conclusion = 'success') => ({
  databaseId,
  conclusion,
  url: `https://example.test/runs/${databaseId}`
})

describe('findGreenRun', () => {
  it('returns the run whose record names the commit', () => {
    const recorded = { 1: OTHER, 2: SHA }
    expect(findGreenRun(SHA, [run(1), run(2)], (r) => recorded[r.databaseId])).toEqual(run(2))
  })

  it('finds nothing when no run recorded the commit', () => {
    expect(findGreenRun(SHA, [run(1)], () => OTHER)).toBeNull()
    expect(findGreenRun(SHA, [], () => SHA)).toBeNull()
  })

  it('ignores a run that recorded nothing, such as a schedule that skipped the suite', () => {
    expect(findGreenRun(SHA, [run(1)], () => null)).toBeNull()
  })

  it('never trusts a run that did not succeed, whatever it recorded', () => {
    expect(findGreenRun(SHA, [run(1, 'failure'), run(2, 'cancelled')], () => SHA)).toBeNull()
  })

  it('refuses an abbreviated or missing commit', () => {
    expect(() => findGreenRun('abc123', [run(1)], () => 'abc123')).toThrow(/full commit sha/)
    expect(() => findGreenRun(undefined, [], () => null)).toThrow(/full commit sha/)
  })
})
