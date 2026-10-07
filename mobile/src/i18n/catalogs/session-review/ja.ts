import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { sessionReviewEn } from './en'

export const sessionReviewJa: MobileLocaleMessages<typeof sessionReviewEn> = {
  committedChangesUnavailable: 'コミット済みの変更を利用できません',
  committedChangesFailed: 'コミット済みの変更の読み込みに失敗しました',
  updateDesktopToReview:
    'モバイルで変更をレビューするには Dolphin デスクトップをアップデートしてください。',
  loadChangesFailed: '変更を読み込めません',
  sourceControlResponseInvalid: 'ソース管理の応答が無効です',
  loadReviewNotesFailed: 'レビューノートを読み込めません',
  loadDiffFailed: '差分を読み込めません',
  committedDiffUnavailable: 'コミット済みの差分は利用できません',

  scopeBranch: 'ブランチ',
  scopeStaged: 'ステージ済み',
  scopeUnstaged: '未ステージ',
  committedOnBranch: 'ブランチにコミット済み',

  waitingForDesktop: 'デスクトップを待機中...',
  sourceControlActionFailed: 'ソース管理の操作に失敗しました',
  stagedWithFailures: '{staged} 件をステージ、{failed} 件が失敗',
  reviewedFilesStaged: {
    one: 'レビュー済みファイル {count} 件をステージしました',
    other: 'レビュー済みファイル {count} 件をステージしました'
  },
  saveReviewStateFailed: 'レビュー状態を保存できませんでした',
  saveReviewFailed: 'レビューを保存できませんでした',
  missingWorktree: 'ワークツリーがありません',
  loadReviewFailed: 'レビューを読み込めません',
  openInSessionFailed: 'セッションで開けません',
  copyReviewNotesFailed: 'レビューノートをコピーできません',
  reviewNotesCopied: 'レビューノートをコピーしました',
  sendNotesFailed: 'ノートを送信できませんでした',
  terminalInputLocked: 'ターミナル入力はロックされています',
  reviewNotesSent: 'レビューノートを送信しました',
  createTerminalFailed: 'ターミナルを作成できませんでした',
  loadAgentSessionsFailed: 'Agent セッションを読み込めません',

  requestFailed: 'リクエストに失敗しました: {method}',
  refreshPullRequestFailed: 'プルリクエストを更新できませんでした。',
  mergePullRequestFailed: 'プルリクエストをマージできませんでした。',
  notConnected: '接続されていません',
  notConnectedToDesktop: 'デスクトップに接続されていません。',
  waitingForDesktopEllipsis: 'デスクトップを待機中…',
  launchAgentFailed: 'Agent を起動できませんでした',
  commentActionFailed: 'コメント操作に失敗しました',
  updateTitleFailed: 'タイトルを更新できませんでした。',
  updateReviewThreadFailed: 'レビュースレッドを更新できませんでした。',
  loadPullRequestFailed: 'プルリクエストを読み込めません',
  sendPromptFailed: 'プロンプトを送信できませんでした',

  sendResumeCommandFailed: '再開コマンドを送信できませんでした',
  prepareLegacyCodexFailed:
    'この従来の Codex セッションを準備できませんでした。再開をもう一度お試しください。'
}
