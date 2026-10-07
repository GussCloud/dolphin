import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const worktreeEn = {
  // Agent states (mirror desktop agentStateLabel)
  agentWorking: 'Working',
  agentMonitoring: 'Monitoring background tasks',
  agentBlocked: 'Blocked',
  agentWaiting: 'Waiting for input',
  agentInterrupted: 'Interrupted',
  agentDone: 'Done',
  agentIdle: 'Idle',
  agentUnverifiable: 'Unverifiable',
  teammate: 'Teammate',
  // Host card summary
  worktreeListUnavailable: 'Worktree list unavailable',
  worktreeCount: { one: '{count} worktree', other: '{count} worktrees' },
  worktreeCountWithActive: '{worktrees} · {active} active',
  lastKnown: 'Last known: {summary}',
  // Workspace list states
  catalogLoadError: 'Could not load workspaces from this host',
  catalogLoadErrorDetail: '{command} failed ({error}) — retrying automatically',
  emptySearch: 'No matching worktrees',
  emptyFiltered: 'No worktrees match filters',
  empty: 'No worktrees',
  // Sections
  sectionPinned: 'Pinned',
  sectionAll: 'All',
  prGroupDone: 'Done',
  prGroupInReview: 'In Review',
  prGroupInProgress: 'In Progress',
  prGroupClosed: 'Closed',
  // Sort and group pickers
  sortSmart: 'Agent activity',
  sortSmartSubtitle: 'Agents that need attention, then recent activity',
  sortName: 'Name',
  sortNameSubtitle: 'Alphabetical by name',
  sortRecent: 'Recent',
  sortRecentSubtitle: 'Most recent output first',
  sortRepo: 'Repo',
  sortRepoSubtitle: 'Repository, then workspace name',
  sortManual: 'Manual',
  sortManualSubtitle: 'Server order',
  groupNone: 'No Grouping',
  groupStatus: 'Status',
  groupRepository: 'Repository',
  groupPrStatus: 'PR Status',
  // Relative time (desktop formatTimeAgo thresholds)
  timeJustNow: 'just now',
  timeMinutes: '{minutes}m',
  timeHours: '{hours}h',
  timeDays: '{days}d'
} as const satisfies MobileCatalogSource
