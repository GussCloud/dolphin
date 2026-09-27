import { describe, expect, it } from 'vitest'
import { parseGcAgeDays, parseGcMaxBytes } from './storage-gc-args'

describe('parseGcAgeDays', () => {
  it('reads hours, days, and weeks', () => {
    expect(parseGcAgeDays('30d')).toBe(30)
    expect(parseGcAgeDays('12h')).toBe(0.5)
    expect(parseGcAgeDays('2w')).toBe(14)
  })

  it('rejects anything else', () => {
    expect(() => parseGcAgeDays('30')).toThrow(/--older-than/)
    expect(() => parseGcAgeDays('0d')).toThrow(/--older-than/)
  })
})

describe('parseGcMaxBytes', () => {
  it('reads byte sizes with binary units', () => {
    expect(parseGcMaxBytes('5GB')).toBe(5 * 1024 ** 3)
    expect(parseGcMaxBytes('500mb')).toBe(500 * 1024 ** 2)
    expect(parseGcMaxBytes('1024')).toBe(1024)
  })

  it('rejects anything else', () => {
    expect(() => parseGcMaxBytes('lots')).toThrow(/--max-size/)
  })
})
