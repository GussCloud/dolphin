import { describe, expect, it, vi } from 'vitest'
import type { PersistedState } from '../../../shared/persisted-state-types'
import { updateSettings, type SettingsMutationOperations } from './settings-update'

function makeOperations(): SettingsMutationOperations {
  return {
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: only the fields updateSettings reads for this setting.
    state: { settings: { commitAuthors: [] }, repos: [] } as unknown as PersistedState,
    bumpLocalWorktreeScanGeneration: vi.fn(),
    removeRetainedBlob: vi.fn(),
    scheduleSave: vi.fn(),
    notifySettingsChanged: vi.fn()
  }
}

describe('updateSettings commitAuthors', () => {
  it('stores only valid, de-duplicated authors from any writer', () => {
    const updated = updateSettings(makeOperations(), {
      commitAuthors: [
        { name: ' Dev ', email: 'dev@example.test' },
        { name: 'Dev', email: 'DEV@example.test' },
        { name: 'Evil\n[core]', email: 'evil@example.test' }
      ]
    })
    expect(updated.commitAuthors).toEqual([{ name: 'Dev', email: 'dev@example.test' }])
  })
})
