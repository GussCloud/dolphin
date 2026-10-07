import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Globe } from 'lucide-react-native'
import { PickerModal, type PickerOption } from '../components/PickerModal'
import {
  loadTerminalLinkOpenMode,
  saveTerminalLinkOpenMode,
  type MobileTerminalLinkOpenMode
} from '../storage/preferences'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import type { settingsEn } from '../i18n/catalogs/settings/en'

function linkModeOptions(
  t: MobileTranslate<typeof settingsEn>
): PickerOption<MobileTerminalLinkOpenMode>[] {
  return [
    {
      value: 'dolphin-browser',
      label: t('browserModeDolphin'),
      subtitle: t('browserModeDolphinSubtitle')
    },
    {
      value: 'phone-browser',
      label: t('browserModePhone'),
      subtitle: t('browserModePhoneSubtitle')
    }
  ]
}

export default function BrowserSettingsScreen({
  onBack
}: {
  onBack?: () => void
}): React.JSX.Element {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const t = useMobileTranslation(settingsCatalog)
  const options = useMemo(() => linkModeOptions(t), [t])
  const [linkMode, setLinkMode] = useState<MobileTerminalLinkOpenMode>('dolphin-browser')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    void loadTerminalLinkOpenMode().then(
      (mode) => {
        if (active) {
          setLinkMode(mode)
        }
      },
      () => {
        if (active) {
          setError(t('browserLoadError'))
        }
      }
    )
    return () => {
      active = false
    }
  }, [])

  const selectLinkMode = useCallback(
    (mode: MobileTerminalLinkOpenMode) => {
      setError(null)
      // Optimistic, as base was: the row shows the tapped mode before the write lands.
      setLinkMode(mode)
      void saveTerminalLinkOpenMode(mode).catch(() => setError(t('browserSaveError')))
    },
    [t]
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          style={styles.backButton}
          onPress={onBack ?? (() => router.back())}
        >
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.heading}>{t('browser')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.groupHeading}>{t('browserLinksHeading')}</Text>
        <Text style={styles.groupDescription}>{t('browserLinksDescription')}</Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.groupDescription}>
            {error}
          </Text>
        )}
        <View style={[styles.section, styles.sectionTopGap]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('browserOpenTerminalLinks')}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setPickerOpen(true)}
          >
            <Globe size={16} color={colors.textSecondary} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('browserOpenTerminalLinks')}</Text>
              <Text style={styles.rowSublabel}>
                {(options.find((option) => option.value === linkMode) ?? options[0]!).label}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>

      <PickerModal<MobileTerminalLinkOpenMode>
        visible={pickerOpen}
        title={t('browserOpenTerminalLinks')}
        options={options}
        selected={linkMode}
        onSelect={selectLinkMode}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    paddingHorizontal: spacing.lg,
    paddingTop: 0
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg
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
  scrollContent: {
    paddingBottom: spacing.xl
  },
  groupHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs
  },
  groupDescription: {
    fontSize: typography.bodySize - 1,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: spacing.xs
  },
  section: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    overflow: 'hidden'
  },
  sectionTopGap: {
    marginTop: spacing.sm
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2
  },
  rowPressed: {
    backgroundColor: colors.bgRaised
  },
  rowContent: {
    flex: 1
  },
  rowLabel: {
    fontSize: typography.bodySize,
    fontWeight: '500',
    color: colors.textPrimary
  },
  rowSublabel: {
    fontSize: typography.bodySize - 2,
    color: colors.textSecondary,
    marginTop: 2
  }
})
