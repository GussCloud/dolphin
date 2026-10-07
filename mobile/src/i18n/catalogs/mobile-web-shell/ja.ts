import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { mobileWebShellEn } from './en'

export const mobileWebShellJa: MobileLocaleMessages<typeof mobileWebShellEn> = {
  // Waiting and progress
  opening: 'ワークスペースを開いています',
  checkingHost: 'ホストを確認しています',
  downloading: 'ワークスペースをダウンロードしています',
  downloadProgress:
    '{completedAssets}/{totalAssets} ファイル · {receivedBytes}/{totalBytes} バイト',
  offline: 'ワークスペースをダウンロードするには、このホストに接続してください',
  loading: '読み込み中',
  // Failures
  failureIsolationUnavailable:
    'このデバイスの WebView は古すぎるため、ワークスペースを安全に開けません。',
  failureDownload: 'このホストからワークスペースをダウンロードできませんでした。',
  failureStatusUnreadable: 'このホストの状態を読み取れませんでした。戻って開き直してください。',
  failureStoppedResponding: 'ワークスペースが応答しなくなりました。',
  failureCouldNotOpen: 'ダウンロードしたワークスペースを開けませんでした。',
  tryAgain: 'もう一度試す',
  updateFailedNotice:
    'このホストからワークスペースを更新できませんでした。最後に動作したバージョンを表示しています。',
  requestOversized:
    'この操作は一度に送るデータが多すぎて Dolphin に届きません。ファイル数を減らして試してください。',
  // Unavailable route
  routeUnavailable: 'このホストではこのワークスペース画面を利用できません。',
  backToHosts: 'ホスト一覧に戻る',
  backToWorkspaces: 'ワークスペース一覧に戻る'
}
