import { describe, expect, it } from 'vitest'
import { DESIGN_NAME_MAX_CHARS, DESIGN_REQUEST_MAX_CHARS } from '../../../shared/design-types'
import {
  createDesignDraft,
  designDraftBlocksCreate,
  designDraftForName,
  designEphemeralVmRecipes
} from './design-draft'

const ready = { ...createDesignDraft(), step: 2 as const, request: 'A checkout flow' }

describe('designDraftBlocksCreate', () => {
  it('allows create only from the last step with a name, a request and an agent', () => {
    expect(designDraftBlocksCreate(ready, { name: 'Checkout', agent: 'claude' })).toBe(false)
    expect(
      designDraftBlocksCreate({ ...ready, step: 1 }, { name: 'Checkout', agent: 'claude' })
    ).toBe(true)
    expect(designDraftBlocksCreate(ready, { name: '  ', agent: 'claude' })).toBe(true)
    expect(
      designDraftBlocksCreate({ ...ready, request: ' ' }, { name: 'C', agent: 'claude' })
    ).toBe(true)
    expect(designDraftBlocksCreate(ready, { name: 'Checkout', agent: 'gemini' })).toBe(false)
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

describe('designDraftForName', () => {
  it('returns to the basics once "Create more" clears the name, keeping the request', () => {
    expect(designDraftForName(ready, '')).toEqual({ ...ready, step: 1 })
    expect(designDraftForName(ready, 'Checkout')).toBe(ready)
    const basics = { ...ready, step: 1 as const }
    expect(designDraftForName(basics, '')).toBe(basics)
  })
})

describe('designEphemeralVmRecipes', () => {
  it('keeps only recipes whose VM is reached over SSH', () => {
    const recipes = [
      { id: 'root', checkoutMode: 'provisioned-root' },
      { id: 'worktree', checkoutMode: 'dolphin-worktree' },
      { id: 'unset' }
    ]
    expect(designEphemeralVmRecipes(recipes).map((recipe) => recipe.id)).toEqual(['root'])
  })
})
