import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { AgentHookServer, _internals } from './server'
import { buildBody, GOOD_PANE, PANE, postHookEvent } from './server.test-fixtures'

vi.mock('../telemetry/client', () => ({ track: vi.fn() }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: vi.fn(() => ({})) }))

// Agent Teams teammate panes must never be relaunched with provider resume, so every row the
// store writes for one carries `terminalResumeEligible: false`, across restarts too.
describe('teammate panes are not terminal-resumable', () => {
  let userDataPath: string

  beforeEach(() => {
    _internals.resetCachesForTests()
    userDataPath = mkdtempSync(join(tmpdir(), 'dolphin-teammate-not-resumable-'))
  })

  afterEach(() => {
    rmSync(userDataPath, { recursive: true, force: true })
  })

  async function startServer(): Promise<AgentHookServer> {
    const server = new AgentHookServer()
    await server.start({ env: 'production', userDataPath })
    return server
  }

  function osc(server: AgentHookServer, paneKey: string, state: 'working' | 'done'): void {
    server.ingestTerminalStatus({
      paneKey,
      connectionId: null,
      payload: { state, prompt: '', agentType: 'claude' }
    })
  }

  function rowFor(server: AgentHookServer, paneKey: string) {
    return server.getStatusSnapshot().find((row) => row.paneKey === paneKey)
  }

  it('stamps hook and OSC rows for a registered pane only', async () => {
    const server = await startServer()
    try {
      server.markPaneNotTerminalResumable(PANE)
      await postHookEvent(server, buildBody({ hook_event_name: 'UserPromptSubmit', prompt: 'go' }))
      expect(rowFor(server, PANE)?.terminalResumeEligible).toBe(false)

      osc(server, PANE, 'done')
      expect(rowFor(server, PANE)?.terminalResumeEligible).toBe(false)

      osc(server, GOOD_PANE, 'working')
      expect(rowFor(server, GOOD_PANE)).not.toHaveProperty('terminalResumeEligible')
    } finally {
      await server.stop()
    }
  })

  it('persists the stamp and keeps it on rows written after hydrate', async () => {
    const first = await startServer()
    first.markPaneNotTerminalResumable(PANE)
    await postHookEvent(first, buildBody({ hook_event_name: 'UserPromptSubmit', prompt: 'go' }))
    await first.flushStatusPersist()
    await first.stop()
    const persisted = JSON.parse(
      readFileSync(join(userDataPath, 'agent-hooks', 'last-status.json'), 'utf8')
    )
    expect(persisted.entries[PANE].terminalResumeEligible).toBe(false)

    const second = await startServer()
    try {
      expect(rowFor(second, PANE)?.terminalResumeEligible).toBe(false)
      await postHookEvent(second, buildBody({ hook_event_name: 'Stop' }))
      expect(rowFor(second, PANE)?.terminalResumeEligible).toBe(false)
    } finally {
      await second.stop()
    }
  })
})
