import { describe, expect, it } from 'vitest'
import {
  parseWslConfigDocument,
  readWslConfigValue,
  serializeWslConfigDocument,
  setWslConfigValue
} from './wslconfig-ini-document'

describe('wslconfig ini document', () => {
  it('reads keys case-insensitively and ignores trailing comments', () => {
    const document = parseWslConfigDocument('[WSL2]\nMemory = 8GB # cap\nswap=0\n')
    expect(readWslConfigValue(document, 'wsl2', 'memory')).toBe('8GB')
    expect(readWslConfigValue(document, 'wsl2', 'processors')).toBeNull()
    expect(readWslConfigValue(document, 'experimental', 'memory')).toBeNull()
  })

  it('replaces the last duplicate in place and keeps comments and CRLF', () => {
    const text = '# mine\r\n[wsl2]\r\nmemory=4GB\r\nmemory=40GB\r\n\r\n[boot]\r\nsystemd=true\r\n'
    const next = setWslConfigValue(parseWslConfigDocument(text), 'wsl2', 'memory', '16GB')
    expect(serializeWslConfigDocument(next)).toBe(
      '# mine\r\n[wsl2]\r\nmemory=4GB\r\nmemory=16GB\r\n\r\n[boot]\r\nsystemd=true\r\n'
    )
  })

  it('inserts a missing key at the end of its section, before the blank separator', () => {
    const text = '[experimental]\nsparseVhd=true\n\n[wsl2]\nmemory=8GB\n'
    const next = setWslConfigValue(
      parseWslConfigDocument(text),
      'experimental',
      'autoMemoryReclaim',
      'gradual'
    )
    expect(serializeWslConfigDocument(next)).toBe(
      '[experimental]\nsparseVhd=true\nautoMemoryReclaim=gradual\n\n[wsl2]\nmemory=8GB\n'
    )
  })

  it('appends a missing section after existing content', () => {
    const next = setWslConfigValue(
      parseWslConfigDocument('[wsl2]\nmemory=8GB'),
      'experimental',
      'sparseVhd',
      'true'
    )
    expect(serializeWslConfigDocument(next)).toBe(
      '[wsl2]\nmemory=8GB\n\n[experimental]\nsparseVhd=true\n'
    )
  })

  it('creates a file from an empty document', () => {
    const next = setWslConfigValue(parseWslConfigDocument(''), 'experimental', 'sparseVhd', 'true')
    expect(serializeWslConfigDocument(next)).toBe('[experimental]\nsparseVhd=true\n')
  })
})
