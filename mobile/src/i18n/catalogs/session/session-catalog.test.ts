import { expect, it } from 'vitest'
import { mobileCatalogPlaceholderMismatches } from '../../../test-support/mobile-catalog-placeholders'
import { sessionCatalog } from '.'

it('keeps every English placeholder in every locale', () => {
  expect(mobileCatalogPlaceholderMismatches(sessionCatalog)).toEqual([])
})
