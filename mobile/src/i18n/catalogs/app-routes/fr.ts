import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { appRoutesEn } from './en'

export const appRoutesFr: MobileLocaleMessages<typeof appRoutesEn> = {
  back: 'Retour',
  cancel: 'Annuler',
  continue: 'Continuer',
  openSettings: 'Ouvrir les réglages',
  tryAgain: 'Réessayer',
  backToHome: 'Retour à l’accueil',
  missingPairingCode: 'Code d’association manquant',
  pairConfirmTitle: 'Associer cet ordinateur ?',
  pairConfirmSubtitle:
    'Vous avez ouvert un lien d’association depuis votre ordinateur. Confirmez pour l’ajouter à vos hôtes.',
  pair: 'Associer',
  connecting: 'Connexion…',
  pairingLog: 'Journal d’association',
  pairingTimedOut:
    'Connexion impossible en {seconds} s — consultez le journal ci-dessous pour voir où elle a bloqué',
  pairingFailed: 'Échec de l’association : {reason}',
  invalidQrCode: 'Ce n’est pas un QR code Dolphin valide',
  invalidPairingCode:
    'Code d’association non valide — copiez-le depuis votre ordinateur et collez-le à nouveau',
  pairWithDesktop: 'Associer un ordinateur',
  cameraAccessDisabled: 'Accès à la caméra désactivé',
  scanPrompt:
    'Scannez le QR code affiché par Dolphin sur votre ordinateur, ou collez plutôt le code d’association.',
  cameraDisabledPrompt:
    'Autorisez l’accès à la caméra dans les Réglages, ou collez plutôt le code d’association.',
  pasteCodeInstead: 'Coller le code',
  orPasteCode: 'Ou collez le code d’association',
  pasteCodeTitle: 'Coller le code d’association',
  pasteCodeMessage: 'Copiez le code affiché sous le QR code sur votre ordinateur.',
  pasteCodePlaceholder: 'dolphin://pair?code=... ou collez le code',
  scanStepOpenDolphin: 'Ouvrez Dolphin sur votre ordinateur',
  scanStepOpenMobileSettings: 'Allez dans Paramètres → Mobile',
  scanStepScan: 'Scannez le QR code',
  onboardingSaveChoiceError: 'Impossible d’enregistrer votre choix. Réessayez.',
  onboardingNotificationsError:
    'Impossible de mettre à jour les réglages de notification. Réessayez.',
  onboardingProgress: 'Progression de la prise en main',
  onboardingStep: 'Étape {current} sur {total}'
}
