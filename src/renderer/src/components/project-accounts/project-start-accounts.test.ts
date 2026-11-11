import { describe, expect, it } from 'vitest'
import {
  EMPTY_PROJECT_START_ACCOUNTS,
  createProjectBinding,
  hasProjectStartChoice,
  preferredCloneSelection,
  projectStartBinding,
  type ProjectStartAccounts
} from './project-start-accounts'

const COMPANY: ProjectStartAccounts = {
  ghAccount: { host: 'github.com', user: 'ana-corp' },
  azureDevOpsAccountId: 'ado-corp',
  agentAccountId: 'claude-corp',
  commitIdentity: { name: 'Ana Dev', email: 'ana@corp.example' }
}

describe('projectStartBinding', () => {
  it('keeps only the GitHub account for a GitHub remote on the same host', () => {
    expect(projectStartBinding(COMPANY, { provider: 'github', host: 'github.com' })).toEqual({
      ghAccount: COMPANY.ghAccount,
      agentAccountId: 'claude-corp',
      commitIdentity: COMPANY.commitIdentity
    })
  })

  it('drops a GitHub account for another host, which would never authenticate the remote', () => {
    expect(
      projectStartBinding(COMPANY, { provider: 'github', host: 'ghe.corp.example' }).ghAccount
    ).toBeUndefined()
  })

  it('keeps only the Azure DevOps account for an Azure remote', () => {
    const binding = projectStartBinding(COMPANY, {
      provider: 'azure-devops',
      host: 'dev.azure.com'
    })
    expect(binding.azureDevOpsAccountId).toBe('ado-corp')
    expect(binding.ghAccount).toBeUndefined()
  })

  it('keeps the agent account and author even for an unsupported or missing remote', () => {
    expect(projectStartBinding(COMPANY, null)).toEqual({
      agentAccountId: 'claude-corp',
      commitIdentity: COMPANY.commitIdentity
    })
  })
})

describe('createProjectBinding', () => {
  it('keeps both providers and uses the author left in the form, not the suggestion', () => {
    expect(createProjectBinding(COMPANY, { name: 'Edited', email: 'edited@corp.example' })).toEqual(
      {
        ghAccount: COMPANY.ghAccount,
        azureDevOpsAccountId: 'ado-corp',
        agentAccountId: 'claude-corp',
        commitIdentity: { name: 'Edited', email: 'edited@corp.example' }
      }
    )
    expect(createProjectBinding(COMPANY, null).commitIdentity).toBeUndefined()
    expect(createProjectBinding(undefined, null)).toEqual({})
  })
})

describe('preferredCloneSelection and hasProjectStartChoice', () => {
  it('preselects the first-screen account of the remote provider', () => {
    expect(preferredCloneSelection(COMPANY, { provider: 'github', host: 'github.com' })).toEqual({
      provider: 'github',
      ghAccount: COMPANY.ghAccount
    })
    expect(
      preferredCloneSelection(COMPANY, { provider: 'azure-devops', host: 'dev.azure.com' })
    ).toEqual({ provider: 'azure-devops', azureDevOpsAccountId: 'ado-corp' })
    expect(preferredCloneSelection(EMPTY_PROJECT_START_ACCOUNTS, null)).toBeNull()
  })

  it('treats the all-defaults state as no choice, so the add flow stays as before', () => {
    expect(hasProjectStartChoice(EMPTY_PROJECT_START_ACCOUNTS)).toBe(false)
    expect(hasProjectStartChoice({ ...EMPTY_PROJECT_START_ACCOUNTS, agentAccountId: 'x' })).toBe(
      true
    )
  })
})
