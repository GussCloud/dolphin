import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { notificationsEn } from './en'

export const notificationsKo: MobileLocaleMessages<typeof notificationsEn> = {
  // Android notification channels (shown in system settings)
  silentChannelName: 'Dolphin 무음 알림',
  desktopChannelName: '데스크톱 알림',
  // Delivery preferences
  onlyWhenAway: '데스크톱에서 자리를 비웠을 때만',
  onlyWhenAwayHint: '키보드나 마우스 활동이 3분 동안 없거나 잠겼을 때.',
  sound: '알림 소리',
  suppressWhileFocused: '보고 있을 때 알리지 않기',
  suppressWhileFocusedHint: '이 휴대폰에서 열려 있는 워크스페이스의 알림은 건너뜁니다.',
  footer:
    '알림 유형은 페어링된 각 데스크톱의 알림 설정을 따릅니다. 이 앱을 7일 동안 사용하지 않으면 알림이 일시 중지되며, 앱을 열고 다시 연결하면 재개됩니다.'
}
