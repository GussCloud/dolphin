import { Bell, Globe, Info, MessageSquare, Mic, Radio, Terminal, Wrench } from 'lucide-react-native'
import type { MobileSettingsMenuItem } from './mobile-settings-menu'
import { nativeBackgroundRelay } from '../platform/native-background-relay'

export function mobileSettingsMenuItems(push: (route: string) => void): MobileSettingsMenuItem[] {
  return [
    { label: 'Terminal', icon: Terminal, onPress: () => push('/terminal-settings') },
    { label: 'Chat UI', icon: MessageSquare, onPress: () => push('/native-chat-settings') },
    { label: 'Browser', icon: Globe, onPress: () => push('/browser-settings') },
    { label: 'Voice', icon: Mic, onPress: () => push('/voice-settings') },
    { label: 'Notifications', icon: Bell, onPress: () => push('/notifications') },
    ...(nativeBackgroundRelay
      ? [
          {
            label: 'Background connection',
            icon: Radio,
            onPress: () => push('/background-connection')
          }
        ]
      : []),
    { label: 'Troubleshooting', icon: Wrench, onPress: () => push('/troubleshoot') },
    { label: 'About', icon: Info, onPress: () => push('/about') }
  ]
}
