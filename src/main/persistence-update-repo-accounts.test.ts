import { closeTestStores, testState, createStore, makeRepo } from './persistence-test-harness'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { rmSync, mkdtempSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

vi.mock('electron', () => ({
  app: { getPath: () => testState.dir },
  safeStorage: {
    isEncryptionAvailable: () => false,
    encryptString: (value: string) => Buffer.from(value),
    decryptString: (value: Buffer) => value.toString()
  }
}))
vi.mock('./telemetry/client', () => ({ track: vi.fn() }))
vi.mock('./telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn(() => ({})) }))

describe('Store per-project accounts', () => {
  beforeEach(() => {
    testState.dir = mkdtempSync(join(tmpdir(), 'dolphin-test-'))
  })

  afterEach(async () => {
    await closeTestStores()
    rmSync(testState.dir, { recursive: true, force: true })
  })

  it('persists the Azure DevOps account and commit identity across a reload, and null clears them', async () => {
    const store = await createStore()
    store.addRepo(makeRepo())

    const updated = store.updateRepo('r1', {
      azureDevOpsAccountId: ' acct_1 ',
      commitIdentity: { name: ' Ana Dev ', email: ' ana@corp.example ' }
    })
    expect(updated!.azureDevOpsAccountId).toBe('acct_1')
    expect(updated!.commitIdentity).toEqual({ name: 'Ana Dev', email: 'ana@corp.example' })

    store.flush()
    const reloaded = await createStore()
    expect(reloaded.getRepo('r1')!.azureDevOpsAccountId).toBe('acct_1')
    expect(reloaded.getRepo('r1')!.commitIdentity).toEqual({
      name: 'Ana Dev',
      email: 'ana@corp.example'
    })

    const cleared = reloaded.updateRepo('r1', { azureDevOpsAccountId: null, commitIdentity: null })
    expect(cleared!.azureDevOpsAccountId).toBeUndefined()
    expect(cleared!.commitIdentity).toBeUndefined()
  })

  it('ignores malformed values instead of clearing or storing them', async () => {
    const store = await createStore()
    store.addRepo(
      makeRepo({
        azureDevOpsAccountId: 'acct_1',
        commitIdentity: { name: 'Ana', email: 'ana@corp.example' }
      })
    )

    const updated = store.updateRepo('r1', {
      azureDevOpsAccountId: '../../etc',
      commitIdentity: { name: 'Ana\n[core]', email: 'ana@corp.example' }
    })
    expect(updated!.azureDevOpsAccountId).toBe('acct_1')
    expect(updated!.commitIdentity).toEqual({ name: 'Ana', email: 'ana@corp.example' })
  })

  it('persists the project agent account across a reload, rejects malformed ids, and null clears it', async () => {
    const store = await createStore()
    store.addRepo(makeRepo())

    expect(store.updateRepo('r1', { agentAccountId: ' acct-company ' })!.agentAccountId).toBe(
      'acct-company'
    )
    expect(store.updateRepo('r1', { agentAccountId: 'bad id\n' })!.agentAccountId).toBe(
      'acct-company'
    )
    store.flush()
    const reloaded = await createStore()
    expect(reloaded.getRepo('r1')!.agentAccountId).toBe('acct-company')
    expect(reloaded.updateRepo('r1', { agentAccountId: null })!.agentAccountId).toBeUndefined()
  })

  it('drops a corrupt persisted identity on hydration', async () => {
    const store = await createStore()
    store.addRepo(makeRepo({ commitIdentity: { name: 'Ana', email: 'not-an-email' } }))
    expect(store.getRepo('r1')!.commitIdentity).toBeUndefined()
  })
})
