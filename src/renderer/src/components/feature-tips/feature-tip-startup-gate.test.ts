import { describe, expect, it } from 'vitest'
import { getDefaultOnboardingState, getDefaultVoiceSettings } from '../../../../shared/constants'
import type { CliInstallStatus } from '../../../../shared/cli-install-types'
import type { FeatureTipAudience, FeatureTipId } from '../../../../shared/feature-tips'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { OnboardingState } from '../../../../shared/onboarding-state-types'
import {
  getFeatureTipsAppOpenDecision,
  isCliFeatureTipCompleted,
  isSessionSearchFeatureTipCompleted
} from './feature-tip-startup-gate'

const existingUserOnboarding: OnboardingState = {
  ...getDefaultOnboardingState(),
  closedAt: Date.parse('2026-05-17T00:00:00.000Z'),
  outcome: 'completed',
  lastCompletedStep: 4
}

const firstTimeOnboarding: OnboardingState = getDefaultOnboardingState()

// Session search defaults on so tests about the older tips don't see the session-search tip first.
function makeSettings(
  voiceEnabled = false,
  sessionSearchEnabled = true
): Pick<GlobalSettings, 'voice' | 'aiVaultSearch'> {
  return {
    voice: {
      ...getDefaultVoiceSettings(),
      enabled: voiceEnabled
    },
    aiVaultSearch: { enabled: sessionSearchEnabled, historyDays: null }
  }
}

function makeCliStatus(overrides: Partial<CliInstallStatus> = {}): CliInstallStatus {
  return {
    platform: 'darwin',
    commandName: 'dolphin',
    supported: true,
    state: 'installed',
    commandPath: '/usr/local/bin/dolphin',
    pathDirectory: '/usr/local/bin',
    pathConfigured: true,
    launcherPath: '/Applications/Dolphin.app/Contents/MacOS/dolphin',
    installMethod: 'symlink',
    currentTarget: null,
    unsupportedReason: null,
    detail: null,
    ...overrides
  }
}

