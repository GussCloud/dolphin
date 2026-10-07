import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const agentHistoryEn = {
  // Screen chrome
  title: 'Agent Session History',
  back: 'Back',
  refresh: 'Refresh agent sessions',
  retry: 'Retry',
  sourceControl: 'Source Control',
  // Scope tabs and search
  scopeWorkspace: 'Workspace',
  scopeProject: 'Project',
  scopeAll: 'All',
  searchPlaceholder: 'Search sessions, repo:, path:',
  transcriptsSkipped: { one: '{count} transcript skipped', other: '{count} transcripts skipped' },
  // States
  unavailableTitle: 'Agent Session History Unavailable',
  unavailableBody: 'Update Dolphin on this host to browse agent session history.',
  loadErrorTitle: 'Unable to Load',
  emptyTitle: 'No agent sessions',
  emptySearch: 'No sessions match your search.',
  emptyScope: 'No past agent sessions in this scope.',
  waitingForHost: 'Waiting for host…',
  hostUnreachable: 'Unable to reach host',
  sessionsLoadError: 'Unable to load agent sessions',
  // Session cards
  untitledSession: 'Untitled session',
  messageCount: { one: '{count} message', other: '{count} messages' },
  currentWorktree: 'current worktree',
  resumeSession: 'Resume agent session',
  // Resume
  missingResumeId: 'This session is missing a resume id.',
  unknownHostPlatform: 'Unable to determine host platform.',
  sessionQueued: 'Agent session queued.',
  resumeFailed: 'Failed to resume session.',
  workspaceMetadataError: 'Unable to load workspace metadata.',
  blockedRuntime: 'Resume from history is not available in runtime-hosted workspaces.',
  blockedSsh:
    'This session is stored on the host machine, so it cannot be resumed in an SSH workspace. Open a local workspace for this project.',
  blockedNoLocal: 'Open a local workspace before resuming a session.'
} as const satisfies MobileCatalogSource
