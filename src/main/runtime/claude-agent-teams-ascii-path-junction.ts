import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readlink,
  rename,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

// Why: Claude Code on Windows refuses to run `tmux` found under a PATH entry with non-ASCII text or an
// 8.3 `~` name (exit 127 "not found or is in an unsafe location"); an ASCII junction to the same dir works.
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/

export function isClaudeSafePathEntry(dir: string): boolean {
  return PRINTABLE_ASCII.test(dir) && !dir.includes('~')
}

export type ClaudeSafeShimPathDirs = {
  dirs: string[]
  /** False when some dir could not be exposed on a Claude-safe path; Claude would never find its tmux. */
  allSafe: boolean
}

export type ClaudeSafeShimPathOptions = {
  platform?: NodeJS.Platform
  env?: Record<string, string | undefined>
  /** Private record of the junctions this user created, so a launch reuses instead of minting one. */
  registryPath?: string
  junctionRoots?: string[]
}

/** Replaces each unsafe Windows shim dir with an ASCII junction to it, keeping the order. */
export async function exposeShimDirsOnClaudeSafePath(
  dirs: string[],
  options: ClaudeSafeShimPathOptions = {}
): Promise<ClaudeSafeShimPathDirs> {
  if ((options.platform ?? process.platform) !== 'win32' || dirs.every(isClaudeSafePathEntry)) {
    return { dirs, allSafe: true }
  }
  const registryPath = options.registryPath ?? defaultRegistryPath()
  const registry = await readRegistry(registryPath)
  const roots = (options.junctionRoots ?? defaultJunctionRoots(options.env ?? process.env)).filter(
    isClaudeSafePathEntry
  )
  let registryChanged = false
  let allSafe = true
  const mapped: string[] = []
  for (const dir of dirs) {
    if (isClaudeSafePathEntry(dir)) {
      mapped.push(dir)
      continue
    }
    const key = normalizeForCompare(dir)
    const recorded = registry.get(key)
    if (recorded && isClaudeSafePathEntry(recorded) && (await isJunctionTo(recorded, dir))) {
      mapped.push(recorded)
      continue
    }
    const created = await createJunction(dir, roots)
    if (!created) {
      allSafe = false
      mapped.push(dir)
      continue
    }
    registry.set(key, created)
    registryChanged = true
    mapped.push(created)
  }
  if (registryChanged) {
    await writeRegistry(registryPath, registry)
  }
  return { dirs: mapped, allSafe }
}

function defaultRegistryPath(): string {
  return join(homedir(), '.dolphin', 'claude-agent-teams-ascii-path.json')
}

function defaultJunctionRoots(env: Record<string, string | undefined>): string[] {
  const roots: string[] = []
  if (env.ProgramData) {
    roots.push(join(env.ProgramData, 'Dolphin', 'agent-teams-path'))
  }
  if (env.SystemDrive) {
    roots.push(join(`${env.SystemDrive}\\`, 'DolphinAgentTeamsPath'))
  }
  return roots
}

// Why: these roots are shared by every account, so the holder name is random and never adopted unless we
// recorded it, and every reuse re-checks that the link still points at our dir.
async function createJunction(target: string, roots: string[]): Promise<string | null> {
  for (const root of roots) {
    let holder: string | null = null
    try {
      await mkdir(root, { recursive: true })
      holder = await mkdtemp(join(root, 'u-'))
      const link = join(holder, 'bin')
      await symlink(target, link, 'junction')
      if (await isJunctionTo(link, target)) {
        return link
      }
    } catch {
      // try the next root
    }
    if (holder) {
      await rm(holder, { recursive: true, force: true }).catch(() => undefined)
    }
  }
  return null
}

async function isJunctionTo(link: string, target: string): Promise<boolean> {
  try {
    if (!(await lstat(link)).isSymbolicLink()) {
      return false
    }
    return normalizeForCompare(await readlink(link)) === normalizeForCompare(target)
  } catch {
    return false
  }
}

function normalizeForCompare(path: string): string {
  return resolve(path.replace(/^\\\\\?\\/, ''))
    .replace(/[\\/]+$/, '')
    .toLowerCase()
}

async function readRegistry(path: string): Promise<Map<string, string>> {
  const registry = new Map<string, string>()
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          registry.set(key, value)
        }
      }
    }
  } catch {
    // missing or corrupt: start over
  }
  return registry
}

async function writeRegistry(path: string, registry: Map<string, string>): Promise<void> {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`
  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(tmp, JSON.stringify(Object.fromEntries(registry), null, 2), 'utf8')
    await rename(tmp, path)
  } catch {
    // Why: losing the record only costs a fresh junction on the next launch.
    await rm(tmp, { force: true }).catch(() => undefined)
  }
}
