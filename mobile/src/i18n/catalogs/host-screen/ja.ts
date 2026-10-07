import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostScreenEn } from './en'

export const hostScreenJa: MobileLocaleMessages<typeof hostScreenEn> = {
  // Shared
  cancel: 'キャンセル',
  delete: '削除',
  remove: '削除',
  accounts: 'アカウント',
  tasks: 'タスク',
  // Header
  backToHosts: 'ホスト一覧に戻る',
  reconnect: '再接続',
  floatingWorkspace: 'フローティングワークスペース',
  hideSidebar: 'サイドバーを隠す',
  newWorkspace: '新しいワークスペース',
  closeSearch: '検索を閉じる',
  searchWorkspaces: 'ワークスペースを検索',
  // Toolbar
  filter: 'フィルター',
  filterWithCount: 'フィルター {count}',
  filterWithCountParens: 'フィルター（{count}）',
  filterWorkspaces: 'ワークスペースを絞り込む',
  filterWorkspacesActive: {
    one: 'ワークスペースを絞り込む、{count} 件適用中',
    other: 'ワークスペースを絞り込む、{count} 件適用中'
  },
  sortBy: '並べ替え: {label}',
  groupWorkspaces: 'ワークスペースをグループ化',
  group: 'グループ',
  groupStatusShort: 'ステータス',
  groupRepoShort: 'リポジトリ',
  groupPrShort: 'PR',
  // Pickers and filters
  sortByTitle: '並べ替え',
  groupByTitle: 'グループ化',
  clearFilters: 'フィルターをクリア',
  filterWorkspacesSection: 'ワークスペース',
  hideSleeping: 'スリープ中を隠す',
  hideDefaultBranch: 'デフォルトブランチを隠す',
  filterRepositoriesSection: 'リポジトリ',
  searchWorktreesPlaceholder: 'ワークツリーを検索…',
  searchWorktrees: 'ワークツリーを検索',
  // Worktree actions
  sleep: 'スリープ',
  pin: 'ピン留め',
  unpin: 'ピン留めを外す',
  deleteWorktreeTitle: 'ワークツリーを削除',
  deleteWorktreeMessage: '「{name}」（{branch}）を削除しますか？',
  // Host
  removeHostTitle: 'ホストを削除',
  removeHostMessage: '「{name}」を削除しますか？後で再度ペアリングできます。',
  removeHostError: 'ホストを削除できませんでした。もう一度お試しください。',
  hostNotFound: 'ホストが見つかりません'
}
