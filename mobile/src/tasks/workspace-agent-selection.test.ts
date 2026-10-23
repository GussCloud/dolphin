import { describe, expect, it } from 'vitest'

import {
  isWorkspaceAgentOfferable,
  normalizeWorkspaceAgent,
  pickWorkspaceAgent,
  resolveWorkspaceAgentSelection,
  workspaceAgentLabel
} from './workspace-agent-selection'

describe('workspace agent selection', () => {
  it('uses an installed explicit default agent', () => {
    expect(pickWorkspaceAgent({ defaultTuiAgent: 'codex' }, new Set(['claude', 'codex']))).toBe(
      'codex'
    )
  })

  it('falls back by desktop auto-pick order when the default is unavailable on the target host', () => {
    expect(pickWorkspaceAgent({ defaultTuiAgent: 'codex' }, new Set(['claude']))).toBe('claude')
  })

  it('skips disabled preferred and fallback agents', () => {
    expect(
      pickWorkspaceAgent(
        { defaultTuiAgent: 'codex', disabledTuiAgents: ['codex'] },
        new Set(['claude', 'codex'])
      )
    ).toBe('claude')
    expect(
      pickWorkspaceAgent(
        { defaultTuiAgent: null, disabledTuiAgents: ['claude', 'codex', 'not-real'] },
        new Set(['claude', 'codex'])
      )
    ).toBe('blank')
  })

  it('honors blank terminal as an explicit no-agent preference', () => {
    expect(pickWorkspaceAgent({ defaultTuiAgent: 'blank' }, new Set(['claude', 'codex']))).toBe(
      'blank'
    )
  })

  it('returns blank when detection completed and no known agent exists', () => {
    expect(pickWorkspaceAgent({ defaultTuiAgent: null }, new Set(['unknown-agent']))).toBe('blank')
  })

  it('uses the preferred/default display value while detection is still pending', () => {
    expect(pickWorkspaceAgent({ defaultTuiAgent: 'codex' }, null)).toBe('codex')
    expect(pickWorkspaceAgent({ defaultTuiAgent: null }, null)).toBe('claude')
    expect(
      pickWorkspaceAgent({ defaultTuiAgent: 'codex', disabledTuiAgents: ['codex'] }, null)
    ).toBe('claude')
  })

  it('normalizes legacy blank sentinel and labels known choices', () => {
    expect(normalizeWorkspaceAgent('__blank__')).toBe('blank')
    expect(workspaceAgentLabel('codex')).toBe('Codex')
  })

  it('keeps automatic selection current while create selection is active', () => {
    expect(
      resolveWorkspaceAgentSelection({
        selectionActive: true,
        settings: { defaultTuiAgent: 'codex' },
        detectedAgentIds: new Set(['claude', 'codex']),
        agent: null,
        overridden: false
      })
    ).toEqual({ agent: 'codex', overridden: false })
  })

  it('preserves a valid user override', () => {
    expect(
      resolveWorkspaceAgentSelection({
        selectionActive: true,
        settings: { defaultTuiAgent: 'claude' },
        detectedAgentIds: new Set(['claude', 'codex']),
        agent: 'codex',
        overridden: true
      })
    ).toEqual({ agent: 'codex', overridden: true })
  })

  it('falls back when a user override is unavailable after detection settles', () => {
    expect(
      resolveWorkspaceAgentSelection({
        selectionActive: true,
        settings: { defaultTuiAgent: 'codex' },
        detectedAgentIds: new Set(['claude']),
        agent: 'codex',
        overridden: true
      })
    ).toEqual({ agent: 'claude', overridden: false })
  })

  it('does not repair inactive selection state', () => {
    expect(
      resolveWorkspaceAgentSelection({
        selectionActive: false,
        settings: { defaultTuiAgent: 'codex' },
        detectedAgentIds: new Set(['codex']),
        agent: null,
        overridden: false
      })
    ).toEqual({ agent: null, overridden: false })
  })
  describe('DeepSeek on a host whose agents are unknown', () => {
    it('is not offerable until the host reports it', () => {
      expect(isWorkspaceAgentOfferable('deepseek', null)).toBe(false)
      expect(isWorkspaceAgentOfferable('deepseek-agent-teams', null)).toBe(false)
      expect(isWorkspaceAgentOfferable('claude', null)).toBe(true)
      expect(isWorkspaceAgentOfferable('deepseek', new Set(['deepseek']))).toBe(true)
      expect(isWorkspaceAgentOfferable('deepseek', new Set(['claude']))).toBe(false)
    })

    it('does not auto-pick a DeepSeek default when detection is unknown', () => {
      expect(pickWorkspaceAgent({ defaultTuiAgent: 'deepseek' }, null)).toBe('claude')
      expect(pickWorkspaceAgent({ defaultTuiAgent: 'deepseek' }, new Set(['deepseek']))).toBe(
        'deepseek'
      )
    })

    it('drops a DeepSeek override once detection becomes unknown', () => {
      expect(
        resolveWorkspaceAgentSelection({
          selectionActive: true,
          settings: { defaultTuiAgent: null },
          detectedAgentIds: null,
          agent: 'deepseek',
          overridden: true
        })
      ).toEqual({ agent: 'claude', overridden: false })
      expect(
        resolveWorkspaceAgentSelection({
          selectionActive: true,
          settings: { defaultTuiAgent: null },
          detectedAgentIds: null,
          agent: 'codex',
          overridden: true
        })
      ).toEqual({ agent: 'codex', overridden: true })
    })
  })
})
