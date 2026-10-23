// Why: the WSL relay's agent detection already learns each distro's claude version; DeepSeek's
// launch-time hook install reuses it instead of starting another WSL probe.
const claudeVersionByDistro = new Map<string, string>()

export function rememberWslClaudeVersion(distro: string, version: string | null): void {
  if (version) {
    claudeVersionByDistro.set(distro, version)
  }
}

export function getRememberedWslClaudeVersion(distro: string): string | null {
  return claudeVersionByDistro.get(distro) ?? null
}
