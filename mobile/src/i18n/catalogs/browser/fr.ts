import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { browserEn } from './en'

export const browserFr: MobileLocaleMessages<typeof browserEn> = {
  // Toolbar
  back: 'Précédent',
  forward: 'Suivant',
  reload: 'Actualiser',
  urlPlaceholder: 'URL',
  showWebView: 'Afficher la version web du site',
  showMobileView: 'Afficher la version mobile du site',
  // Keyboard dock
  clickModifier: 'Modificateur de clic {key}',
  typeOnPage: 'Saisir sur la page…',
  sendText: 'Envoyer le texte au navigateur',
  sent: 'Envoyé',
  rightClick: 'Clic droit',
  // Page dialogs
  dialogTitle: 'Boîte de dialogue du navigateur',
  dialogFallback: 'Boîte de dialogue du navigateur',
  cancel: 'Annuler',
  ok: 'OK',
  dialogAnswerFailed: 'Cette réponse n’a pas atteint la page.',
  // Errors
  invalidUrl: 'Saisissez une URL valide.',
  streamFailed: 'Échec du flux du navigateur.',
  commandFailed: 'Échec de la commande du navigateur',
  updateAppForStreaming: 'Mettez à jour l’app Dolphin pour diffuser ici les onglets du navigateur.',
  updateDesktopForStreaming:
    'Mettez à jour Dolphin sur l’ordinateur pour diffuser les onglets du navigateur sur mobile.',
  checkingStreamingSupport:
    'Vérification de la prise en charge du flux navigateur sur l’ordinateur.',
  pageNotAvailable: 'La page du navigateur n’est pas encore disponible.',
  streamTimedOut: 'Le flux du navigateur a expiré.'
}
