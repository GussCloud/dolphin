import { describe, expect, it } from 'vitest'
import {
  FEATURE_TIPS,
  getCompletedFeatureTipIds,
  getOrderedUnseenFeatureTips,
  isFeatureTipForAudience,
  normalizeFeatureTipIds,
  type FeatureTipId
} from './feature-tips'

describe('feature tips', () => {
  it('orders new unseen tips before older unseen tips', () => {
    const tips = getOrderedUnseenFeatureTips({ seenTipIds: new Set<FeatureTipId>() })

    expect(tips.map((tip) => tip.id)).toEqual([
      'agent-session-search',
      'dolphin-cli',
      'cmd-j-palette',
      'voice-dictation'
    ])
  })

  it('skips tips the user has already seen', () => {
    const tips = getOrderedUnseenFeatureTips({
      seenTipIds: new Set<FeatureTipId>([
        'voice-dictation',
        'dolphin-cli',
        'cmd-j-palette',
        'agent-session-search',
        'claude-agent-teams-windows',
        'telegram-integration'
      ])
    })

    expect(tips.map((tip) => tip.id)).toEqual([])
  })

  it('skips tips for features the user has already completed', () => {
    const tips = getOrderedUnseenFeatureTips({
      // cmd-j is a seen-based tip with no feature completion, so mark it seen here.
      seenTipIds: new Set<FeatureTipId>(['cmd-j-palette']),
      completedTipIds: getCompletedFeatureTipIds({
        cliInstalled: true,
        voiceDictationEnabled: true,
        sessionSearchTipCompleted: true
      })
    })

    expect(tips.map((tip) => tip.id)).toEqual([])
  })

  it('skips the CLI tip when the CLI is already installed', () => {
    const tips = getOrderedUnseenFeatureTips({
      seenTipIds: new Set<FeatureTipId>(['voice-dictation', 'cmd-j-palette']),
      completedTipIds: getCompletedFeatureTipIds({
        cliInstalled: true,
        voiceDictationEnabled: false,
        sessionSearchTipCompleted: true
      })
    })

    expect(tips.map((tip) => tip.id)).toEqual([])
  })

  it('skips tips for features the user has already interacted with', () => {
    const tips = getOrderedUnseenFeatureTips({
      seenTipIds: new Set<FeatureTipId>(),
      completedTipIds: getCompletedFeatureTipIds({
        cliInstalled: false,
        voiceDictationEnabled: false,
        sessionSearchTipCompleted: true,
        featureInteractions: {
          'voice-dictation': { firstInteractedAt: 100, interactionCount: 1 }
        }
      })
    })

    expect(tips.map((tip) => tip.id)).toEqual(['dolphin-cli', 'cmd-j-palette'])
  })

  it('normalizes persisted tip ids', () => {
    expect(
      normalizeFeatureTipIds([
        'feature-tour',
        'dolphin-cli',
        'bogus',
        'cmd-j-palette',
        'voice-dictation'
      ])
    ).toEqual(['dolphin-cli', 'cmd-j-palette', 'voice-dictation'])
  })

  it('describes the command palette tip as a passive acknowledgement', () => {
    const paletteTip = FEATURE_TIPS.find((tip) => tip.id === 'cmd-j-palette')

    expect(paletteTip).toMatchObject({
      action: 'learn-cmd-j-palette',
      priority: 'new',
      eyebrow: 'Tip',
      ctaLabel: 'Got it'
    })
    expect(paletteTip?.description).toContain('worktrees')
    expect(paletteTip?.description).toContain('spin up a new worktree')
  })

  it('describes the CLI tip as an install action with concrete workflows', () => {
    const cliTip = FEATURE_TIPS.find((tip) => tip.id === 'dolphin-cli')

    expect(cliTip).toMatchObject({
      action: 'setup-cli',
      title: 'Let agents drive Dolphin with the Dolphin CLI',
      ctaLabel: 'Install CLI & Skills'
    })
    expect(cliTip?.description).toContain('coordinate child worktrees')
    expect(cliTip?.description).toContain('communicate between worktrees')
  })

  it('does not label the voice dictation tip as new', () => {
    const voiceTip = FEATURE_TIPS.find((tip) => tip.id === 'voice-dictation')

    expect(voiceTip?.eyebrow).toBe('Tip')
    expect(voiceTip?.priority).toBe('unseen')
    expect(voiceTip?.title).toBe('Dictate into any pane')
    expect(voiceTip?.ctaLabel).toBe('Set up voice dictation')
  })

  describe('Claude Agent Teams on Windows tip', () => {
    const tip = FEATURE_TIPS.find((entry) => entry.id === 'claude-agent-teams-windows')
    if (!tip) {
      throw new Error('Expected claude-agent-teams-windows feature tip')
    }

    it('is a new passive tip', () => {
      expect(tip).toMatchObject({
        action: 'learn-claude-agent-teams',
        priority: 'new',
        eyebrow: 'New',
        ctaLabel: 'Got it'
      })
    })

    it('shows on Windows from 0.1.21 on', () => {
      expect(isFeatureTipForAudience(tip, { appVersion: '0.1.21', windows: true })).toBe(true)
      expect(isFeatureTipForAudience(tip, { appVersion: '0.2.0', windows: true })).toBe(true)
    })

    it('stays hidden before 0.1.21, off Windows, or while the version is unknown', () => {
      expect(isFeatureTipForAudience(tip, { appVersion: '0.1.20', windows: true })).toBe(false)
      expect(isFeatureTipForAudience(tip, { appVersion: '0.1.21-rc.1', windows: true })).toBe(false)
      expect(isFeatureTipForAudience(tip, { appVersion: '0.1.21', windows: false })).toBe(false)
      expect(isFeatureTipForAudience(tip, { appVersion: null, windows: true })).toBe(false)
      expect(isFeatureTipForAudience(tip, { appVersion: 'dev', windows: true })).toBe(false)
      expect(isFeatureTipForAudience(tip, undefined)).toBe(false)
    })

    it('comes first for an eligible audience', () => {
      const tips = getOrderedUnseenFeatureTips({
        seenTipIds: new Set<FeatureTipId>(),
        audience: { appVersion: '0.1.21', windows: true }
      })

      expect(tips[0]?.id).toBe('claude-agent-teams-windows')
    })
  })

  describe('Telegram integration tip', () => {
    const tip = FEATURE_TIPS.find((entry) => entry.id === 'telegram-integration')
    if (!tip) {
      throw new Error('Expected telegram-integration feature tip')
    }

    it('is a new tip that leads to Telegram setup', () => {
      expect(tip).toMatchObject({
        action: 'setup-telegram',
        priority: 'new',
        eyebrow: 'New',
        ctaLabel: 'Set up Telegram'
      })
    })

    it('shows from 0.2.3 on, on every platform', () => {
      expect(isFeatureTipForAudience(tip, { appVersion: '0.2.3', windows: false })).toBe(true)
      expect(isFeatureTipForAudience(tip, { appVersion: '0.2.3', windows: true })).toBe(true)
      expect(isFeatureTipForAudience(tip, { appVersion: '0.3.0', windows: false })).toBe(true)
    })

    it('stays hidden before 0.2.3 or while the version is unknown', () => {
      expect(isFeatureTipForAudience(tip, { appVersion: '0.2.2', windows: false })).toBe(false)
      expect(isFeatureTipForAudience(tip, { appVersion: null, windows: false })).toBe(false)
      expect(isFeatureTipForAudience(tip, undefined)).toBe(false)
    })

    it('comes before every other tip for an eligible audience', () => {
      const tips = getOrderedUnseenFeatureTips({
        seenTipIds: new Set<FeatureTipId>(),
        audience: { appVersion: '0.2.3', windows: true }
      })

      expect(tips[0]?.id).toBe('telegram-integration')
    })
  })
})
