import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { useAllHostClients } from '../transport/use-all-host-clients'
import { loadHostCatalog } from '../transport/host-store'
import { pushDeliveryTest } from '../notifications/mobile-push-delivery-test-operations'
import type { RpcFailure } from '../transport/types'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export function NotificationDisplayTest({ onTroubleshoot }: { onTroubleshoot: () => void }) {
  const t = useMobileTranslation(settingsCatalog)
  const busy = useRef(false)
  const [hostIds, setHostIds] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const clients = useAllHostClients(hostIds)
  useEffect(() => {
    void loadHostCatalog()
      .then((hosts) => setHostIds(hosts.map((host) => host.id)))
      .catch(() => setMessage(t('pushTestLoadHostsError')))
  }, [t])
  const run = async () => {
    if (busy.current) {
      return
    }
    busy.current = true
    setSending(true)
    setMessage(null)
    try {
      if (hostIds.length === 0) {
        throw new Error(t('pushTestPairDesktop'))
      }
      const connected = clients.filter((entry) => entry.state === 'connected')
      if (connected.length === 0) {
        throw new Error(t('pushTestConnectDesktop'))
      }
      let unavailable = t('pushTestUpdateDesktop')
      for (const { client } of connected) {
        const reply = await pushDeliveryTest.request(client, null, {
          timeoutMs: 20000,
          failWhenDisconnected: true
        })
        const delivered = pushDeliveryTest.interpret(reply)
        if (!delivered.accepted) {
          // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: this policy skips only a refusal, so an unaccepted reply is a failure envelope.
          const code = (reply as RpcFailure).error?.code
          if (code === 'forbidden' || code === 'method_not_found') {
            continue
          }
          throw new Error(t('pushTestReachError'))
        }
        const result = delivered.value
        if (result?.accepted) {
          setMessage(t('pushTestAccepted'))
          return
        }
        if (result?.reason === 'not_registered') {
          unavailable = t('pushTestNotRegistered')
          continue
        }
        throw new Error(
          result?.reason === 'rate_limited' ? t('pushTestRateLimited') : t('pushTestSendError')
        )
      }
      throw new Error(unavailable)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('pushTestGenericError'))
    } finally {
      busy.current = false
      setSending(false)
    }
  }
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{t('pushTestHeading')}</Text>
      <Text style={styles.detail}>{t('pushTestDetail')}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={sending ? t('pushTestSending') : t('pushTestSend')}
        disabled={sending}
        accessibilityState={{ disabled: sending }}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        onPress={() => void run()}
      >
        <View>
          <Text accessible={false} style={[styles.buttonText, styles.sizingLabel]}>
            {t('pushTestSend')}
          </Text>
          <View pointerEvents="none" style={styles.buttonLabel}>
            <Text accessible={false} style={styles.buttonText}>
              {sending ? t('pushTestSending') : t('pushTestSend')}
            </Text>
          </View>
        </View>
      </Pressable>
      <Pressable accessibilityRole="link" onPress={onTroubleshoot} style={styles.troubleshootLink}>
        <Text style={styles.linkText}>{t('troubleshooting')}</Text>
      </Pressable>
      {message && (
        <Text accessibilityRole="alert" style={styles.detail}>
          {message}
        </Text>
      )}
    </View>
  )
}
const styles = StyleSheet.create({
  container: { marginTop: spacing.xl, gap: spacing.sm },
  label: { color: colors.textPrimary, fontSize: typography.bodySize, fontWeight: '600' },
  detail: { color: colors.textMuted, fontSize: typography.metaSize, lineHeight: 18 },
  button: {
    alignSelf: 'flex-start',
    backgroundColor: colors.bgRaised,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md
  },
  sizingLabel: { opacity: 0 },
  buttonLabel: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  troubleshootLink: { alignSelf: 'flex-start', paddingVertical: spacing.sm },
  linkText: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    textDecorationLine: 'underline'
  },
  pressed: { opacity: 0.6 },
  buttonText: { color: colors.textPrimary, fontSize: typography.metaSize, fontWeight: '600' }
})
