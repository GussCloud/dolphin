import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { transportEn } from './en'

export const transportJa: MobileLocaleMessages<typeof transportEn> = {
  // Connection status
  connected: '接続済み',
  disconnected: '切断済み',
  connecting: '接続中…',
  reconnecting: '再接続中…',
  connectingViaRelay: 'Relay 経由で接続中…',
  cantConnect: '接続できません',
  cantConnectViaRelay: 'Relay 経由で接続できません',
  cantReachDesktop: 'デスクトップに到達できません',
  pairingInvalid: 'ペアリングが無効です — デスクトップと再ペアリングしてください',
  tailscaleHint: 'Tailscale を確認してください',
  labelWithHint: '{label} — {hint}',
  hostFallbackName: 'ホスト',
  signInRequired: '{host} でサインインが必要です',
  signInRequiredDetail: '再接続するにはデスクトップの Dolphin にサインインしてください',
  hostOffline: '{host} はオフラインです',
  hostOfflineDetail:
    'スリープしていないか、Dolphin が起動しているか、サインインしているかを確認してください',
  relayAccessExpired: '{host} の Relay アクセスの有効期限が切れました',
  relayAccessExpiredDetail: 'デスクトップと再ペアリングしてください',
  cantReachRelay: 'Relay に到達できません',
  cantReachRelayDetail: '接続を確認してください',

  // Connection path
  pathDirectTailscale: '直接 · Tailscale',
  pathDirectLan: '直接 · LAN',

  // Host address validation
  unknownEndpoint: '不明なエンドポイント',
  enterHostAddress: 'ホストのアドレスを入力してください。',
  invalidPort: 'ポートは 1～65535 で指定してください。',
  useWebSocketScheme: 'ws:// または wss://（または host:port）を使用してください。',
  invalidAddress: '有効なアドレスではありません。',
  hostHasPathOrQuery: 'ホストにパスやクエリを含めることはできません。',
  invalidHostname: '有効なホスト名ではありません。',
  missingHostname: 'ホスト名がありません。',

  // Pairing
  missingPairingCode: 'ペアリングコードがありません',
  invalidPairingCode: '有効なペアリングコードではありません',
  removeHostInApp: 'このホストは Dolphin アプリのホスト一覧から削除してください。'
}
