import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { transportEn } from './en'

export const transportEs: MobileLocaleMessages<typeof transportEn> = {
  // Connection status
  connected: 'Conectado',
  disconnected: 'Desconectado',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…',
  connectingViaRelay: 'Conectando a través de Relay…',
  cantConnect: 'No se puede conectar',
  cantConnectViaRelay: 'No se puede conectar a través de Relay',
  cantReachDesktop: 'No se puede acceder al escritorio',
  pairingInvalid: 'Emparejamiento no válido: vuelve a emparejar con tu escritorio',
  tailscaleHint: 'revisa Tailscale',
  labelWithHint: '{label} — {hint}',
  hostFallbackName: 'Host',
  signInRequired: 'Se requiere iniciar sesión en {host}',
  signInRequiredDetail: 'Inicia sesión en Dolphin en tu escritorio para reconectar',
  hostOffline: '{host} está sin conexión',
  hostOfflineDetail:
    'Comprueba que esté activo, que Dolphin se esté ejecutando y que hayas iniciado sesión',
  relayAccessExpired: 'El acceso a Relay caducó para {host}',
  relayAccessExpiredDetail: 'Vuelve a emparejar con tu escritorio',
  cantReachRelay: 'No se puede acceder a Relay',
  cantReachRelayDetail: 'Revisa tu conexión',

  // Connection path
  pathDirectTailscale: 'Directa · Tailscale',
  pathDirectLan: 'Directa · LAN',

  // Host address validation
  unknownEndpoint: 'Endpoint desconocido',
  enterHostAddress: 'Introduce la dirección del host.',
  invalidPort: 'El puerto debe estar entre 1 y 65535.',
  useWebSocketScheme: 'Usa ws:// o wss:// (o host:puerto).',
  invalidAddress: 'Dirección no válida.',
  hostHasPathOrQuery: 'El host no debe incluir una ruta ni una consulta.',
  invalidHostname: 'Nombre de host no válido.',
  missingHostname: 'Falta el nombre de host.',

  // Pairing
  missingPairingCode: 'Falta el código de emparejamiento',
  invalidPairingCode: 'Código de emparejamiento no válido',
  removeHostInApp: 'Elimina este host de la lista de hosts en la app de Dolphin.'
}
