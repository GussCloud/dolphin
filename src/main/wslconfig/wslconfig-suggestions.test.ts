import { describe, expect, it } from 'vitest'
import { parseWslConfigDocument, serializeWslConfigDocument } from './wslconfig-ini-document'
import {
  applyWslConfigSuggestions,
  buildWslConfigSuggestions,
  parseWslMemorySize
} from './wslconfig-suggestions'

const GB = 1024 ** 3

describe('wslconfig suggestions', () => {
  it('parses WSL size strings', () => {
    expect(parseWslMemorySize('8GB')).toBe(8 * GB)
    expect(parseWslMemorySize('4g')).toBe(4 * GB)
    expect(parseWslMemorySize('512MB')).toBe(512 * 1024 ** 2)
    expect(parseWslMemorySize('lots')).toBeNull()
  })

  it('suggests memory reclaim and sparse disks for a missing file, without capping memory', () => {
    const suggestions = buildWslConfigSuggestions(parseWslConfigDocument(''), 32 * GB)
    expect(suggestions.map((suggestion) => suggestion.id)).toEqual([
      'auto-memory-reclaim',
      'sparse-vhd'
    ])
  })

  it('respects explicit values in either section, including disabled', () => {
    const document = parseWslConfigDocument(
      '[wsl2]\nautoMemoryReclaim=disabled\n[experimental]\nsparseVhd=false\n'
    )
    expect(buildWslConfigSuggestions(document, 32 * GB)).toEqual([])
  })

  it('suggests half of RAM only when the memory cap exceeds three quarters of it', () => {
    const oversized = parseWslConfigDocument(
      '[wsl2]\nmemory=28GB\n[experimental]\nautoMemoryReclaim=gradual\nsparseVhd=true\n'
    )
    expect(buildWslConfigSuggestions(oversized, 32 * GB)).toEqual([
      {
        id: 'memory-cap',
        section: 'wsl2',
        key: 'memory',
        currentValue: '28GB',
        suggestedValue: '16GB'
      }
    ])
    const reasonable = parseWslConfigDocument(
      '[wsl2]\nmemory=12GB\n[experimental]\nautoMemoryReclaim=gradual\nsparseVhd=true\n'
    )
    expect(buildWslConfigSuggestions(reasonable, 32 * GB)).toEqual([])
  })

  it('applies only the requested suggestions', () => {
    const document = parseWslConfigDocument('')
    const suggestions = buildWslConfigSuggestions(document, 32 * GB)
    const result = applyWslConfigSuggestions(document, suggestions, ['sparse-vhd'])
    expect(result.appliedIds).toEqual(['sparse-vhd'])
    expect(serializeWslConfigDocument(result.document)).toBe('[experimental]\nsparseVhd=true\n')
  })
})
