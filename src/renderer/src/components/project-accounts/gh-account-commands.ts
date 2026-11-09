// Why: these strings are typed into a shell (bash, zsh, PowerShell, cmd); only shell-inert characters pass.
const HOST_RE = /^[A-Za-z0-9](?:[A-Za-z0-9.-]{0,251}[A-Za-z0-9])?(?::\d{1,5})?$/
const GH_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,38})$/

export function normalizeGhHostInput(value: string): string | null {
  const host = value
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .toLowerCase()
  return HOST_RE.test(host) ? host : null
}

export function ghAuthLoginCommand(host: string): string | null {
  const normalized = normalizeGhHostInput(host)
  return normalized ? `gh auth login --hostname ${normalized} --web` : null
}

export function ghAuthLogoutCommand(host: string, user: string): string | null {
  const normalized = normalizeGhHostInput(host)
  return normalized && GH_LOGIN_RE.test(user)
    ? `gh auth logout --hostname ${normalized} --user ${user}`
    : null
}
