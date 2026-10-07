import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { sessionReviewEn } from './en'

export const sessionReviewFr: MobileLocaleMessages<typeof sessionReviewEn> = {
  committedChangesUnavailable: 'Modifications commitées indisponibles',
  committedChangesFailed: 'Échec du chargement des modifications commitées',
  updateDesktopToReview:
    'Mettez à jour Dolphin sur le bureau pour relire les modifications sur mobile.',
  loadChangesFailed: 'Impossible de charger les modifications',
  sourceControlResponseInvalid: 'La réponse du contrôle de code source est invalide',
  loadReviewNotesFailed: 'Impossible de charger les notes de revue',
  loadDiffFailed: 'Impossible de charger le diff',
  committedDiffUnavailable: 'Le diff commité est indisponible',

  scopeBranch: 'Branche',
  scopeStaged: 'Indexé',
  scopeUnstaged: 'Non indexé',
  committedOnBranch: 'Commité sur la branche',

  waitingForDesktop: 'En attente du bureau...',
  sourceControlActionFailed: 'Échec de l’action de contrôle de code source',
  stagedWithFailures: '{staged} indexés, {failed} en échec',
  reviewedFilesStaged: {
    one: '{count} fichier relu indexé',
    other: '{count} fichiers relus indexés'
  },
  saveReviewStateFailed: 'Impossible d’enregistrer l’état de la revue',
  saveReviewFailed: 'Impossible d’enregistrer la revue',
  missingWorktree: 'Worktree manquant',
  loadReviewFailed: 'Impossible de charger la revue',
  openInSessionFailed: 'Impossible d’ouvrir dans la session',
  copyReviewNotesFailed: 'Impossible de copier les notes de revue',
  reviewNotesCopied: 'Notes de revue copiées',
  sendNotesFailed: 'Impossible d’envoyer les notes',
  terminalInputLocked: 'La saisie du terminal est verrouillée',
  reviewNotesSent: 'Notes de revue envoyées',
  createTerminalFailed: 'Impossible de créer le terminal',
  loadAgentSessionsFailed: 'Impossible de charger les sessions d’agent',

  requestFailed: 'Échec de la requête : {method}',
  refreshPullRequestFailed: 'Impossible d’actualiser la pull request.',
  mergePullRequestFailed: 'Impossible de fusionner la pull request.',
  notConnected: 'Non connecté',
  notConnectedToDesktop: 'Non connecté au bureau.',
  waitingForDesktopEllipsis: 'En attente du bureau…',
  launchAgentFailed: 'Impossible de lancer l’agent',
  commentActionFailed: 'Échec de l’action sur le commentaire',
  updateTitleFailed: 'Impossible de mettre à jour le titre.',
  updateReviewThreadFailed: 'Impossible de mettre à jour le fil de revue.',
  loadPullRequestFailed: 'Impossible de charger la pull request',
  sendPromptFailed: 'Impossible d’envoyer le prompt',

  sendResumeCommandFailed: 'Impossible d’envoyer la commande de reprise',
  prepareLegacyCodexFailed:
    'Impossible de préparer cette ancienne session Codex. Relancez la reprise.'
}
