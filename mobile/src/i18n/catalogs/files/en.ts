import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const filesEn = {
  // Explorer
  title: 'Files',
  worktreeShowingFirst: '{worktree} - Showing first {count}',
  closeFiles: 'Close files',
  backToSession: 'Back to session',
  retry: 'Retry',
  noFilesFound: 'No files found',
  unableToLoadFiles: 'Unable to load files',
  connectingToDesktop: 'Connecting to desktop...',
  waitingForDesktop: 'Waiting for desktop...',
  loading: 'Loading...',
  unableToLoadFolder: 'Unable to load folder',
  retryLoadingA11y: 'Retry loading {path}',
  openFolderA11y: 'Open folder {name}',
  previewFileA11y: 'Preview file {name}',
  unavailableOnMobileA11y: '{name} unavailable on mobile',
  unavailableOnMobile: 'Unavailable on mobile',

  // Preview
  preview: 'Preview',
  file: 'File',
  backToFiles: 'Back to files',
  saveArtifactA11y: 'Save terminal artifact',
  discardChangesTitle: 'Discard changes?',
  unsavedEditsLost: 'Unsaved edits will be lost.',
  discard: 'Discard',
  stay: 'Stay',
  loadingPreview: 'Loading preview...',
  emptyFile: 'Empty file',
  imageA11y: '{title} image',
  editorA11y: '{title} editor',
  filePreviewA11y: 'File preview',
  viewMarkdownSourceA11y: 'View Markdown source',
  viewRenderedMarkdownA11y: 'View rendered Markdown preview',
  previewTruncated: 'Preview truncated. File size: {size}.',
  unknownSize: 'unknown size',

  // Preview errors
  unableToLoadPreview: 'Unable to load preview',
  unableToSaveFile: 'Unable to save file',
  binaryPreviewUnavailable: 'Binary preview unavailable',
  fileTooLarge: 'File too large for mobile preview',
  reloadBeforeSaving: 'Reload preview before saving',
  unableToReachFilesystem: 'Unable to reach the desktop filesystem',
  fileNotFound: 'File not found',
  fileChangedOnDesktop: 'File changed on desktop. Reload preview before saving',
  sshOwnerChanged: "Couldn't verify the SSH connection. Reconnect the host and try again."
} as const satisfies MobileCatalogSource
