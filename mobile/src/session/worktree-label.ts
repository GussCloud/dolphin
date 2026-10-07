import { sessionCatalog } from '../i18n/catalogs/session'
import { translate } from '../i18n/mobile-locale-state'

// Why: worktree ids encode `repo::path`; screens that only receive the id
// (deep links, route params without a name) still need a human label.
export function getWorktreeLabel(name: string | undefined, worktreeId: string): string {
  if (name?.trim()) {
    return name.trim()
  }
  const pathPart = worktreeId.includes('::')
    ? worktreeId.slice(worktreeId.indexOf('::') + 2)
    : worktreeId
  const normalized = pathPart.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.slice(normalized.lastIndexOf('/') + 1) || translate(sessionCatalog, 'worktree')
}
