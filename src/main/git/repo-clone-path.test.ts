import { describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  deriveCloneRepoNameFromUrl,
  deriveValidatedClonePath,
  getClonePathComparisonKey
} from './repo-clone-path'

describe('repo clone path helpers', () => {
  it('allows safe repository names that start with two dots', async () => {
    const destination = await mkdtemp(join(tmpdir(), 'dolphin-clone-path-'))
    try {
      expect(
        deriveValidatedClonePath({
          url: 'https://example.com/..repo.git',
          destination
        })
      ).toBe(join(destination, '..repo'))
    } finally {
      await rm(destination, { recursive: true, force: true })
    }
  })

  it('decodes percent-encoded repository names from remote URLs', () => {
    expect(
      deriveCloneRepoNameFromUrl('https://dev.azure.com/org/EVUP%20-%20ELOS/_git/EVUP%20-%20ELOS')
    ).toBe('EVUP - ELOS')
    expect(
      deriveCloneRepoNameFromUrl(
        'https://org@dev.azure.com/org/EVUP%20-%20ELOS/_git/EVUP%20-%20ELOS'
      )
    ).toBe('EVUP - ELOS')
    expect(
      deriveCloneRepoNameFromUrl('git@ssh.dev.azure.com:v3/org/EVUP%20-%20ELOS/EVUP%20-%20ELOS')
    ).toBe('EVUP - ELOS')
    expect(deriveCloneRepoNameFromUrl('https://example.com/bad%E0%A4%A.git')).toBe('bad%E0%A4%A')
  })

  it('keeps literal percent sequences in local path sources', () => {
    expect(deriveCloneRepoNameFromUrl('/srv/git/EVUP%20-%20ELOS')).toBe('EVUP%20-%20ELOS')
    expect(deriveCloneRepoNameFromUrl('C:\\git\\EVUP%20-%20ELOS')).toBe('EVUP%20-%20ELOS')
  })

  it('rejects encoded separators and dot segments after decoding', () => {
    expect(() => deriveCloneRepoNameFromUrl('https://example.com/a%2Fb')).toThrow(
      'Invalid repository name derived from URL'
    )
    expect(() => deriveCloneRepoNameFromUrl('https://example.com/%2E%2E')).toThrow(
      'Invalid repository name derived from URL'
    )
  })

  it('rejects Windows-looking destinations on non-Windows hosts', async () => {
    if (process.platform === 'win32') {
      return
    }
    expect(() =>
      deriveValidatedClonePath({
        url: 'https://example.com/dolphin.git',
        destination: 'C:\\Users\\me\\src'
      })
    ).toThrow('Clone destination must be an absolute path')
    expect(() =>
      deriveValidatedClonePath({
        url: 'https://example.com/dolphin.git',
        destination: '\\\\server\\share'
      })
    ).toThrow('Clone destination must be an absolute path')
    expect(() =>
      deriveValidatedClonePath({
        url: 'https://example.com/dolphin.git',
        destination: '//server/share'
      })
    ).toThrow('Clone destination must be an absolute path')
    expect(() =>
      deriveValidatedClonePath({
        url: 'https://example.com/dolphin.git',
        destination: '//wsl.localhost/Ubuntu/home/me'
      })
    ).toThrow('Clone destination must be an absolute path')
  })

  it('canonicalizes WSL UNC server aliases without folding Linux path casing', () => {
    expect(getClonePathComparisonKey('\\\\wsl.localhost\\Ubuntu\\home\\User\\repo')).toBe(
      getClonePathComparisonKey('\\\\wsl$\\ubuntu\\home\\User\\repo')
    )
    expect(getClonePathComparisonKey('\\\\wsl.localhost\\Ubuntu\\home\\User\\repo\\')).toBe(
      getClonePathComparisonKey('\\\\wsl$\\ubuntu\\home\\User\\repo')
    )
    expect(getClonePathComparisonKey('\\\\wsl.localhost\\Ubuntu\\home\\User\\repo')).not.toBe(
      getClonePathComparisonKey('\\\\wsl$\\ubuntu\\home\\user\\repo')
    )
  })
})
