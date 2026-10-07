import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BatteryCharging, ChevronLeft, ChevronRight, Power, Radio } from 'lucide-react-native'
import { PickerModal, type PickerOption } from '../components/PickerModal'
import type { NativeBackgroundRelay } from '../platform/native-background-relay'
import { loadBackgroundRelayRetention, saveBackgroundRelayRetention } from '../storage/preferences'
import {
  setBackgroundRelayRetention,
  type BackgroundRelayRetention
} from '../transport/background-relay-retention'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { voiceSettingsStyles as styles } from './voice-settings-styles'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import type { settingsEn } from '../i18n/catalogs/settings/en'

function retentionOptions(
  t: MobileTranslate<typeof settingsEn>
): PickerOption<BackgroundRelayRetention>[] {
  return [
    { value: 'off', label: t('off'), subtitle: t('backgroundRetentionOffSubtitle') },
    {
      value: '15m',
      label: t('backgroundRetention15m'),
      subtitle: t('backgroundRetention15mSubtitle')
    },
    {
      value: '1h',
      label: t('backgroundRetention1h'),
      subtitle: t('backgroundRetention1hSubtitle')
    },
    {
      value: 'always',
      label: t('backgroundRetentionAlways'),
      subtitle: t('backgroundRetentionAlwaysSubtitle')
    }
  ]
}

export default function BackgroundConnectionSettingsScreen({
  native,
  onBack
}: {
  native: NativeBackgroundRelay
  onBack: () => void
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const t = useMobileTranslation(settingsCatalog)
  const options = useMemo(() => retentionOptions(t), [t])
  const [retention, setRetention] = useState<BackgroundRelayRetention>('off')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unrestricted, setUnrestricted] = useState(() => native.isIgnoringBatteryOptimizations())
  const hasAutostart = native.hasAutostartSettings()

  useEffect(() => {
    let active = true
    void loadBackgroundRelayRetention().then((loaded) => {
      if (active) {
        setRetention(loaded)
      }
    })
    // Battery exemption is granted in a system screen; re-read it on return.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setUnrestricted(native.isIgnoringBatteryOptimizations())
      }
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [native])

  const selectRetention = useCallback(
    (next: BackgroundRelayRetention) => {
      setError(null)
      setRetention(next)
      setBackgroundRelayRetention(next)
      void saveBackgroundRelayRetention(next).catch(() => setError(t('backgroundSaveError')))
      if (next !== 'off' && !native.isIgnoringBatteryOptimizations()) {
        native.requestIgnoreBatteryOptimizations()
      }
    },
    [native, t]
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          style={styles.backButton}
          onPress={onBack}
        >
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.heading}>{t('backgroundConnection')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.groupHeading}>{t('backgroundRelayHeading')}</Text>
        <Text style={localStyles.description}>{t('backgroundRelayDescription')}</Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={[styles.section, styles.sectionTopGap]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('backgroundStayConnected')}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setPickerOpen(true)}
          >
            <Radio size={16} color={colors.textSecondary} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('backgroundStayConnected')}</Text>
              <Text style={styles.rowSublabel}>
                {options.find((option) => option.value === retention)?.label ?? t('off')}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {retention !== 'off' && (
          <>
            <Text style={[styles.groupHeading, styles.inputGroupGap]}>
              {t('backgroundSystemHeading')}
            </Text>
            <Text style={localStyles.description}>
              {hasAutostart
                ? t('backgroundSystemDescriptionWithAutostart')
                : t('backgroundSystemDescription')}
            </Text>
            <View style={[styles.section, styles.sectionTopGap]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('backgroundBatteryOptimization')}
                disabled={unrestricted}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => native.requestIgnoreBatteryOptimizations()}
              >
                <BatteryCharging size={16} color={colors.textSecondary} />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>{t('backgroundBatteryOptimization')}</Text>
                  <Text style={styles.rowSublabel}>
                    {unrestricted ? t('backgroundUnrestricted') : t('backgroundRestricted')}
                  </Text>
                </View>
                {!unrestricted && <ChevronRight size={16} color={colors.textMuted} />}
              </Pressable>
              {hasAutostart && (
                <>
                  <View style={styles.separator} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('backgroundAutostart')}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => native.openAutostartSettings()}
                  >
                    <Power size={16} color={colors.textSecondary} />
                    <View style={styles.rowContent}>
                      <Text style={styles.rowLabel}>{t('backgroundAutostart')}</Text>
                      <Text style={styles.rowSublabel}>{t('backgroundAutostartHint')}</Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <PickerModal<BackgroundRelayRetention>
        visible={pickerOpen}
        title={t('backgroundStayConnected')}
        options={options}
        selected={retention}
        onSelect={selectRetention}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}

const localStyles = StyleSheet.create({
  description: {
    fontSize: typography.bodySize - 1,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.xs
  }
})
