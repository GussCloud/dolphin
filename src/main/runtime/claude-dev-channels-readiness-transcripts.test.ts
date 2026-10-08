/**
 * Pins how `tui-idle` (orchestration sends, agent.launch prompts) reads Claude's
 * development-channels confirmation, using captures from a live claude 2.1.294 launched with
 * `--dangerously-load-development-channels` (the Telegram channel opt-in).
 * Capture protocol: docs/reference/agent-pty-transcript-capture.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createTranscriptPane } from './agent-transcript-pane-test-harness'
import { extractLastOscTitle } from '../../shared/osc-title-extraction'

vi.mock('electron', () => ({
  BrowserWindow: { fromId: vi.fn(() => null) },
  webContents: { fromId: vi.fn(() => null) },
  ipcMain: { on: vi.fn(), removeListener: vi.fn() },
  app: { getPath: vi.fn(() => '/tmp') }
}))

const FIXTURE_DIR = join(__dirname, '__fixtures__')

async function tuiIdleSatisfied(fixture: string, timeoutMs: number): Promise<boolean> {
  const transcript = readFileSync(join(FIXTURE_DIR, `${fixture}.txt`), 'utf8')
  const { runtime, handle } = await createTranscriptPane({
    paneTitle: extractLastOscTitle(transcript) ?? 'claude',
    foregroundProcess: 'claude',
    launchAgent: 'claude',
    data: transcript
  })
  try {
    const result: unknown = await runtime.waitForTerminal(handle, {
      condition: 'tui-idle',
      timeoutMs
    })
    return typeof result === 'object' && result !== null && 'satisfied' in result
      ? result.satisfied === true
      : false
  } catch {
    return false
  }
}

describe('Claude development-channels confirmation, decided by captured transcripts', () => {
  it('is not idle while the confirmation owns the screen', async () => {
    expect(await tuiIdleSatisfied('claude-dev-channels-dialog', 1_500)).toBe(false)
  })

  it('is idle once the confirmation is answered and the session is up', async () => {
    expect(await tuiIdleSatisfied('claude-dev-channels-confirmed', 3_000)).toBe(true)
  })
})
