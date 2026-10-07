import type { MobileGitUpstreamStatus } from './mobile-git-status'
import { sourceControlText } from './source-control-text'

// Icon identifier resolved to a lucide component by the screen. Kept as a string
// here so this module stays free of the native lucide import and unit-testable.
export type MobileSourceControlActionIcon =
  | 'commit'
  | 'push'
  | 'pull'
  | 'sync'
  | 'fetch'
  | 'publish'
  | 'rebase'
  | 'pr'
  | 'branch'
  | 'history'

export type MobileSourceControlAction = {
  label: string
  iconKey: MobileSourceControlActionIcon
  disabled?: boolean
  hint?: string
  loading?: boolean
  skipAutoClose?: boolean
  onPress: () => void
}

export type MobileSourceControlActionArgs = {
  commitMessage: string
  stagedCount: number
  upstream: MobileGitUpstreamStatus | null
  upstreamKnown: boolean
  busyAction: string | null
  openingPath: string | null
  openingBranchPath: string | null
  prAvailable: boolean
  handlers: {
    commit: () => void
    commitPush: () => void
    commitSync: () => void
    push: () => void
    pull: () => void
    sync: () => void
    fetch: () => void
    publish: () => void
    fastForward: () => void
    rebase: () => void
    createPr: () => void
    pushAndCreatePr: () => void
    checkout: () => void
    history: () => void
  }
}

