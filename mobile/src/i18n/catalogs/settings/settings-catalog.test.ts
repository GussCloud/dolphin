import { expect, it } from 'vitest'
import { mobileCatalogPlaceholderMismatches } from '../../../test-support/mobile-catalog-placeholders'
import { settingsCatalog } from '.'

it('keeps every English placeholder in every locale', () => {
  expect(mobileCatalogPlaceholderMismatches(settingsCatalog)).toEqual([])
})
