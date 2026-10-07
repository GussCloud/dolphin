import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const sessionReviewEn = {
  // Diff review loading
  committedChangesUnavailable: 'Committed changes unavailable',
  committedChangesFailed: 'Committed changes failed',
  updateDesktopToReview: 'Update Dolphin desktop to review changes on mobile.',
  loadChangesFailed: 'Unable to load changes',
  sourceControlResponseInvalid: 'Source control response was invalid',
  loadReviewNotesFailed: 'Unable to load review notes',
  loadDiffFailed: 'Unable to load diff',
  committedDiffUnavailable: 'Committed diff is unavailable',

  // Review scopes
  scopeBranch: 'Branch',
  scopeStaged: 'Staged',
  scopeUnstaged: 'Unstaged',
  committedOnBranch: 'Committed on branch',

  // Review actions
  waitingForDesktop: 'Waiting for desktop...',
  sourceControlActionFailed: 'Source control action failed',
  stagedWithFailures: '{staged} staged, {failed} failed',
  reviewedFilesStaged: {
    one: '{count} reviewed file staged',
    other: '{count} reviewed files staged'
  },
  saveReviewStateFailed: 'Failed to save review state',
  saveReviewFailed: 'Failed to save review',
  missingWorktree: 'Missing worktree',
  loadReviewFailed: 'Unable to load review',
  openInSessionFailed: 'Unable to open in session',
  copyReviewNotesFailed: 'Unable to copy the review notes',
  reviewNotesCopied: 'Review notes copied',
  sendNotesFailed: 'Failed to send notes',
  terminalInputLocked: 'Terminal input is locked',
  reviewNotesSent: 'Review notes sent',
  createTerminalFailed: 'Failed to create terminal',
  loadAgentSessionsFailed: 'Unable to load agent sessions',

  // Pull requests
  requestFailed: 'Request failed: {method}',
  refreshPullRequestFailed: 'Failed to refresh pull request.',
  mergePullRequestFailed: 'Failed to merge pull request.',
  notConnected: 'Not connected',
  notConnectedToDesktop: 'Not connected to desktop.',
  waitingForDesktopEllipsis: 'Waiting for desktop…',
  launchAgentFailed: 'Failed to launch agent',
  commentActionFailed: 'Comment action failed',
  updateTitleFailed: 'Failed to update title.',
  updateReviewThreadFailed: 'Failed to update review thread.',
  loadPullRequestFailed: 'Unable to load pull request',
  sendPromptFailed: 'Failed to send prompt',

  // Resuming agent sessions
  sendResumeCommandFailed: 'Failed to send resume command',
  prepareLegacyCodexFailed: 'Could not prepare this legacy Codex session. Retry resume.'
} as const satisfies MobileCatalogSource
