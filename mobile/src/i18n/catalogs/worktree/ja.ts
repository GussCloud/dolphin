import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { worktreeEn } from './en'

export const worktreeJa: MobileLocaleMessages<typeof worktreeEn> = {
  // Agent states (mirror desktop agentStateLabel)
  agentWorking: '作業中',
  agentMonitoring: 'バックグラウンドタスクを監視中',
  agentBlocked: 'ブロック中',
  agentWaiting: '入力待ち',
  agentInterrupted: '中断',
  agentDone: '完了',
  agentIdle: 'アイドル',
  agentUnverifiable: '確認できません',
  teammate: 'チームメイト',
  // Host card summary
  worktreeListUnavailable: 'ワークツリー一覧を取得できません',
  worktreeCount: { one: '{count} 個のワークツリー', other: '{count} 個のワークツリー' },
  worktreeCountWithActive: '{worktrees} · アクティブ {active}',
  lastKnown: '前回の情報: {summary}',
  // Workspace list states
  catalogLoadError: 'このホストからワークスペースを読み込めませんでした',
  catalogLoadErrorDetail: '{command} が失敗しました（{error}）— 自動的に再試行しています',
  emptySearch: '一致するワークツリーはありません',
  emptyFiltered: 'フィルターに一致するワークツリーはありません',
  empty: 'ワークツリーはありません',
  // Sections
  sectionPinned: 'ピン留め',
  sectionAll: 'すべて',
  prGroupDone: '完了',
  prGroupInReview: 'レビュー中',
  prGroupInProgress: '進行中',
  prGroupClosed: 'クローズ',
  // Sort and group pickers
  sortSmart: 'エージェントのアクティビティ',
  sortSmartSubtitle: '対応が必要なエージェント、次に最近のアクティビティ',
  sortName: '名前',
  sortNameSubtitle: '名前のアルファベット順',
  sortRecent: '最近',
  sortRecentSubtitle: '最新の出力順',
  sortRepo: 'リポジトリ',
  sortRepoSubtitle: 'リポジトリ、次にワークスペース名',
  sortManual: '手動',
  sortManualSubtitle: 'サーバーの順序',
  groupNone: 'グループ化しない',
  groupStatus: 'ステータス',
  groupRepository: 'リポジトリ',
  groupPrStatus: 'PR ステータス',
  // Relative time (desktop formatTimeAgo thresholds)
  timeJustNow: 'たった今',
  timeMinutes: '{minutes}分',
  timeHours: '{hours}時間',
  timeDays: '{days}日'
}
