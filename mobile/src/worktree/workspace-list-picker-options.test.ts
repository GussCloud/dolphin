import { describe, expect, it } from 'vitest'
import { worktreeCatalog } from '../i18n/catalogs/worktree'
import { translate } from '../i18n/mobile-locale-state'
import { workspaceSortOptions } from './workspace-list-picker-options'

const sortOptions = () =>
  workspaceSortOptions((key, ...args) => translate(worktreeCatalog, key, ...args))

describe('workspaceSortOptions', () => {
  it('keeps the persisted sort values stable for desktop compatibility', () => {
    expect(sortOptions().map((option) => option.value)).toEqual([
      'smart',
      'name',
      'recent',
      'repo',
      'manual'
    ])
  })

  it('keeps the smart sort value while showing the agent activity label', () => {
    expect(sortOptions().find((option) => option.value === 'smart')).toEqual({
      value: 'smart',
      label: 'Agent activity',
      subtitle: 'Agents that need attention, then recent activity'
    })
  })
})
