import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { desktopUpdateEn } from './en'

export const desktopUpdateJa: MobileLocaleMessages<typeof desktopUpdateEn> = {
  // Host card tag
  tagAvailable: 'アップデートがあります',
  tagReady: 'アップデートの準備完了',
  tagManual: 'アップデートあり · デスクトップでインストール',
  tagStarting: 'アップデートを開始中…',
  tagDownloading: 'ダウンロード中 {percent}%',
  tagInstalling: 'デスクトップを再起動中…',
  tagFailed: 'アップデート失敗 · 再試行',
  // Install confirmation
  confirmInstallVersion:
    '「{hostName}」に Dolphin {version} をインストールしますか？そのデスクトップで Dolphin が再起動します。',
  confirmInstallLatest:
    '「{hostName}」に最新の Dolphin をインストールしますか？そのデスクトップで Dolphin が再起動します。',
  confirmLastAttemptFailed: '前回の試行に失敗しました: {message}',
  // Errors
  errorRestartedOnOlder:
    'デスクトップは {installedVersion} で再起動しました。{targetVersion} はインストールされていません。',
  errorManualRequired: 'このデスクトップは手動で更新する必要があります。',
  errorNotAvailable: 'デスクトップは利用可能なアップデートを報告しなくなりました。',
  errorNotDownloaded: 'デスクトップでアップデートのダウンロードがまだ完了していません。',
  errorUpdaterTimeout: 'デスクトップのアップデーターの応答を待つ間にタイムアウトしました。'
}
