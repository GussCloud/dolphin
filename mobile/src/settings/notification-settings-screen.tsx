import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { AppState, View, Text, StyleSheet, Pressable, Switch, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useFocusEffect } from 'expo-router'
import type { NotificationSettingsOperations } from './notification-settings-operations'
import { ChevronLeft } from 'lucide-react-native'
import { colors, spacing, typography } from '../theme/mobile-theme'
import type { NotificationPermissionState } from '../notifications/notification-permissions'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

const DEFAULT_PERMISSION_STATE: NotificationPermissionState = {
  granted: false,
  status: 'undetermined',
  canAskAgain: true,
  authorizationReflectsUserChoice: false
}

export default function NotificationsScreen({
  operations,
  onBack,
  description,
  children
}: {
  operations: NotificationSettingsOperations
  onBack: () => void
  description?: string
  children?: (enabled: boolean) => ReactNode
}) {
  const insets = useSafeAreaInsets()
  const t = useMobileTranslation(settingsCatalog)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [permissionState, setPermissionState] = useState(DEFAULT_PERMISSION_STATE)

  const refreshSettings = useCallback(async () => {
    const [enabled, permission] = await Promise.all([
      operations.preference(),
      operations.permission()
    ])
    setPushEnabled(enabled.enabled)
    setPermissionState(permission)
    setError(null)
  }, [operations])

  useFocusEffect(
    useCallback(() => {
      void refreshSettings().catch(() => setError(t('notificationsLoadError')))
    }, [refreshSettings, t])
  )

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refreshSettings().catch(() => setError(t('notificationsLoadError')))
      }
    })
    return () => subscription.remove()
  }, [refreshSettings, t])

  const togglePush = async (value: boolean) => {
    setError(null)
    setSaving(true)
    try {
      const permission = await operations.permission(value)
      setPermissionState(permission)
      const saved = await operations.preference(value && permission.granted)
      setPushEnabled(saved.enabled)
    } catch {
      setError(t('notificationsSaveError'))
    } finally {
      setSaving(false)
    }
  }

  const switchEnabled = pushEnabled && permissionState.granted
  const notificationsBlocked = permissionState.status === 'denied'
  const hint = notificationsBlocked
    ? t('notificationsBlocked')
    : (description ?? t('notificationsDefaultDescription'))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.sm,
        paddingBottom: insets.bottom + spacing.xl
      }}
    >
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          style={styles.backButton}
          onPress={onBack}
        >
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.heading}>{t('notifications')}</Text>
      </View>

      {error && (
        <Text accessibilityRole="alert" style={styles.hint}>
          {error}
        </Text>
      )}
      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('notificationsEnable')}</Text>
          <Switch
            value={switchEnabled}
            testID="notification-enabled"
            accessibilityLabel={t('notificationsEnable')}
            disabled={notificationsBlocked || saving}
            onValueChange={(v) => void togglePush(v)}
            trackColor={{ false: colors.bgRaised, true: colors.textSecondary }}
            thumbColor={colors.textPrimary}
          />
        </View>
        <Text style={styles.hint}>{hint}</Text>
        {notificationsBlocked && (
          <Pressable
            style={({ pressed }) => [
              styles.settingsButton,
              pressed && styles.settingsButtonPressed
            ]}
            testID="notification-system-settings"
            onPress={() =>
              void operations
                .openSettings()
                .catch(() => setError(t('notificationsOpenSettingsError')))
            }
          >
            <Text style={styles.settingsButtonText}>{t('openSettings')}</Text>
          </Pressable>
        )}
      </View>
      {children?.(switchEnabled && !saving)}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    padding: spacing.lg
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary
  },
  section: {
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
    overflow: 'hidden'
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2
  },
  rowLabel: {
    flex: 1,
    fontSize: typography.bodySize,
    fontWeight: '500',
    color: colors.textPrimary
  },
  hint: {
    fontSize: typography.metaSize,
    color: colors.textMuted,
    lineHeight: 18,
    paddingHorizontal: spacing.md + 2,
    paddingBottom: spacing.md
  },
  settingsButton: {
    alignSelf: 'flex-start',
    marginHorizontal: spacing.md + 2,
    marginBottom: spacing.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    backgroundColor: colors.bgRaised
  },
  settingsButtonPressed: {
    opacity: 0.6
  },
  settingsButtonText: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '600'
  }
})
