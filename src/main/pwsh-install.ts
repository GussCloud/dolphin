import { existsSync } from 'node:fs'
import { win32 as pathWin32 } from 'node:path'
import { runProcess } from '../shared/child-process/run-process'
import { PWSH_WINGET_INSTALL_ARGS, type PwshInstallResult } from '../shared/pwsh-install'
import { refreshPwshAvailability } from './pwsh'
import { refreshDaemonPwshAvailability } from './daemon/daemon-session-inventory'

const WINGET_PROBE_TIMEOUT_MS = 15_000
// Why: the MSI download is ~100 MB and waits on a UAC prompt the user may leave open.
const WINGET_INSTALL_TIMEOUT_MS = 15 * 60_000
const FAILURE_MESSAGE_MAX_LENGTH = 300

type PwshInstallDeps = {
  platform?: NodeJS.Platform
  env?: NodeJS.ProcessEnv
  wingetAliasExists?: (path: string) => boolean
  run?: typeof runProcess
  refresh?: () => Promise<boolean>
  refreshDaemon?: () => Promise<void>
}

let installInFlight: { promise: Promise<PwshInstallResult>; controller: AbortController } | null =
  null

/** winget ships as a Store App Execution Alias; prefer its absolute path over a PATH lookup. */
export function resolveWingetProgram(
  env: NodeJS.ProcessEnv,
  aliasExists: (path: string) => boolean = existsSync
): string {
  const localAppData = env.LOCALAPPDATA ?? env.LocalAppData
  if (localAppData) {
    const alias = pathWin32.join(localAppData, 'Microsoft', 'WindowsApps', 'winget.exe')
    if (aliasExists(alias)) {
      return alias
    }
  }
  return 'winget.exe'
}

/** Last readable line of winget's output; its spinner and progress bars are noise. */
export function summarizeWingetFailure(
  stdout: string,
  stderr: string,
  code: number | null
): string {
  const lines = `${stdout}\n${stderr}`
    .split(/[\r\n]+/)
    .map((line) => line.replace(/\p{Cc}/gu, '').trim())
    .filter((line) => /\p{L}{3,}/u.test(line))
  const exitCode = code === null ? '' : ` (exit code 0x${(code >>> 0).toString(16).toUpperCase()})`
  const detail = lines.at(-1) ?? 'winget did not report a reason'
  return `${detail}${exitCode}`.slice(0, FAILURE_MESSAGE_MAX_LENGTH)
}

async function runInstall(signal: AbortSignal, deps: PwshInstallDeps): Promise<PwshInstallResult> {
  const run = deps.run ?? runProcess
  const refresh = deps.refresh ?? refreshPwshAvailability
  const refreshDaemon = deps.refreshDaemon ?? refreshDaemonPwshAvailability
  const program = resolveWingetProgram(deps.env ?? process.env, deps.wingetAliasExists)

  try {
    const probe = await run({ program, args: ['--version'], timeoutMs: WINGET_PROBE_TIMEOUT_MS })
    if (probe.timedOut || probe.code !== 0) {
      return { status: 'winget-unavailable' }
    }
  } catch {
    return { status: 'winget-unavailable' }
  }
  if (signal.aborted) {
    return { status: 'cancelled' }
  }

  let result
  try {
    result = await run({
      program,
      args: PWSH_WINGET_INSTALL_ARGS,
      timeoutMs: WINGET_INSTALL_TIMEOUT_MS,
      signal
    })
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
  if (signal.aborted) {
    return { status: 'cancelled' }
  }

  const pwshAvailable = await refresh().catch(() => false)
  if (result.code === 0 || pwshAvailable) {
    // Why: the daemon spawns terminals with its own cached probe; without this it keeps 5.1 for up to 30s.
    await refreshDaemon().catch(() => undefined)
    // Why: winget exits non-zero for "already installed", which is still the outcome the user wanted.
    return { status: 'installed', pwshAvailable }
  }
  if (result.timedOut) {
    return { status: 'timed-out' }
  }
  return {
    status: 'failed',
    message: summarizeWingetFailure(result.stdout, result.stderr, result.code)
  }
}

/** Install PowerShell 7 on this (local) Windows machine with winget; concurrent calls share one run. */
export function installPwshWithWinget(deps: PwshInstallDeps = {}): Promise<PwshInstallResult> {
  if ((deps.platform ?? process.platform) !== 'win32') {
    return Promise.resolve({ status: 'unsupported' })
  }
  if (installInFlight) {
    return installInFlight.promise
  }
  const controller = new AbortController()
  const promise = runInstall(controller.signal, deps).finally(() => {
    installInFlight = null
  })
  installInFlight = { promise, controller }
  return promise
}

export function cancelPwshInstall(): void {
  installInFlight?.controller.abort()
}
