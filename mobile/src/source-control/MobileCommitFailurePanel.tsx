import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { ChevronDown, ChevronRight, Sparkles } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { sourceControlCatalog } from '../i18n/catalogs/source-control'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import type { MobileCommitFailureRecovery } from './mobile-commit-failure-recovery'
import type { MobileCommitFailureRecoveryAction } from './use-mobile-commit-failure-recovery'
import { styles } from './mobile-source-control-styles'

type Props = {
  failure: MobileCommitFailureRecovery
  action: MobileCommitFailureRecoveryAction
}

export function MobileCommitFailurePanel({ failure, action }: Props) {
  const t = useMobileTranslation(sourceControlCatalog)
  const [expanded, setExpanded] = useState(false)
  const Chevron = expanded ? ChevronDown : ChevronRight
  const detailsText = failure.error.trim()

  return (
    <View style={styles.commitFailurePanel}>
      <View style={styles.commitFailureHeader}>
        <View style={styles.commitFailureTextBlock}>
          <Text style={styles.commitFailureTitle}>{t('commitFailed')}</Text>
          <Text style={styles.commitFailureSummary} numberOfLines={2}>
            {action.summary ?? t('commitFailedSentence')}
          </Text>
        </View>
        <Pressable
          style={({ pressed }) => [
            styles.commitFailureFixButton,
            action.launching && styles.commitFailureFixButtonDisabled,
            pressed && styles.commitFailureFixButtonPressed
          ]}
          onPress={() => void action.launch()}
          disabled={action.launching}
          accessibilityRole="button"
          accessibilityLabel={t('fixWithAiA11y')}
        >
          {action.launching ? (
            <ActivityIndicator color={colors.bgBase} />
          ) : (
            <Sparkles size={14} color={colors.bgBase} strokeWidth={2.2} />
          )}
          <Text style={styles.commitFailureFixButtonText}>{t('fix')}</Text>
        </Pressable>
      </View>
      {action.hasDetails && detailsText ? (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.commitFailureDetailsButton,
              pressed && styles.commitFailureDetailsButtonPressed
            ]}
            onPress={() => setExpanded((current) => !current)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? t('hideDetailsA11y') : t('showDetailsA11y')}
          >
            <Chevron size={14} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={styles.commitFailureDetailsButtonText}>
              {expanded ? t('hideDetails') : t('showDetails')}
            </Text>
          </Pressable>
          {expanded ? <Text style={styles.commitFailureDetailsText}>{detailsText}</Text> : null}
        </>
      ) : null}
      {action.launchError ? (
        <Text style={styles.commitFailureLaunchError}>{action.launchError}</Text>
      ) : null}
    </View>
  )
}
