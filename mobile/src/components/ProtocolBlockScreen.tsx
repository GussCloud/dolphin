import { openExternalLink } from '../platform/external-link'
import { useRouteHandoff } from '../navigation/route-handoff'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import type { CompatVerdict } from '../transport/protocol-compat'
import type { MobileWebBundleCompatVerdict } from '../transport/mobile-web-bundle-compat'
import { componentsCatalog } from '../i18n/catalogs/components'
import type { componentsEn } from '../i18n/catalogs/components/en'
import type { MobileTranslate } from '../i18n/mobile-i18n-catalog'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

const RELEASES_URL = 'https://github.com/GussCloud/dolphin/releases'
const IOS_APP_STORE_URL = 'itms-apps://apps.apple.com/app/dolphin-ide/id6766130217'

/** Every wall this screen renders: the protocol one and the bundle one. Both are terminal — there
 *  is no native workspace to fall back to, so the only way out is updating one of the two apps. */
export type BlockedVerdict =
  | Extract<CompatVerdict, { kind: 'blocked' }>
  | Extract<MobileWebBundleCompatVerdict, { kind: 'blocked' }>

type Props = {
  verdict: BlockedVerdict
}

type ComponentsTranslate = MobileTranslate<typeof componentsEn>
type MobileStore = 'app-store' | 'github-releases'

/** What clears the wall. `refresh-bundle` is the one that no store can: the cached workspace is
 *  older than this host's client floor, so a download fixes it and an app update does not. */
type BlockRemedy = 'update-mobile' | 'update-desktop' | 'refresh-bundle'

function blockRemedy(verdict: BlockedVerdict): BlockRemedy {
  switch (verdict.reason) {
    case 'mobile-too-old':
    case 'bundle-shell-too-old':
      return 'update-mobile'
    case 'desktop-too-old':
    case 'bundle-unavailable':
      return 'update-desktop'
    case 'bundle-incompatible':
      return verdict.side === 'desktop' ? 'update-desktop' : 'refresh-bundle'
  }
}

function blockTitle(remedy: BlockRemedy, t: ComponentsTranslate): string {
  switch (remedy) {
    case 'update-mobile':
      return t('blockUpdateMobileTitle')
    case 'update-desktop':
      return t('blockUpdateDesktopTitle')
    case 'refresh-bundle':
      return t('blockRefreshBundleTitle')
  }
}

function blockBody(
  verdict: BlockedVerdict,
  remedy: BlockRemedy,
  store: MobileStore,
  t: ComponentsTranslate
): string {
  if (remedy === 'refresh-bundle') {
    return t('blockRefreshBundleBody')
  }
  if (verdict.reason === 'mobile-too-old') {
    return store === 'app-store'
      ? t('blockMobileTooOldAppStoreBody')
      : t('blockMobileTooOldGitHubBody')
  }
  if (verdict.reason === 'bundle-unavailable') {
    return t('blockBundleUnavailableBody')
  }
  if (remedy === 'update-mobile') {
    return store === 'app-store'
      ? t('blockBundleMobileAppStoreBody')
      : t('blockBundleMobileGitHubBody')
  }
  return t('blockDesktopTooOldBody')
}

export function ProtocolBlockScreen({ verdict }: Props) {
  const t = useMobileTranslation(componentsCatalog)
  const router = useRouteHandoff()
  const remedy = blockRemedy(verdict)
  // Why: Android APKs ship through GitHub Releases until a Play Store listing exists.
  const mobileUpdateTarget =
    Platform.OS === 'ios'
      ? { label: t('openAppStore'), url: IOS_APP_STORE_URL, store: 'app-store' as const }
      : { label: t('openGitHubReleases'), url: RELEASES_URL, store: 'github-releases' as const }
  // No download to offer when the fix is a refetch: reconnecting is what this screen leaves you to do.
  const primaryAction =
    remedy === 'refresh-bundle'
      ? null
      : remedy === 'update-mobile'
        ? { label: mobileUpdateTarget.label, url: mobileUpdateTarget.url }
        : { label: t('openGitHubReleases'), url: RELEASES_URL }

  const title = blockTitle(remedy, t)
  const body = blockBody(verdict, remedy, mobileUpdateTarget.store, t)
  const recoveryNote =
    remedy === 'refresh-bundle' ? t('blockRecoveryNoteRefresh') : t('blockRecoveryNoteUpdate')

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {primaryAction ? (
          <Pressable
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            onPress={() => {
              // The seam: this screen is in the tasks page closure, where react-native's `openURL`
              // calls a `window.open` both shells refuse and resolves anyway.
              openExternalLink(primaryAction.url)
            }}
          >
            <Text style={styles.primaryButtonText}>{primaryAction.label}</Text>
          </Pressable>
        ) : null}
        <Pressable
          style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
          onPress={() => {
            // The handoff, not expo-router's singleton: `/` is the phone's home screen and the
            // page does not carry it, so inside the shell a singleton replace renders the root
            // route in the WebView rather than leaving it. This posts the target to the shell.
            router.replace('/')
          }}
        >
          <Text style={styles.secondaryButtonText}>{t('backToHosts')}</Text>
        </Pressable>
        <Text style={styles.recoveryNote}>{recoveryNote}</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgBase,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg
  },
  card: {
    backgroundColor: colors.bgPanel,
    borderRadius: radii.card,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderSubtle
  },
  title: {
    fontSize: typography.titleSize,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.sm
  },
  body: {
    fontSize: typography.bodySize,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: spacing.lg
  },
  primaryButton: {
    backgroundColor: colors.textPrimary,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.button,
    alignItems: 'center',
    marginBottom: spacing.sm
  },
  primaryButtonText: {
    fontSize: typography.bodySize,
    fontWeight: '600',
    color: colors.bgBase
  },
  secondaryButton: {
    backgroundColor: colors.bgRaised,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.button,
    alignItems: 'center'
  },
  secondaryButtonText: {
    fontSize: typography.bodySize,
    fontWeight: '600',
    color: colors.textPrimary
  },
  recoveryNote: {
    fontSize: typography.metaSize,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: spacing.md
  },
  pressed: {
    opacity: 0.7
  }
})