describe('feature tip startup gate', () => {
  it('opens the CLI feature tip first for an existing user on app open', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'open', tipId: 'dolphin-cli' })
  })

  it('suppresses feature tips for first-time users while onboarding is showing', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: firstTimeOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'suppress-for-onboarding' })
  })

  it('does not open later in the same session after onboarding suppressed it', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: true,
        webClient: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('opens the CLI tip after the voice tip was marked seen', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: ['voice-dictation'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'open', tipId: 'dolphin-cli' })
  })

  it('opens the CLI tip after voice dictation is already enabled', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(true),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'open', tipId: 'dolphin-cli' })
  })

  it('opens the command palette tip after the CLI tip was marked seen', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: true,
        featureTipsSeenIds: ['dolphin-cli'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'open', tipId: 'cmd-j-palette' })
  })

  it('does not open after every tip was marked seen', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: false,
        featureTipsSeenIds: ['voice-dictation', 'dolphin-cli', 'cmd-j-palette'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('does not open the voice tip after Settings marked it seen and dictation is disabled', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: true,
        featureTipsSeenIds: ['voice-dictation', 'cmd-j-palette'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(false),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('does not open the CLI tip after the CLI is installed', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: true,
        featureTipsSeenIds: ['voice-dictation', 'cmd-j-palette'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('waits for CLI install status before opening the CLI tip', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: null,
        featureTipsSeenIds: ['voice-dictation'],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('waits for CLI install status before opening later tips', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: null,
        featureTipsSeenIds: [],
        featureInteractions: {},
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('does not open after the user already interacted with the feature', () => {
    expect(
      getFeatureTipsAppOpenDecision({
        activeModal: 'none',
        cliInstalled: true,
        featureTipsSeenIds: ['cmd-j-palette'],
        featureInteractions: {
          'voice-dictation': { firstInteractedAt: 100, interactionCount: 1 }
        },
        onboarding: existingUserOnboarding,
        persistedUIReady: true,
        promptedThisSession: false,
        settings: makeSettings(),
        suppressedByOnboardingThisSession: false,
        webClient: false
      })
    ).toEqual({ kind: 'skip' })
  })

  it('requires an installed CLI to also be configured on PATH', () => {
    expect(isCliFeatureTipCompleted(makeCliStatus())).toBe(true)
    expect(isCliFeatureTipCompleted(makeCliStatus({ pathConfigured: false }))).toBe(false)
  })

  it('treats unsupported CLI setup as completed for feature tips', () => {
    expect(
      isCliFeatureTipCompleted(
        makeCliStatus({
          supported: false,
          state: 'unsupported',
          pathConfigured: false
        })
      )
    ).toBe(true)
  })

  function decideForExistingUser(args: {
    sessionSearchEnabled: boolean
    webClient: boolean
    featureTipsSeenIds?: FeatureTipId[]
    audience?: FeatureTipAudience | null
  }): ReturnType<typeof getFeatureTipsAppOpenDecision> {
    return getFeatureTipsAppOpenDecision({
      activeModal: 'none',
      audience: args.audience,
      cliInstalled: false,
      featureTipsSeenIds: args.featureTipsSeenIds ?? [],
      featureInteractions: {},
      onboarding: existingUserOnboarding,
      persistedUIReady: true,
      promptedThisSession: false,
      settings: makeSettings(false, args.sessionSearchEnabled),
      suppressedByOnboardingThisSession: false,
      webClient: args.webClient
    })
  }

  it('opens the session search tip first while search is off', () => {
    expect(decideForExistingUser({ sessionSearchEnabled: false, webClient: false })).toEqual({
      kind: 'open',
      tipId: 'agent-session-search'
    })
  })

  it('skips the session search tip once it has been seen', () => {
    expect(
      decideForExistingUser({
        sessionSearchEnabled: false,
        webClient: false,
        featureTipsSeenIds: ['agent-session-search']
      })
    ).toEqual({ kind: 'open', tipId: 'dolphin-cli' })
  })

  it('skips the session search tip when search is already on or on a web client', () => {
    expect(decideForExistingUser({ sessionSearchEnabled: true, webClient: false })).toEqual({
      kind: 'open',
      tipId: 'dolphin-cli'
    })
    expect(decideForExistingUser({ sessionSearchEnabled: false, webClient: true })).toEqual({
      kind: 'open',
      tipId: 'dolphin-cli'
    })
  })

  it('treats a profile with no session search settings as search off', () => {
    expect(isSessionSearchFeatureTipCompleted({}, false)).toBe(false)
  })

  it('waits for the app version before choosing a tip', () => {
    expect(
      decideForExistingUser({ sessionSearchEnabled: false, webClient: false, audience: null })
    ).toEqual({ kind: 'skip' })
  })

  it('opens the Agent Teams tip first for Windows users on 0.1.21', () => {
    expect(
      decideForExistingUser({
        sessionSearchEnabled: false,
        webClient: false,
        audience: { appVersion: '0.1.21', windows: true }
      })
    ).toEqual({ kind: 'open', tipId: 'claude-agent-teams-windows' })
  })

  it('skips the Agent Teams tip off Windows or before 0.1.21', () => {
    expect(
      decideForExistingUser({
        sessionSearchEnabled: false,
        webClient: false,
        audience: { appVersion: '0.1.21', windows: false }
      })
    ).toEqual({ kind: 'open', tipId: 'agent-session-search' })
    expect(
      decideForExistingUser({
        sessionSearchEnabled: false,
        webClient: false,
        audience: { appVersion: '0.1.20', windows: true }
      })
    ).toEqual({ kind: 'open', tipId: 'agent-session-search' })
  })

  it('opens the Telegram tip first on the first launch of 0.2.3, on every platform', () => {
    for (const windows of [true, false]) {
      expect(
        decideForExistingUser({
          sessionSearchEnabled: false,
          webClient: false,
          audience: { appVersion: '0.2.3', windows }
        })
      ).toEqual({ kind: 'open', tipId: 'telegram-integration' })
    }
  })

  it('never reopens the Telegram tip once it was shown', () => {
    expect(
      decideForExistingUser({
        sessionSearchEnabled: true,
        webClient: false,
        featureTipsSeenIds: ['telegram-integration', 'dolphin-cli', 'cmd-j-palette'],
        audience: { appVersion: '0.2.4', windows: false }
      })
    ).toEqual({ kind: 'open', tipId: 'voice-dictation' })
  })

  it('never opens the Telegram tip in the web client', () => {
    expect(
      decideForExistingUser({
        sessionSearchEnabled: false,
        webClient: true,
        audience: { appVersion: '0.2.3', windows: false }
      })
    ).toEqual({ kind: 'open', tipId: 'dolphin-cli' })
  })

  it('keeps the Telegram tip hidden before 0.2.3', () => {
    expect(
      decideForExistingUser({
        sessionSearchEnabled: false,
        webClient: false,
        audience: { appVersion: '0.2.2', windows: false }
      })
    ).toEqual({ kind: 'open', tipId: 'agent-session-search' })
  })
})
