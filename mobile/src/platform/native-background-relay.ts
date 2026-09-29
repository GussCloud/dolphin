export type NativeBackgroundRelay = {
  start(title: string, text: string): boolean
  stop(): void
  isRunning(): boolean
  enterBackground(windowMs: number | null): void
  enterForeground(): void
  isIgnoringBatteryOptimizations(): boolean
  requestIgnoreBatteryOptimizations(): boolean
  hasAutostartSettings(): boolean
  openAutostartSettings(): boolean
}

// Only Android can hold a background socket open, through a foreground service.
export const nativeBackgroundRelay: NativeBackgroundRelay | null = null
