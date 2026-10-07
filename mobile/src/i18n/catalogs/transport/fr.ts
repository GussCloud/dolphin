import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { transportEn } from './en'

export const transportFr: MobileLocaleMessages<typeof transportEn> = {
  // Connection status
  connected: 'Connecté',
  disconnected: 'Déconnecté',
  connecting: 'Connexion…',
  reconnecting: 'Reconnexion…',
  connectingViaRelay: 'Connexion via Relay…',
  cantConnect: 'Connexion impossible',
  cantConnectViaRelay: 'Connexion via Relay impossible',
  cantReachDesktop: 'Ordinateur injoignable',
  pairingInvalid: 'Appairage invalide — appairez à nouveau avec votre ordinateur',
  tailscaleHint: 'vérifiez Tailscale',
  labelWithHint: '{label} — {hint}',
  hostFallbackName: 'Hôte',
  signInRequired: 'Connexion requise sur {host}',
  signInRequiredDetail: 'Connectez-vous à Dolphin sur votre ordinateur pour rétablir la connexion',
  hostOffline: '{host} est hors ligne',
  hostOfflineDetail: 'Vérifiez qu’il est allumé, que Dolphin est lancé et que vous êtes connecté',
  relayAccessExpired: 'L’accès Relay a expiré pour {host}',
  relayAccessExpiredDetail: 'Appairez à nouveau avec votre ordinateur',
  cantReachRelay: 'Relay injoignable',
  cantReachRelayDetail: 'Vérifiez votre connexion',

  // Connection path
  pathDirectTailscale: 'Direct · Tailscale',
  pathDirectLan: 'Direct · LAN',

  // Host address validation
  unknownEndpoint: 'Point de terminaison inconnu',
  enterHostAddress: 'Saisissez l’adresse de l’hôte.',
  invalidPort: 'Le port doit être compris entre 1 et 65535.',
  useWebSocketScheme: 'Utilisez ws:// ou wss:// (ou hôte:port).',
  invalidAddress: 'Adresse non valide.',
  hostHasPathOrQuery: 'L’hôte ne doit pas inclure de chemin ni de requête.',
  invalidHostname: 'Nom d’hôte non valide.',
  missingHostname: 'Nom d’hôte manquant.',

  // Pairing
  missingPairingCode: 'Code d’appairage manquant',
  invalidPairingCode: 'Code d’appairage non valide',
  removeHostInApp: 'Supprimez cet hôte de la liste des hôtes dans l’app Dolphin.'
}
