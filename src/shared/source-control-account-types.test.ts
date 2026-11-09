import { describe, expect, it } from 'vitest'
import { MAX_COMMIT_AUTHORS, normalizeCommitAuthors } from './source-control-account-types'

describe('normalizeCommitAuthors', () => {
  it('keeps valid authors in order, trimmed and de-duplicated by name and email case', () => {
    expect(
      normalizeCommitAuthors([
        { name: ' Dev ', email: ' dev@example.test ' },
        { name: 'Dev', email: 'DEV@example.test' },
        { name: 'Ops', email: 'ops@example.test' }
      ])
    ).toEqual([
      { name: 'Dev', email: 'dev@example.test' },
      { name: 'Ops', email: 'ops@example.test' }
    ])
  })

  it('drops entries that would forge git config or are not authors', () => {
    expect(
      normalizeCommitAuthors([
        { name: 'Dev\n[core]', email: 'dev@example.test' },
        { name: 'Dev', email: 'not-an-email' },
        'Dev <dev@example.test>',
        null
      ])
    ).toEqual([])
    expect(normalizeCommitAuthors('nope')).toEqual([])
  })

  it('bounds the list', () => {
    const many = Array.from({ length: MAX_COMMIT_AUTHORS + 5 }, (_, index) => ({
      name: `Dev ${index}`,
      email: `dev${index}@example.test`
    }))
    expect(normalizeCommitAuthors(many)).toHaveLength(MAX_COMMIT_AUTHORS)
  })
})
