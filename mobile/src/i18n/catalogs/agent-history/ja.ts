import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { agentHistoryEn } from './en'

export const agentHistoryJa: MobileLocaleMessages<typeof agentHistoryEn> = {
  // Screen chrome
  title: 'エージェントセッション履歴',
  back: '戻る',
  refresh: 'エージェントセッションを更新',
  retry: '再試行',
  sourceControl: 'ソース管理',
  // Scope tabs and search
  scopeWorkspace: 'ワークスペース',
  scopeProject: 'プロジェクト',
  scopeAll: 'すべて',
  searchPlaceholder: 'セッション、repo:、path: を検索',
  transcriptsSkipped: {
    one: '{count} 件のトランスクリプトをスキップしました',
    other: '{count} 件のトランスクリプトをスキップしました'
  },
  // States
  unavailableTitle: 'エージェントセッション履歴は利用できません',
  unavailableBody:
    'エージェントセッション履歴を表示するには、このホストの Dolphin をアップデートしてください。',
  loadErrorTitle: '読み込めません',
  emptyTitle: 'エージェントセッションはありません',
  emptySearch: '検索に一致するセッションはありません。',
  emptyScope: 'この範囲に過去のエージェントセッションはありません。',
  waitingForHost: 'ホストを待っています…',
  hostUnreachable: 'ホストに接続できません',
  sessionsLoadError: 'エージェントセッションを読み込めません',
  // Session cards
  untitledSession: '無題のセッション',
  messageCount: { one: '{count} 件のメッセージ', other: '{count} 件のメッセージ' },
  currentWorktree: '現在のワークツリー',
  resumeSession: 'エージェントセッションを再開',
  // Resume
  missingResumeId: 'このセッションには再開 ID がありません。',
  unknownHostPlatform: 'ホストのプラットフォームを特定できません。',
  sessionQueued: 'エージェントセッションをキューに追加しました。',
  resumeFailed: 'セッションを再開できませんでした。',
  workspaceMetadataError: 'ワークスペースのメタデータを読み込めません。',
  blockedRuntime: 'ランタイムでホストされるワークスペースでは履歴からの再開は利用できません。',
  blockedSsh:
    'このセッションはホストマシンに保存されているため、SSH ワークスペースでは再開できません。このプロジェクトのローカルワークスペースを開いてください。',
  blockedNoLocal: 'セッションを再開する前にローカルワークスペースを開いてください。'
}
