import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  configureAzureDevOpsDefaults,
  getAzureCliStatus,
  parseAzureDevOpsDefaults
} from './azure-cli-status'
import type * as AzureCliRunner from './azure-cli-runner'

const mocks = vi.hoisted(() => ({
  resolveAzureCliProgram: vi.fn(),
  runAzureCli: vi.fn(),
  runAzureCliJson: vi.fn()
}))

vi.mock('./azure-cli-runner', async (importOriginal) => ({
  ...(await importOriginal<typeof AzureCliRunner>()),
  ...mocks
}))

const ok = (stdout = ''): object => ({ code: 0, signal: null, stdout, stderr: '', timedOut: false })
const failed = (stderr: string): object => ({
  code: 1,
  signal: null,
  stdout: '',
  stderr,
  timedOut: false
})

describe('parseAzureDevOpsDefaults', () => {
  it('reads organization and project from the INI listing', () => {
    expect(
      parseAzureDevOpsDefaults(
        '[defaults]\r\norganization = https://dev.azure.com/contoso\r\nproject = Web\r\n'
      )
    ).toEqual({ organization: 'https://dev.azure.com/contoso', project: 'Web' })
  })

  it('treats empty values as unset', () => {
    expect(parseAzureDevOpsDefaults('[defaults]\norganization = \nproject =')).toEqual({
      organization: null,
      project: null
    })
  })
})

describe('getAzureCliStatus', () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset())
  })

  it('reports a missing CLI without spawning anything', async () => {
    mocks.resolveAzureCliProgram.mockResolvedValue(null)
    await expect(getAzureCliStatus()).resolves.toMatchObject({ installed: false })
    expect(mocks.runAzureCli).not.toHaveBeenCalled()
  })

  it('combines sign-in, extension and defaults probes', async () => {
    mocks.resolveAzureCliProgram.mockResolvedValue({ program: 'az', prefixArgs: [], env: {} })
    mocks.runAzureCliJson.mockResolvedValue({ user: { name: 'dev@contoso.com' } })
    mocks.runAzureCli.mockImplementation(async (args: string[]) =>
      args[0] === 'extension' ? ok() : ok('[defaults]\norganization = https://dev.azure.com/c\n')
    )
    await expect(getAzureCliStatus()).resolves.toEqual({
      installed: true,
      devopsExtensionInstalled: true,
      authenticated: true,
      account: 'dev@contoso.com',
      defaultOrganization: 'https://dev.azure.com/c',
      defaultProject: null
    })
  })

  it('skips the defaults probe when the extension is missing', async () => {
    mocks.resolveAzureCliProgram.mockResolvedValue({ program: 'az', prefixArgs: [], env: {} })
    mocks.runAzureCliJson.mockRejectedValue(new Error('not logged in'))
    mocks.runAzureCli.mockResolvedValue(failed('extension not installed'))
    await expect(getAzureCliStatus()).resolves.toMatchObject({
      installed: true,
      authenticated: false,
      devopsExtensionInstalled: false
    })
    expect(mocks.runAzureCli).toHaveBeenCalledTimes(1)
  })
})

describe('configureAzureDevOpsDefaults', () => {
  beforeEach(() => mocks.runAzureCli.mockReset())

  it('passes organization and project as separate argv entries', async () => {
    mocks.runAzureCli.mockResolvedValue(ok())
    await expect(
      configureAzureDevOpsDefaults({ organization: 'https://dev.azure.com/c', project: 'My Proj' })
    ).resolves.toEqual({ ok: true })
    expect(mocks.runAzureCli).toHaveBeenCalledWith([
      'devops',
      'configure',
      '--defaults',
      'organization=https://dev.azure.com/c',
      'project=My Proj'
    ])
  })

  it('returns the CLI error text on failure', async () => {
    mocks.runAzureCli.mockResolvedValue(failed('ERROR: bad organization'))
    await expect(
      configureAzureDevOpsDefaults({ organization: 'x', project: null })
    ).resolves.toEqual({ ok: false, error: 'ERROR: bad organization' })
  })
})
