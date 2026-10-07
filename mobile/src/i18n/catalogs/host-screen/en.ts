import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const hostScreenEn = {
  // Shared
  cancel: 'Cancel',
  delete: 'Delete',
  remove: 'Remove',
  accounts: 'Accounts',
  tasks: 'Tasks',
  // Header
  backToHosts: 'Back to hosts',
  reconnect: 'Reconnect',
  floatingWorkspace: 'Floating Workspace',
  hideSidebar: 'Hide sidebar',
  newWorkspace: 'New workspace',
  closeSearch: 'Close search',
  searchWorkspaces: 'Search workspaces',
  // Toolbar
  filter: 'Filter',
  filterWithCount: 'Filter {count}',
  filterWithCountParens: 'Filter ({count})',
  filterWorkspaces: 'Filter workspaces',
  filterWorkspacesActive: {
    one: 'Filter workspaces, {count} active',
    other: 'Filter workspaces, {count} active'
  },
  sortBy: 'Sort by {label}',
  groupWorkspaces: 'Group workspaces',
  group: 'Group',
  groupStatusShort: 'Status',
  groupRepoShort: 'Repo',
  groupPrShort: 'PR',
  // Pickers and filters
  sortByTitle: 'Sort By',
  groupByTitle: 'Group By',
  clearFilters: 'Clear filters',
  filterWorkspacesSection: 'Workspaces',
  hideSleeping: 'Hide sleeping',
  hideDefaultBranch: 'Hide default branch',
  filterRepositoriesSection: 'Repositories',
  searchWorktreesPlaceholder: 'Search worktrees…',
  searchWorktrees: 'Search worktrees',
  // Worktree actions
  sleep: 'Sleep',
  pin: 'Pin',
  unpin: 'Unpin',
  deleteWorktreeTitle: 'Delete Worktree',
  deleteWorktreeMessage: 'Delete "{name}" ({branch})?',
  // Host
  removeHostTitle: 'Remove Host',
  removeHostMessage: 'Remove "{name}"? You can re-pair later.',
  removeHostError: 'Could not remove host. Please try again.',
  hostNotFound: 'Host not found'
} as const satisfies MobileCatalogSource
