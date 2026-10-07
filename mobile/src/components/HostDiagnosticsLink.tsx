import { ChevronRight } from 'lucide-react-native'
import { Pressable, StyleSheet, Text } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import { componentsCatalog } from '../i18n/catalogs/components'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export function HostDiagnosticsLink({ onPress }: { onPress: () => void }): React.JSX.Element {
  const t = useMobileTranslation(componentsCatalog)
  return (
    <Pressable
      style={styles.link}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('viewNetworkDiagnostics')}
    >
      <Text style={styles.text}>{t('viewNetworkDiagnostics')}</Text>
      <ChevronRight size={16} color={colors.textSecondary} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  link: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.button,
    backgroundColor: colors.bgPanel,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  text: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontWeight: '600'
  }
})
