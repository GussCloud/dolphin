import { expect, it } from 'vitest'
import { mobileCatalogPlaceholderMismatches } from '../../../test-support/mobile-catalog-placeholders'
import { mobileWebShellCatalog } from '.'

it('keeps every English placeholder in every locale', () => {
  expect(mobileCatalogPlaceholderMismatches(mobileWebShellCatalog)).toEqual([])
})
