import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const componentsEn = {
  // Shared
  retry: 'Retry',
  cancel: 'Cancel',
  back: 'Back',
  save: 'Save',
  remove: 'Remove',

  // Agent state
  monitoringBackgroundTasks: 'Monitoring background tasks',

  // Auth failed banner
  rePair: 'Re-pair',
  authFailedMessage:
    'Authentication failed — try reconnecting first; if it keeps failing, re-pair from desktop.',
  authFailedWebNote: 'Reconnect or remove this host from the Dolphin app.',

  // Codex reset credits
  resetsAvailable: { one: '{count} reset available', other: '{count} resets available' },
  resetOutcomeResetTitle: 'Rate limits reset',
  resetOutcomeRefreshed: 'Codex usage has been refreshed.',
  resetOutcomeAlreadyAppliedTitle: 'Reset already applied',
  resetOutcomeNothingTitle: 'Nothing to reset',
  resetOutcomeNothingMessage: 'No eligible Codex rate-limit window is exhausted.',
  resetOutcomeNoCreditTitle: 'No reset available',
  resetOutcomeNoCreditMessage: 'This account has no earned reset credits available.',
  earnedCodexReset: 'Earned Codex rate-limit reset',
  resettingCodexLimits: 'Resetting Codex rate limits',
  useCodexReset: 'Use Codex rate-limit reset',
  useResetHintScoped: 'Uses one earned reset for {scope}',
  useResetHintActive: 'Uses one earned reset for the active Codex account',
  resetting: 'Resetting…',
  useReset: 'Use reset',
  resetScopeSelectedAccount: 'the selected managed account',
  resetScopeOnHost: '{identity} on the host',
  resetScopeOnWsl: '{identity} on WSL {distro}',
  resetDetailsChangedTitle: 'Reset details changed',
  resetDetailsChangedMessage:
    'The account or reset offer changed before the host contacted Codex. Review the updated details, then confirm again.',
  resetDiscardedRecordWarning:
    'This phone could not clear the discarded retry record. Retrying it is safe, but the record must be cleared before a new reset can be confirmed for this account.',
  resetConfirmedRecordWarning:
    'The host confirmed this attempt, but this phone could not clear its retry record. A later retry will reuse the same safe operation ID.',
  resetFailedTitle: 'Could not reset rate limits',
  useResetConfirmTitle: 'Use a rate-limit reset?',
  useResetConfirmMessage:
    'This spends one earned reset for {scope} and immediately resets eligible rate-limit windows.',

  // Confirm modal
  confirm: 'Confirm',

  // Custom shortcut keys
  addShortcut: 'Add Shortcut',
  shortcutCombo: 'Shortcut Combo',
  pickAKey: 'Pick a key',
  textMacro: 'Text Macro',
  shortcutComboHint: 'Build Ctrl, Alt, and Shift key chords',
  textMacroHint: 'Send custom text command',
  manageShortcuts: 'Manage Shortcuts',
  manageShortcutsHint: 'Show, hide, or reorder shortcut keys',
  modifiers: 'Modifiers',
  key: 'Key',
  moreKeys: 'More keys — Tab, arrows, F1–F12…',
  add: 'Add',
  keyGroupEditing: 'Editing',
  keyGroupNavigation: 'Navigation',
  keyGroupFunction: 'Function',
  macroLabel: 'Label',
  macroLabelPlaceholder: 'e.g. Build',
  macroCommand: 'Command',
  macroCommandPlaceholder: 'e.g. pnpm build',
  pressEnter: 'Press Enter',

  // Lists and banners
  dragToReorder: 'Drag to reorder',
  dragToReorderHint: 'Use the move up and move down actions to reorder without dragging',
  moveUp: 'Move up',
  moveDown: 'Move down',
  viewNetworkDiagnostics: 'View network diagnostics',
  checkingHostCompatibility: 'Checking host compatibility',
  dismissNotice: 'Dismiss notice',

  // Voice dictation models
  modelExtracting: 'extracting…',
  modelRecommended: 'Recommended',
  modelApiKeySet: 'API key set',
  modelSetUpOnDesktop: 'Set up on desktop',
  modelInUse: 'In use',
  modelUse: 'Use',
  modelDownload: 'Download',
  deleteModel: 'Delete {model}',
  downloadModel: 'Download {model}',
  dictationLoadFailed: 'Failed to load',
  dictationDownloadFailed: 'Download failed',
  dictationSelectFailed: 'Could not select model',
  dictationUpdateFailed: 'Could not update',
  dictationSetupHeading: 'Set up voice dictation',
  dictationSetupSubtitle: 'Download a model and enable dictation on your desktop — all from here.',
  dictationEnabled: 'Dictation enabled',

  // Host card
  pairingInvalid: 'Pairing invalid',
  pairingTemporarilyUnavailable: 'Pairing temporarily unavailable',
  discoveryHint: 'Update desktop Dolphin and sign in to connect from anywhere',
  credentialMissingHint: 'Tap to re-pair with your desktop',
  credentialUnavailableHint: 'Unlock your phone, then tap to retry',
  openHost: 'Open {name}',
  hostActions: 'Actions for {name}',

  // HTML preview
  previewRenderedHtml: 'Preview rendered HTML',
  preview: 'Preview',
  viewHtmlSource: 'View HTML source',
  source: 'Source',
  htmlPreviewFrameTitle: 'HTML preview',

  // Markdown
  openImage: 'Open image',
  tableMoreRows: { one: '{count} more row', other: '{count} more rows' },
  tableMoreColumns: { one: '{count} more column', other: '{count} more columns' },

  // Rich markdown editor
  linkUrl: 'Link URL',
  imageUrl: 'Image URL',
  insert: 'Insert',
  toolbarBody: 'Body',
  toolbarHeading1: 'H1',
  toolbarHeading2: 'H2',
  toolbarHeading3: 'H3',
  toolbarBold: 'Bold',
  toolbarItalic: 'Italic',
  toolbarStrike: 'Strike',
  toolbarBulletList: 'Bullet list',
  toolbarNumberedList: 'Numbered list',
  toolbarChecklist: 'Checklist',
  toolbarQuote: 'Quote',
  toolbarLink: 'Link',
  toolbarImage: 'Image',
  toolbarInlineCode: 'Inline code',
  toolbarCodeBlock: 'Code block',

  // Root error boundary
  errorBoundaryTitle: 'This part of Dolphin hit an error.',
  errorBoundaryDescription:
    'The app is still running. Retry this screen, return home, or share diagnostic details.',
  returnHome: 'Return home',
  reportError: 'Report error',
  clearSearch: 'Clear search',

  // Previous crash notice
  crashDiagnosticsAvailable: 'Crash diagnostics are available to copy and share with support.',
  viewDiagnostics: 'View diagnostics',
  viewCrashDiagnostics: 'View crash diagnostics',
  dismissCrashNotice: 'Dismiss crash diagnostics notice',

  // Protocol block screen
  blockUpdateMobileTitle: 'Update Dolphin Mobile',
  blockUpdateDesktopTitle: 'Update Dolphin on your computer',
  blockRefreshBundleTitle: 'Refresh the mobile workspace',
  blockRefreshBundleBody:
    'The workspace cached for this host is older than the desktop expects. Reconnect to this host to download the current one.',
  blockMobileTooOldAppStoreBody:
    'This desktop needs a newer Dolphin Mobile app. Update Dolphin Mobile from the App Store, then try this host again.',
  blockMobileTooOldGitHubBody:
    'This desktop needs a newer Dolphin Mobile app. Update Dolphin Mobile from GitHub Releases, then try this host again.',
  blockBundleUnavailableBody:
    'This paired desktop app does not include the mobile workspace yet. Update Dolphin on your computer, then try this host again.',
  blockBundleMobileAppStoreBody:
    "This desktop's mobile workspace needs a newer Dolphin Mobile app. Update Dolphin Mobile from the App Store, then try this host again.",
  blockBundleMobileGitHubBody:
    "This desktop's mobile workspace needs a newer Dolphin Mobile app. Update Dolphin Mobile from GitHub Releases, then try this host again.",
  blockDesktopTooOldBody:
    'This paired desktop app is too old for your current Dolphin Mobile app. Update Dolphin on your computer, then try this host again.',
  openAppStore: 'Open App Store',
  openGitHubReleases: 'Open GitHub Releases',
  blockRecoveryNoteRefresh: 'If this message stays, remove this host and pair it again.',
  blockRecoveryNoteUpdate:
    'Already updated? Go back to Hosts and refresh the connection. If this message stays, remove this host and pair it again.',
  backToHosts: 'Back to hosts',

  // Terminal shortcut settings
  shortcutBarHeading: 'SHORTCUT BAR',
  shortcutBarDescription:
    'Toggle keys to show or hide them, and hold the grip to drag a key into the order you want on the terminal shortcut bar.',
  resetDefaults: 'Reset Defaults',
  resetDefaultsHint: 'Show every built-in shortcut key in the original order',
  customShortcutsHeading: 'CUSTOM SHORTCUTS',
  noCustomShortcuts: 'No custom shortcuts defined yet.',
  addCustomShortcut: 'Add Custom Shortcut…',
  addCustomShortcutHint: 'Create key combo or text macro',

  // Workspace list
  noWorkspaceOpen: 'No workspace open',
  noWorkspaceOpenHint: 'Pick a workspace from the sidebar to open its terminal here.',
  agentsCount: { one: '{count} agent', other: '{count} agents' },
  collapseAgents: { one: 'Collapse {count} agent', other: 'Collapse {count} agents' },
  expandAgents: { one: 'Expand {count} agent', other: 'Expand {count} agents' },
  folder: 'Folder',
  childWorkspace: 'Child',
  teammateLabel: 'Teammate {name}, {state}',
  dismissDrawer: 'Dismiss drawer'
} as const satisfies MobileCatalogSource
