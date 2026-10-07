import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Check, ChevronLeft } from 'lucide-react-native'
import { UI_LANGUAGE_SYSTEM } from '../../../src/shared/ui-language'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { MOBILE_LANGUAGE_ENDONYMS, MOBILE_LANGUAGE_LOCALES } from '../i18n/mobile-language-options'
import { useMobileLanguageSetting } from '../i18n/mobile-locale-provider'
import {
  resolveMobileSystemUiLocale,
  type MobileLanguagePreference
} from '../i18n/mobile-locale-state'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { voiceSettingsStyles as styles } from './voice-settings-styles'

type LanguageRow = { value: MobileLanguagePreference; label: string; sublabel?: string }

export default function LanguageSettingsScreen({
  onBack
}: {
  onBack?: () => void
}): React.JSX.Element {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const t = useMobileTranslation(settingsCatalog)
  const { preference, setPreference } = useMobileLanguageSetting()
  const [error, setError] = useState<string | null>(null)

  const rows: LanguageRow[] = [
    {
      value: UI_LANGUAGE_SYSTEM,
      label: t('languageSystemDefault'),
      sublabel: MOBILE_LANGUAGE_ENDONYMS[resolveMobileSystemUiLocale()]
    },
    ...MOBILE_LANGUAGE_LOCALES.map((locale) => ({
      value: locale,
      label: MOBILE_LANGUAGE_ENDONYMS[locale]
    }))
  ]

  const select = (next: MobileLanguagePreference) => {
    setError(null)
    // The UI switches at once; only the write can fail.
    void setPreference(next).catch(() => setError(t('languageSaveError')))
  }

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
        <Text style={styles.heading}>{t('language')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.groupHeading}>{t('languageHeading')}</Text>
        <Text style={localStyles.description}>{t('languageDescription')}</Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={[styles.section, styles.sectionTopGap]}>
          {rows.map((row, index) => {
            const selected = row.value === preference
            return (
              <View key={row.value}>
                {index > 0 && <View style={styles.separator} />}
                <Pressable
                  accessibilityRole="radio"
                  accessibilityLabel={row.label}
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                  onPress={() => select(row.value)}
                >
                  <View style={styles.rowContent}>
                    <Text style={styles.rowLabel}>{row.label}</Text>
                    {row.sublabel ? <Text style={styles.rowSublabel}>{row.sublabel}</Text> : null}
                  </View>
                  {selected && <Check size={16} color={colors.textPrimary} />}
                </Pressable>
              </View>
            )
          })}
        </View>
      </ScrollView>
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
