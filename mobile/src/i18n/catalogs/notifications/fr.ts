import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { notificationsEn } from './en'

export const notificationsFr: MobileLocaleMessages<typeof notificationsEn> = {
  // Android notification channels (shown in system settings)
  silentChannelName: 'Notifications silencieuses de Dolphin',
  desktopChannelName: 'Notifications de l’ordinateur',
  // Delivery preferences
  onlyWhenAway: 'Uniquement en votre absence',
  onlyWhenAwayHint:
    'Après 3 minutes sans activité du clavier ou de la souris, ou lorsque la session est verrouillée.',
  sound: 'Son des notifications',
  suppressWhileFocused: 'Ne pas alerter pendant la consultation',
  suppressWhileFocusedHint: 'Ignore les alertes de l’espace de travail ouvert sur ce téléphone.',
  footer:
    'Les types d’alertes suivent les réglages de notifications de chaque ordinateur associé. Les notifications sont suspendues après 7 jours sans utiliser cette app ; ouvrez-la et reconnectez-vous pour les reprendre.'
}
