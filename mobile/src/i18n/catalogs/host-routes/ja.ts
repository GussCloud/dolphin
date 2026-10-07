import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesEn } from './en'

export const hostRoutesJa: MobileLocaleMessages<typeof hostRoutesEn> = {
  // Route titles
  routeHost: 'ホスト',
  routeAccounts: 'アカウント',
  routeTasks: 'タスク',
  routeTerminal: 'ターミナル',
  routeSourceControl: 'ソース管理',
  routeAgentHistory: 'エージェントのセッション履歴',
  routeChanges: '変更',
  routePullRequest: 'PR',
  routeWorkspace: 'ワークスペース',

  // Edit host
  editHost: 'ホストを編集',
  back: '戻る',
  save: '保存',
  saveHostA11y: 'ホストを保存',
  goBack: '戻る',
  missingHost: 'ホストがありません。',
  hostRemoved: 'このホストはこの端末から削除されました。',
  failedToLoadHost: 'ホストを読み込めませんでした。',
  failedToSaveHost: 'ホストを保存できませんでした。',
  editHelp:
    '表示名または接続先アドレスを変更します。名前を空欄にすると、デスクトップが報告する名前を使用します。アドレスを変更しても、この端末の接続先が切り替わるだけで再ペアリングはされません。同じデスクトップに別の IP（例: 自宅 LAN と Tailscale）で接続できる場合に使用してください。',
  name: '名前',
  hostNamePlaceholder: 'ホスト名',
  address: 'アドレス',
  addressHint:
    'IP、host:port、または ws:// / wss:// を入力できます。ポートを省略すると現在のポート（または 6768）を使用します。',
  connectsTo: '{endpoint} に接続します',

  // Accounts
  accounts: 'アカウント',
  invalidSnapshot: 'ホストから無効なアカウント情報を受信しました',
  hostNotFound: 'ホストが見つかりません',
  couldNotSwitchAccount: 'アカウントを切り替えられませんでした',
  systemDefault: 'システムのデフォルト',
  useAgentLogin: 'エージェント自身のログインを使用',
  connectingToHost: '{host} に接続中…',
  connectingToHostGeneric: 'ホストに接続中…',
  loadingAccounts: 'アカウントを読み込み中…',
  addAccountsHint:
    'アカウントの追加や再認証は、デスクトップの「設定 → アカウント」から行ってください。'
}
