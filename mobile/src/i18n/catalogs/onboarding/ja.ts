import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { onboardingEn } from './en'

export const onboardingJa: MobileLocaleMessages<typeof onboardingEn> = {
  // Session view step
  sessionViewTitle: 'セッションをどう開きますか？',
  sessionViewBody:
    '対応するエージェントセッションをこのデバイスでターミナルと Chat UI のどちらで開くかを選択します。セッションタブを長押しすると表示を切り替えられます。既定値は後から設定で変更できます。',
  useChatUi: 'Chat UI を使う',
  useChatUiA11y: 'セッションを Chat UI で開く',
  keepTerminal: 'ターミナルのまま',
  keepTerminalA11y: 'セッションをターミナルで開く',
  // Notifications step
  notificationsTitle: 'エージェントからの呼び出しを見逃さない',
  notificationsBody:
    'エージェントが完了したり待機したりすると、アプリを使っていなくてもこのスマートフォンに通知が届きます。',
  notificationsDisclosure:
    'デスクトップが 3 分間アイドル状態になると、Dolphin のプッシュサービス経由で届きます。設定からいつでも変更できます。',
  enableNotifications: '通知を有効にする',
  enableNotificationsA11y: 'エージェント通知を有効にする',
  notNow: '後で',
  notNowA11y: '今は通知をスキップ',
  // Sample notification banners
  sampleNow: 'たった今',
  sampleCodexTitle: 'Codex が完了しました',
  sampleCodexBody: 'テストは成功しています。',
  sampleClaudeTitle: 'Claude が入力を求めています',
  sampleClaudeBody: 'あなたを待っています。'
}
