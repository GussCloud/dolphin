import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { MessageSquare } from 'lucide-react-native'
import type { MobileOnboardingStep } from './mobile-onboarding-plan'
import { mobileOnboardingStyles as styles } from './mobile-onboarding-styles'
import { NotificationOnboardingPreview } from './NotificationOnboardingPreview'
import type { MobileSessionView } from '../storage/session-view-preferences'
import { colors } from '../theme/mobile-theme'
import { onboardingCatalog } from '../i18n/catalogs/onboarding'
import { useMobileTranslation } from '../i18n/use-mobile-translation'

export type NotificationOnboardingChoice = 'enable' | 'skip'
export type MobileOnboardingBusyChoice = MobileSessionView | NotificationOnboardingChoice | null

type Props = {
  step: MobileOnboardingStep
  width: number
  active: boolean
  busyChoice: MobileOnboardingBusyChoice
  error: string | null
  onSessionChoice: (view: MobileSessionView) => void
  onNotificationChoice: (choice: NotificationOnboardingChoice) => void
}

export function MobileOnboardingPage({
  step,
  width,
  active,
  busyChoice,
  error,
  onSessionChoice,
  onNotificationChoice
}: Props) {
  const t = useMobileTranslation(onboardingCatalog)
  const busy = busyChoice !== null
  const isSessionView = step === 'session-view'

  return (
    <ScrollView
      style={[styles.page, { width }]}
      contentContainerStyle={styles.pageContent}
      showsVerticalScrollIndicator={false}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
    >
      <View style={[styles.content, !isSessionView && styles.notificationContent]}>
        {isSessionView ? (
          <View style={styles.iconSurface}>
            <MessageSquare size={30} color={colors.textPrimary} />
          </View>
        ) : (
          <NotificationOnboardingPreview active={active} />
        )}
        <Text style={styles.title}>
          {isSessionView ? t('sessionViewTitle') : t('notificationsTitle')}
        </Text>
        <Text style={styles.body}>
          {isSessionView ? t('sessionViewBody') : t('notificationsBody')}
        </Text>
      </View>

      <View style={styles.footer}>
        {!isSessionView ? (
          <Text style={styles.disclosure}>{t('notificationsDisclosure')}</Text>
        ) : null}
        {error ? (
          <Text style={styles.error} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {isSessionView ? (
          <SessionViewChoices busyChoice={busyChoice} disabled={busy} onChoice={onSessionChoice} />
        ) : (
          <NotificationChoices
            busyChoice={busyChoice}
            disabled={busy}
            onChoice={onNotificationChoice}
          />
        )}
      </View>
    </ScrollView>
  )
}

function SessionViewChoices({
  busyChoice,
  disabled,
  onChoice
}: {
  busyChoice: MobileOnboardingBusyChoice
  disabled: boolean
  onChoice: (view: MobileSessionView) => void
}) {
  const t = useMobileTranslation(onboardingCatalog)
  return (
    <>
      <ChoiceButton
        label={t('useChatUi')}
        accessibilityLabel={t('useChatUiA11y')}
        primary
        busy={busyChoice === 'chat'}
        disabled={disabled}
        onPress={() => onChoice('chat')}
      />
      <ChoiceButton
        label={t('keepTerminal')}
        accessibilityLabel={t('keepTerminalA11y')}
        busy={busyChoice === 'terminal'}
        disabled={disabled}
        onPress={() => onChoice('terminal')}
      />
    </>
  )
}

function NotificationChoices({
  busyChoice,
  disabled,
  onChoice
}: {
  busyChoice: MobileOnboardingBusyChoice
  disabled: boolean
  onChoice: (choice: NotificationOnboardingChoice) => void
}) {
  const t = useMobileTranslation(onboardingCatalog)
  return (
    <>
      <ChoiceButton
        label={t('enableNotifications')}
        accessibilityLabel={t('enableNotificationsA11y')}
        primary
        busy={busyChoice === 'enable'}
        disabled={disabled}
        onPress={() => onChoice('enable')}
      />
      <ChoiceButton
        label={t('notNow')}
        accessibilityLabel={t('notNowA11y')}
        busy={busyChoice === 'skip'}
        disabled={disabled}
        onPress={() => onChoice('skip')}
      />
    </>
  )
}

function ChoiceButton({
  label,
  accessibilityLabel,
  primary = false,
  busy,
  disabled,
  onPress
}: {
  label: string
  accessibilityLabel?: string
  primary?: boolean
  busy: boolean
  disabled: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled}
      style={({ pressed }) => [
        primary ? styles.primaryButton : styles.secondaryButton,
        pressed && styles.buttonPressed,
        disabled && styles.buttonDisabled
      ]}
      onPress={onPress}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.bgBase : colors.textSecondary} />
      ) : (
        <Text style={primary ? styles.primaryButtonText : styles.secondaryButtonText}>{label}</Text>
      )}
    </Pressable>
  )
}
