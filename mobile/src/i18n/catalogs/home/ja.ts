import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { homeEn } from './en'

export const homeJa: MobileLocaleMessages<typeof homeEn> = {
  // Shared
  pleaseTryAgain: 'もう一度お試しください。',
  remove: '削除',
  update: 'アップデート',
  tasks: 'タスク',
  openSettings: '設定を開く',
  // Host actions
  checkPairingErrorTitle: 'ペアリングを確認できませんでした',
  removeHostErrorTitle: 'ホストを削除できませんでした',
  removeHostTitle: 'ホストを削除',
  removeHostMessage: '「{name}」を削除しますか？後で再度ペアリングできます。',
  updateDesktopTitle: 'デスクトップをアップデート',
  // Empty state
  emptyTitle: 'デスクトップを接続',
  emptyBody:
    'コンピューターの Dolphin とペアリングすると、エージェントの確認、任意のターミナルへの移動、スマートフォンからの作業操作ができます。',
  pairDesktop: 'デスクトップとペアリング',
  howItWorks: '使い方',
  stepOpenDesktopTitle: 'Dolphin デスクトップを開く',
  stepOpenDesktopDesc: '設定 → モバイル で、ペアリング用の QR コードを生成します。',
  stepScanTitle: 'コードをスキャン',
  stepScanDesc: '上のボタンをタップしてスキャナーを開き、画面の QR コードに向けます。',
  stepConnectedTitle: '接続完了',
  stepConnectedDesc: 'デスクトップがここに表示されます。すべてエンドツーエンドで暗号化されます。',
  // List header and footer
  welcomeBack: 'おかえりなさい',
  statAgentsSpawned: '起動したエージェント',
  statAgentTime: 'エージェント稼働時間',
  statPRsCreated: '作成した PR',
  durationDaysHours: '{days}日 {hours}時間',
  durationHoursMinutes: '{hours}時間 {minutes}分',
  durationMinutes: '{minutes}分',
  desktops: 'デスクトップ',
  resume: '再開',
  accountUsage: 'アカウント使用量',
  systemDefaultAccount: 'システムの既定',
  noTaskSources: '接続されたタスクソースはありません',
  openProviderTasks: '{provider} のタスクを開く'
}
