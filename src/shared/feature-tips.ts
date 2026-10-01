import { compareAppVersions, isValidAppVersion } from './app-version'
import {
  hasFeatureInteraction,
  type FeatureInteractionId,
  type FeatureInteractionState
} from './feature-interactions'

export type FeatureTipId =
  | 'voice-dictation'
  | 'dolphin-cli'
  | 'cmd-j-palette'
  | 'agent-session-search'
  | 'claude-agent-teams-windows'

export type FeatureTipPriority = 'new' | 'unseen'

export type FeatureTipAction =
  | 'enable-voice'
  | 'setup-cli'
  | 'learn-cmd-j-palette'
  | 'enable-session-search'
  | 'learn-claude-agent-teams'

/** Who is running the app; tips with an audience rule stay hidden until it is known. */
export type FeatureTipAudience = {
  appVersion: string | null
  windows: boolean
}

export type FeatureTip = {
  id: FeatureTipId
  priority: FeatureTipPriority
  eyebrow: string
  title: string
  description: string
  action: FeatureTipAction
  ctaLabel: string
  /** Feature interactions that mean this tip is no longer useful to show. */
  completedByFeatureInteractions?: readonly FeatureInteractionId[]
  /** Shown only from this app version on, so the tip announces what that release shipped. */
  minAppVersion?: string
  windowsOnly?: boolean
}

export type CompletedFeatureTipState = {
  cliInstalled: boolean
  voiceDictationEnabled: boolean
  /** Search is on, or this client cannot turn it on. */
  sessionSearchTipCompleted: boolean
  featureInteractions?: FeatureInteractionState
}

export const FEATURE_TIPS = [
  {
    id: 'claude-agent-teams-windows',
    priority: 'new',
    eyebrow: 'New',
    title: 'Claude Agent Teams on Windows',
    description:
      'Start Claude Agent Teams and each teammate opens in its own Dolphin pane, side by side with the lead.',
    action: 'learn-claude-agent-teams',
    ctaLabel: 'Got it',
    completedByFeatureInteractions: [],
    minAppVersion: '0.1.21',
    windowsOnly: true
  },
  {
    id: 'agent-session-search',
    priority: 'new',
    eyebrow: 'New',
    title: 'Search every agent session',
    description:
      'Find any past conversation by what was said in it, then pick up where the agent left off.',
    action: 'enable-session-search',
    ctaLabel: 'Turn on session search',
    completedByFeatureInteractions: []
  },
  {
    id: 'dolphin-cli',
    priority: 'new',
    eyebrow: 'Tip',
    title: 'Let agents drive Dolphin with the Dolphin CLI',
    description: 'Enable agents to coordinate child worktrees and communicate between worktrees.',
    action: 'setup-cli',
    ctaLabel: 'Install CLI & Skills',
    completedByFeatureInteractions: []
  },
  {
    id: 'cmd-j-palette',
    priority: 'new',
    eyebrow: 'Tip',
    // Why: "<shortcut>" is a placeholder token; the cmd-j dialog splits the
    // title on it and inlines the live, platform-correct keybinding as a <kbd>.
    title: 'Jump to a worktree with <shortcut>',
    description:
      'Search worktrees, switch tabs, tweak settings, or spin up a new worktree, all without leaving the keyboard.',
    action: 'learn-cmd-j-palette',
    ctaLabel: 'Got it',
    completedByFeatureInteractions: []
  },
  {
    id: 'voice-dictation',
    priority: 'unseen',
    eyebrow: 'Tip',
    title: 'Dictate into any pane',
    description: 'Start voice dictation in any focused pane, then use the shortcut again to stop.',
    action: 'enable-voice',
    ctaLabel: 'Set up voice dictation',
    completedByFeatureInteractions: ['voice-dictation']
  }
] as const satisfies readonly FeatureTip[]

export const FEATURE_TIP_IDS = FEATURE_TIPS.map((tip) => tip.id)

export function isFeatureTipId(value: unknown): value is FeatureTipId {
  return typeof value === 'string' && FEATURE_TIP_IDS.includes(value as FeatureTipId)
}

export function normalizeFeatureTipIds(value: unknown): FeatureTipId[] {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set<FeatureTipId>()
  for (const item of value) {
    if (isFeatureTipId(item)) {
      seen.add(item)
    }
  }
  return [...seen]
}

export function getCompletedFeatureTipIds(state: CompletedFeatureTipState): Set<FeatureTipId> {
  const completedIds = new Set<FeatureTipId>()
  if (state.cliInstalled) {
    completedIds.add('dolphin-cli')
  }
  if (state.voiceDictationEnabled) {
    completedIds.add('voice-dictation')
  }
  if (state.sessionSearchTipCompleted) {
    completedIds.add('agent-session-search')
  }
  for (const tip of FEATURE_TIPS) {
    if (
      tip.completedByFeatureInteractions?.some((id) =>
        hasFeatureInteraction(state.featureInteractions, id)
      )
    ) {
      completedIds.add(tip.id)
    }
  }
  return completedIds
}

export function isFeatureTipForAudience(
  tip: FeatureTip,
  audience: FeatureTipAudience | undefined
): boolean {
  if (tip.windowsOnly && audience?.windows !== true) {
    return false
  }
  if (tip.minAppVersion === undefined) {
    return true
  }
  const appVersion = audience?.appVersion
  return (
    typeof appVersion === 'string' &&
    isValidAppVersion(appVersion) &&
    compareAppVersions(appVersion, tip.minAppVersion) >= 0
  )
}

export function getOrderedUnseenFeatureTips(args: {
  seenTipIds: ReadonlySet<FeatureTipId>
  completedTipIds?: ReadonlySet<FeatureTipId>
  audience?: FeatureTipAudience
}): FeatureTip[] {
  const completedTipIds = args.completedTipIds ?? new Set<FeatureTipId>()
  const unseenTips = FEATURE_TIPS.filter(
    (tip) =>
      !args.seenTipIds.has(tip.id) &&
      !completedTipIds.has(tip.id) &&
      isFeatureTipForAudience(tip, args.audience)
  )
  return [
    ...unseenTips.filter((tip) => tip.priority === 'new'),
    ...unseenTips.filter((tip) => tip.priority !== 'new')
  ]
}
