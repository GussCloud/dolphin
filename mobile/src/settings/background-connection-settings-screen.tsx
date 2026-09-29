import { useCallback, useEffect, useState } from 'react'
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BatteryCharging, ChevronLeft, ChevronRight, Power, Radio } from 'lucide-react-native'
import { PickerModal, type PickerOption } from '../components/PickerModal'
import type { NativeBackgroundRelay } from '../platform/native-background-relay'
import { loadBackgroundRelayRetention, saveBackgroundRelayRetention } from '../storage/preferences'
import {
  setBackgroundRelayRetention,
  type BackgroundRelayRetention
} from '../transport/background-relay-retention'
import { colors, spacing, typography } from '../theme/mobile-theme'
import { voiceSettingsStyles as styles } from './voice-settings-styles'

const RETENTION_OPTIONS: PickerOption<BackgroundRelayRetention>[] = [
  { value: 'off', label: 'Off', subtitle: 'Disconnect shortly after you leave the app.' },
  { value: '15m', label: '15 minutes', subtitle: 'Stay connected for 15 minutes in background.' },
  { value: '1h', label: '1 hour', subtitle: 'Stay connected for 1 hour in background.' },
  { value: 'always', label: 'Always', subtitle: 'Stay connected until you turn this off.' }
]

function retentionLabel(retention: BackgroundRelayRetention): string {
  return RETENTION_OPTIONS.find((option) => option.value === retention)?.label ?? 'Off'
}

export default function BackgroundConnectionSettingsScreen({
  native,
  onBack
}: {
  native: NativeBackgroundRelay
  onBack: () => void
}): React.JSX.Element {
  const insets = useSafeAreaInsets()
  const [retention, setRetention] = useState<BackgroundRelayRetention>('off')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unrestricted, setUnrestricted] = useState(() => native.isIgnoringBatteryOptimizations())
  const hasAutostart = native.hasAutostartSettings()

  useEffect(() => {
    let active = true
    void loadBackgroundRelayRetention().then((loaded) => {
      if (active) {
        setRetention(loaded)
      }
    })
    // Battery exemption is granted in a system screen; re-read it on return.
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setUnrestricted(native.isIgnoringBatteryOptimizations())
      }
    })
    return () => {
      active = false
      subscription.remove()
    }
  }, [native])

  const selectRetention = useCallback(
    (next: BackgroundRelayRetention) => {
      setError(null)
      setRetention(next)
      setBackgroundRelayRetention(next)
      void saveBackgroundRelayRetention(next).catch(() =>
        setError('Could not save background connection. Try again.')
      )
      if (next !== 'off' && !native.isIgnoringBatteryOptimizations()) {
        native.requestIgnoreBatteryOptimizations()
      }
    },
    [native]
  )

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={styles.backButton}
          onPress={onBack}
        >
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.heading}>Background connection</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.groupHeading}>RELAY</Text>
        <Text style={localStyles.description}>
          Keep the Relay connection open after you leave the app so it reopens instantly. While on,
          Android shows a persistent notification and battery use goes up.
        </Text>
        {error && (
          <Text accessibilityRole="alert" style={styles.error}>
            {error}
          </Text>
        )}
        <View style={[styles.section, styles.sectionTopGap]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stay connected in background"
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setPickerOpen(true)}
          >
            <Radio size={16} color={colors.textSecondary} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>Stay connected in background</Text>
              <Text style={styles.rowSublabel}>{retentionLabel(retention)}</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        {retention !== 'off' && (
          <>
            <Text style={[styles.groupHeading, styles.inputGroupGap]}>SYSTEM</Text>
            <Text style={localStyles.description}>
              Battery savers can still close the connection. Allow Dolphin to run unrestricted
              {hasAutostart ? ' and enable Autostart' : ''}.
            </Text>
            <View style={[styles.section, styles.sectionTopGap]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Battery optimization"
                disabled={unrestricted}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                onPress={() => native.requestIgnoreBatteryOptimizations()}
              >
                <BatteryCharging size={16} color={colors.textSecondary} />
                <View style={styles.rowContent}>
                  <Text style={styles.rowLabel}>Battery optimization</Text>
                  <Text style={styles.rowSublabel}>
                    {unrestricted ? 'Unrestricted' : 'Restricted — tap to allow'}
                  </Text>
                </View>
                {!unrestricted && <ChevronRight size={16} color={colors.textMuted} />}
              </Pressable>
              {hasAutostart && (
                <>
                  <View style={styles.separator} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Autostart"
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                    onPress={() => native.openAutostartSettings()}
                  >
                    <Power size={16} color={colors.textSecondary} />
                    <View style={styles.rowContent}>
                      <Text style={styles.rowLabel}>Autostart</Text>
                      <Text style={styles.rowSublabel}>Required on Xiaomi, Redmi and POCO</Text>
                    </View>
                    <ChevronRight size={16} color={colors.textMuted} />
                  </Pressable>
                </>
              )}
            </View>
          </>
        )}
      </ScrollView>

      <PickerModal<BackgroundRelayRetention>
        visible={pickerOpen}
        title="Stay connected in background"
        options={RETENTION_OPTIONS}
        selected={retention}
        onSelect={selectRetention}
        onClose={() => setPickerOpen(false)}
      />
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
