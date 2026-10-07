import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const sessionEn = {
  // Attachments and paste
  attachFailedDisconnected: 'Attach failed (disconnected)',
  attachPhotoPermissionDenied: 'Photo permission denied',
  attachImageTooLarge: 'Image too large to attach',
  attachFailed: 'Attach failed',
  attachFailedReconnecting: 'Attach failed (reconnecting)',
  pasteTooLarge: 'Paste too large (max 256 KiB)',
  pasteFailedDisconnected: 'Paste failed (disconnected)',
  pasteImageTooLarge: 'Image too large to paste',
  pasteFailed: 'Paste failed',

  // Shared actions
  open: 'Open',
  refresh: 'Refresh',
  remove: 'Remove',
  discard: 'Discard',
  cancel: 'Cancel',
  close: 'Close',
  copy: 'Copy',
  save: 'Save',
  retry: 'Retry',
  back: 'Back',

  // Tab kinds and sheets
  newTab: 'New Tab',
  terminal: 'Terminal',
  browser: 'Browser',
  markdown: 'Markdown',
  file: 'File',
  chat: 'Chat',
  markdownNote: 'Markdown Note',
  newBrowser: 'New Browser',
  newBrowserMessage: 'Enter a URL, or leave blank for a new tab.',
  browserStreamingNeedsDesktopUpdate: 'Desktop update required for mobile browser streaming',
  renameTerminal: 'Rename Terminal',
  terminalNamePlaceholder: 'Terminal name',
  shortcut: 'Shortcut',
  removeShortcutMessage: 'Remove this custom shortcut?',
  copyPath: 'Copy Path',
  pathCopied: 'Path copied',
  copyPathFailed: "Couldn't copy path",

  // Review notes delivery
  sendReviewNotesTitle: 'Send Review Notes',
  sendReviewNotesMessage: 'Choose an agent session for the current notes.',
  copyNotes: 'Copy Notes',
  notesCopied: 'Notes copied',
  copyNotesFailed: "Couldn't copy notes",

  // Unsaved markdown
  unsavedMarkdownTitle: 'Unsaved markdown changes',
  unsavedMarkdownMessage: 'Copy or discard phone drafts before leaving.',
  copyAllAndLeave: 'Copy All & Leave',
  copyDraftsFailed: "Couldn't copy drafts",
  discardAndLeave: 'Discard & Leave',
  discardChangesTitle: 'Discard Changes',
  discardChangesMessage: 'Replace the phone draft with the latest desktop file?',

  // Tab long-press menus
  closeOtherTabs: 'Close Other Tabs',
  closeTabsToTheLeft: 'Close Tabs to the Left',
  switchToDesktop: 'Switch to Desktop',
  switchToPhone: 'Switch to Phone',
  rename: 'Rename',
  clearTerminal: 'Clear Terminal',
  browserBack: 'Back',
  browserForward: 'Forward',
  browserReload: 'Reload',

  // Header
  backToWorktrees: 'Back to worktrees',
  reconnectToDesktop: 'Reconnect to desktop',
  openFileExplorer: 'Open file explorer',
  openSourceControl: 'Open source control',
  moreSessionActions: 'More session actions',
  newTabAccessibility: 'New tab',
  quickCommandsNeedDesktopUpdate: 'Desktop update required for quick commands',
  checkingDesktopCapabilities: 'Checking desktop capabilities — try again in a moment',
  agentHistory: 'Agent History',
  agentHistoryHint: 'Browse and resume agent sessions',
  checks: 'Checks',
  checksHint: 'Open pull request checks',

  // Connection summary under the session title
  loadingTabs: 'Loading tabs',
  tabCount: { one: '{count} tab', other: '{count} tabs' },
  connectionTapToRetry: '{status} — tap to retry',
  statusConnecting: 'Connecting',
  statusSecuring: 'Securing',
  statusConnected: 'Connected',
  statusDisconnected: 'Disconnected',
  statusReconnecting: 'Reconnecting',
  statusPairingInvalid: 'Pairing invalid',

  // Session content
  noTabsInSession: 'No tabs in this session',
  creatingTab: 'Creating...',
  createTab: 'Create Tab',
  terminalTakingLonger: 'Terminal is taking longer than expected',
  loadingTerminal: 'Loading terminal',
  retryLoadingTerminal: 'Retry loading terminal',

  // Terminal command dock
  dismissKeyboard: 'Dismiss keyboard',
  dismissKeyboardTerminalHint:
    'Hides the software keyboard and keeps the current terminal session open.',
  switchToDesktopMode: 'Switch to desktop mode',
  switchToPhoneMode: 'Switch to phone mode',
  switchToBufferedInput: 'Switch to buffered command input',
  switchToLiveInput: 'Switch to live terminal input',
  pasteFromClipboard: 'Paste from clipboard',
  paste: 'Paste',
  sendKey: 'Send {key}',
  addCustomShortcut: 'Add custom shortcut',
  showLiveInputKeyboard: 'Show keyboard for live terminal input',
  showLiveInputKeyboardHint: 'Typed text is sent directly to the active terminal',
  typeCommandPlaceholder: 'Type a command…',
  sendCommand: 'Send command',

  // Live input and dictation
  liveInputListening: 'Listening',
  liveInputProcessing: 'Processing',
  liveInputStartingMic: 'Starting mic',
  liveInputTitle: 'Live input',
  liveInputTapMicToStop: 'Tap mic to stop',
  liveInputTranscribing: 'Transcribing on desktop',
  liveInputPreparingMic: 'Preparing microphone',
  liveInputUploadingImage: 'Uploading image to host',
  liveInputTapToShowKeyboard: 'Tap to show keyboard',
  sendingImage: 'Sending image',
  attachPhoto: 'Attach a photo',
  attachPhotoHint: 'Long press to attach a file instead',
  stopVoiceDictation: 'Stop voice dictation',
  cancelVoiceDictation: 'Cancel voice dictation',
  startingVoiceDictation: 'Starting voice dictation',
  startVoiceDictation: 'Start voice dictation',
  dismissCreateWarning: 'Dismiss workspace creation warning',

  // Markdown editor
  markdownReadOnly: 'Read only',
  markdownChangedOnDesktop: 'Changed on desktop',
  dismissKeyboardMarkdownHint: 'Hides the software keyboard and keeps the markdown editor open.',

  // File reader and review notes
  send: 'Send',
  noReviewNotes: 'No review notes',
  reviewNoteCount: { one: '{count} review note', other: '{count} review notes' },
  copyReviewNotes: 'Copy review notes',
  sendReviewNotesToAi: 'Send review notes to AI',
  fileImageAccessibility: '{title} image',
  filePreviewAccessibility: '{title} preview',

  // Diff lines with review notes
  diffLineAccessibility: '{title} diff line {line}',
  addNoteOnLine: 'Add note on line {line}',
  noteLine: 'Line {line}',
  deleteNoteOnLine: 'Delete note on line {line}',
  addReviewNotePlaceholder: 'Add review note',
  saveNote: 'Save note',

  // Quick command editor
  quickCommandTerminalCommand: 'Terminal Command',
  quickCommandAgentPrompt: 'Agent Prompt',
  quickCommandLabel: 'Label',
  quickCommandLabelPlaceholder: 'Start dev server',
  quickCommandAction: 'Action',
  quickCommandAgent: 'Agent',
  quickCommandChooseAgent: 'Choose agent',
  quickCommandPrompt: 'Prompt',
  quickCommandCommandText: 'Command Text',
  quickCommandPromptPlaceholder: 'Ask the agent to investigate this workspace',
  quickCommandPromptHint: 'Supports skills, file paths, and built-in commands.',
  quickCommandAdvanced: 'Advanced',
  quickCommandAppendEnter: 'Append Enter',
  quickCommandAppendEnterHint: 'Submit immediately instead of only inserting text.',
  quickCommandScope: 'Scope',
  quickCommandScopeGlobal: 'Global',
  quickCommandScopeProject: 'Project',
  addQuickCommand: 'Add Quick Command',

  // Quick command rows
  copied: 'Copied',
  copyFailed: "Couldn't copy",
  quickCommandCopy: 'Copy {label}',
  quickCommandNothingToCopy: 'Nothing to copy',
  quickCommandRun: 'Run {label}',
  quickCommandEdit: 'Edit {label}',
  quickCommandDelete: 'Delete {label}',

  // Quick commands sheet
  delete: 'Delete',
  quickCommands: 'Quick Commands',
  quickCommandsAccessibility: 'Quick commands',
  editQuickCommand: 'Edit Quick Command',
  quickCommandChooseAgentTitle: 'Choose Agent',
  quickCommandDeleteTitle: 'Delete "{label}"?',
  quickCommandUntitled: 'Untitled',
  quickCommandDeleteMessage: 'This quick command will be removed from your saved list.',
  quickCommandsSearchPlaceholder: 'Search quick commands...',
  quickCommandsEmpty: 'No quick commands yet.',
  quickCommandsNoMatch: 'No matching quick commands.',
  quickCommandsThisProject: 'This project',
  quickCommandsNew: 'New quick command',
  quickCommandsLimitReached: 'Quick command limit reached',
  quickCommandsLoadFailed: 'Failed to load quick commands',
  quickCommandSaveFailed: 'Failed to save quick command',

  // Creating terminals and sending notes
  createTerminalFailed: 'Failed to create terminal',
  sendNotesError: 'Failed to send notes',
  sendNotesFailed: "Couldn't send notes",
  terminalInputLockedByOtherClient: 'Terminal input is locked by another client.',
  notesSent: 'Notes sent',
  quickCommandNeedsEdit: 'Edit this quick command before running it',
  quickCommandFallbackLabel: 'Quick command',
  quickCommandRunFailed: "Couldn't run {label}",

  // Creating notes and browsers
  createMarkdownNoteFailed: 'Failed to create markdown note',
  createUntitledMarkdownFailed: 'Unable to create untitled markdown note',
  enterValidUrl: 'Enter a valid URL',
  createBrowserFailed: 'Failed to create browser',
  browserPageNotAvailable: 'Browser page is not available yet.',
  browserCommandFailed: 'Browser command failed',

  // Agent pickers in the New Tab and review-notes sheets
  detectingAgents: 'Detecting Agents',
  noEnabledAgents: 'No Enabled Agents',
  agentPresetsUnavailable: 'Agent Presets Unavailable',
  checkHostConnection: 'Check the host connection',
  newAgentSession: 'New agent session',
  copyNotesInstead: 'Copy notes instead',

  // Review notes on session diffs
  waitingForDesktop: 'Waiting for desktop...',
  noteAdded: 'Note added',
  saveNoteFailed: 'Failed to save note',
  deleteNoteFailed: 'Failed to delete note',
  saveReviewNotesFailed: 'Failed to save review notes',

  // Document previews
  readMarkdownFailed: 'Unable to read markdown',
  loadMarkdownFailed: "Couldn't load markdown",
  binaryPreviewUnavailable: 'Binary preview unavailable',
  fileTooLargeForPreview: 'File too large for mobile preview',
  loadDiffPreviewFailed: "Couldn't load diff preview",
  loadFilePreviewFailed: "Couldn't load file preview",
  saved: 'Saved',
  saveFailed: 'Save failed',
  openPathFailed: "Couldn't open {path}",

  // Terminal feedback
  dictationInserted: 'Dictation inserted',
  selectionCleared: 'Selection cleared (scrolled out of buffer)',
  wakeSleepingAgents: 'Open Dolphin on the host to wake sleeping agents.',
  terminalCleared: 'Terminal cleared',
  clearTerminalFailed: "Couldn't clear terminal",
  terminalFitFailed: "Couldn't fit the terminal to this screen",

  // Workspace names
  floatingWorkspace: 'Floating Workspace',
  worktree: 'Worktree',
  quickCommandEditorDescription: 'Save terminal commands or agent prompts for quick access.',
  inputTooLarge: 'Input too large (max 256 KiB)'
} as const satisfies MobileCatalogSource
