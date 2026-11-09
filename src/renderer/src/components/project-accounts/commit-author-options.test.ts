import { describe, expect, it } from 'vitest'
import {
  commitAuthorOptions,
  isSavedCommitAuthor,
  replaceCommitAuthor,
  withCommitAuthor,
  withoutCommitAuthor
} from './commit-author-options'

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

describe('replaceCommitAuthor', () => {
  it('corrects an author in place and appends one that was not saved', () => {
    const fixed = { name: 'Dev Fixed', email: 'dev@work.example' }
    expect(replaceCommitAuthor([WORK, HOME], WORK, fixed)).toEqual([fixed, HOME])
    expect(replaceCommitAuthor([HOME], WORK, fixed)).toEqual([HOME, fixed])
  })

  it('collapses a correction that turns into an existing author', () => {
    expect(replaceCommitAuthor([WORK, HOME], WORK, HOME)).toEqual([HOME])
  })
})

describe('withoutCommitAuthor', () => {
  it('removes only the given author', () => {
    expect(withoutCommitAuthor([WORK, HOME], { ...WORK, email: 'DEV@work.example' })).toEqual([
      HOME
    ])
    expect(isSavedCommitAuthor([HOME], WORK)).toBe(false)
  })
})
