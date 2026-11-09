import { describe, expect, it } from 'vitest'
import { commitAuthorOptions, withCommitAuthor } from './commit-author-options'

const WORK = { name: 'Dev', email: 'dev@work.example' }
const HOME = { name: 'Dev', email: 'dev@home.example' }

describe('commitAuthorOptions', () => {
  it('lists saved authors first, then authors other projects use, without duplicates', () => {
    const options = commitAuthorOptions(
      [WORK],
      [{ name: 'Dev', email: 'DEV@work.example' }, HOME, null, undefined],
      null
    )
    expect(options.map((option) => option.label)).toEqual([
      'Dev <dev@work.example>',
      'Dev <dev@home.example>'
    ])
  })

  it('keeps the current pick offered even when nothing else lists it', () => {
    const options = commitAuthorOptions([], [], HOME)
    expect(options.map((option) => option.identity)).toEqual([HOME])
  })

  it('ignores malformed saved entries', () => {
    expect(commitAuthorOptions([{ name: 'x\ny', email: 'a@b' }, 'junk'], [], null)).toEqual([])
  })
})

describe('withCommitAuthor', () => {
  it('appends a new author and keeps an existing one once', () => {
    expect(withCommitAuthor([WORK], HOME)).toEqual([WORK, HOME])
    expect(withCommitAuthor([WORK], { ...WORK, email: 'DEV@work.example' })).toEqual([WORK])
  })
})
