import { describe, expect, it } from 'vitest'
import { parseAzureDevOpsOrganizationUrl } from './azure-devops-verifier.js'
import { readAuthConfig } from './config.js'

const ISSUER = 'https://auth.dolphin.example'

describe('parseAzureDevOpsOrganizationUrl', () => {
  it('normalizes both public URL forms to a lowercase org name', () => {
    expect(parseAzureDevOpsOrganizationUrl('https://dev.azure.com/Contoso/Project/_git/repo')).toEqual({
      organizationName: 'contoso',
      baseUrl: 'https://dev.azure.com/contoso'
    })
    expect(parseAzureDevOpsOrganizationUrl(' https://Contoso.visualstudio.com/ ')).toEqual({
      organizationName: 'contoso',
      baseUrl: 'https://contoso.visualstudio.com'
    })
  })

  it('rejects other hosts, schemes, ports, credentials and odd names', () => {
    for (const url of [
      'not a url',
      'https://dev.azure.com/',
      'https://dev.azure.com.evil.example/contoso',
      'https://evilvisualstudio.com',
      'https://dev.azure.com/con%2Ftoso',
      'https://dev.azure.com/-contoso',
      'ftp://dev.azure.com/contoso'
    ]) {
      expect(parseAzureDevOpsOrganizationUrl(url)).toBeNull()
    }
  })
})

describe('AZDO_ORG_PROOF', () => {
  it('defaults to admin and refuses member mode in production', () => {
    expect(readAuthConfig({ DOLPHIN_AUTH_ISSUER: ISSUER }).azureDevOpsOrgProof).toBe('admin')
    expect(readAuthConfig({ DOLPHIN_AUTH_ISSUER: ISSUER, AZDO_ORG_PROOF: 'member' }).azureDevOpsOrgProof).toBe('member')
    expect(() =>
      readAuthConfig({ DOLPHIN_AUTH_ISSUER: ISSUER, AZDO_ORG_PROOF: 'member', NODE_ENV: 'production' })
    ).toThrow(/not allowed/)
    expect(() => readAuthConfig({ DOLPHIN_AUTH_ISSUER: ISSUER, AZDO_ORG_PROOF: 'owner' })).toThrow()
  })
})
