import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { KeyRound } from 'lucide-react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  loadPendingHostCredentialCleanup,
  subscribePendingHostCredentialCleanup
} from '../transport/host-credential-cleanup'
import { retryPendingHostCredentialCleanup } from '../transport/host-store'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export function PendingCredentialCleanupCard() {
  const t = useMobileTranslation(settingsCatalog)
  const [pendingCredentialIds, setPendingCredentialIds] = useState<string[]>([])
  const [credentialStorageUnreadable, setCredentialStorageUnreadable] = useState(false)
  const [retryingCredentialCleanup, setRetryingCredentialCleanup] = useState(false)
  const [credentialRetryFailed, setCredentialRetryFailed] = useState(false)
  const credentialRefreshGenerationRef = useRef(0)

  useFocusEffect(
    useCallback(() => {
      let active = true
      setCredentialRetryFailed(false)
      const refresh = () => {
        const generation = ++credentialRefreshGenerationRef.current
        void loadPendingHostCredentialCleanup().then((state) => {
          if (active && generation === credentialRefreshGenerationRef.current) {
            setPendingCredentialIds(state.ids)
            setCredentialStorageUnreadable(state.storageUnreadable)
            // Why: neutral copy once the queue is confirmed empty so a later
            // pending set does not inherit a previous Retry failure message.
            if (state.ids.length === 0 && !state.storageUnreadable) {
              setCredentialRetryFailed(false)
            }
          }
        })
      }
      const unsubscribe = subscribePendingHostCredentialCleanup(refresh)
      refresh()
      return () => {
        active = false
        credentialRefreshGenerationRef.current += 1
        unsubscribe()
      }
    }, [])
  )

  const retryCredentialCleanup = useCallback(async () => {
    if (retryingCredentialCleanup) {
      return
    }
    setCredentialRetryFailed(false)
    setRetryingCredentialCleanup(true)
    try {
      const result = await retryPendingHostCredentialCleanup()
      setPendingCredentialIds(result.remainingIds)
      setCredentialStorageUnreadable(result.storageUnreadable)
      setCredentialRetryFailed(result.remainingIds.length > 0 || result.storageUnreadable)
    } catch {
      setCredentialRetryFailed(true)
    } finally {
      setRetryingCredentialCleanup(false)
    }
  }, [retryingCredentialCleanup])

  const pendingCredentialCount = pendingCredentialIds.length
  // Why: show the cleanup card whenever cleanup is pending OR the durable queue
  // is unreadable — an unreadable queue can hide an orphaned token, so keep a
  // retry affordance rather than a silently-empty (hidden) section.
  if (pendingCredentialCount === 0 && !credentialStorageUnreadable) {
    return null
  }

  return (
    <View style={[styles.section, styles.sectionSpacer]}>
      <View style={styles.credentialCleanupRow}>
        <KeyRound size={16} color={colors.statusAmber} />
        <View style={styles.credentialCleanupCopy}>
          <Text style={styles.credentialCleanupTitle}>{t('credentialCleanupTitle')}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.rowHint}>
            {credentialRetryFailed
              ? t('credentialCleanupRetryFailed')
              : pendingCredentialCount > 0
                ? t('credentialCleanupPending', { count: pendingCredentialCount })
                : t('credentialCleanupUnreadable')}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('credentialCleanupRetryLabel')}
          accessibilityState={{
            busy: retryingCredentialCleanup,
            disabled: retryingCredentialCleanup
          }}
          disabled={retryingCredentialCleanup}
          hitSlop={8}
          style={({ pressed }) => [
            styles.retryButton,
            pressed && !retryingCredentialCleanup && styles.rowPressed
          ]}
          onPress={() => void retryCredentialCleanup()}
        >
          {retryingCredentialCleanup ? (
            <ActivityIndicator size="small" color={colors.textSecondary} />
          ) : (
            <Text style={styles.retryButtonText}>{t('retry')}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.bgPanel,
    borderRadius: 12,
    overflow: 'hidden'
  },
  sectionSpacer: {
    marginTop: spacing.md
  },
  rowPressed: {
    backgroundColor: colors.bgRaised
  },
  credentialCleanupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2
  },
  credentialCleanupCopy: {
    flex: 1,
    gap: spacing.xs
  },
  credentialCleanupTitle: {
    fontSize: typography.bodySize,
    fontWeight: '500',
    color: colors.textPrimary
  },
  rowHint: {
    fontSize: typography.metaSize,
    color: colors.textSecondary,
    lineHeight: 17
  },
  retryButton: {
    width: 72,
    height: 32,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised,
    alignItems: 'center',
    justifyContent: 'center'
  },
  retryButtonText: {
    fontSize: typography.metaSize,
    fontWeight: '600',
    color: colors.textPrimary
  }
})
