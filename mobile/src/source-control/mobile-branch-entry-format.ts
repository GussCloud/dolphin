import type { MobileGitBranchChangeEntry } from './mobile-branch-compare'
import { sourceControlText } from './source-control-text'

export function formatMobileBranchEntryMeta(entry: MobileGitBranchChangeEntry): string | null {
  const stats =
    entry.added !== undefined || entry.removed !== undefined
      ? `+${entry.added ?? 0} -${entry.removed ?? 0}`
      : null
  if (entry.oldPath) {
    return stats
      ? sourceControlText('renamedFromWithStats', { path: entry.oldPath, stats })
      : sourceControlText('renamedFrom', { path: entry.oldPath })
  }
  return stats
}
