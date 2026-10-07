import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, Text, Pressable, Switch } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useSharedValue
} from 'react-native-reanimated'
import { useRouter } from 'expo-router'
import { ChevronLeft, ChevronRight, Smartphone, Type } from 'lucide-react-native'
import { colors, spacing } from '../src/theme/mobile-theme'
import { loadHosts } from '../src/transport/host-store'
import type { HostProfile } from '../src/transport/types'
import { useFocusedSettingsHostClients } from '../src/transport/settings-host-client-connections'
import type { RpcClient } from '../src/transport/rpc-client'
import { PickerModal, type PickerOption } from '../src/components/PickerModal'
import { TerminalShortcutSettings } from '../src/components/TerminalShortcutSettings'
import { setTerminalAutoRestoreFitMsForHost } from '../src/terminal/terminal-auto-restore-fit-state'
import { terminalSettingsScreenStyles as styles } from '../src/terminal/terminal-settings-screen-styles'
import { setTerminalSettingsScrollEnabled } from '../src/terminal/terminal-settings-scroll-lock'
import {
  loadTerminalAutocompleteEnabled,
  loadTerminalTextScale,
  saveTerminalAutocompleteEnabled,
  saveTerminalTextScale
} from '../src/storage/preferences'
import { settingsCatalog } from '../src/i18n/catalogs/settings'
import type { MobileTranslate } from '../src/i18n/mobile-i18n-catalog'
import type { settingsEn } from '../src/i18n/catalogs/settings/en'
import { useMobileTranslation } from '../src/i18n/use-mobile-translation'

type RestoreValue = 'indefinite' | '60s' | '5m' | '30m'

type TextSizeValue = 'smallest' | 'smaller' | 'default' | 'large' | 'larger' | 'largest'

type SettingsTranslate = MobileTranslate<typeof settingsEn>

// scale = baseline zoom the terminal WebView applies on top of fit-to-width.
// Keep in sync with TERMINAL_TEXT_SCALES; pinch-to-zoom snaps to these values.
const TEXT_SIZE_OPTIONS = [
  { value: 'smallest', labelKey: 'terminalTextSizeSmallest', scale: 0.5 },
  { value: 'smaller', labelKey: 'terminalTextSizeSmaller', scale: 0.75 },
  { value: 'default', labelKey: 'terminalTextSizeDefault', scale: 1 },
  { value: 'large', labelKey: 'terminalTextSizeLarge', scale: 1.25 },
  { value: 'larger', labelKey: 'terminalTextSizeLarger', scale: 1.5 },
  { value: 'largest', labelKey: 'terminalTextSizeLargest', scale: 2 }
] as const satisfies readonly { value: TextSizeValue; labelKey: string; scale: number }[]

function textSizeValueFromScale(scale: number): TextSizeValue {
  return TEXT_SIZE_OPTIONS.find((o) => o.scale === scale)?.value ?? 'default'
}

function textSizeSummary(scale: number, t: SettingsTranslate): string {
  return t((TEXT_SIZE_OPTIONS.find((o) => o.scale === scale) ?? TEXT_SIZE_OPTIONS[0]).labelKey)
}

const AUTO_RESTORE_FIT_OPTIONS = [
  { value: 'indefinite', labelKey: 'terminalRestoreKeepPhoneSize', ms: null },
  { value: '60s', labelKey: 'terminalRestoreAfter1Minute', ms: 60_000 },
  { value: '5m', labelKey: 'terminalRestoreAfter5Minutes', ms: 5 * 60_000 },
  { value: '30m', labelKey: 'terminalRestoreAfter30Minutes', ms: 30 * 60_000 }
] as const satisfies readonly { value: RestoreValue; labelKey: string; ms: number | null }[]

function pickerOptions<T extends string>(
  options: readonly { value: T; labelKey: keyof typeof settingsEn }[],
  t: SettingsTranslate
): PickerOption<T>[] {
  return options.map((option) => ({ value: option.value, label: t(option.labelKey) }))
}

function valueFromMs(ms: number | null | undefined): RestoreValue {
  if (ms == null) {
    return 'indefinite'
  }
  const exact = AUTO_RESTORE_FIT_OPTIONS.find((o) => o.ms === ms)
  if (exact) {
    return exact.value
  }
  // Why: server may return a non-preset ms (custom value, future preset,
  // or server-side clamp). Snap to the closest finite preset so the
  // picker's selected radio agrees with the row sublabel rendered by
  // autoRestoreSummary ("After Xs").
  let closest: (typeof AUTO_RESTORE_FIT_OPTIONS)[number] | null = null
  let bestDelta = Infinity
  for (const opt of AUTO_RESTORE_FIT_OPTIONS) {
    if (opt.ms == null) {
      continue
    }
    const delta = Math.abs(opt.ms - ms)
    if (delta < bestDelta) {
      bestDelta = delta
      closest = opt
    }
  }
  return closest ? closest.value : 'indefinite'
}

