// @vitest-environment happy-dom

import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useQuickSubmitAction, type QuickSubmitActionInput } from './quick-submit-action'

function makeInput(overrides: Partial<QuickSubmitActionInput> = {}): QuickSubmitActionInput {
  return {
    effectiveLinkedPR: null,
    executeQuickCreation: vi.fn<QuickSubmitActionInput['executeQuickCreation']>(),
    fallbackCreatureName: 'otter',
    isProjectGroupTarget: false,
    isSubmissionCancelled: () => false,
    linkedPR: null,
    name: 'feature-x',
    onCreated: vi.fn(),
    parsedLinkedIssueNumber: null,
    repoId: 'crm-ui',
    requiresExplicitSetupChoice: false,
    resolvePendingSmartGitHubSubmit: async () => ({ kind: 'none' }),
    selectedRepo: {
      id: 'crm-ui',
      path: '/code/crm-ui',
      displayName: 'crm-ui',
      badgeColor: '#000',
      addedAt: 0
    },
    selectedRepoRequiresConnection: false,
    selectedWorkspaceTarget: { status: 'unavailable', reason: 'no-eligible-repo' },
    setCreateError: vi.fn(),
    setCreating: vi.fn(),
    setupDecision: null,
    showProjectRequiredError: vi.fn(),
    sourceIntentBlocksCreate: false,
    sparseError: null,
    submitFolderTarget: vi.fn<QuickSubmitActionInput['submitFolderTarget']>(),
    multiProjectMemberRepoIds: null,
    submitMultiProjectTarget: vi.fn<QuickSubmitActionInput['submitMultiProjectTarget']>(),
    ...overrides
  }
}

describe('useQuickSubmitAction with several projects', () => {
  it('creates one multi-project workspace named after the typed name', async () => {
    const input = makeInput({ multiProjectMemberRepoIds: ['crm-ui', 'crm-api'] })
    const hook = renderHook(() => useQuickSubmitAction(input))

    await act(() => hook.result.current.submitQuick('claude'))

    expect(input.submitMultiProjectTarget).toHaveBeenCalledWith(
      'claude',
      ['crm-ui', 'crm-api'],
      'feature-x'
    )
    expect(input.executeQuickCreation).not.toHaveBeenCalled()
  })

  it('falls back to the generated name when none was typed', async () => {
    const input = makeInput({ name: '', multiProjectMemberRepoIds: ['crm-ui', 'crm-api'] })
    const hook = renderHook(() => useQuickSubmitAction(input))

    await act(() => hook.result.current.submitQuick(null))

    expect(input.submitMultiProjectTarget).toHaveBeenCalledWith(
      null,
      ['crm-ui', 'crm-api'],
      'otter'
    )
  })

  it('keeps the single-project create when no project was added', async () => {
    const input = makeInput()
    const hook = renderHook(() => useQuickSubmitAction(input))

    await act(() => hook.result.current.submitQuick('claude'))

    expect(input.submitMultiProjectTarget).not.toHaveBeenCalled()
    expect(input.executeQuickCreation).toHaveBeenCalledTimes(1)
  })
})
