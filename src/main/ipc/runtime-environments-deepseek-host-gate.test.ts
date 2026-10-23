import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY,
  DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
} from '../../shared/protocol-version'
import { addEnvironmentFromPairingCode } from '../../shared/runtime-environment-store'

const { sendRemoteRuntimeRequestMock } = vi.hoisted(() => ({
  sendRemoteRuntimeRequestMock: vi.fn()
}))

vi.mock('electron', () => ({
  BrowserWindow: { getAllWindows: () => [] },
  app: { getPath: vi.fn() },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn(), removeAllListeners: vi.fn() }
}))

vi.mock('../../shared/remote-runtime-client', () => ({
  sendRemoteRuntimeRequest: sendRemoteRuntimeRequestMock,
  subscribeRemoteRuntimeRequest: vi.fn()
}))

vi.mock('./runtime-environment-request-connections', async () => {
  const { withRuntimeStatusOwners } = await import('./runtime-environments-ipc-test-harness')
  return withRuntimeStatusOwners({
    sendRemoteRuntimeConnectionRequest: vi.fn(),
    sendRemoteRuntimeSharedControlRequest: vi.fn(),
    subscribeRemoteRuntimeSharedControlRequest: vi.fn(),
    getRemoteRuntimeSharedControlDiagnostics: vi.fn(() => null),
    reconnectRemoteRuntimeSharedControlConnection: vi.fn(),
    retryRemoteRuntimeSharedControlConnectionsNow: vi.fn(),
    retryRemoteRuntimeSharedControlConnectionNow: vi.fn(),
    ensureRemoteRuntimeSharedControlConnection: vi.fn(),
    pauseRemoteRuntimeSharedControlRetry: vi.fn(),
    closeRemoteRuntimeRequestConnection: vi.fn()
  })
})

import { resetRuntimeEnvironmentStatusOwners } from './runtime-environment-request-connections'
import { callRuntimeEnvironment } from './runtime-environment-transport-routing'
import { pairingCode } from './runtime-environments-ipc-test-harness'

describe('callRuntimeEnvironment DeepSeek host gate', () => {
  let userDataPath: string

  beforeEach(() => {
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-deepseek-gate-'))
    sendRemoteRuntimeRequestMock.mockReset()
    addEnvironmentFromPairingCode(userDataPath, { name: 'desk', pairingCode: pairingCode() })
  })

  afterEach(() => {
    resetRuntimeEnvironmentStatusOwners()
    rmSync(userDataPath, { recursive: true, force: true })
  })

  function hostAdvertises(capabilities: string[]): void {
    sendRemoteRuntimeRequestMock.mockImplementation(async (_pairing, method: string) =>
      method === 'status.get'
        ? {
            id: 'status',
            ok: true,
            result: { runtimeId: 'runtime-remote', capabilities },
            _meta: { runtimeId: 'runtime-remote' }
          }
        : {
            id: method,
            ok: true,
            result: { terminal: { handle: 'term-1' } },
            _meta: { runtimeId: 'runtime-remote' }
          }
    )
  }

  const sentMethods = (): unknown[] =>
    sendRemoteRuntimeRequestMock.mock.calls.map((call) => call[1])

  it('refuses a DeepSeek worktree create on a host that predates DeepSeek, before sending it', async () => {
    hostAdvertises([])
    const response = await callRuntimeEnvironment(userDataPath, 'desk', 'worktree.create', {
      repo: 'repo-1',
      startupCommand: 'claude',
      createdWithAgent: 'deepseek'
    })
    expect(response).toMatchObject({
      ok: false,
      error: {
        code: 'deepseek_host_update_required',
        message: DEEPSEEK_HOST_UPDATE_REQUIRED_MESSAGE
      }
    })
    expect(sentMethods()).not.toContain('worktree.create')
  })

  it('sends a DeepSeek launch to a host that advertises DeepSeek', async () => {
    hostAdvertises([AGENT_SESSION_DEEPSEEK_RESUME_RUNTIME_CAPABILITY])
    const response = await callRuntimeEnvironment(userDataPath, 'desk', 'terminal.create', {
      command: 'claude',
      launchAgent: 'deepseek'
    })
    expect(response).toMatchObject({ ok: true })
    expect(sentMethods()).toContain('terminal.create')
  })

  it('leaves non-DeepSeek launches to an older host untouched', async () => {
    hostAdvertises([])
    const response = await callRuntimeEnvironment(userDataPath, 'desk', 'terminal.create', {
      command: 'claude',
      launchAgent: 'claude'
    })
    expect(response).toMatchObject({ ok: true })
    expect(sentMethods()).toContain('terminal.create')
  })
})
