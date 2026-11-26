import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { UsageScanWorkerRequestBody } from './usage-scan-worker-protocol'
import type * as WorkerClient from './usage-scan-worker-client'
import { CLAUDE_PROFILE_MARKER } from '../claude-accounts/pinned-config-dir/claude-pinned-config-layout'
import { registerClaudeProfileRootSources } from '../claude-accounts/profile/claude-profile-roots'

const { scanMock } = vi.hoisted(() => ({
  scanMock: vi.fn(async (body: UsageScanWorkerRequestBody) => ({
    providerId: body.providerId,
    source: [],
    sessions: [],
    dailyAggregates: []
  }))
}))

vi.mock('./usage-scan-worker-client', async (importOriginal) => ({
  ...(await importOriginal<typeof WorkerClient>()),
  UsageScanWorkerClient: class {
    scan = scanMock
  }
}))

import {
  scanClaudeApiUsageFilesViaWorker,
  scanClaudeUsageFilesViaWorker
} from './usage-scan-worker-spawn'

function profileDirsSent(): string[] | undefined {
  const body = scanMock.mock.calls.at(-1)?.[0]
  return body && 'profileConfigDirs' in body ? body.profileConfigDirs : undefined
}

describe('usage scans split plan and API account profiles', () => {
  let userData: string
  let root: string

  beforeEach(() => {
    scanMock.mockClear()
    userData = mkdtempSync(join(tmpdir(), 'dolphin-usage-profiles-'))
    root = join(userData, 'claude-accounts')
    for (const id of ['plan-1', 'api-1']) {
      mkdirSync(join(root, id, 'config'), { recursive: true })
      writeFileSync(join(root, id, 'config', CLAUDE_PROFILE_MARKER), '{"version":1}\n')
    }
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => root,
      linkedConfigDirs: () => [],
      apiKeyAccountIds: () => ['api-1'],
      planAccountIds: () => ['plan-1']
    })
  })

  afterEach(() => {
    registerClaudeProfileRootSources({
      managedAccountsRoot: () => null,
      linkedConfigDirs: () => [],
      apiKeyAccountIds: () => [],
      planAccountIds: () => []
    })
    rmSync(userData, { recursive: true, force: true })
  })

  it('never sends an API account profile to the subscription Claude scan', async () => {
    await scanClaudeUsageFilesViaWorker([])
    expect(scanMock.mock.calls.at(-1)?.[0].providerId).toBe('claude')
    expect(profileDirsSent()).toEqual([join(root, 'plan-1', 'config')])
  })

  it('sends only API account profiles to the Claude (API) scan', async () => {
    await scanClaudeApiUsageFilesViaWorker([])
    expect(scanMock.mock.calls.at(-1)?.[0].providerId).toBe('claude-api')
    expect(profileDirsSent()).toEqual([join(root, 'api-1', 'config')])
  })
})
