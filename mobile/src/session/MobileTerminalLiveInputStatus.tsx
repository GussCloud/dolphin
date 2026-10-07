import { StyleSheet, Text, View } from 'react-native'
import { colors, typography } from '../theme/mobile-theme'
import { sessionCatalog } from '../i18n/catalogs/session'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type DictationStatus = {
  readonly isStarting: boolean
  readonly isRecording: boolean
  readonly isProcessing: boolean
}

type MobileTerminalLiveInputStatusProps = {
  readonly dictation: DictationStatus
  readonly isAttaching: boolean
  readonly liveInputText: string
}

export function MobileTerminalLiveInputStatus({
  dictation,
  isAttaching,
  liveInputText
}: MobileTerminalLiveInputStatusProps) {
  const t = useMobileTranslation(sessionCatalog)
  const title = dictation.isRecording
    ? t('liveInputListening')
    : dictation.isProcessing
      ? t('liveInputProcessing')
      : dictation.isStarting
        ? t('liveInputStartingMic')
        : t('liveInputTitle')
  const detail = dictation.isRecording
    ? t('liveInputTapMicToStop')
    : dictation.isProcessing
      ? t('liveInputTranscribing')
      : dictation.isStarting
        ? t('liveInputPreparingMic')
        : isAttaching
          ? t('liveInputUploadingImage')
          : liveInputText || t('liveInputTapToShowKeyboard')

  return (
    <View style={styles.status}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.detail} numberOfLines={1} ellipsizeMode="head">
        {detail}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  status: {
    flex: 1,
    gap: 1
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.metaSize,
    fontWeight: '600'
  },
  detail: {
    color: colors.textSecondary,
    fontSize: typography.metaSize,
    fontFamily: typography.monoFamily
  }
})
