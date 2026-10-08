/**
 * Pins how `tui-idle` (orchestration sends, agent.launch prompts) reads Claude's
 * development-channels confirmation, using captures from a live claude 2.1.294 launched with
 * `--dangerously-load-development-channels` (the Telegram channel opt-in).
 * Capture protocol: docs/reference/agent-pty-transcript-capture.md
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { extractLastOscTitle } from '../../shared/osc-title-extraction'
import { grantClaudeChannelPane, markClaudeChannelPty } from '../telegram/claude-channel-panes'
import { createTranscriptPane, TRANSCRIPT_PANE_PTY_ID } from './agent-transcript-pane-test-harness'

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

function markTranscriptPaneAsChannelLaunch(): void {
  const env = {
    DOLPHIN_PANE_KEY: 'tab-1:transcript',
    DOLPHIN_AGENT_LAUNCH_TOKEN: 'transcript-launch'
  }
  grantClaudeChannelPane(env)
  markClaudeChannelPty(TRANSCRIPT_PANE_PTY_ID, env)
}

describe('Claude development-channels confirmation, decided by captured transcripts', () => {
  it('is idle-looking text in a PTY Dolphin did not launch with the channel flag', async () => {
    // An agent reading these sources or a `cat` of the fixture prints the same bytes.
    expect(await tuiIdleSatisfied('claude-dev-channels-dialog', 1_500)).toBe(true)
  })

  it('blocks tui-idle while the confirmation owns a channel PTY', async () => {
    markTranscriptPaneAsChannelLaunch()
    expect(await tuiIdleSatisfied('claude-dev-channels-dialog', 1_500)).toBe(false)
  })

  it('is idle once the confirmation is answered and the session is up', async () => {
    markTranscriptPaneAsChannelLaunch()
    expect(await tuiIdleSatisfied('claude-dev-channels-confirmed', 3_000)).toBe(true)
  })
})
