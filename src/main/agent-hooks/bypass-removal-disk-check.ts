import { realpath, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname } from 'node:path'
import type { BypassRemovalDiskCheck } from '../../shared/bypass-removal-classifier'
import {
  isFilesystemRoot,
  isSameOrAncestor,
  normalizeCwd,
  pathRulesForCwd,
  type PathRules
} from '../../shared/bypass-removal-target-paths'

/** The filesystem calls the check makes; a seam so tests can model case-sensitive volumes. */
export type DiskCheckFilesystem = {
  realpath: (path: string) => Promise<string>
  stat: (path: string) => Promise<{ dev: number }>
}

// Why: bound lazily so suites that mock fs/promises without these exports can still import this.
const HOST_FILESYSTEM: DiskCheckFilesystem = {
  realpath: (path) => realpath(path),
  stat: (path) => stat(path)
}

async function isMountPoint(path: string, fs: DiskCheckFilesystem): Promise<boolean> {
  const [self, parent] = await Promise.all([fs.stat(path), fs.stat(dirname(path))])
  return self.dev !== parent.dev
}

/**
 * True only when every literal target still means what the classifier read: a symlink can make
 * `.` or `/Volumes/X` resolve elsewhere. Any filesystem error is false (no decision).
 */
export async function confirmBypassRemovalOnDisk(
  checks: readonly BypassRemovalDiskCheck[],
  cwd: string,
  options: { homeDir?: string; fs?: DiskCheckFilesystem } = {}
): Promise<boolean> {
  if (checks.length === 0) {
    return true
  }
  const fs = options.fs ?? HOST_FILESYSTEM
  try {
    const realCwd = await fs.realpath(cwd)
    // Why exact case: realpath returns the stored spelling, and case-sensitive APFS volumes exist.
    const rules: PathRules = {
      ...pathRulesForCwd(realCwd, process.platform),
      caseInsensitive: false
    }
    const realHome = normalizeCwd(await fs.realpath(options.homeDir ?? homedir()), rules)
    for (const check of checks) {
      const real = await fs.realpath(check.path)
      if (check.kind === 'is-cwd') {
        if (
          real !== realCwd ||
          isFilesystemRoot(realCwd, rules) ||
          isSameOrAncestor(realCwd, realHome, rules)
        ) {
          return false
        }
      } else if (real !== normalizeCwd(check.path, rules) || !(await isMountPoint(real, fs))) {
        return false
      }
    }
    return true
  } catch {
    return false
  }
}
