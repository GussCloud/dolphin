import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { transportEn } from './en'

export const transportKo: MobileLocaleMessages<typeof transportEn> = {
  // Connection status
  connected: '연결됨',
  disconnected: '연결 끊김',
  connecting: '연결 중…',
  reconnecting: '다시 연결 중…',
  connectingViaRelay: 'Relay를 통해 연결 중…',
  cantConnect: '연결할 수 없음',
  cantConnectViaRelay: 'Relay를 통해 연결할 수 없음',
  cantReachDesktop: '데스크톱에 연결할 수 없음',
  pairingInvalid: '페어링이 유효하지 않음 — 데스크톱과 다시 페어링하세요',
  tailscaleHint: 'Tailscale을 확인하세요',
  labelWithHint: '{label} — {hint}',
  hostFallbackName: '호스트',
  signInRequired: '{host}에 로그인해야 합니다',
  signInRequiredDetail: '다시 연결하려면 데스크톱에서 Dolphin에 로그인하세요',
  hostOffline: '{host}이(가) 오프라인입니다',
  hostOfflineDetail: '절전 상태가 아닌지, Dolphin이 실행 중인지, 로그인되어 있는지 확인하세요',
  relayAccessExpired: '{host}의 Relay 액세스가 만료되었습니다',
  relayAccessExpiredDetail: '데스크톱과 다시 페어링하세요',
  cantReachRelay: 'Relay에 연결할 수 없음',
  cantReachRelayDetail: '연결 상태를 확인하세요',

  // Connection path
  pathDirectTailscale: '직접 · Tailscale',
  pathDirectLan: '직접 · LAN',

  // Host address validation
  unknownEndpoint: '알 수 없는 엔드포인트',
  enterHostAddress: '호스트 주소를 입력하세요.',
  invalidPort: '포트는 1–65535 사이여야 합니다.',
  useWebSocketScheme: 'ws:// 또는 wss://(또는 host:port)를 사용하세요.',
  invalidAddress: '유효한 주소가 아닙니다.',
  hostHasPathOrQuery: '호스트에 경로나 쿼리를 포함할 수 없습니다.',
  invalidHostname: '유효한 호스트 이름이 아닙니다.',
  missingHostname: '호스트 이름이 없습니다.',

  // Pairing
  missingPairingCode: '페어링 코드가 없습니다',
  invalidPairingCode: '유효한 페어링 코드가 아닙니다',
  removeHostInApp: 'Dolphin 앱의 호스트 목록에서 이 호스트를 제거하세요.'
}
