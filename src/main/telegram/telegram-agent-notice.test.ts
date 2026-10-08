import { describe, expect, it, vi } from 'vitest'
import type { AgentStatusEntry } from '../../shared/agent-status-types'
import { UI_LANGUAGE_ENGLISH, UI_LANGUAGE_PORTUGUESE_BRAZIL } from '../../shared/ui-language'
import { setMainUiLanguage } from '../i18n/main-i18n'
import {
  buildTelegramAgentNotice,
  escapeAndClipTelegramText,
  markTelegramNoticeResolved,
  telegramNoticeKindFor
} from './telegram-agent-notice'

vi.mock('electron', () => ({ app: { getLocale: () => 'en-US' } }))

function entry(overrides: Partial<AgentStatusEntry> = {}): AgentStatusEntry {
  return {
    state: 'done',
    prompt: 'fix the build',
    updatedAt: 1,
    stateStartedAt: 1,
    paneKey: 'tab-1:11111111-1111-4111-8111-111111111111',
    stateHistory: [],
    agentType: 'claude',
    ...overrides
  }
}

describe('telegramNoticeKindFor', () => {
  it('maps attention states and real completions', () => {
    expect(telegramNoticeKindFor(entry({ state: 'waiting' }))).toBe('waiting')
    expect(telegramNoticeKindFor(entry({ state: 'blocked' }))).toBe('blocked')
    expect(telegramNoticeKindFor(entry({ state: 'done' }))).toBe('done')
    expect(telegramNoticeKindFor(entry({ state: 'working' }))).toBeNull()
  })

  it('skips session boundaries and hydrated rows', () => {
    expect(telegramNoticeKindFor(entry({ sessionBoundary: true }))).toBeNull()
    expect(telegramNoticeKindFor(entry({ state: 'waiting', restoredUnconfirmed: true }))).toBeNull()
  })
})

describe('buildTelegramAgentNotice', () => {
  it('shows worktree, agent and the trimmed completed summary, HTML-escaped', () => {
    const notice = buildTelegramAgentNotice(
      entry({ lastCompletedAssistantMessage: '  Fixed <Foo> & "bar"  ' }),
      'feature/x <y>'
    )
    expect(notice).toEqual({
      kind: 'done',
      buttons: [],
      text: [
        '✅ Done',
        '<b>feature/x &lt;y&gt;</b> · Claude',
        '💬 <i>fix the build</i>',
        '',
        'Fixed &lt;Foo&gt; &amp; &quot;bar&quot;'
      ].join('\n')
    })
  })

  it('never uses tool output as the done summary', () => {
    const notice = buildTelegramAgentNotice(
      entry({ prompt: '', lastAssistantMessage: 'stdout', lastAssistantMessageIsToolOutput: true }),
      null
    )
    expect(notice?.text).toBe('✅ Done\nClaude')
  })

  it('labels interrupted turns as stopped', () => {
    expect(buildTelegramAgentNotice(entry({ interrupted: true, prompt: '' }), null)?.text).toBe(
      '⏹ Stopped\nClaude'
    )
  })

  it('shows the pending question for a waiting agent', () => {
    const notice = buildTelegramAgentNotice(
      entry({
        state: 'waiting',
        prompt: '',
        agentType: 'codex',
        interactivePrompt: JSON.stringify({ questions: [{ question: 'Deploy now?' }] })
      }),
      'api'
    )
    expect(notice?.kind).toBe('waiting')
    expect(notice?.text).toBe('⏳ Waiting for you\n<b>api</b> · Codex\n\n❓ Deploy now?')
  })

  it('falls back to the tool for a permission wait', () => {
    const notice = buildTelegramAgentNotice(
      entry({ state: 'blocked', prompt: '', toolName: 'Bash', toolInput: 'rm -rf <dir>' }),
      null
    )
    expect(notice?.text).toBe('⛔ Blocked\nClaude\n\n🔧 Bash <code>rm -rf &lt;dir&gt;</code>')
  })

  it('returns null for rows that deserve no notice', () => {
    expect(buildTelegramAgentNotice(entry({ state: 'working' }), 'x')).toBeNull()
    expect(buildTelegramAgentNotice(entry({ sessionBoundary: true }), 'x')).toBeNull()
  })

  it('bounds a huge summary under the Telegram message cap', () => {
    const notice = buildTelegramAgentNotice(
      entry({ lastCompletedAssistantMessage: '&'.repeat(10_000) }),
      'x'
    )
    expect(notice!.text.length).toBeLessThan(4096 - 64)
    expect(notice!.text).not.toMatch(/&[a-z]*…/)
  })

  it('localizes the headline with the main UI language', async () => {
    await setMainUiLanguage(UI_LANGUAGE_PORTUGUESE_BRAZIL)
    try {
      expect(buildTelegramAgentNotice(entry({ prompt: '' }), null)?.text).toBe(
        '✅ Concluído\nClaude'
      )
      expect(markTelegramNoticeResolved('x')).toBe('x\n\n<i>✔ Respondido</i>')
    } finally {
      await setMainUiLanguage(UI_LANGUAGE_ENGLISH)
    }
  })
})

describe('escapeAndClipTelegramText', () => {
  it('clips without splitting an entity', () => {
    expect(escapeAndClipTelegramText('ab&cd', 5)).toBe('ab…')
    expect(escapeAndClipTelegramText('abc', 5)).toBe('abc')
  })
})
