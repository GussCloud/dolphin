/**
 * Per-account gh config dir for terminals: a `hosts.yml` naming only the bound login, with no
 * token. gh keys keyring entries by host+login, so `GH_CONFIG_DIR=<dir> gh …` uses that login's
 * keyring token while the token itself never reaches disk or the PTY environment.
 *
 * Only valid when the user's gh keeps tokens in the keyring. With insecure storage the token lives
 * inside the user's own hosts.yml; Dolphin does not copy it, and the binding is skipped instead.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'
import { getAppEnvironment } from '../../shared/app-environment'
import {
  normalizeGhAccountBinding,
  type GhAccountBinding
} from '../../shared/github/account-binding'
import { runProcess } from '../../shared/child-process/run-process'
import { buildWslExecArgs } from '../../shared/wsl-login-shell-command'

const ACCOUNTS_DIR_NAME = 'gh-accounts'
const WSL_PROBE_TIMEOUT_MS = 10_000

/** `keyring`: safe to bind. `file`: token sits in hosts.yml. `missing`: login not on that host's gh. */
export type GhTokenStorage = 'keyring' | 'file' | 'missing' | 'unknown'

function safeSegment(value: string): string {
  const encoded = encodeURIComponent(value)
  return encoded === '.' || encoded === '..' ? encodeURIComponent(`_${value}`) : encoded
}

export function ghTerminalConfigDir(binding: GhAccountBinding, userDataPath?: string): string {
  return join(
    userDataPath ?? getAppEnvironment().getPath('userData'),
    ACCOUNTS_DIR_NAME,
    safeSegment(binding.host),
    safeSegment(binding.user)
  )
}

export function renderGhTerminalHostsYml(binding: GhAccountBinding): string {
  const host = JSON.stringify(binding.host)
  const user = JSON.stringify(binding.user)
  return `${host}:\n    git_protocol: https\n    users:\n        ${user}:\n    user: ${user}\n`
}

/** Creates or refreshes the dir; never writes a token. Returns the dir path. */
export function ensureGhTerminalConfigDir(
  bindingInput: GhAccountBinding,
  userDataPath?: string
): string {
  const binding = normalizeGhAccountBinding(bindingInput)
  if (!binding) {
    throw new Error('Invalid GitHub account binding')
  }
  const dir = ghTerminalConfigDir(binding, userDataPath)
  const hostsPath = join(dir, 'hosts.yml')
  const content = renderGhTerminalHostsYml(binding)
  if (!existsSync(hostsPath) || readFileSync(hostsPath, 'utf8') !== content) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(hostsPath, content, { mode: 0o600 })
  }
  return dir
}

/** Classifies one login's token storage from a gh hosts.yml body; never returns the token. */
export function classifyGhTokenStorage(
  hostsYml: string,
  binding: GhAccountBinding
): GhTokenStorage {
  let parsed: unknown
  try {
    parsed = parse(hostsYml)
  } catch {
    return 'unknown'
  }
  const hosts = parsed && typeof parsed === 'object' ? new Map(Object.entries(parsed)) : null
  const entry: unknown = hosts
    ? [...hosts].find(([host]) => host.toLowerCase() === binding.host)?.[1]
    : undefined
  if (!entry || typeof entry !== 'object') {
    return 'missing'
  }
  const users =
    'users' in entry && entry.users && typeof entry.users === 'object' ? entry.users : {}
  if (Object.hasOwn(users, binding.user)) {
    const user: unknown = Object.entries(users).find(([login]) => login === binding.user)?.[1]
    return user && typeof user === 'object' && 'oauth_token' in user ? 'file' : 'keyring'
  }
  // Pre-multi-account layout: one login per host, token beside it.
  if ('user' in entry && entry.user === binding.user) {
    return 'oauth_token' in entry ? 'file' : 'keyring'
  }
  return 'missing'
}

function nativeGhHostsPath(env: NodeJS.ProcessEnv = process.env): string {
  if (env.GH_CONFIG_DIR) {
    return join(env.GH_CONFIG_DIR, 'hosts.yml')
  }
  if (process.platform === 'win32') {
    return join(
      env.AppData ?? env.APPDATA ?? join(homedir(), 'AppData', 'Roaming'),
      'GitHub CLI',
      'hosts.yml'
    )
  }
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'gh', 'hosts.yml')
}

// Why only presence markers: the guest's hosts.yml may hold tokens; they must not cross into Dolphin.
const WSL_STORAGE_PROBE = [
  'f="${GH_CONFIG_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/gh}/hosts.yml"',
  '[ -f "$f" ] || { echo missing; exit 0; }',
  'grep -q "oauth_token:" "$f" && echo file || echo keyring'
].join('\n')

/**
 * Where the gh that a terminal will run keeps this login's token. WSL is conservative: any token
 * stored in the guest's hosts.yml counts as `file`.
 */
export async function detectGhTokenStorage(
  binding: GhAccountBinding,
  target: { wsl?: { distro: string | null } } = {}
): Promise<GhTokenStorage> {
  if (target.wsl) {
    try {
      const result = await runProcess({
        program: 'wsl.exe',
        args: buildWslExecArgs(target.wsl.distro ?? undefined, [
          '/bin/sh',
          '-c',
          WSL_STORAGE_PROBE
        ]),
        timeoutMs: WSL_PROBE_TIMEOUT_MS
      })
      const answer = result.stdout.trim()
      return answer === 'keyring' || answer === 'file' || answer === 'missing' ? answer : 'unknown'
    } catch {
      return 'unknown'
    }
  }
  const hostsPath = nativeGhHostsPath()
  if (!existsSync(hostsPath)) {
    return 'missing'
  }
  try {
    return classifyGhTokenStorage(readFileSync(hostsPath, 'utf8'), binding)
  } catch {
    return 'unknown'
  }
}
