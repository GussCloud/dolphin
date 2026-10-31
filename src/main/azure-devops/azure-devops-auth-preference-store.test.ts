import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import * as os from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORK_HOME_STATE_DIR_NAME } from '../../shared/fork-identity'
import {
  _resetAzureDevOpsAuthPreferenceCache,
  getAzureDevOpsAuthPreference,
  setAzureDevOpsAuthPreference
} from './azure-devops-auth-preference-store'

const home = vi.hoisted(() => ({ dir: '' }))
const writes = vi.hoisted(() => ({ write: vi.fn() }))

vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof os>()),
  homedir: () => home.dir
}))
vi.mock('../integration-credential-file', () => ({ writeCredentialFileAtomic: writes.write }))

function writeStored(content: string): void {
  const dir = join(home.dir, FORK_HOME_STATE_DIR_NAME)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'azure-devops-auth.json'), content)
}

describe('azure devops auth preference store', () => {
  beforeEach(() => {
    home.dir = mkdtempSync(join(os.tmpdir(), 'dolphin-azdo-pref-'))
    _resetAzureDevOpsAuthPreferenceCache()
    writes.write.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    rmSync(home.dir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('defaults to token with the sign-in notice on', () => {
    expect(getAzureDevOpsAuthPreference()).toEqual({ method: 'token', autoRenewCliSession: true })
  })

  it('turns the notice on for v1 files, which always stored the old opt-in', () => {
    writeStored(JSON.stringify({ version: 1, method: 'azure-cli', autoRenewCliSession: false }))
    expect(getAzureDevOpsAuthPreference()).toEqual({
      method: 'azure-cli',
      autoRenewCliSession: true
    })
    _resetAzureDevOpsAuthPreferenceCache()
    writeStored(JSON.stringify({ version: 1, method: 'azure-cli', autoRenewCliSession: true }))
    expect(getAzureDevOpsAuthPreference().autoRenewCliSession).toBe(true)
  })

  it('treats a file without a version as v1', () => {
    writeStored(JSON.stringify({ method: 'azure-cli', autoRenewCliSession: false }))
    expect(getAzureDevOpsAuthPreference()).toEqual({
      method: 'azure-cli',
      autoRenewCliSession: true
    })
  })

  it('honors a v2 choice to hide the notice', () => {
    writeStored(JSON.stringify({ version: 2, method: 'azure-cli', autoRenewCliSession: false }))
    expect(getAzureDevOpsAuthPreference()).toEqual({
      method: 'azure-cli',
      autoRenewCliSession: false
    })
  })

  it('falls back to the default on a corrupt file', () => {
    writeStored('{not json')
    expect(getAzureDevOpsAuthPreference()).toEqual({ method: 'token', autoRenewCliSession: true })
  })

  it('writes v2 so the stored choice is honored next launch', () => {
    setAzureDevOpsAuthPreference({ method: 'azure-cli', autoRenewCliSession: false })
    const written: unknown = JSON.parse(String(writes.write.mock.calls[0]?.[1]))
    expect(written).toEqual({ version: 2, method: 'azure-cli', autoRenewCliSession: false })
  })
})
