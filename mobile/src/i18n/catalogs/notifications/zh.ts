import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { notificationsEn } from './en'

export const notificationsZh: MobileLocaleMessages<typeof notificationsEn> = {
  // Android notification channels (shown in system settings)
  silentChannelName: 'Dolphin 静默通知',
  desktopChannelName: '桌面端通知',
  // Delivery preferences
  onlyWhenAway: '仅在离开桌面端时',
  onlyWhenAwayHint: '键盘或鼠标 3 分钟无操作后，或锁屏时。',
  sound: '通知声音',
  suppressWhileFocused: '专注时不提醒',
  suppressWhileFocusedHint: '跳过此手机上已打开工作区的提醒。',
  footer:
    '提醒类型遵循各已配对桌面端的通知设置。7 天未使用此应用后通知将暂停；打开应用并重新连接即可恢复。'
}
