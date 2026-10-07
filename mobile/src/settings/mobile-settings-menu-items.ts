import {
  Bell,
  Globe,
  Info,
  Languages,
  MessageSquare,
  Mic,
  Radio,
  Terminal,
  Wrench
} from 'lucide-react-native'
import type { MobileSettingsMenuItem } from './mobile-settings-menu'
import { nativeBackgroundRelay } from '../platform/native-background-relay'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import type { settingsEn } from '../i18n/catalogs/settings/en'

export function mobileSettingsMenuItems(
  push: (route: string) => void,
  t: MobileTranslate<typeof settingsEn>
): MobileSettingsMenuItem[] {
  return [
    { label: t('terminal'), icon: Terminal, onPress: () => push('/terminal-settings') },
    { label: t('chatUi'), icon: MessageSquare, onPress: () => push('/native-chat-settings') },
    { label: t('browser'), icon: Globe, onPress: () => push('/browser-settings') },
    { label: t('voice'), icon: Mic, onPress: () => push('/voice-settings') },
    { label: t('notifications'), icon: Bell, onPress: () => push('/notifications') },
    ...(nativeBackgroundRelay
      ? [
          {
            label: t('backgroundConnection'),
            icon: Radio,
            onPress: () => push('/background-connection')
          }
        ]
      : []),
    { label: t('language'), icon: Languages, onPress: () => push('/language-settings') },
    { label: t('troubleshooting'), icon: Wrench, onPress: () => push('/troubleshoot') },
    { label: t('about'), icon: Info, onPress: () => push('/about') }
  ]
}
