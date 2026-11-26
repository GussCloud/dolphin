/**
 * Deletes `keys` from `env` the way the OS reads names: case-insensitively on win32 (an inherited
 * `Anthropic_Base_Url` is `ANTHROPIC_BASE_URL` there), exactly elsewhere.
 */
export function deletePlatformEnvKeys(
  env: Record<string, string>,
  keys: readonly string[] | undefined,
  platform: NodeJS.Platform = process.platform
): void {
  if (!keys || keys.length === 0) {
    return
  }
  for (const key of keys) {
    delete env[key]
  }
  if (platform !== 'win32') {
    return
  }
  const requested = new Set(keys.map((key) => key.toUpperCase()))
  for (const key of Object.keys(env)) {
    if (requested.has(key.toUpperCase())) {
      delete env[key]
    }
  }
}
