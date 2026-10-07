import { WifiOff, Shield, Monitor, Clock, Globe, Bell } from 'lucide-react-native'
import type { diagnosticsEn } from '../i18n/catalogs/diagnostics/en'
import { colors } from '../theme/mobile-theme'

type DiagnosticsKey = keyof typeof diagnosticsEn

/** Copy is stored as catalog keys and translated at render, so a language change applies. */
export type TroubleshootSection = {
  id: string
  icon: React.ReactNode
  titleKey: DiagnosticsKey
  stepKeys: readonly DiagnosticsKey[]
}

export const troubleshootCommonIssues: TroubleshootSection[] = [
  {
    id: 'notifications',
    icon: <Bell size={16} color={colors.textSecondary} />,
    titleKey: 'notifTitle',
    stepKeys: ['notifStep1', 'notifStep2']
  },
  {
    id: 'wifi',
    icon: <WifiOff size={16} color={colors.textSecondary} />,
    titleKey: 'wifiTitle',
    stepKeys: ['wifiStep1', 'wifiStep2', 'wifiStep3']
  },
  {
    id: 'firewall',
    icon: <Shield size={16} color={colors.textSecondary} />,
    titleKey: 'firewallTitle',
    stepKeys: ['firewallStep1', 'firewallStep2', 'firewallStep3', 'firewallStep4']
  },
  {
    id: 'desktop',
    icon: <Monitor size={16} color={colors.textSecondary} />,
    titleKey: 'desktopTitle',
    stepKeys: ['desktopStep1', 'desktopStep2', 'desktopStep3']
  },
  {
    id: 'timeout',
    icon: <Clock size={16} color={colors.textSecondary} />,
    titleKey: 'timeoutTitle',
    stepKeys: ['timeoutStep1', 'timeoutStep2', 'timeoutStep3']
  },
  {
    id: 'tailscale',
    icon: <Globe size={16} color={colors.textSecondary} />,
    titleKey: 'tailscaleTitle',
    stepKeys: ['tailscaleStep1', 'tailscaleStep2', 'tailscaleStep3', 'tailscaleStep4']
  },
  {
    id: 'vpn',
    icon: <Shield size={16} color={colors.textSecondary} />,
    titleKey: 'vpnTitle',
    stepKeys: ['vpnStep1', 'vpnStep2']
  }
]
