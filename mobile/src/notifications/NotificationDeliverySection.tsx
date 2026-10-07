import { StyleSheet, Switch, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { NotificationDeliveryPreferences } from './notification-delivery-preferences'
import { notificationsCatalog } from '../i18n/catalogs/notifications'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type Props = {
  value: NotificationDeliveryPreferences
  disabled?: boolean
  onChange: (value: NotificationDeliveryPreferences) => void
}

export function NotificationDeliverySection({ value, disabled, onChange }: Props) {
  const t = useMobileTranslation(notificationsCatalog)
  const row = (key: keyof NotificationDeliveryPreferences, label: string, hint?: string) => {
    return (
      <View key={key} style={[styles.row, disabled && styles.disabled]}>
        <View style={styles.labelGroup}>
          <Text style={styles.label}>{label}</Text>
          {hint && <Text style={styles.hint}>{hint}</Text>}
        </View>
        <Switch
          accessibilityLabel={label}
          testID={`notification-${key}`}
          value={value[key]}
          disabled={disabled}
          onValueChange={(enabled) => onChange({ ...value, [key]: enabled })}
          trackColor={{ false: colors.bgRaised, true: colors.textSecondary }}
          thumbColor={colors.textPrimary}
        />
      </View>
    )
  }
  return (
    <>
      <View style={styles.section}>
        {row('onlyWhenDesktopAway', t('onlyWhenAway'), t('onlyWhenAwayHint'))}
        {row('sound', t('sound'))}
        {row('suppressWhileViewing', t('suppressWhileFocused'), t('suppressWhileFocusedHint'))}
      </View>
      <Text style={styles.footer}>{t('footer')}</Text>
    </>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    overflow: 'hidden',
    marginTop: spacing.md
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md },
  labelGroup: { flex: 1, gap: spacing.xs },
  label: { fontSize: typography.bodySize, fontWeight: '500', color: colors.textPrimary },
  hint: { fontSize: typography.metaSize, color: colors.textMuted },
  disabled: { opacity: 0.5 },
  footer: {
    fontSize: typography.metaSize,
    color: colors.textMuted,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm
  }
})
