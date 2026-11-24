import { posix, win32 } from 'node:path'

export type PathStyle = 'posix' | 'windows'

/** How paths compare on the host the command runs on. */
export type PathRules = { style: PathStyle; caseInsensitive: boolean }

const WINDOWS_DRIVE_PATH = /^[A-Za-z]:([\\/]|$)/
// Git Bash spells `C:\x` as `/c/x`.
const GIT_BASH_DRIVE_PATH = /^\/([A-Za-z])(\/|$)/

/** Windows-style cwd → Windows rules; otherwise POSIX, case-insensitive on macOS (APFS default). */
export function pathRulesForCwd(cwd: string, platform: NodeJS.Platform): PathRules {
  if (WINDOWS_DRIVE_PATH.test(cwd)) {
    return { style: 'windows', caseInsensitive: true }
  }
  return { style: 'posix', caseInsensitive: platform === 'darwin' || platform === 'win32' }
}

/** Absolute, normalized form of `target` as seen from `cwd`; null when it cannot be resolved. */
export function resolveTargetPath(target: string, cwd: string, rules: PathRules): string | null {
  if (target === '') {
    return null
  }
  if (rules.style === 'posix') {
    return posix.resolve(cwd, target)
  }
  const gitBashDrive = GIT_BASH_DRIVE_PATH.exec(target)
  if (gitBashDrive) {
    return win32.resolve(`${gitBashDrive[1]}:\\`, target.slice(3))
  }
  // A rooted path without a drive (`/tmp`, `\x`) or a drive-relative `C:x` means something else.
  if (/^[\\/]/.test(target) || /^[A-Za-z]:(?![\\/])/.test(target)) {
    return null
  }
  return win32.resolve(cwd, target)
}

export function normalizeCwd(cwd: string, rules: PathRules): string {
  return rules.style === 'posix' ? posix.resolve(cwd) : win32.resolve(cwd)
}

function comparable(path: string, rules: PathRules): string {
  return rules.caseInsensitive ? path.toLowerCase() : path
}

export function samePath(a: string, b: string, rules: PathRules): boolean {
  return comparable(a, rules) === comparable(b, rules)
}

/** True when `ancestor` is `path` or one of its parents. */
export function isSameOrAncestor(ancestor: string, path: string, rules: PathRules): boolean {
  return samePath(ancestor, path, rules) || isUnder(ancestor, path, rules)
}

/** True when `path` is strictly inside `parent`. */
export function isUnder(parent: string, path: string, rules: PathRules): boolean {
  const api = rules.style === 'posix' ? posix : win32
  const relative = api.relative(comparable(parent, rules), comparable(path, rules))
  return (
    relative !== '' &&
    relative !== '..' &&
    !relative.startsWith(`..${api.sep}`) &&
    !api.isAbsolute(relative)
  )
}

export function isFilesystemRoot(path: string, rules: PathRules): boolean {
  return rules.style === 'posix' ? path === '/' : /^[A-Za-z]:\\$/.test(path)
}

/**
 * A removable-volume mount point by convention: `/Volumes/<name>` on macOS, `/media/<user>/<name>`
 * or `/mnt/<name>` on Linux. Never a Windows drive root, a WSL drive mount (`/mnt/c`) or WSL's
 * own `/mnt/wsl*` mounts: those are
 * system drives more often than not.
 */
export function isRemovableMountPath(
  path: string,
  rules: PathRules,
  platform: NodeJS.Platform
): boolean {
  if (rules.style !== 'posix') {
    return false
  }
  if (platform === 'darwin') {
    return /^\/Volumes\/[^/]+$/.test(path)
  }
  if (platform === 'linux') {
    return (
      /^\/media\/[^/]+\/[^/]+$/.test(path) ||
      (/^\/mnt\/[^/]{2,}$/.test(path) && !/^\/mnt\/wsl/i.test(path))
    )
  }
  return false
}
