import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { hasAzureDevOpsCredential, resolveAzureDevOpsAuthHeaders } from './azure-devops-credential'

const mocks = vi.hoisted(() => ({
  preference: vi.fn(),
  token: vi.fn()
}))

vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: mocks.preference
}))
vi.mock('./azure-cli-access-token', () => ({ getAzureCliAccessToken: mocks.token }))

const OLD_ENV = process.env

describe('resolveAzureDevOpsAuthHeaders', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV }
    delete process.env.DOLPHIN_AZURE_DEVOPS_TOKEN
    delete process.env.DOLPHIN_AZURE_DEVOPS_PAT
    delete process.env.DOLPHIN_AZURE_DEVOPS_ACCESS_TOKEN
    mocks.preference.mockReset()
    mocks.token.mockReset()
  })

  afterEach(() => {
    process.env = OLD_ENV
  })

  it('uses the Azure CLI bearer token and ignores env tokens in azure-cli mode', async () => {
    process.env.DOLPHIN_AZURE_DEVOPS_TOKEN = 'pat'
    mocks.preference.mockReturnValue({ method: 'azure-cli' })
    mocks.token.mockResolvedValue('entra-token')
    await expect(resolveAzureDevOpsAuthHeaders()).resolves.toEqual({
      Authorization: 'Bearer entra-token'
    })
  })

  it('sends no credentials when the Azure CLI is signed out', async () => {
    mocks.preference.mockReturnValue({ method: 'azure-cli' })
    mocks.token.mockRejectedValue(new Error('az login'))
    await expect(resolveAzureDevOpsAuthHeaders()).resolves.toEqual({})
    await expect(hasAzureDevOpsCredential()).resolves.toBe(false)
  })

  it('keeps PAT basic auth in token mode without touching the CLI', async () => {
    process.env.DOLPHIN_AZURE_DEVOPS_TOKEN = 'pat'
    mocks.preference.mockReturnValue({ method: 'token' })
    const headers = await resolveAzureDevOpsAuthHeaders()
    expect(headers.Authorization).toBe(`Basic ${Buffer.from(':pat').toString('base64')}`)
    await expect(hasAzureDevOpsCredential()).resolves.toBe(true)
    expect(mocks.token).not.toHaveBeenCalled()
  })
})
