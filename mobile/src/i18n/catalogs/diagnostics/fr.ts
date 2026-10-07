import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { diagnosticsEn } from './en'

export const diagnosticsFr: MobileLocaleMessages<typeof diagnosticsEn> = {
  // Shared chrome
  back: 'Retour',
  troubleshooting: 'Dépannage',
  networkDiagnostics: 'Diagnostic réseau',
  // Troubleshoot screen
  running: 'Exécution…',
  runAgain: 'Relancer',
  runDiagnostics: 'Lancer le diagnostic',
  viewNetworkDiagnostics: 'Voir le diagnostic réseau',
  commonIssues: 'Problèmes courants',
  // Diagnostic checks
  checkPairedHosts: 'Hôtes associés',
  checkPairedCount: { one: '{count} associé', other: '{count} associés' },
  checkPairedNone: 'Aucun — scannez un QR code pour associer',
  checkPairedReadError: 'Impossible de lire les données des hôtes',
  checkInternet: 'Internet',
  checkInternetConnected: 'Connecté',
  checkInternetUnexpected: 'Réponse inattendue',
  checkInternetNone: 'Pas de connexion',
  checkReachableAt: 'Joignable à {endpoint}',
  checkHosts: 'Hôtes',
  checkHostsError: 'Test impossible',
  checkPlatform: 'Plateforme',
  cannotReach: 'Impossible de joindre {endpoint}',
  cannotReachTailscale: 'Impossible de joindre {endpoint} — vérifiez Tailscale',
  // Common issues: push notifications
  notifTitle: 'Notifications push',
  notifStep1:
    'Vérifiez que les réglages système autorisent les notifications de Dolphin et que Concentration ou Ne pas déranger est désactivé.',
  notifStep2:
    'Essayez le réseau cellulaire ou un autre réseau Wi-Fi. Si les alertes arrivent après le changement, votre réseau retarde peut-être leur remise.',
  // Common issues: different Wi-Fi
  wifiTitle: 'Réseaux Wi-Fi différents',
  wifiStep1:
    'Les deux appareils doivent être sur le même réseau local (sauf connexion via Tailscale).',
  wifiStep2: 'L’Ethernet et le Wi-Fi doivent partager le même sous-réseau.',
  wifiStep3: 'Essayez de reconnecter le Wi-Fi sur les deux appareils.',
  // Common issues: firewall
  firewallTitle: 'Le pare-feu bloque le port 6768',
  firewallStep1: 'macOS : Réglages Système → Réseau → Coupe-feu — autorisez Dolphin.',
  firewallStep2:
    'Windows : Pare-feu Defender → Autoriser une application — activez Dolphin pour les réseaux privés.',
  firewallStep3: 'Linux : sudo ufw allow 6768',
  firewallStep4:
    'Les réseaux d’entreprise ou d’école peuvent bloquer le P2P — essayez un partage de connexion personnel.',
  // Common issues: desktop not running
  desktopTitle: 'L’app de bureau n’est pas lancée',
  desktopStep1: 'Dolphin doit être ouvert sur votre ordinateur pour accepter les connexions.',
  desktopStep2: 'Essayez de redémarrer Dolphin — le serveur compagnon démarre au lancement.',
  desktopStep3: 'Après une mise à jour, vous devrez peut-être réassocier via le QR code.',
  // Common issues: timeout
  timeoutTitle: 'Délai de connexion dépassé',
  timeoutStep1: 'Vérifiez la puissance du signal Wi-Fi sur votre téléphone.',
  timeoutStep2: 'Revenez à la liste des hôtes et touchez votre hôte pour réessayer.',
  timeoutStep3: 'Redémarrez les deux apps si les délais dépassés persistent.',
  // Common issues: Tailscale
  tailscaleTitle: 'Hôte Tailscale injoignable',
  tailscaleStep1:
    'Les adresses comme 100.x.x.x ou *.ts.net passent par Tailscale — laissez-le activé.',
  tailscaleStep2:
    'iOS/Android peuvent bloquer le tunnel sans prévenir : désactivez puis réactivez Tailscale dans l’app Tailscale.',
  tailscaleStep3:
    'Vérifiez que l’ordinateur est allumé et apparaît comme connecté dans votre tailnet.',
  tailscaleStep4:
    'Mettez à jour l’app Tailscale — les versions récentes corrigent des bugs de reconnexion.',
  // Common issues: other VPNs
  vpnTitle: 'Interférence d’un autre VPN',
  vpnStep1:
    'Les VPN autres que Tailscale peuvent faire passer le trafic local par un serveur distant.',
  vpnStep2: 'Désactivez ce VPN ou activez le split tunneling / « Autoriser le réseau local ».',
  // Network diagnostics screen
  stateConnecting: 'Connexion',
  stateHandshaking: 'Négociation',
  stateConnected: 'Connecté',
  stateDisconnected: 'Déconnecté',
  stateReconnecting: 'Reconnexion',
  stateAuthFailed: 'Échec de l’authentification',
  stateWithAttempt: '{state} · tentative {attempt}',
  copied: 'Copié',
  copyReport: 'Copier le rapport',
  whatThisSuggests: 'Ce que cela suggère',
  sendPrivacyHint:
    'Envoie un rapport anonymisé et de taille limitée comprenant le nom de l’hôte, l’endpoint, les versions, l’état de la connexion et les événements — jamais le contenu du terminal ni les identifiants.',
  sending: 'Envoi…',
  diagnosticsSent: 'Diagnostic envoyé',
  retrySending: 'Réessayer l’envoi',
  sendDiagnostics: 'Envoyer le diagnostic à Dolphin',
  noEvents:
    'Aucun événement de connexion pour l’instant. Ils apparaissent quand l’app contacte cet hôte.',
  noPairedHosts: 'Aucun hôte associé.',
  // Connection diagnosis (the shareable report renders these in English)
  causeHealthy: 'La connexion est saine.',
  causeHealthyVia: 'La connexion via {path} est saine.',
  nextNoAction: 'Aucune action requise.',
  pathTailscaleDirect: 'Tailscale/directe',
  pathLanDirect: 'LAN/directe',
  causeBeforeNetworkChange: 'Avant le dernier changement de réseau : {cause}',
  causeBeforeResume: 'Avant la dernière reprise de l’app : {cause}',
  causeRelayCredentialRejected: 'Relay a refusé l’identifiant de reprise enregistré.',
  nextRelayCredentialRejected:
    'Essayez une connexion directe ; si Relay renvoie toujours 401, associez de nouveau cet appareil.',
  causeRelayUnavailable: 'Le service Relay était temporairement indisponible.',
  causeRelayUnavailableRetry:
    'Le service Relay était temporairement indisponible et a demandé à Dolphin de réessayer dans {delay}.',
  nextRelayUnavailable:
    'Gardez Dolphin ouvert ; la récupération devrait réessayer automatiquement.',
  delaySeconds: '{seconds} s',
  delayMinutes: '{minutes} min',
  causeRelayLiveness: 'Relay a cessé de répondre aux vérifications d’état authentifiées.',
  causeHostLiveness: 'L’hôte connecté a cessé de répondre aux vérifications d’état authentifiées.',
  nextLiveness: 'Dolphin a fermé la session obsolète et lancé la récupération.',
  causeRelaySessionFailed: 'La session Relay active s’est fermée de façon inattendue.',
  nextRelaySessionFailed:
    'Dolphin a lancé la récupération Relay ; l’historique des événements indique la raison de fermeture de la cellule.',
  causeAuthRejected: 'L’ordinateur a refusé cet appareil lors de l’authentification.',
  nextAuthRejected:
    'Vérifiez que l’appareil est toujours associé ; associez-le de nouveau si le refus se répète.',
  causeTailscaleTimeout:
    'L’endpoint Tailscale enregistré n’a pas répondu avant l’expiration du délai de connexion.',
  causeDirectTimeout:
    'L’endpoint direct enregistré n’a pas répondu avant l’expiration du délai de connexion.',
  nextRelayRecoveryInProgress:
    'La récupération Relay est en cours ; gardez Dolphin ouvert pendant les nouvelles tentatives.',
  nextCheckNetwork: 'Vérifiez le réseau local/VPN et assurez-vous que l’ordinateur est allumé.',
  causeHandshakeTimeout:
    'L’endpoint s’est ouvert, mais la négociation chiffrée de Dolphin n’a pas abouti.',
  nextHandshakeTimeout:
    'Vérifiez que l’ordinateur exécute une version compatible de Dolphin, puis réessayez.',
  causeRelayRecoveryPending:
    'La récupération Relay est sélectionnée, mais aucun échec plus précis n’est encore enregistré.',
  nextRelayRecoveryPending:
    'Gardez cette page ouverte pendant l’enregistrement du prochain événement de récupération.',
  causeUnknown:
    'Aucune cause d’échec unique ne peut être déterminée à partir des événements enregistrés.',
  nextUnknown:
    'Lancez le diagnostic et copiez de nouveau le rapport après la prochaine tentative de connexion.',
  causeRelayHostOffline:
    'Relay a répondu, mais l’ordinateur n’y est pas connecté (code de fermeture {code}, hôte hors ligne).',
  nextRelayHostOffline:
    'Vérifiez que l’ordinateur est allumé, que Dolphin est lancé et connecté à Dolphin Cloud.',
  causeRelayCredentialRefused:
    'Relay a refusé l’identifiant relay de cet appareil (code de fermeture {code}).',
  nextRelayCredentialRefused: 'Associez de nouveau ce téléphone à l’ordinateur.',
  causeRelayUnreachable:
    'Le téléphone n’a pas pu joindre la cellule Relay (fermeture du transport {code}).',
  nextRelayUnreachable:
    'Vérifiez la connexion réseau de ce téléphone ; la récupération Relay réessaie automatiquement.',
  causeRelayConnecting:
    'Relay a fermé la connexion avec le code {code} ; la récupération résout de nouveau et réessaie.',
  nextRelayConnecting: 'Gardez Dolphin ouvert pendant que la récupération Relay réessaie.',
  causeRelayDialNoAnswer: 'La connexion Relay a échoué avant que la cellule réponde.',
  // Developer and OTA rows
  hybridShellDevelopmentBuild: 'Shell hybride (build de développement)',
  hybridShellOtaBuild: 'Shell hybride (build OTA)',
  openHybridShell: 'Ouvrir le shell hybride du premier hôte associé',
  workspaceUpdates: 'Mises à jour de l’espace de travail',
  // Workspace update failures
  updateFailedAgo: 'La dernière mise à jour depuis {host} a échoué il y a {ago} : {reason}.',
  updateFailedJustNow: 'La dernière mise à jour depuis {host} vient d’échouer : {reason}.',
  reasonWithGeneration: '{reason} (génération {generation})',
  outcomeOpenedCached: 'Retour à la version enregistrée.',
  outcomeOpenedCachedGeneration: 'Retour à la version enregistrée (génération {generation}).',
  outcomeWall: 'L’espace de travail a été bloqué.',
  outcomeWallReason: 'Bloqué : {reason}.',
  outcomeNativeRoute: 'L’écran natif a été affiché.',
  outcomeFailed: 'L’écran d’échec a été affiché.',
  outcomeWaiting: 'Attente de l’hôte.',
  reasonNoConnection: 'pas connecté à l’hôte',
  reasonConnectionLost: 'la connexion a été interrompue',
  reasonHostRefused: 'l’hôte a refusé la lecture',
  reasonReplyUnreadable: 'l’hôte a envoyé une réponse illisible pour cette app',
  reasonChunkOversize: 'un bloc dépassait la taille autorisée par l’hôte',
  reasonAssetOverlong: 'une ressource était plus longue que ce que déclare le manifeste',
  reasonAssetNoProgress: 'la lecture d’une ressource n’a pas progressé',
  reasonAssetShort: 'une ressource s’est terminée avant sa taille déclarée',
  reasonAssetChecksumMismatch: 'somme de contrôle de ressource incorrecte',
  reasonBuildChangedMidFetch: 'le build de l’hôte a changé pendant le téléchargement',
  reasonChunkMisrouted: 'un bloc a répondu pour la mauvaise ressource ou le mauvais décalage',
  reasonAssetEntryChanged: 'une ressource ne correspondait plus au manifeste',
  reasonRangeUndecodable: 'une lecture compressée n’a pas pu être décodée',
  reasonFetchStopped: 'le téléchargement a été arrêté',
  reasonCacheWriteFailed: 'l’enregistrement du téléchargement sur ce téléphone a échoué',
  reasonUnrecognisedError: 'une erreur non reconnue',
  hostCodeUnavailable: 'l’hôte n’a pas de bundle d’espace de travail',
  hostCodeBuildChanged: 'le build de l’hôte a changé pendant le téléchargement',
  hostCodeAssetUnknown: 'l’hôte n’a pas reconnu une ressource',
  hostCodeAssetChanged: 'une ressource a changé sur l’hôte',
  hostCodeOffsetInvalid: 'l’hôte a refusé un décalage de lecture',
  hostCodeReadLimited: 'l’hôte a limité les lectures simultanées',
  wallBundleUnavailable: 'l’hôte n’a pas de bundle d’espace de travail',
  wallBundleShellTooOld: 'cette app est trop ancienne pour le bundle enregistré',
  wallHostTooOldForBundle: 'l’hôte est trop ancien pour le bundle enregistré',
  wallBundleTooOldForHost: 'le bundle enregistré est trop ancien pour l’hôte'
}
