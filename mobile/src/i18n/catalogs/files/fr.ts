import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { filesEn } from './en'

export const filesFr: MobileLocaleMessages<typeof filesEn> = {
  // Explorer
  title: 'Fichiers',
  showingFirstSuffix: ' - Affichage des {count} premiers',
  closeFiles: 'Fermer les fichiers',
  backToSession: 'Retour à la session',
  retry: 'Réessayer',
  noFilesFound: 'Aucun fichier trouvé',
  unableToLoadFiles: 'Impossible de charger les fichiers',
  connectingToDesktop: 'Connexion à l’ordinateur...',
  waitingForDesktop: 'En attente de l’ordinateur...',
  loading: 'Chargement...',
  unableToLoadFolder: 'Impossible de charger le dossier',
  retryLoadingA11y: 'Réessayer de charger {path}',
  openFolderA11y: 'Ouvrir le dossier {name}',
  previewFileA11y: 'Aperçu du fichier {name}',
  unavailableOnMobileA11y: '{name} indisponible sur mobile',
  unavailableOnMobile: 'Indisponible sur mobile',

  // Preview
  preview: 'Aperçu',
  file: 'Fichier',
  backToFiles: 'Retour aux fichiers',
  saveArtifactA11y: 'Enregistrer l’artefact du terminal',
  discardChangesTitle: 'Abandonner les modifications ?',
  unsavedEditsLost: 'Les modifications non enregistrées seront perdues.',
  discard: 'Abandonner',
  stay: 'Rester',
  loadingPreview: 'Chargement de l’aperçu...',
  emptyFile: 'Fichier vide',
  imageA11y: 'Image {title}',
  editorA11y: 'Éditeur de {title}',
  filePreviewA11y: 'Aperçu du fichier',
  viewMarkdownSourceA11y: 'Afficher la source Markdown',
  viewRenderedMarkdownA11y: 'Afficher l’aperçu Markdown',
  previewTruncated: 'Aperçu tronqué. Taille du fichier : {size}.',
  unknownSize: 'taille inconnue',

  // Preview errors
  unableToLoadPreview: 'Impossible de charger l’aperçu',
  unableToSaveFile: 'Impossible d’enregistrer le fichier',
  binaryPreviewUnavailable: 'Aperçu binaire indisponible',
  fileTooLarge: 'Fichier trop volumineux pour l’aperçu mobile',
  reloadBeforeSaving: 'Rechargez l’aperçu avant d’enregistrer',
  unableToReachFilesystem: 'Impossible d’accéder au système de fichiers de l’ordinateur',
  fileNotFound: 'Fichier introuvable',
  fileChangedOnDesktop:
    'Le fichier a changé sur l’ordinateur. Rechargez l’aperçu avant d’enregistrer',
  sshOwnerChanged: 'Impossible de vérifier la connexion SSH. Reconnectez l’hôte et réessayez.'
}
