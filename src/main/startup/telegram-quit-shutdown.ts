// The quit barrier's handle on Telegram: settle the device-code relay, then dispose the bridge.
let shutdown: (() => Promise<void>) | null = null
let running: Promise<void> | null = null

export function setTelegramQuitShutdown(next: () => Promise<void>): void {
  shutdown = next
}

/** Fallback set as soon as the bridge starts; plugin startup upgrades it to relay-then-dispose. */
export function registerTelegramBridgeQuitFallback(bridge: { dispose(): void }): void {
  setTelegramQuitShutdown(async () => bridge.dispose())
}

/** Idempotent: will-quit's listener and the quit barrier share one run. */
export function runTelegramQuitShutdown(): Promise<void> {
  running ??= shutdown?.() ?? Promise.resolve()
  return running
}

/** @internal - tests need a fresh quit between cases. */
export function _resetTelegramQuitShutdown(): void {
  shutdown = null
  running = null
}
