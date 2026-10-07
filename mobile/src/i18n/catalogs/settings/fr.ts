import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { settingsEn } from './en'

export const settingsFr: MobileLocaleMessages<typeof settingsEn> = {
  back: 'Retour',
  on: 'Activé',
  off: 'Désactivé',
  retry: 'Réessayer',
  openSettings: 'Ouvrir les réglages',

  settings: 'Paramètres',
  terminal: 'Terminal',
  chatUi: 'Chat UI',
  browser: 'Navigateur',
  voice: 'Voix',
  notifications: 'Notifications',
  backgroundConnection: 'Connexion en arrière-plan',
  language: 'Langue',
  troubleshooting: 'Dépannage',
  about: 'À propos',
  privacyPolicy: 'Politique de confidentialité',
  support: 'Assistance',

  languageHeading: 'LANGUE DE L’APP',
  languageDescription: 'Choisissez la langue utilisée par l’app Dolphin sur cet appareil.',
  languageSystemDefault: 'Langue du système',
  languageSaveError: 'Impossible d’enregistrer la langue. Réessayez.',

  aboutTagline: 'IDE d’agents open source pour les bâtisseurs 100x',
  aboutWebsite: 'Site web de Dolphin',
  aboutSourceCode: 'Code source de Dolphin',
  aboutOnX: 'Dolphin sur X',
  aboutOpenLinkError: 'Impossible d’ouvrir le lien. Réessayez.',

  backgroundRelayHeading: 'RELAY',
  backgroundRelayDescription:
    'Garde la connexion Relay ouverte après avoir quitté l’app pour qu’elle se rouvre instantanément. Quand c’est activé, Android affiche une notification permanente et la consommation de batterie augmente.',
  backgroundStayConnected: 'Rester connecté en arrière-plan',
  backgroundRetentionOffSubtitle: 'Se déconnecte peu après que vous quittez l’app.',
  backgroundRetention15m: '15 minutes',
  backgroundRetention15mSubtitle: 'Reste connecté 15 minutes en arrière-plan.',
  backgroundRetention1h: '1 heure',
  backgroundRetention1hSubtitle: 'Reste connecté 1 heure en arrière-plan.',
  backgroundRetentionAlways: 'Toujours',
  backgroundRetentionAlwaysSubtitle: 'Reste connecté jusqu’à ce que vous le désactiviez.',
  backgroundSaveError: 'Impossible d’enregistrer la connexion en arrière-plan. Réessayez.',
  backgroundSystemHeading: 'SYSTÈME',
  backgroundSystemDescription:
    'Les économiseurs de batterie peuvent quand même fermer la connexion. Autorisez Dolphin à s’exécuter sans restriction.',
  backgroundSystemDescriptionWithAutostart:
    'Les économiseurs de batterie peuvent quand même fermer la connexion. Autorisez Dolphin à s’exécuter sans restriction et activez le démarrage automatique.',
  backgroundBatteryOptimization: 'Optimisation de la batterie',
  backgroundUnrestricted: 'Sans restriction',
  backgroundRestricted: 'Restreint — touchez pour autoriser',
  backgroundAutostart: 'Démarrage automatique',
  backgroundAutostartHint: 'Requis sur Xiaomi, Redmi et POCO',

  browserLinksHeading: 'LIENS',
  browserLinksDescription:
    'Choisissez où s’ouvrent les liens HTTP(S) touchés dans la sortie du terminal.',
  browserOpenTerminalLinks: 'Ouvrir les liens du terminal',
  browserModeDolphin: 'Navigateur Dolphin sur l’ordinateur',
  browserModeDolphinSubtitle: 'Ouvre dans le navigateur diffusé depuis votre ordinateur associé.',
  browserModePhone: 'Navigateur du téléphone',
  browserModePhoneSubtitle: 'Ouvre dans Safari, Chrome ou un autre navigateur de ce téléphone.',
  browserLoadError: 'Impossible de charger les préférences du navigateur. Réessayez.',
  browserSaveError: 'Impossible d’enregistrer les préférences du navigateur. Réessayez.',

  chatDefaultViewHeading: 'VUE PAR DÉFAUT',
  chatDefaultViewDescription:
    'Choisissez comment les sessions d’agents compatibles (Claude, Codex et autres agents avec chat) s’ouvrent sur cet appareil. Terminal affiche la CLI brute ; Chat UI affiche une interface de chat comme l’app de bureau. Vous pouvez toujours changer chaque session depuis son menu d’appui long.',
  chatOpenSessionsInChatUi: 'Ouvrir les sessions dans Chat UI',

  notificationsEnable: 'Activer les notifications',
  notificationsDefaultDescription:
    'Soyez averti sur cet appareil quand un agent a besoin de vous ou termine une tâche.',
  notificationsPushDescription:
    'Recevez les alertes des agents même lorsque l’app est fermée. Distribuées via le service push de Dolphin et Apple ou Google.',
  notificationsBlocked: 'Les notifications sont désactivées dans les réglages du système.',
  notificationsLoadError: 'Impossible de charger les réglages de notification. Réessayez.',
  notificationsSaveError: 'Impossible d’enregistrer les réglages de notification. Réessayez.',
  notificationsOpenSettingsError: 'Impossible d’ouvrir les réglages du système. Réessayez.',
  deliveryLoadError:
    'Impossible de charger les réglages de distribution. Rouvrez cet écran pour réessayer.',
  deliverySaveError: 'Impossible d’enregistrer les réglages de distribution. Réessayez.',
  deliveryNeedsUpdatedDesktop:
    'Associez un ordinateur à jour pour recevoir des notifications sur ce téléphone.',

  pushTestHeading: 'Vous ne recevez pas les alertes ?',
  pushTestDetail: 'Envoyez un test via le service push de Dolphin.',
  pushTestSend: 'Envoyer une notification de test',
  pushTestSending: 'Envoi…',
  pushTestLoadHostsError: 'Impossible de charger les ordinateurs associés.',
  pushTestPairDesktop: 'Associez un ordinateur et réessayez.',
  pushTestConnectDesktop: 'Connectez un ordinateur et réessayez.',
  pushTestUpdateDesktop: 'Mettez à jour votre ordinateur pour lancer ce test.',
  pushTestReachError: 'Impossible de joindre l’ordinateur. Réessayez.',
  pushTestAccepted:
    'Acceptée par le service push de Dolphin. Vérifiez si la notification est arrivée.',
  pushTestNotRegistered: 'Reconnectez-vous pour enregistrer ce téléphone pour les notifications.',
  pushTestRateLimited: 'Trop de notifications. Réessayez plus tard.',
  pushTestSendError: 'Impossible d’envoyer via le service push de Dolphin. Réessayez.',
  pushTestGenericError: 'Impossible d’envoyer le test push.',

  credentialCleanupTitle: 'Nettoyage des identifiants d’association',
  credentialCleanupRetryFailed:
    'Le nettoyage n’a toujours pas pu être confirmé. Réessayez plus tard.',
  credentialCleanupPending: {
    one: 'Impossible de confirmer le nettoyage de {count} identifiant sur cet appareil.',
    other: 'Impossible de confirmer le nettoyage de {count} identifiants sur cet appareil.'
  },
  credentialCleanupUnreadable:
    'Impossible de vérifier l’état du nettoyage sur cet appareil. Réessayez par précaution.',
  credentialCleanupRetryLabel: 'Relancer le nettoyage des identifiants d’association',

  voiceConnectDesktop: 'Connectez-vous à un ordinateur pour gérer les réglages vocaux.',
  voiceLoadError: 'Échec du chargement des réglages vocaux.',
  voiceUpdateError: 'Impossible de mettre à jour.',
  voiceSelectModelError: 'Impossible de sélectionner le modèle.',
  voiceDownloadError: 'Échec du téléchargement.',
  voiceDeleteError: 'Échec de la suppression.',
  voiceDictationHeading: 'DICTÉE',
  voiceEnableDictation: 'Activer la dictée vocale',
  voiceEnableDictationDescription:
    'Dictez du texte dans n’importe quel volet actif de votre ordinateur.',
  voiceDictationMode: 'Mode de dictée',
  voiceDictationModeDescription:
    'Bascule : appuyez une fois pour commencer, encore pour arrêter. Maintien : dictez tant que vous maintenez.',
  voiceModeToggle: 'Bascule',
  voiceModeHold: 'Maintien',
  voiceSpeechModelHeading: 'MODÈLE VOCAL',
  voiceSpeechModel: 'Modèle vocal',
  voiceNoModelSelected: 'Aucun sélectionné',

  terminalLeaveHeading: 'QUAND VOUS QUITTEZ L’APP',
  terminalLeaveDescription:
    'Quand vous utilisez un terminal sur votre téléphone, Dolphin le réduit pour l’adapter à votre écran. Quand vous fermez l’app ou passez à une autre, ce réglage détermine s’il reste à la taille du téléphone (pour que les outils CLI interactifs ne se réorganisent pas) ou reprend la taille de votre ordinateur. Vous pouvez toujours utiliser Restaurer ce terminal ou Restaurer tous les terminaux dans la bannière pour le redimensionner manuellement.',
  terminalNoHosts:
    'Aucun ordinateur associé pour l’instant. Associez-en un pour contrôler le comportement du terminal.',
  terminalRestoreKeepPhoneSize: 'Garder la taille du téléphone (par défaut)',
  terminalRestoreAfter1Minute: 'Après 1 minute',
  terminalRestoreAfter5Minutes: 'Après 5 minutes',
  terminalRestoreAfter30Minutes: 'Après 30 minutes',
  terminalRestoreAfterSeconds: 'Après {seconds} s',
  terminalRestorePickerTitle: 'Restaurer {host}',
  terminalTextSizeHeading: 'TAILLE DU TEXTE',
  terminalTextSizeDescription:
    'Ajuste la taille du texte du terminal. Les petites tailles affichent plus de colonnes avec des marges latérales ; les grandes en affichent moins — faites glisser latéralement pour vous déplacer. Vous pouvez aussi pincer pour zoomer dans le terminal lui-même, ce qui met à jour ce réglage. Affichage sur cet appareil uniquement ; le terminal de l’ordinateur n’est pas modifié.',
  terminalTextSize: 'Taille du texte',
  terminalTextSizePickerTitle: 'Taille du texte du terminal',
  terminalTextSizeSmallest: 'Très petite (50 %)',
  terminalTextSizeSmaller: 'Petite (75 %)',
  terminalTextSizeDefault: 'Par défaut (100 %)',
  terminalTextSizeLarge: 'Grande (125 %)',
  terminalTextSizeLarger: 'Plus grande (150 %)',
  terminalTextSizeLargest: 'Très grande (200 %)',
  terminalKeyboardHeading: 'SAISIE CLAVIER',
  terminalKeyboardDescription:
    'Active la saisie prédictive, la correction automatique et les suggestions orthographiques du téléphone dans la barre de commande du terminal. Désactivé par défaut pour que le clavier ne réécrive jamais les commandes, options ou chemins. La saisie clavier directe (quand les touches vont directement au terminal) envoie toujours les frappes brutes, donc les suggestions ne s’y appliquent pas.',
  terminalAutocomplete: 'Saisie prédictive et correction automatique'
}