function autoRestoreSummary(ms: number | null | undefined, t: SettingsTranslate): string {
  if (ms === undefined) {
    return '…'
  }
  if (ms === null) {
    return t(AUTO_RESTORE_FIT_OPTIONS[0].labelKey)
  }
  const exact = AUTO_RESTORE_FIT_OPTIONS.find((o) => o.ms === ms)
  return exact
    ? t(exact.labelKey)
    : t('terminalRestoreAfterSeconds', { seconds: Math.round(ms / 1000) })
}

function HostFitRow({
  client,
  hostName,
  ms,
  onPress
}: {
  client: RpcClient | null
  hostName: string
  ms: number | null | undefined
  onPress: () => void
}): React.JSX.Element {
  const t = useMobileTranslation(settingsCatalog)
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
      disabled={!client}
    >
      <Smartphone size={16} color={colors.textSecondary} />
      <View style={styles.rowContent}>
        <Text style={styles.rowLabel}>{hostName}</Text>
        <Text style={styles.rowSublabel}>{autoRestoreSummary(ms, t)}</Text>
      </View>
      <ChevronRight size={16} color={colors.textMuted} />
    </Pressable>
  )
}

export default function TerminalSettingsScreen() {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const t = useMobileTranslation(settingsCatalog)
  const textSizeOptions = useMemo(() => pickerOptions(TEXT_SIZE_OPTIONS, t), [t])
  const autoRestoreOptions = useMemo(() => pickerOptions(AUTO_RESTORE_FIT_OPTIONS, t), [t])
  const [hosts, setHosts] = useState<HostProfile[]>([])
  useEffect(() => {
    void loadHosts().then(setHosts)
  }, [])
  const hostIds = useMemo(() => hosts.map((h) => h.id), [hosts])
  const { clients: hostClients } = useFocusedSettingsHostClients(hostIds)
  const hostClientsById = useMemo(
    () => new Map(hostClients.map((entry) => [entry.hostId, entry.client])),
    [hostClients]
  )

  // Why: per-host current value, lazily fetched. We keep state at the
  // screen level rather than per-row so the picker can render at root
  // level — embedding PickerModal inside a row clipped its BottomDrawer
  // absoluteFill backdrop to the ScrollView content frame and made the
  // drawer appear cut-off.
  const [hostMs, setHostMs] = useState<Record<string, number | null | undefined>>({})
  const [pickerHostId, setPickerHostId] = useState<string | null>(null)

  const [textScale, setTextScale] = useState(1)
  const [textSizePickerOpen, setTextSizePickerOpen] = useState(false)
  useEffect(() => {
    void loadTerminalTextScale().then(setTextScale)
  }, [])
  const selectTextSize = useCallback((value: TextSizeValue) => {
    const opt = TEXT_SIZE_OPTIONS.find((o) => o.value === value)
    if (!opt) {
      return
    }
    setTextScale(opt.scale)
    void saveTerminalTextScale(opt.scale)
  }, [])

  const [autocompleteEnabled, setAutocompleteEnabled] = useState(false)
  // Why: a fast toggle before the initial load resolves must win — otherwise the
  // delayed read would clobber the user's choice with the stored (stale) value.
  const userToggledAutocompleteRef = useRef(false)
  useEffect(() => {
    let stale = false
    void loadTerminalAutocompleteEnabled().then((enabled) => {
      if (!stale && !userToggledAutocompleteRef.current) {
        setAutocompleteEnabled(enabled)
      }
    })
    return () => {
      stale = true
    }
  }, [])
  const toggleAutocomplete = useCallback((next: boolean) => {
    userToggledAutocompleteRef.current = true
    setAutocompleteEnabled(next)
    void saveTerminalAutocompleteEnabled(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    for (const host of hosts) {
      const client = hostClientsById.get(host.id) ?? null
      if (!client) {
        continue
      }
      void client
        .sendRequest('terminal.getAutoRestoreFit')
        .then((resp) => {
          if (cancelled) {
            return
          }
          const value = (resp as { ms?: number | null } | null)?.ms
          // Why: reconnect/status ticks can replay the same value; preserving
          // object identity avoids rerendering every settings row again.
          setHostMs((prev) => setTerminalAutoRestoreFitMsForHost(prev, host.id, value))
        })
        .catch(() => {
          if (!cancelled) {
            setHostMs((prev) => setTerminalAutoRestoreFitMsForHost(prev, host.id, null))
          }
        })
    }
    return () => {
      cancelled = true
    }
  }, [hosts, hostClientsById])

  async function selectValue(hostId: string, value: RestoreValue) {
    const client = hostClientsById.get(hostId) ?? null
    if (!client) {
      return
    }
    const opt = AUTO_RESTORE_FIT_OPTIONS.find((o) => o.value === value)
    if (!opt) {
      return
    }
    setHostMs((prev) => setTerminalAutoRestoreFitMsForHost(prev, hostId, opt.ms))
    try {
      const resp = (await client.sendRequest('terminal.setAutoRestoreFit', {
        ms: opt.ms
      })) as { ms?: number | null } | null
      setHostMs((prev) => setTerminalAutoRestoreFitMsForHost(prev, hostId, resp?.ms))
    } catch {
      try {
        const resp = (await client.sendRequest('terminal.getAutoRestoreFit')) as {
          ms?: number | null
        } | null
        setHostMs((prev) => setTerminalAutoRestoreFitMsForHost(prev, hostId, resp?.ms))
      } catch {
        // give up silently — the next mount retries
      }
    }
  }

  const pickerHost = pickerHostId ? hosts.find((h) => h.id === pickerHostId) : null

  const scrollRef = useAnimatedRef<Animated.ScrollView>()
  const scrollOffsetY = useSharedValue(0)
  const scrollContentHeight = useSharedValue(0)
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollOffsetY.value = event.contentOffset.y
  })
  // Why: imperative toggle instead of state — a re-render while a drag gesture
  // is active would rebuild the row gestures and could cancel the drag.
  const setScrollEnabled = useCallback(
    (enabled: boolean) => {
      setTerminalSettingsScrollEnabled(scrollRef, enabled)
    },
    [scrollRef]
  )
  const handleDragActiveChange = useCallback(
    (active: boolean) => setScrollEnabled(!active),
    [setScrollEnabled]
  )

  return (
    <GestureHandlerRootView style={[styles.container, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.topRow}>
        <Pressable
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel={t('back')}
          onPress={() => router.back()}
        >
          <ChevronLeft size={22} color={colors.textSecondary} />
        </Pressable>
        <Text style={styles.heading}>{t('terminal')}</Text>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onContentSizeChange={(_width, height) => {
          scrollContentHeight.value = height
        }}
      >
        <Text style={styles.groupHeading}>{t('terminalLeaveHeading')}</Text>
        <Text style={styles.groupDescription}>{t('terminalLeaveDescription')}</Text>

        {hosts.length === 0 ? (
          <View style={[styles.section, styles.sectionTopGap]}>
            <Text style={styles.emptyText}>{t('terminalNoHosts')}</Text>
          </View>
        ) : (
          <View style={[styles.section, styles.sectionTopGap]}>
            {hosts.map((host, idx) => {
              const client = hostClientsById.get(host.id) ?? null
              return (
                <View key={host.id}>
                  {idx > 0 && <View style={styles.separator} />}
                  <HostFitRow
                    client={client}
                    hostName={host.name}
                    ms={hostMs[host.id]}
                    onPress={() => setPickerHostId(host.id)}
                  />
                </View>
              )
            })}
          </View>
        )}

        <Text style={[styles.groupHeading, styles.inputGroupGap]}>
          {t('terminalTextSizeHeading')}
        </Text>
        <Text style={styles.groupDescription}>{t('terminalTextSizeDescription')}</Text>
        <View style={[styles.section, styles.sectionTopGap]}>
          <Pressable
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => setTextSizePickerOpen(true)}
          >
            <Type size={16} color={colors.textSecondary} />
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('terminalTextSize')}</Text>
              <Text style={styles.rowSublabel}>{textSizeSummary(textScale, t)}</Text>
            </View>
            <ChevronRight size={16} color={colors.textMuted} />
          </Pressable>
        </View>

        <Text style={[styles.groupHeading, styles.inputGroupGap]}>
          {t('terminalKeyboardHeading')}
        </Text>
        <Text style={styles.groupDescription}>{t('terminalKeyboardDescription')}</Text>
        <View style={[styles.section, styles.sectionTopGap]}>
          <View style={styles.row}>
            <View style={styles.rowContent}>
              <Text style={styles.rowLabel}>{t('terminalAutocomplete')}</Text>
              <Text style={styles.rowSublabel}>{autocompleteEnabled ? t('on') : t('off')}</Text>
            </View>
            <Switch
              value={autocompleteEnabled}
              onValueChange={toggleAutocomplete}
              trackColor={{ false: colors.bgRaised, true: colors.textSecondary }}
              thumbColor={colors.textPrimary}
            />
          </View>
        </View>

        <TerminalShortcutSettings
          scrollRef={scrollRef}
          scrollOffsetY={scrollOffsetY}
          scrollContentHeight={scrollContentHeight}
          onDragActiveChange={handleDragActiveChange}
        />
      </Animated.ScrollView>

      <PickerModal<RestoreValue>
        visible={pickerHost != null}
        title={pickerHost ? t('terminalRestorePickerTitle', { host: pickerHost.name }) : ''}
        options={autoRestoreOptions}
        selected={valueFromMs(pickerHost ? hostMs[pickerHost.id] : null)}
        onSelect={(v) => {
          if (pickerHost) {
            void selectValue(pickerHost.id, v)
          }
        }}
        onClose={() => setPickerHostId(null)}
      />

      <PickerModal<TextSizeValue>
        visible={textSizePickerOpen}
        title={t('terminalTextSizePickerTitle')}
        options={textSizeOptions}
        selected={textSizeValueFromScale(textScale)}
        onSelect={selectTextSize}
        onClose={() => setTextSizePickerOpen(false)}
      />
    </GestureHandlerRootView>
  )
}
