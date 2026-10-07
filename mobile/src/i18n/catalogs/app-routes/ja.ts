import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { appRoutesEn } from './en'

export const appRoutesJa: MobileLocaleMessages<typeof appRoutesEn> = {
  back: '戻る',
  cancel: 'キャンセル',
  continue: '続ける',
  openSettings: '設定を開く',
  tryAgain: '再試行',
  backToHome: 'ホームに戻る',
  missingPairingCode: 'ペアリングコードがありません',
  pairConfirmTitle: 'このデスクトップとペアリングしますか？',
  pairConfirmSubtitle:
    'デスクトップのペアリングリンクを開きました。確認するとホストに追加されます。',
  pair: 'ペアリング',
  connecting: '接続中…',
  pairingLog: 'ペアリングログ',
  pairingTimedOut:
    '{seconds} 秒以内に接続できませんでした — どこで止まったかは下のログを確認してください',
  pairingFailed: 'ペアリングに失敗しました: {reason}',
  invalidQrCode: '有効な Dolphin の QR コードではありません',
  invalidPairingCode:
    '有効なペアリングコードではありません — コンピュータからコピーしてもう一度貼り付けてください',
  pairWithDesktop: 'デスクトップとペアリング',
  cameraAccessDisabled: 'カメラへのアクセスがオフです',
  scanPrompt:
    'デスクトップの Dolphin に表示された QR コードをスキャンするか、ペアリングコードを貼り付けてください。',
  cameraDisabledPrompt:
    '設定でカメラへのアクセスを許可するか、ペアリングコードを貼り付けてください。',
  pasteCodeInstead: 'コードを貼り付ける',
  orPasteCode: 'またはペアリングコードを貼り付け',
  pasteCodeTitle: 'ペアリングコードを貼り付け',
  pasteCodeMessage: 'コンピュータの QR コードの下に表示されているコードをコピーしてください。',
  pasteCodePlaceholder: 'dolphin://pair?code=... またはコードを貼り付け',
  scanStepOpenDolphin: 'コンピュータで Dolphin を開く',
  scanStepOpenMobileSettings: '設定 → モバイル を開く',
  scanStepScan: 'QR コードをスキャン',
  onboardingSaveChoiceError: '選択を保存できませんでした。もう一度お試しください。',
  onboardingNotificationsError: '通知設定を更新できませんでした。もう一度お試しください。',
  onboardingProgress: 'オンボーディングの進行状況',
  onboardingStep: 'ステップ {current}/{total}'
}
