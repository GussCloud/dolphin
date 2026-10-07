import { NotificationDisplayTest } from '../src/settings/notification-display-test'
import { NativeNotificationDeliverySettings } from '../src/settings/native-notification-delivery-settings'
import { useRouter } from 'expo-router'
import NotificationsScreen from '../src/settings/notification-settings-screen'
import { nativeNotificationSettingsOperations } from '../src/settings/native-notification-settings-operations'
import { settingsCatalog } from '../src/i18n/catalogs/settings'
import { useMobileTranslation } from '../src/i18n/use-mobile-translation'

export default function NativeNotificationsRoute() {
  const router = useRouter()
  const t = useMobileTranslation(settingsCatalog)
  return (
    <NotificationsScreen
      operations={nativeNotificationSettingsOperations}
      onBack={() => router.back()}
      description={t('notificationsPushDescription')}
    >
      {(enabled) => (
        <>
          <NativeNotificationDeliverySettings enabled={enabled} />
          <NotificationDisplayTest onTroubleshoot={() => router.push('/troubleshoot')} />
        </>
      )}
    </NotificationsScreen>
  )
}
