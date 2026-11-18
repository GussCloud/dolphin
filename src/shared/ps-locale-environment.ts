/** macOS ps localizes lstart (%c) and vis-encodes non-ASCII argv; en_US.UTF-8 yields the parsed shape. */
export function psLocaleEnvironment(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv | undefined {
  return platform === 'darwin' ? { ...env, LC_ALL: 'en_US.UTF-8' } : undefined
}