// Builds the source-control bottom-sheet action list. Pure (no hooks) so it can
// be unit-tested and keeps the screen file lean. Enable/disable rules mirror the
// desktop primary-action gating.
export function buildMobileSourceControlActions(
  args: MobileSourceControlActionArgs
): MobileSourceControlAction[] {
  const { commitMessage, stagedCount, upstream, upstreamKnown, handlers } = args
  const hasMessage = commitMessage.trim().length > 0
  const hasStaged = stagedCount > 0
  const hasUpstream = upstream?.hasUpstream === true
  const ahead = upstream?.ahead ?? 0
  const behind = upstream?.behind ?? 0
  const busy =
    args.busyAction !== null || args.openingPath !== null || args.openingBranchPath !== null
  const commitHint = !hasStaged
    ? sourceControlText('sheetStageFile')
    : !hasMessage
      ? sourceControlText('sheetEnterMessage')
      : undefined
  const remoteHint = !upstreamKnown
    ? sourceControlText('sheetCheckingBranch')
    : hasUpstream
      ? undefined
      : sourceControlText('sheetPublishFirst')
  const prHint = !upstreamKnown
    ? sourceControlText('sheetCheckingBranch')
    : !args.prAvailable
      ? sourceControlText('sheetPrUnavailable')
      : undefined

  return [
    {
      label: sourceControlText('actionCommit'),
      iconKey: 'commit',
      disabled: busy || !!commitHint,
      hint: commitHint,
      loading: args.busyAction === 'commit',
      skipAutoClose: true,
      onPress: handlers.commit
    },
    {
      label: sourceControlText('actionCommitPush'),
      iconKey: 'push',
      disabled: busy || !!commitHint || !upstreamKnown || !hasUpstream,
      hint: commitHint ?? remoteHint,
      loading: args.busyAction === 'commit-push',
      skipAutoClose: true,
      onPress: handlers.commitPush
    },
    {
      label: sourceControlText('actionCommitSync'),
      iconKey: 'sync',
      disabled: busy || !!commitHint || !upstreamKnown || !hasUpstream || behind === 0,
      hint:
        commitHint ??
        (!upstreamKnown || !hasUpstream
          ? remoteHint
          : behind === 0
            ? sourceControlText('sheetNothingToPull')
            : undefined),
      loading: args.busyAction === 'commit-sync',
      skipAutoClose: true,
      onPress: handlers.commitSync
    },
    {
      label:
        ahead > 0
          ? sourceControlText('actionPushCount', { count: ahead })
          : sourceControlText('actionPush'),
      iconKey: 'push',
      disabled: busy || !upstreamKnown || !hasUpstream || ahead === 0,
      hint: !hasUpstream
        ? remoteHint
        : ahead === 0
          ? sourceControlText('sheetNothingToPush')
          : undefined,
      loading: args.busyAction === 'push',
      skipAutoClose: true,
      onPress: handlers.push
    },
    {
      label: sourceControlText('actionCreatePr'),
      iconKey: 'pr',
      disabled: busy || !args.prAvailable,
      hint: prHint,
      loading: args.busyAction === 'create-pr',
      skipAutoClose: true,
      onPress: handlers.createPr
    },
    {
      label: sourceControlText('actionPushCreatePr'),
      iconKey: 'pr',
      disabled: busy || !upstreamKnown || !hasUpstream || ahead === 0 || !args.prAvailable,
      hint: prHint ?? (!hasUpstream ? remoteHint : undefined),
      loading: args.busyAction === 'push-create-pr',
      skipAutoClose: true,
      onPress: handlers.pushAndCreatePr
    },
    {
      label:
        behind > 0
          ? sourceControlText('actionPullCount', { count: behind })
          : sourceControlText('actionPull'),
      iconKey: 'pull',
      disabled: busy || !upstreamKnown || !hasUpstream || behind === 0,
      hint: !hasUpstream
        ? remoteHint
        : behind === 0
          ? sourceControlText('sheetNothingToPull')
          : undefined,
      loading: args.busyAction === 'pull',
      skipAutoClose: true,
      onPress: handlers.pull
    },
    {
      label:
        ahead > 0 || behind > 0
          ? sourceControlText('actionSyncCounts', { behind, ahead })
          : sourceControlText('actionSync'),
      iconKey: 'sync',
      disabled: busy || !upstreamKnown || !hasUpstream || (ahead === 0 && behind === 0),
      hint:
        !upstreamKnown || !hasUpstream
          ? remoteHint
          : ahead === 0 && behind === 0
            ? sourceControlText('sheetUpToDate')
            : undefined,
      loading: args.busyAction === 'sync',
      skipAutoClose: true,
      onPress: handlers.sync
    },
    {
      label: sourceControlText('actionFetch'),
      iconKey: 'fetch',
      disabled: busy,
      loading: args.busyAction === 'fetch',
      skipAutoClose: true,
      onPress: handlers.fetch
    },
    {
      label: sourceControlText('actionPublishBranch'),
      iconKey: 'publish',
      disabled: busy || !upstreamKnown || hasUpstream,
      hint: !upstreamKnown
        ? sourceControlText('sheetCheckingBranch')
        : hasUpstream
          ? sourceControlText('sheetAlreadyPublished')
          : undefined,
      loading: args.busyAction === 'publish',
      skipAutoClose: true,
      onPress: handlers.publish
    },
    {
      label:
        behind > 0
          ? sourceControlText('actionFastForwardCount', { count: behind })
          : sourceControlText('actionFastForward'),
      iconKey: 'pull',
      disabled: busy || !upstreamKnown || !hasUpstream || behind === 0 || ahead > 0,
      hint: !hasUpstream
        ? remoteHint
        : behind === 0
          ? sourceControlText('sheetNothingToFastForward')
          : ahead > 0
            ? sourceControlText('sheetLocalCommitsLost')
            : undefined,
      loading: args.busyAction === 'fast-forward',
      skipAutoClose: true,
      onPress: handlers.fastForward
    },
    {
      label: sourceControlText('actionRebase'),
      iconKey: 'branch',
      disabled: busy,
      loading: args.busyAction === 'rebase',
      skipAutoClose: true,
      onPress: handlers.rebase
    },
    {
      label: sourceControlText('actionSwitchBranch'),
      iconKey: 'branch',
      disabled: busy,
      skipAutoClose: true,
      onPress: handlers.checkout
    },
    {
      label: sourceControlText('actionCommits'),
      iconKey: 'history',
      disabled: busy,
      onPress: handlers.history
    }
  ]
}
