import { describe, expect, it } from 'vitest'
import { resolveAzureDevOpsLinkOrganization } from './azure-devops-org-link'

describe('resolveAzureDevOpsLinkOrganization', () => {
  it('canonicalizes both Azure DevOps Services URL forms', () => {
    expect(resolveAzureDevOpsLinkOrganization('https://dev.azure.com/Contoso/Project')).toEqual({
      organizationUrl: 'https://dev.azure.com/contoso',
      organizationName: 'contoso'
    })
    expect(
      resolveAzureDevOpsLinkOrganization('https://Contoso.visualstudio.com/DefaultCollection')
    ).toEqual({
      organizationUrl: 'https://contoso.visualstudio.com',
      organizationName: 'contoso'
    })
  })

  it('rejects hosts the auth server does not accept', () => {
    expect(resolveAzureDevOpsLinkOrganization('https://tfs.contoso.local/tfs')).toBeNull()
    expect(resolveAzureDevOpsLinkOrganization('http://dev.azure.com/contoso')).toBeNull()
    expect(resolveAzureDevOpsLinkOrganization('https://dev.azure.com/')).toBeNull()
    expect(resolveAzureDevOpsLinkOrganization('not a url')).toBeNull()
  })
})
