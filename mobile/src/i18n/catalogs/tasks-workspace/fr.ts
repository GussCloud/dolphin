import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { tasksWorkspaceEn } from './en'

export const tasksWorkspaceFr: MobileLocaleMessages<typeof tasksWorkspaceEn> = {
  // Setup hooks source
  setupSourceLegacy: 'hooks locaux',
  setupSourceRepository: 'hooks du dépôt',

  // Workspace create drawer
  selectRepository: 'Sélectionner un dépôt',
  sshConnection: 'Connexion SSH',
  remoteRepository: 'Dépôt distant',
  connecting: 'Connexion...',
  workspaceName: 'Nom de l’espace de travail',
  optionalHint: '[Facultatif]',
  agent: 'Agent',
  connectRepositoryFirst: 'Connectez d’abord le dépôt',
  detectingAgents: 'Détection des agents...',
  advanced: 'Avancé',
  startFrom: 'Partir de',
  defaultBranch: 'Branche par défaut',
  createFromRef: 'Créer depuis {ref}',
  linearWorkspaceNeedsRepository:
    'Ajoutez un dépôt Git avant de créer un espace de travail Linear.',
  repositoryNotFound: 'Dépôt introuvable.',
  connectRepository: 'Connecter le dépôt',

  // Workspace option pickers
  startFromTitle: 'Partir de',
  startFromSubtitle: 'Choisissez une branche ou une ref existante.',
  searchBranches: 'Rechercher des branches',
  defaultBranchSubtitle: 'Utiliser la base configurée pour ce dépôt',
  noBranchesMatch: 'Aucune branche correspondante.',
  branchNameLabel: 'Nom de la branche : {branch}',
  sparseCheckoutTitle: 'Sparse checkout',
  fullCheckout: 'Checkout complet',
  fullCheckoutSubtitle: 'Utiliser tout le dépôt',
  editPresetLabel: 'Modifier {name}',
  newPreset: 'Nouveau préréglage',

  // Sparse presets and setup trust
  newSparsePreset: 'Nouveau préréglage sparse',
  editSparsePreset: 'Modifier le préréglage sparse',
  presetName: 'Nom',
  presetDirectories: 'Répertoires',
  directoryCount: { one: '{count} répertoire', other: '{count} répertoires' },
  runSetupScriptTitle: 'Exécuter le script de setup ?',
  setupChoiceRequired: '{repo} nécessite un choix de setup avant de créer cet espace de travail.',
  runSetupAndCreate: 'Exécuter le setup et créer',
  skipSetupAndCreate: 'Ignorer le setup et créer',
  setupScriptChanged: 'Le script de setup de {repo} a changé',
  runSetupFrom: 'Exécuter le setup de {repo} ?',
  setupTrustWarning:
    'Le dolphin.yaml de ce dépôt s’exécute sur votre machine avant le démarrage de l’espace de travail. Ne l’exécutez que si vous faites confiance à ce dépôt.',
  newSetupScript: 'Nouveau script de setup',
  setupScript: 'Script de setup',
  trustSetupScriptError: 'Impossible d’approuver le script de setup.',
  runHooks: 'Exécuter les hooks',
  alwaysTrustAndRun: 'Toujours approuver et exécuter',
  dontRun: 'Ne pas exécuter',

  // Workspace create operations
  sshConnected: 'Connecté',
  sshConnecting: 'Connexion',
  sshDeployingRelay: 'Déploiement du relais',
  sshReconnecting: 'Reconnexion',
  sshAuthFailed: 'Échec de l’authentification',
  sshReconnectFailed: 'Échec de la reconnexion',
  sshConnectionFailed: 'Échec de la connexion',
  sshDisconnected: 'Déconnecté',
  agentLaunchUnsupportedWarning:
    'L’espace de travail a été créé, mais cet ordinateur ne peut pas démarrer l’agent depuis le téléphone.',
  agentLaunchFailedWarning:
    'L’espace de travail a été créé, mais l’agent n’a pas démarré : {reason}',
  searchFailed: 'Échec de la recherche',
  sparseDirectoriesInvalid:
    'Utilisez des répertoires relatifs au dépôt, pas la racine, des chemins absolus ni des segments parents.',
  sparseDirectoriesEmpty: 'Ajoutez au moins un répertoire.',
  unknownError: 'Erreur inconnue',
  createWorkspaceError: 'Impossible de créer l’espace de travail',

  // Smart workspace source modes
  smartModeSmart: 'Intelligent',
  smartModeBranch: 'Branche',
  smartModeName: 'Nom',

  // Action errors
  resolveBaseBranchError: 'Impossible de résoudre la branche de base.',
  agentDisabled: 'L’agent sélectionné est désactivé. Choisissez un agent activé avant de créer.',
  nameRequired: 'Le nom est obligatoire.',
  openShellSubtitle: 'Ouvrir un shell',
  sparsePresetsLoadError: 'Échec du chargement des préréglages sparse.',
  branchSearchError: 'Échec de la recherche de branches.',
  sparsePresetSaveError: 'Impossible d’enregistrer le préréglage sparse.',
  sshStateReadError: 'Impossible de lire l’état de la connexion SSH.',
  sshConnectError: 'Impossible de se connecter au dépôt SSH.',
  connectRepoBeforeWorkspace: 'Connectez {repo} avant de créer un espace de travail.',
  nameTooLong: 'Le nom doit comporter 80 caractères au maximum.',
  nameAlreadyExists: '« {name} » existe déjà.',
  blankTerminal: 'Terminal vierge'
}
