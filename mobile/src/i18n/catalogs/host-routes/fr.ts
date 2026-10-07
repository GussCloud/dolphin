import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesEn } from './en'

export const hostRoutesFr: MobileLocaleMessages<typeof hostRoutesEn> = {
  // Route titles
  routeHost: 'Hôte',
  routeAccounts: 'Comptes',
  routeTasks: 'Tâches',
  routeTerminal: 'Terminal',
  routeSourceControl: 'Contrôle de code source',
  routeAgentHistory: 'Historique des sessions de l’agent',
  routeChanges: 'Modifications',
  routePullRequest: 'Pull request',
  routeWorkspace: 'Espace de travail',

  // Edit host
  editHost: 'Modifier l’hôte',
  back: 'Retour',
  save: 'Enregistrer',
  saveHostA11y: 'Enregistrer l’hôte',
  goBack: 'Revenir',
  missingHost: 'Hôte manquant.',
  hostRemoved: 'Cet hôte a été supprimé de ce téléphone.',
  failedToLoadHost: 'Impossible de charger l’hôte.',
  failedToSaveHost: 'Impossible d’enregistrer l’hôte.',
  editHelp:
    'Modifiez le nom affiché ou l’adresse de connexion. Laissez le nom vide pour utiliser celui indiqué par l’ordinateur. Modifier l’adresse change seulement l’endroit où ce téléphone se connecte — cela ne refait pas l’appairage. Utilisez-le lorsque le même ordinateur est joignable via une autre IP (par exemple réseau local ou Tailscale).',
  name: 'Nom',
  hostNamePlaceholder: 'Nom de l’hôte',
  address: 'Adresse',
  addressHint:
    'Accepte une IP, hôte:port ou ws:// / wss://. Sans port, le port actuel est utilisé (ou 6768).',
  connectsTo: 'Se connecte à {endpoint}',

  // Accounts
  accounts: 'Comptes',
  invalidSnapshot: 'Données de comptes non valides reçues de l’hôte',
  hostNotFound: 'Hôte introuvable',
  couldNotSwitchAccount: 'Impossible de changer de compte',
  systemDefault: 'Valeur par défaut du système',
  useAgentLogin: 'Utiliser la connexion propre à l’agent',
  connectingToHost: 'Connexion à {host}…',
  connectingToHostGeneric: 'Connexion à l’hôte…',
  loadingAccounts: 'Chargement des comptes…',
  addAccountsHint:
    'Ajoutez ou réauthentifiez des comptes depuis Paramètres → Comptes sur l’ordinateur.'
}
