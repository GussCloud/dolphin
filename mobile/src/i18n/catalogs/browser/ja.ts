import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { browserEn } from './en'

export const browserJa: MobileLocaleMessages<typeof browserEn> = {
  // Toolbar
  back: '戻る',
  forward: '進む',
  reload: '再読み込み',
  urlPlaceholder: 'URL',
  showWebView: 'Web 版のサイト表示',
  showMobileView: 'モバイル版のサイト表示',
  // Keyboard dock
  clickModifier: '{key} クリック修飾キー',
  typeOnPage: 'ページに入力…',
  sendText: 'ブラウザにテキストを送信',
  sent: '送信しました',
  rightClick: '右クリック',
  // Page dialogs
  dialogTitle: 'ブラウザのダイアログ',
  dialogFallback: 'ブラウザのダイアログ',
  cancel: 'キャンセル',
  ok: 'OK',
  dialogAnswerFailed: 'その応答はページに届きませんでした。',
  // Errors
  invalidUrl: '有効な URL を入力してください。',
  streamFailed: 'ブラウザのストリーミングに失敗しました。',
  commandFailed: 'ブラウザのコマンドに失敗しました',
  updateAppForStreaming:
    'ここでブラウザタブをストリーミングするには、Dolphin アプリをアップデートしてください。',
  updateDesktopForStreaming:
    'モバイルでブラウザタブをストリーミングするには、デスクトップの Dolphin をアップデートしてください。',
  checkingStreamingSupport: 'デスクトップのブラウザストリーミング対応を確認しています。',
  pageNotAvailable: 'ブラウザページはまだ利用できません。',
  streamTimedOut: 'ブラウザのストリーミングがタイムアウトしました。'
}
