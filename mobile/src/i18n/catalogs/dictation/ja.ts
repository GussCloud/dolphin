import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { dictationEn } from './en'

export const dictationJa: MobileLocaleMessages<typeof dictationEn> = {
  // Dictation setup and capture errors (`src/dictation/**`, `src/hooks/use-mobile-dictation.ts`)
  legacyDesktop:
    'モバイルの音声設定を使うには、ペアリングしたデスクトップの Dolphin アプリをアップデートしてください。',
  loadModelsFailed: '音声入力モデルを読み込めませんでした',
  downloadFailed: 'ダウンロードを開始できませんでした',
  deleteFailed: 'モデルを削除できませんでした',
  updateSettingsFailed: '音声入力の設定を更新できませんでした',
  microphonePermissionDenied: 'マイクへのアクセスが拒否されました',
  microphoneInitFailed: 'マイクを初期化できませんでした'
}
