import { Component, Fragment, type ErrorInfo, type ReactNode } from 'react'
import { AlertTriangle, House, RefreshCw } from 'lucide-react-native'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, radii, spacing, typography } from '../theme/mobile-theme'
import {
  recordMobileRenderError,
  shareMobileCrashDiagnostics
} from '../diagnostics/mobile-crash-diagnostics'
import { componentsCatalog } from '../i18n/catalogs/components'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

type Props = {
  children: ReactNode
  onReturnHome: () => void
}

type State = {
  error: Error | null
  resetKey: number
}

export class MobileRootErrorBoundary extends Component<Props, State> {
  state: State = { error: null, resetKey: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(
      '[mobile-root-error-boundary] render crash contained by boundary',
      error,
      errorInfo
    )
    void recordMobileRenderError(error, errorInfo.componentStack)
  }

  handleRetry = (): void => {
    this.setState(({ resetKey }) => ({ error: null, resetKey: resetKey + 1 }))
  }

  handleReturnHome = (): void => {
    this.props.onReturnHome()
    this.setState(({ resetKey }) => ({ error: null, resetKey: resetKey + 1 }))
  }

  handleReport = (): void => {
    void shareMobileCrashDiagnostics().catch((error: unknown) => {
      console.warn('[mobile-root-error-boundary] diagnostics share failed', error)
    })
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <MobileRootErrorFallback
          onRetry={this.handleRetry}
          onReturnHome={this.handleReturnHome}
          onReport={this.handleReport}
        />
      )
    }

    return <Fragment key={this.state.resetKey}>{this.props.children}</Fragment>
  }
}

function MobileRootErrorFallback({
  onRetry,
  onReturnHome,
  onReport
}: {
  onRetry: () => void
  onReturnHome: () => void
  onReport: () => void
}): ReactNode {
  const t = useMobileTranslation(componentsCatalog)
  return (
    <View style={styles.container} accessibilityRole="alert" testID="mobile-root-error-boundary">
      <View style={styles.iconBadge}>
        <AlertTriangle size={20} color={colors.statusRed} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{t('errorBoundaryTitle')}</Text>
        <Text style={styles.description}>{t('errorBoundaryDescription')}</Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityLabel={t('retry')}
          accessibilityRole="button"
          style={styles.primaryButton}
          onPress={onRetry}
        >
          <RefreshCw size={16} color={colors.bgBase} />
          <Text style={styles.primaryButtonText}>{t('retry')}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t('returnHome')}
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={onReturnHome}
        >
          <House size={16} color={colors.textPrimary} />
          <Text style={styles.secondaryButtonText}>{t('returnHome')}</Text>
        </Pressable>
        <Pressable
          accessibilityLabel={t('reportError')}
          accessibilityRole="button"
          style={styles.secondaryButton}
          onPress={onReport}
        >
          <AlertTriangle size={16} color={colors.textPrimary} />
          <Text style={styles.secondaryButtonText}>{t('reportError')}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bgBase
  },
  iconBadge: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.statusRed,
    backgroundColor: colors.bgPanel
  },
  copy: {
    alignItems: 'center',
    gap: spacing.sm,
    maxWidth: 420
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.titleSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.bodySize,
    lineHeight: 20,
    textAlign: 'center'
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    gap: spacing.sm
  },
  primaryButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.button,
    backgroundColor: colors.surfaceBright
  },
  primaryButtonText: {
    color: colors.bgBase,
    fontSize: typography.bodySize,
    fontWeight: '600'
  },
  secondaryButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.button,
    backgroundColor: colors.bgRaised
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: typography.bodySize,
    fontWeight: '500'
  }
})
