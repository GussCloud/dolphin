import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { filesEn } from './en'

export const filesJa: MobileLocaleMessages<typeof filesEn> = {
  // Explorer
  title: 'ファイル',
  worktreeShowingFirst: '{worktree} - 最初の {count} 件を表示',
  closeFiles: 'ファイルを閉じる',
  backToSession: 'セッションに戻る',
  retry: '再試行',
  noFilesFound: 'ファイルが見つかりません',
  unableToLoadFiles: 'ファイルを読み込めません',
  connectingToDesktop: 'デスクトップに接続中...',
  waitingForDesktop: 'デスクトップを待機中...',
  loading: '読み込み中...',
  unableToLoadFolder: 'フォルダを読み込めません',
  retryLoadingA11y: '{path} の読み込みを再試行',
  openFolderA11y: 'フォルダ {name} を開く',
  previewFileA11y: 'ファイル {name} をプレビュー',
  unavailableOnMobileA11y: '{name} はモバイルでは利用できません',
  unavailableOnMobile: 'モバイルでは利用できません',

  // Preview
  preview: 'プレビュー',
  file: 'ファイル',
  backToFiles: 'ファイルに戻る',
  saveArtifactA11y: 'ターミナルの成果物を保存',
  discardChangesTitle: '変更を破棄しますか？',
  unsavedEditsLost: '保存されていない編集は失われます。',
  discard: '破棄',
  stay: 'とどまる',
  loadingPreview: 'プレビューを読み込み中...',
  emptyFile: '空のファイル',
  imageA11y: '{title} の画像',
  editorA11y: '{title} のエディタ',
  filePreviewA11y: 'ファイルのプレビュー',
  viewMarkdownSourceA11y: 'Markdown のソースを表示',
  viewRenderedMarkdownA11y: 'レンダリングされた Markdown のプレビューを表示',
  previewTruncated: 'プレビューを切り詰めました。ファイルサイズ: {size}。',
  unknownSize: 'サイズ不明',

  // Preview errors
  unableToLoadPreview: 'プレビューを読み込めません',
  unableToSaveFile: 'ファイルを保存できません',
  binaryPreviewUnavailable: 'バイナリはプレビューできません',
  fileTooLarge: 'ファイルが大きすぎるため、モバイルではプレビューできません',
  reloadBeforeSaving: '保存する前にプレビューを再読み込みしてください',
  unableToReachFilesystem: 'デスクトップのファイルシステムにアクセスできません',
  fileNotFound: 'ファイルが見つかりません',
  fileChangedOnDesktop:
    'デスクトップでファイルが変更されました。保存する前にプレビューを再読み込みしてください',
  sshOwnerChanged: 'SSH 接続を確認できませんでした。ホストに再接続してから再試行してください。'
}
