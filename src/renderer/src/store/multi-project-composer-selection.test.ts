import { beforeEach, describe, expect, it } from 'vitest'
import { useMultiProjectComposerSelectionStore } from './multi-project-composer-selection'

const store = useMultiProjectComposerSelectionStore

describe('multi-project composer selection', () => {
  beforeEach(() => {
    store.getState().reset()
  })

  it('adds projects in order without duplicates', () => {
    store.getState().addRepoIds(['crm-api'])
    store.getState().addRepoIds(['saas', 'crm-api', 'saas'])

    expect(store.getState().extraRepoIds).toEqual(['crm-api', 'saas'])
  })

  it('removes one project and resets to none', () => {
    store.getState().addRepoIds(['crm-api', 'saas'])
    store.getState().removeRepoId('crm-api')
    expect(store.getState().extraRepoIds).toEqual(['saas'])

    store.getState().reset()
    expect(store.getState().extraRepoIds).toEqual([])
  })
})
