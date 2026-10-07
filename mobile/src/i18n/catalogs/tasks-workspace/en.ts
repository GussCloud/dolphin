import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const tasksWorkspaceEn = {
  // Setup hooks source
  setupSourceLegacy: 'local hooks',
  setupSourceRepository: 'repository hooks',

  // Workspace create drawer
  selectRepository: 'Select a repository',
  sshConnection: 'SSH Connection',
  remoteRepository: 'Remote repository',
  connecting: 'Connecting...',
  workspaceName: 'Workspace Name',
  optionalHint: '[Optional]',
  agent: 'Agent',
  connectRepositoryFirst: 'Connect repository first',
  detectingAgents: 'Detecting agents...',
  advanced: 'Advanced',
  startFrom: 'Start from',
  defaultBranch: 'Default branch',
  createFromRef: 'Create from {ref}',
  linearWorkspaceNeedsRepository: 'Add a Git repository before creating a Linear workspace.',
  repositoryNotFound: 'Repository not found.',
  connectRepository: 'Connect Repository',

  // Workspace option pickers
  startFromTitle: 'Start From',
  startFromSubtitle: 'Pick an existing branch or ref.',
  searchBranches: 'Search branches',
  defaultBranchSubtitle: "Use this repository's configured base",
  noBranchesMatch: 'No branches match.',
  branchNameLabel: 'Branch name: {branch}',
  sparseCheckoutTitle: 'Sparse Checkout',
  fullCheckout: 'Full checkout',
  fullCheckoutSubtitle: 'Use the whole repository',
  editPresetLabel: 'Edit {name}',
  newPreset: 'New preset',

  // Sparse presets and setup trust
  newSparsePreset: 'New Sparse Preset',
  editSparsePreset: 'Edit Sparse Preset',
  presetName: 'Name',
  presetDirectories: 'Directories',
  directoryCount: { one: '{count} directory', other: '{count} directories' },
  runSetupScriptTitle: 'Run Setup Script?',
  setupChoiceRequired: '{repo} requires a setup choice before creating this workspace.',
  runSetupAndCreate: 'Run setup and create',
  skipSetupAndCreate: 'Skip setup and create',
  setupScriptChanged: "{repo}'s setup script changed",
  runSetupFrom: 'Run setup from {repo}?',
  setupTrustWarning:
    "This repository's dolphin.yaml runs on your machine before the workspace starts. Only run it if you trust this repository.",
  newSetupScript: 'New setup script',
  setupScript: 'Setup script',
  trustSetupScriptError: 'Failed to trust setup script.',
  runHooks: 'Run hooks',
  alwaysTrustAndRun: 'Always trust and run',
  dontRun: "Don't run",

  // Workspace create operations
  sshConnected: 'Connected',
  sshConnecting: 'Connecting',
  sshDeployingRelay: 'Deploying relay',
  sshReconnecting: 'Reconnecting',
  sshAuthFailed: 'Authentication failed',
  sshReconnectFailed: 'Reconnect failed',
  sshConnectionFailed: 'Connection failed',
  sshDisconnected: 'Disconnected',
  agentLaunchUnsupportedWarning:
    'Workspace created, but this computer cannot start the agent from the phone.',
  agentLaunchFailedWarning: 'Workspace created, but the agent did not start: {reason}',
  searchFailed: 'Search failed',
  sparseDirectoriesInvalid:
    'Use repo-relative directories, not root, absolute paths, or parent segments.',
  sparseDirectoriesEmpty: 'Add at least one directory.',
  unknownError: 'Unknown error',
  createWorkspaceError: 'Failed to create workspace',

  // Smart workspace source modes
  smartModeSmart: 'Smart',
  smartModeBranch: 'Branch',
  smartModeName: 'Name',

  // Action errors
  resolveBaseBranchError: 'Failed to resolve base branch.',
  agentDisabled: 'Selected agent is disabled. Choose an enabled agent before creating.',
  nameRequired: 'Name is required.',
  openShellSubtitle: 'Open a shell',
  sparsePresetsLoadError: 'Failed to load sparse presets.',
  branchSearchError: 'Failed to search branches.',
  sparsePresetSaveError: 'Failed to save sparse preset.',
  sshStateReadError: 'Failed to read SSH connection state.',
  sshConnectError: 'Failed to connect to SSH repository.',
  connectRepoBeforeWorkspace: 'Connect {repo} before creating a workspace.',
  nameTooLong: 'Name must be 80 characters or fewer.',
  nameAlreadyExists: '"{name}" already exists.',
  blankTerminal: 'Blank Terminal'
} as const satisfies MobileCatalogSource
