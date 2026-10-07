import type { MobileCatalogSource } from '../../mobile-i18n-catalog'

export const transportEn = {
  // Connection status
  connected: 'Connected',
  disconnected: 'Disconnected',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
  connectingViaRelay: 'Connecting via Relay…',
  cantConnect: "Can't connect",
  cantConnectViaRelay: "Can't connect via Relay",
  cantReachDesktop: "Can't reach desktop",
  pairingInvalid: 'Pairing invalid — re-pair with your desktop',
  tailscaleHint: 'check Tailscale',
  labelWithHint: '{label} — {hint}',
  hostFallbackName: 'Host',
  signInRequired: 'Sign-in required on {host}',
  signInRequiredDetail: 'Sign in to Dolphin on your desktop to reconnect',
  hostOffline: '{host} is offline',
  hostOfflineDetail: "Check it's awake, Dolphin is running, and you're signed in",
  relayAccessExpired: 'Relay access expired for {host}',
  relayAccessExpiredDetail: 'Re-pair with your desktop',
  cantReachRelay: "Can't reach Relay",
  cantReachRelayDetail: 'Check your connection',

  // Connection path
  pathDirectTailscale: 'Direct · Tailscale',
  pathDirectLan: 'Direct · LAN',

  // Host address validation
  unknownEndpoint: 'Unknown endpoint',
  enterHostAddress: 'Enter a host address.',
  invalidPort: 'Port must be 1–65535.',
  useWebSocketScheme: 'Use ws:// or wss:// (or host:port).',
  invalidAddress: 'Not a valid address.',
  hostHasPathOrQuery: 'Host must not include a path or query.',
  invalidHostname: 'Not a valid hostname.',
  missingHostname: 'Missing hostname.',

  // Pairing
  missingPairingCode: 'Missing pairing code',
  invalidPairingCode: 'Not a valid pairing code',
  removeHostInApp: 'Remove this host from the host list in the Dolphin app.'
} as const satisfies MobileCatalogSource
