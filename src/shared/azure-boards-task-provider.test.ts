import { describe, expect, it } from 'vitest'
import {
  buildWorkspaceSourceSelection,
  getWorkspaceSourceProvider,
  shouldPreserveWorkspaceSourceOnRepoChange
} from './new-workspace/workspace-source'
import { normalizeTaskProviderIdentity } from './task-provider-identity'
import { isAccountBackedTaskSource, taskProviderLabel } from './task-providers'
import { normalizeTaskSourceContext } from './task-source-context'
import { normalizeWorkspaceLinkedItem } from './workspace-linked-item'

const url = 'https://dev.azure.com/contoso/Web/_workitems/edit/1234'
const item = { type: 'issue' as const, number: 1234, title: 'Crash on launch', url }

describe('Azure Boards as a task provider', () => {
  it('keeps linked Azure Boards work items through normalization', () => {
    expect(normalizeWorkspaceLinkedItem({ ...item, provider: 'azure-boards' })).toEqual({
      ...item,
      provider: 'azure-boards'
    })
  })

  it('keeps Azure Boards task source contexts and their identity', () => {
    const context = normalizeTaskSourceContext({
      provider: 'azure-boards',
      projectId: 'account-backed-task-source',
      hostId: 'local',
      providerIdentity: {
        provider: 'azure-boards',
        organizationUrl: ' https://dev.azure.com/contoso ',
        project: 'Web'
      }
    })
    expect(context?.provider).toBe('azure-boards')
    expect(context?.providerIdentity).toEqual({
      provider: 'azure-boards',
      organizationUrl: 'https://dev.azure.com/contoso',
      project: 'Web'
    })
    expect(normalizeTaskProviderIdentity('azure-boards', { provider: 'jira' })).toBeNull()
  })

  it('infers the provider from a work item URL and survives repository changes', () => {
    expect(getWorkspaceSourceProvider(item)).toBe('azure-boards')
    expect(shouldPreserveWorkspaceSourceOnRepoChange(item)).toBe(true)
    expect(buildWorkspaceSourceSelection({ linkedWorkItem: item })).toEqual({
      kind: 'azure-boards',
      label: '#1234 Crash on launch',
      url
    })
  })

  it('is account-backed and labelled', () => {
    expect(isAccountBackedTaskSource('azure-boards')).toBe(true)
    expect(isAccountBackedTaskSource('github')).toBe(false)
    expect(taskProviderLabel('azure-boards')).toBe('Azure Boards')
  })
})
