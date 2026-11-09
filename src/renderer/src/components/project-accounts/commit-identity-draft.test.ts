import { describe, expect, it } from 'vitest'
import { evaluateCommitIdentityDraft } from './commit-identity-draft'

describe('evaluateCommitIdentityDraft', () => {
  it('treats two blank fields as "use git config"', () => {
    expect(evaluateCommitIdentityDraft({ name: ' ', email: '' })).toEqual({ status: 'empty' })
  })

  it('rejects a half-filled draft', () => {
    expect(evaluateCommitIdentityDraft({ name: 'Dev', email: '' }).status).toBe('incomplete')
    expect(evaluateCommitIdentityDraft({ name: '', email: 'dev@example.test' }).status).toBe(
      'incomplete'
    )
  })

  it('rejects malformed emails and values that could forge git config', () => {
    expect(evaluateCommitIdentityDraft({ name: 'Dev', email: 'nope' }).status).toBe('invalid')
    expect(evaluateCommitIdentityDraft({ name: 'Dev\nx', email: 'dev@example.test' }).status).toBe(
      'invalid'
    )
  })

  it('trims a valid identity', () => {
    expect(evaluateCommitIdentityDraft({ name: ' Dev ', email: ' dev@example.test ' })).toEqual({
      status: 'valid',
      identity: { name: 'Dev', email: 'dev@example.test' }
    })
  })
})
