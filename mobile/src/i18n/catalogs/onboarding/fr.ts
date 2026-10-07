import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { onboardingEn } from './en'

export const onboardingFr: MobileLocaleMessages<typeof onboardingEn> = {
  // Session view step
  sessionViewTitle: 'Comment ouvrir les sessions ?',
  sessionViewBody:
    'Choisissez si les sessions d’agents compatibles s’ouvrent dans le terminal ou dans Chat UI sur cet appareil. Appuyez longuement sur un onglet de session pour changer sa vue, ou modifiez la valeur par défaut plus tard dans les Réglages.',
  useChatUi: 'Utiliser Chat UI',
  useChatUiA11y: 'Ouvrir les sessions dans Chat UI',
  keepTerminal: 'Garder le terminal',
  keepTerminalA11y: 'Ouvrir les sessions dans le terminal',
  // Notifications step
  notificationsTitle: 'Ne manquez pas quand un agent a besoin de vous',
  notificationsBody:
    'Recevez une notification sur ce téléphone quand un agent termine ou attend, même si vous n’utilisez pas l’app.',
  notificationsDisclosure:
    'Envoyées via le service push de Dolphin après 3 minutes d’inactivité de votre ordinateur. Modifiable à tout moment dans les Réglages.',
  enableNotifications: 'Activer les notifications',
  enableNotificationsA11y: 'Activer les notifications des agents',
  notNow: 'Pas maintenant',
  notNowA11y: 'Ignorer les notifications pour le moment',
  // Sample notification banners
  sampleNow: 'maintenant',
  sampleCodexTitle: 'Codex a terminé',
  sampleCodexBody: 'Les tests passent.',
  sampleClaudeTitle: 'Claude a besoin de vous',
  sampleClaudeBody: 'Vous attend.'
}
