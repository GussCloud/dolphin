import type { ReactNode } from 'react'
import { Shield, LifeBuoy } from 'lucide-react-native'
import { MobileSettingsFrame, MobileSettingsSection } from './mobile-settings-menu'
import { mobileSettingsMenuItems } from './mobile-settings-menu-items'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export default function SettingsMenuScreen({
  push,
  onBack,
  openExternal,
  children
}: {
  push: (route: string) => void
  onBack?: () => void
  openExternal: (url: string) => Promise<unknown>
  children?: ReactNode
}) {
  const t = useMobileTranslation(settingsCatalog)
  return (
    <MobileSettingsFrame onBack={onBack}>
      <MobileSettingsSection items={mobileSettingsMenuItems(push, t)} />

      {children}

      <MobileSettingsSection
        spaced
        items={[
          {
            label: t('privacyPolicy'),
            icon: Shield,
            external: true,
            onPress: () => void openExternal('https://dolphin.guss.dev.br/privacy')
          },
          {
            label: t('support'),
            icon: LifeBuoy,
            external: true,
            onPress: () => void openExternal('https://github.com/GussCloud/dolphin/issues')
          }
        ]}
      />
    </MobileSettingsFrame>
  )
}
