import { ActivityIndicator, Pressable, type StyleProp, type ViewStyle } from 'react-native'
import { ImagePlus, Mic } from 'lucide-react-native'
import { colors } from '../theme/mobile-theme'
import { sessionCatalog } from '../i18n/catalogs/session'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type DictationState = {
  readonly isStarting: boolean
  readonly isRecording: boolean
  readonly isProcessing: boolean
}

type MobileTerminalInputActionsProps = {
  readonly canSend: boolean
  readonly isAttaching: boolean
  readonly dictation: DictationState
  readonly dictationMode: string | undefined
  readonly buttonStyle: StyleProp<ViewStyle>
  readonly activeButtonStyle: StyleProp<ViewStyle>
  readonly disabledButtonStyle: StyleProp<ViewStyle>
  readonly onAttachImage: () => void
  readonly onAttachFile: () => void
  readonly onDictationToggle: () => void
  readonly onDictationPressIn: () => void
  readonly onDictationPressOut: () => void
  readonly onDictationCancel: () => void
}

// Image + mic peer actions shared by the live and buffered input bars so both
// surfaces offer identical multimodal entry points (and the JSX lives once).
export function MobileTerminalInputActions({
  canSend,
  isAttaching,
  dictation,
  dictationMode,
  buttonStyle,
  activeButtonStyle,
  disabledButtonStyle,
  onAttachImage,
  onAttachFile,
  onDictationToggle,
  onDictationPressIn,
  onDictationPressOut,
  onDictationCancel
}: MobileTerminalInputActionsProps) {
  const t = useMobileTranslation(sessionCatalog)
  const dictationActive = dictation.isStarting || dictation.isRecording
  return (
    <>
      <Pressable
        style={[buttonStyle, (!canSend || isAttaching) && disabledButtonStyle]}
        disabled={!canSend || isAttaching}
        // Tap opens the photo library; long-press picks a file. Uploads via host
        // RPC so SSH/remote sessions attach the same as local ones.
        onPress={onAttachImage}
        onLongPress={onAttachFile}
        delayLongPress={350}
        accessibilityLabel={isAttaching ? t('sendingImage') : t('attachPhoto')}
        accessibilityHint={t('attachPhotoHint')}
      >
        {isAttaching ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <ImagePlus size={17} color={colors.textSecondary} strokeWidth={2.4} />
        )}
      </Pressable>
      <Pressable
        style={[buttonStyle, dictationActive && activeButtonStyle, !canSend && disabledButtonStyle]}
        disabled={!canSend}
        onPress={dictationMode === 'toggle' ? onDictationToggle : undefined}
        onPressIn={dictationMode === 'hold' ? onDictationPressIn : undefined}
        onPressOut={dictationMode === 'hold' ? onDictationPressOut : undefined}
        onLongPress={
          dictationMode === 'toggle'
            ? () => {
                if (dictation.isRecording || dictation.isProcessing) {
                  onDictationCancel()
                }
              }
            : undefined
        }
        accessibilityLabel={
          dictation.isRecording
            ? t('stopVoiceDictation')
            : dictation.isProcessing
              ? t('cancelVoiceDictation')
              : dictation.isStarting
                ? t('startingVoiceDictation')
                : t('startVoiceDictation')
        }
      >
        {dictation.isProcessing ? (
          <ActivityIndicator size="small" color={colors.textSecondary} />
        ) : (
          <Mic
            size={17}
            color={dictationActive ? colors.textPrimary : colors.textSecondary}
            strokeWidth={2.4}
          />
        )}
      </Pressable>
    </>
  )
}
