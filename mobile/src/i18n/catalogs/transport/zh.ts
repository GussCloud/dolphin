import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { transportEn } from './en'

export const transportZh: MobileLocaleMessages<typeof transportEn> = {
  // Connection status
  connected: '已连接',
  disconnected: '已断开',
  connecting: '正在连接…',
  reconnecting: '正在重新连接…',
  connectingViaRelay: '正在通过 Relay 连接…',
  cantConnect: '无法连接',
  cantConnectViaRelay: '无法通过 Relay 连接',
  cantReachDesktop: '无法访问桌面端',
  pairingInvalid: '配对无效 — 请重新与桌面端配对',
  tailscaleHint: '请检查 Tailscale',
  labelWithHint: '{label} — {hint}',
  hostFallbackName: '主机',
  signInRequired: '{host} 需要登录',
  signInRequiredDetail: '请在桌面端登录 Dolphin 以重新连接',
  hostOffline: '{host} 已离线',
  hostOfflineDetail: '请确认它处于唤醒状态、Dolphin 正在运行且你已登录',
  relayAccessExpired: '{host} 的 Relay 访问权限已过期',
  relayAccessExpiredDetail: '请重新与桌面端配对',
  cantReachRelay: '无法访问 Relay',
  cantReachRelayDetail: '请检查你的网络连接',

  // Connection path
  pathDirectTailscale: '直连 · Tailscale',
  pathDirectLan: '直连 · 局域网',

  // Host address validation
  unknownEndpoint: '未知端点',
  enterHostAddress: '请输入主机地址。',
  invalidPort: '端口必须为 1–65535。',
  useWebSocketScheme: '请使用 ws:// 或 wss://（或 host:port）。',
  invalidAddress: '地址无效。',
  hostHasPathOrQuery: '主机不能包含路径或查询。',
  invalidHostname: '主机名无效。',
  missingHostname: '缺少主机名。',

  // Pairing
  missingPairingCode: '缺少配对码',
  invalidPairingCode: '配对码无效',
  removeHostInApp: '请在 Dolphin 应用的主机列表中移除此主机。'
}
