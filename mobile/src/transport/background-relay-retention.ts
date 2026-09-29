// How long a backgrounded app keeps its Relay session and recovery alive.
// 'off' keeps the short app-switch grace only; the rest need the Android
// foreground service, otherwise the OS freezes the socket regardless.
export const BACKGROUND_RELAY_RETENTIONS = ['off', '15m', '1h', 'always'] as const

export type BackgroundRelayRetention = (typeof BACKGROUND_RELAY_RETENTIONS)[number]

export const DEFAULT_BACKGROUND_RELAY_RETENTION: BackgroundRelayRetention = 'off'

const RETENTION_WINDOW_MS: Record<Exclude<BackgroundRelayRetention, 'off' | 'always'>, number> = {
  '15m': 15 * 60_000,
  '1h': 60 * 60_000
}

export function isBackgroundRelayRetention(value: unknown): value is BackgroundRelayRetention {
  return BACKGROUND_RELAY_RETENTIONS.some((retention) => retention === value)
}

// null means unbounded; only meaningful when retention is not 'off'.
export function backgroundRelayRetentionWindowMs(
  retention: Exclude<BackgroundRelayRetention, 'off'>
): number | null {
  return retention === 'always' ? null : RETENTION_WINDOW_MS[retention]
}

let current: BackgroundRelayRetention = DEFAULT_BACKGROUND_RELAY_RETENTION
const listeners = new Set<(retention: BackgroundRelayRetention) => void>()

// Process-wide choice read synchronously by transport at each backgrounding.
export function getBackgroundRelayRetention(): BackgroundRelayRetention {
  return current
}

export function setBackgroundRelayRetention(retention: BackgroundRelayRetention): void {
  if (retention === current) {
    return
  }
  current = retention
  for (const listener of listeners) {
    listener(retention)
  }
}

export function subscribeBackgroundRelayRetention(
  listener: (retention: BackgroundRelayRetention) => void
): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
