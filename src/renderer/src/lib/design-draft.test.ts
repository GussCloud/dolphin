import { describe, expect, it } from 'vitest'
import { DESIGN_NAME_MAX_CHARS, DESIGN_REQUEST_MAX_CHARS } from '../../../shared/design-types'
import { createDesignDraft, designDraftBlocksCreate } from './design-draft'

const ready = { ...createDesignDraft(), step: 2 as const, request: 'A checkout flow' }

describe('designDraftBlocksCreate', () => {
  it('allows create only from the last step with a name, a request and a design agent', () => {
    expect(designDraftBlocksCreate(ready, { name: 'Checkout', agent: 'claude' })).toBe(false)
    expect(
      designDraftBlocksCreate({ ...ready, step: 1 }, { name: 'Checkout', agent: 'claude' })
    ).toBe(true)
    expect(designDraftBlocksCreate(ready, { name: '  ', agent: 'claude' })).toBe(true)
    expect(
      designDraftBlocksCreate({ ...ready, request: ' ' }, { name: 'C', agent: 'claude' })
    ).toBe(true)
    expect(designDraftBlocksCreate(ready, { name: 'Checkout', agent: 'gemini' })).toBe(true)
    expect(designDraftBlocksCreate(ready, { name: 'Checkout', agent: null })).toBe(true)
  })

  it('refuses what the host would reject for length', () => {
    const longName = 'n'.repeat(DESIGN_NAME_MAX_CHARS + 1)
    const longRequest = 'r'.repeat(DESIGN_REQUEST_MAX_CHARS + 1)
    expect(designDraftBlocksCreate(ready, { name: longName, agent: 'claude' })).toBe(true)
    expect(
      designDraftBlocksCreate({ ...ready, request: longRequest }, { name: 'C', agent: 'claude' })
    ).toBe(true)
  })
})
