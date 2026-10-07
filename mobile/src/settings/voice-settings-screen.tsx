import { useCallback, useRef, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { VoiceSettingsOperations } from './voice-settings-operations'
import { voiceSettingsStyles as styles } from './voice-settings-styles'
import { ChevronLeft, ChevronRight } from 'lucide-react-native'
import { colors, spacing } from '../theme/mobile-theme'
import { settingsCatalog } from '../i18n/catalogs/settings'
import { useMobileTranslation } from '../i18n/use-mobile-translation'
import { BottomDrawer } from '../components/BottomDrawer'
import { VoiceModelList } from '../components/VoiceModelList'
import { useDictationSetupPoller } from '../dictation/use-dictation-setup-poller'
import {
  isModelInFlight,
  type MobileSpeechModel,
  type MobileSpeechSetup
} from '../dictation/mobile-dictation-setup'

const POLL_INTERVAL_MS = 1500

const DICTATION_MODES = [
  { value: 'toggle', labelKey: 'voiceModeToggle' },
  { value: 'hold', labelKey: 'voiceModeHold' }
] as const

type ModelBusyAction = { modelId: string; type: 'download' | 'select' | 'delete' }

export default function VoiceSettingsScreen({
  operations,
  focused,
  onBack
}: {
  operations: VoiceSettingsOperations | null
  focused: boolean
  onBack: () => void
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const t = useMobileTranslation(settingsCatalog)
  const [setup, setSetup] = useState<MobileSpeechSetup | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<ModelBusyAction | null>(null)
  const requestEpoch = useRef(0)
  const [modelDrawerOpen, setModelDrawerOpen] = useState(false)
  const refresh = useCallback(async (): Promise<boolean | undefined> => {
    if (!operations) {
      return false
    }
    const epoch = requestEpoch.current
    // Own the spinner from the read that clears it, so a retry after a failed load shows
    // the spinner again instead of the stale error card. Reads are serialised by
    // DictationSetupPollController, so no in-flight read can clear another's flag.
    setLoading(true)
    try {
      const next = await operations.load()
      if (epoch !== requestEpoch.current) {
        return undefined
      }
      setSetup(next)
      setError(null)
      return next.models.some(isModelInFlight)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('voiceLoadError'))
      return undefined
    } finally {
      setLoading(false)
    }
  }, [operations, t])

  const polling = setup?.models.some(isModelInFlight) ?? false
  const refreshSetup = useDictationSetupPoller({
    visible: focused && operations !== null,
    polling,
    refresh,
    intervalMs: POLL_INTERVAL_MS
  })

  const configure = useCallback(
    async (params: Parameters<VoiceSettingsOperations['configure']>[0]) => {
      if (!operations) {
        return
      }
      requestEpoch.current += 1
      setError(null)
      // Optimistic flip so the control responds instantly; reconcile below.
      const { enabled, dictationMode } = params
      setSetup((prev) =>
        prev
          ? {
              ...prev,
              ...(enabled === undefined ? {} : { enabled }),
              ...(dictationMode === undefined ? {} : { dictationMode })
            }
          : prev
      )
      try {
        setSetup(await operations.configure(params))
      } catch (err) {
        setError(err instanceof Error ? err.message : t('voiceUpdateError'))
        void refreshSetup()
      }
    },
    [operations, refreshSetup, t]
  )

  const handleUseModel = useCallback(
    async (model: MobileSpeechModel) => {
      if (!operations) {
        return
      }
      requestEpoch.current += 1
      setBusyAction({ modelId: model.id, type: 'select' })
      setError(null)
      try {
        setSetup(await operations.configure({ enabled: true, modelId: model.id }))
        setModelDrawerOpen(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('voiceSelectModelError'))
      } finally {
        setBusyAction(null)
      }
    },
    [operations, t]
  )

  const handleDownload = useCallback(
    async (model: MobileSpeechModel) => {
      if (!operations) {
        return
      }
      requestEpoch.current += 1
      setBusyAction({ modelId: model.id, type: 'download' })
      setError(null)
      try {
        await operations.download(model.id)
        await refreshSetup()
      } catch (err) {
        setError(err instanceof Error ? err.message : t('voiceDownloadError'))
      } finally {
        setBusyAction(null)
      }
    },
    [operations, refreshSetup, t]
  )

  const handleDelete = useCallback(
    async (model: MobileSpeechModel) => {
      if (!operations) {
        return
      }
      const deletedSelectedModel = setup?.selectedModelId === model.id
      requestEpoch.current += 1
      setBusyAction({ modelId: model.id, type: 'delete' })
      setError(null)
      try {
        setSetup(await operations.delete(model.id))
        if (deletedSelectedModel) {
          setModelDrawerOpen(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : t('voiceDeleteError'))
      } finally {
        setBusyAction(null)
      }
    },
    [operations, setup?.selectedModelId, t]
  )

  const enabled = setup?.enabled ?? false
  const selectedModel = setup?.models.find((m) => m.id === setup.selectedModelId)
  const selectedModelLabel = selectedModel?.label ?? t('voiceNoModelSelected')

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
        <Text style={styles.heading}>{t('voice')}</Text>
      </View>

      {!operations ? (
        <View style={[styles.section, styles.sectionTopGap]}>
          <Text style={styles.emptyText}>{t('voiceConnectDesktop')}</Text>
        </View>
      ) : loading && setup === null ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.textSecondary} />
        </View>
      ) : setup === null ? (
        <View style={[styles.section, styles.sectionTopGap]}>
          <Text style={styles.errorText}>{error ?? t('voiceLoadError')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.groupHeading}>{t('voiceDictationHeading')}</Text>
          <View style={[styles.section, styles.sectionTopGap]}>
            <View style={styles.row}>
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('voiceEnableDictation')}</Text>
                <Text style={styles.rowSublabel}>{t('voiceEnableDictationDescription')}</Text>
              </View>
              <Switch
                testID="voice-enabled"
                accessibilityLabel={t('voiceEnableDictation')}
                value={enabled}
                onValueChange={(enabled) => void configure({ enabled })}
                trackColor={{ false: colors.bgRaised, true: colors.textSecondary }}
                thumbColor={colors.textPrimary}
              />
            </View>

            <View style={styles.separator} />

            <View
              style={[styles.row, !enabled && styles.disabled]}
              pointerEvents={enabled ? 'auto' : 'none'}
            >
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('voiceDictationMode')}</Text>
                <Text style={styles.rowSublabel}>{t('voiceDictationModeDescription')}</Text>
              </View>
              <View style={styles.segmented}>
                {DICTATION_MODES.map((mode) => {
                  const active = setup.dictationMode === mode.value
                  return (
                    <Pressable
                      key={mode.value}
                      accessibilityRole="radio"
                      aria-checked={active}
                      testID={`voice-mode-${mode.value}`}
                      onPress={() => void configure({ dictationMode: mode.value })}
                      style={[styles.segment, active && styles.segmentActive]}
                    >
                      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
                        {t(mode.labelKey)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </View>

          <Text style={[styles.groupHeading, styles.inputGroupGap]}>
            {t('voiceSpeechModelHeading')}
          </Text>
          <View style={[styles.section, styles.sectionTopGap]}>
            <Pressable
              style={({ pressed }) => [
                styles.row,
                !enabled && styles.disabled,
                pressed && styles.rowPressed
              ]}
              disabled={!enabled}
              testID="voice-model-picker"
              onPress={() => setModelDrawerOpen(true)}
            >
              <View style={styles.rowContent}>
                <Text style={styles.rowLabel}>{t('voiceSpeechModel')}</Text>
                <Text style={styles.rowSublabel} numberOfLines={1}>
                  {selectedModelLabel}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.textMuted} />
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
      )}

      <BottomDrawer visible={modelDrawerOpen} onClose={() => setModelDrawerOpen(false)}>
        <Text style={styles.drawerTitle}>{t('voiceSpeechModel')}</Text>
        {setup ? (
          <VoiceModelList
            setup={setup}
            disabled={false}
            busyAction={busyAction}
            onUseModel={(m) => void handleUseModel(m)}
            onDownload={(m) => void handleDownload(m)}
            onDelete={(m) => void handleDelete(m)}
          />
        ) : null}
      </BottomDrawer>
    </View>
  )
}
