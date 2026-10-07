import type { ReactNode } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { ChevronLeft, Copy, Check, Send } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import { ConnectionLog } from '../components/ConnectionLog'
import { connectionDiagnosticsScreenStyles as styles } from './connection-diagnostics-screen-styles'
import type { ConnectionLogEntry, ConnectionState } from '../transport/types'
import type { ConnectionDiagnosis } from './connection-diagnostics-analysis'
import type { DiagnosticsSubmissionState } from './connection-diagnostics-screen-data'
import { diagnosticsCatalog } from '../i18n/catalogs/diagnostics'
import type { diagnosticsEn } from '../i18n/catalogs/diagnostics/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export function ConnectionDiagnosticsView({
  hostPicker,
  hasHost,
  hostName,
  state,
  reconnectAttempts,
  copied,
  copyDiagnostics,
  diagnosis,
  submissionState,
  sendDiagnostics,
  entries,
  onBack
}: {
  hostPicker?: ReactNode
  hasHost: boolean
  hostName: string
  state: ConnectionState
  reconnectAttempts: number
  copied: boolean
  copyDiagnostics: () => Promise<void>
  diagnosis: ConnectionDiagnosis | null
  submissionState: DiagnosticsSubmissionState | 'idle'
  sendDiagnostics: () => Promise<void>
  entries: readonly ConnectionLogEntry[]
  onBack: () => void
}) {
  const insets = useSafeAreaInsets()
  const t = useMobileTranslation(diagnosticsCatalog)
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
        <Text style={styles.heading}>{t('networkDiagnostics')}</Text>
      </View>

      {hostPicker}
      {hasHost ? (
        <>
          <View style={styles.statusRow}>
            <Text style={styles.statusText}>
              {reconnectAttempts > 0
                ? t('stateWithAttempt', {
                    state: connectionStateLabel(state, t),
                    attempt: reconnectAttempts
                  })
                : connectionStateLabel(state, t)}
            </Text>
            <Pressable style={styles.copyButton} onPress={() => void copyDiagnostics()}>
              {copied ? (
                <Check size={14} color={colors.statusGreen} />
              ) : (
                <Copy size={14} color={colors.textSecondary} />
              )}
              <Text style={styles.copyButtonText}>{copied ? t('copied') : t('copyReport')}</Text>
            </Pressable>
          </View>
          {diagnosis && (
            <View style={styles.diagnosisCard}>
              <Text style={styles.diagnosisHeading}>{t('whatThisSuggests')}</Text>
              <Text style={styles.diagnosisText}>{diagnosis.likelyCause}</Text>
              <Text style={styles.diagnosisNext}>{diagnosis.nextStep}</Text>
              {diagnosis.reportability === 'dolphin-relay' && (
                <>
                  <Text style={styles.privacyHint}>{t('sendPrivacyHint')}</Text>
                  <Pressable
                    style={styles.sendButton}
                    onPress={() => void sendDiagnostics()}
                    disabled={submissionState === 'sending'}
                  >
                    {submissionState === 'sent' ? (
                      <Check size={14} color={colors.statusGreen} />
                    ) : (
                      <Send size={14} color={colors.textPrimary} />
                    )}
                    <Text style={styles.sendButtonText}>
                      {submissionState === 'sending'
                        ? t('sending')
                        : submissionState === 'sent'
                          ? t('diagnosticsSent')
                          : submissionState === 'failed'
                            ? t('retrySending')
                            : t('sendDiagnostics')}
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
          {entries.length > 0 ? (
            <ConnectionLog entries={[...entries]} title={hostName} fillAvailableHeight />
          ) : (
            <Text style={styles.emptyText}>{t('noEvents')}</Text>
          )}
        </>
      ) : (
        <Text style={styles.emptyText}>{t('noPairedHosts')}</Text>
      )}
    </View>
  )
}

function connectionStateLabel(
  state: ConnectionState,
  t: MobileTranslate<typeof diagnosticsEn>
): string {
  switch (state) {
    case 'connecting':
      return t('stateConnecting')
    case 'handshaking':
      return t('stateHandshaking')
    case 'connected':
      return t('stateConnected')
    case 'disconnected':
      return t('stateDisconnected')
    case 'reconnecting':
      return t('stateReconnecting')
    case 'auth-failed':
      return t('stateAuthFailed')
  }
}
