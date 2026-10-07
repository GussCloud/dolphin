import { StyleSheet, Text, View } from 'react-native'
import type { HomeStatsSummary } from '../stats/home-stats-total'
import { colors, spacing } from '../theme/mobile-theme'
import { homeCatalog } from '../i18n/catalogs/home'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import type { homeEn } from '../i18n/catalogs/home/en'
import { useMobileLocale, useMobileTranslation } from '../i18n/use-mobile-translation'

function formatDuration(ms: number, t: MobileTranslate<typeof homeEn>): string {
  const totalMinutes = Math.floor(ms / 60_000)
  const totalHours = Math.floor(totalMinutes / 60)
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  if (days > 0) {
    return t('durationDaysHours', { days, hours })
  }
  const minutes = totalMinutes % 60
  return totalHours > 0
    ? t('durationHoursMinutes', { hours: totalHours, minutes })
    : t('durationMinutes', { minutes: totalMinutes })
}

export function MobileHomeListHeader({ stats }: { stats: HomeStatsSummary | null }) {
  const t = useMobileTranslation(homeCatalog)
  const locale = useMobileLocale()
  return (
    <View>
      <View style={styles.hero}>
        <Text style={styles.heroTitle}>{t('welcomeBack')}</Text>
      </View>
      {stats ? (
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalAgentsSpawned.toLocaleString(locale)}</Text>
            <Text style={styles.statLabel}>{t('statAgentsSpawned')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatDuration(stats.totalAgentTimeMs, t)}</Text>
            <Text style={styles.statLabel}>{t('statAgentTime')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalPRsCreated.toLocaleString(locale)}</Text>
            <Text style={styles.statLabel}>{t('statPRsCreated')}</Text>
          </View>
        </View>
      ) : null}
      <Text style={styles.sectionHeading}>{t('desktops')}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  hero: { paddingTop: spacing.xs, paddingBottom: spacing.md },
  heroTitle: {
    color: colors.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.3
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: spacing.lg },
  statCard: {
    flex: 1,
    backgroundColor: 'rgba(26,26,26,0.6)',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: spacing.md
  },
  statValue: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3
  },
  statLabel: { color: colors.textMuted, fontSize: 11, fontWeight: '500', marginTop: 2 },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs
  }
})
