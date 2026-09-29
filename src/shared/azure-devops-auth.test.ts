import { describe, expect, it } from 'vitest'
import { isAzureDevOpsAuthMethod, normalizeAzureDevOpsOrganizationUrl } from './azure-devops-auth'

describe('normalizeAzureDevOpsOrganizationUrl', () => {
  it.each([
    ['contoso', 'https://dev.azure.com/contoso'],
    ['dev.azure.com/contoso/', 'https://dev.azure.com/contoso'],
    ['https://dev.azure.com/contoso', 'https://dev.azure.com/contoso'],
    ['https://contoso.visualstudio.com', 'https://contoso.visualstudio.com'],
    ['https://ado.example.com:8443/tfs/Collection/', 'https://ado.example.com:8443/tfs/Collection']
  ])('normalizes %s', (input, expected) => {
    expect(normalizeAzureDevOpsOrganizationUrl(input)).toBe(expected)
  })

  it('rejects blank and non-http input', () => {
    expect(normalizeAzureDevOpsOrganizationUrl('   ')).toBeNull()
    expect(normalizeAzureDevOpsOrganizationUrl('ftp://contoso')).toBeNull()
  })
})

describe('isAzureDevOpsAuthMethod', () => {
  it('accepts only known methods', () => {
    expect(isAzureDevOpsAuthMethod('token')).toBe(true)
    expect(isAzureDevOpsAuthMethod('azure-cli')).toBe(true)
    expect(isAzureDevOpsAuthMethod('pat')).toBe(false)
    expect(isAzureDevOpsAuthMethod(null)).toBe(false)
  })
})
