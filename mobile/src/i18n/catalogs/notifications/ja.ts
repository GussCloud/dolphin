import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { notificationsEn } from './en'

export const notificationsJa: MobileLocaleMessages<typeof notificationsEn> = {
  // Android notification channels (shown in system settings)
  silentChannelName: 'Dolphin のサイレント通知',
  desktopChannelName: 'デスクトップ通知',
  // Delivery preferences
  onlyWhenAway: 'デスクトップから離れているときのみ',
  onlyWhenAwayHint: 'キーボードやマウスの操作が 3 分間ない場合、またはロック中。',
  sound: '通知音',
  suppressWhileFocused: '表示中は通知しない',
  suppressWhileFocusedHint: 'このスマートフォンで開いているワークスペースの通知はスキップします。',
  footer:
    '通知の種類はペアリングした各デスクトップの通知設定に従います。このアプリを 7 日間使用しないと通知は一時停止します。再開するにはアプリを開いて再接続してください。'
}
