/**
 * Spreads `overlay` over `base`. On win32 env names are case-insensitive but a JS object is not,
 * so a base `Path` must not survive beside an overlay `PATH` — Windows would keep whichever sorts first.
 */
export function overlayPlatformEnv<T extends string | undefined>(
  base: Readonly<Record<string, T>>,
  overlay: Readonly<Record<string, T>>,
  platform: NodeJS.Platform = process.platform
): Record<string, T> {
  const merged: Record<string, T> = { ...base }
  if (platform === 'win32') {
    const overlaid = new Set(Object.keys(overlay).map((key) => key.toUpperCase()))
    for (const key of Object.keys(merged)) {
      if (overlaid.has(key.toUpperCase())) {
        delete merged[key]
      }
    }
  }
  return { ...merged, ...overlay }
}
