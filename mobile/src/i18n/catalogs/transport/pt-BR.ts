import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { transportEn } from './en'

export const transportPtBR: MobileLocaleMessages<typeof transportEn> = {
  // Connection status
  connected: 'Conectado',
  disconnected: 'Desconectado',
  connecting: 'Conectando…',
  reconnecting: 'Reconectando…',
  connectingViaRelay: 'Conectando via Relay…',
  cantConnect: 'Não foi possível conectar',
  cantConnectViaRelay: 'Não foi possível conectar via Relay',
  cantReachDesktop: 'Não foi possível alcançar o desktop',
  pairingInvalid: 'Pareamento inválido — pareie novamente com o desktop',
  tailscaleHint: 'verifique o Tailscale',
  labelWithHint: '{label} — {hint}',
  hostFallbackName: 'Host',
  signInRequired: 'Login necessário em {host}',
  signInRequiredDetail: 'Faça login no Dolphin no desktop para reconectar',
  hostOffline: '{host} está offline',
  hostOfflineDetail:
    'Verifique se ele está ativo, se o Dolphin está aberto e se você está conectado',
  relayAccessExpired: 'O acesso ao Relay expirou para {host}',
  relayAccessExpiredDetail: 'Pareie novamente com o desktop',
  cantReachRelay: 'Não foi possível alcançar o Relay',
  cantReachRelayDetail: 'Verifique sua conexão',

  // Connection path
  pathDirectTailscale: 'Direto · Tailscale',
  pathDirectLan: 'Direto · LAN',

  // Host address validation
  unknownEndpoint: 'Endpoint desconhecido',
  enterHostAddress: 'Digite o endereço do host.',
  invalidPort: 'A porta deve estar entre 1 e 65535.',
  useWebSocketScheme: 'Use ws:// ou wss:// (ou host:porta).',
  invalidAddress: 'Endereço inválido.',
  hostHasPathOrQuery: 'O host não pode incluir caminho ou query.',
  invalidHostname: 'Nome de host inválido.',
  missingHostname: 'Nome de host ausente.',

  // Pairing
  missingPairingCode: 'Código de pareamento ausente',
  invalidPairingCode: 'Código de pareamento inválido',
  removeHostInApp: 'Remova este host da lista de hosts no app Dolphin.'
}
