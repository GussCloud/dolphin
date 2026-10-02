import { homedir } from 'node:os'
import { runProcess, type ProcessResult } from '../../shared/child-process/run-process'
import { OPENOBSERVE_CLI_COMMAND } from '../../shared/openobserve-cli'
import { resolveCommandOnLocalPath } from '../ipc/command-path-resolver'
import { buildLocalPreflightEnv } from '../ipc/preflight-local-env'

// Why generous: the npm install starts through a node shim before the Go binary.
const OPENOBSERVE_COMMAND_TIMEOUT_MS = 20_000

export class OpenObserveCliNotInstalledError extends Error {
  constructor() {
    super('openobserve-cli is not installed or not on PATH')
    this.name = 'OpenObserveCliNotInstalledError'
  }
}

function openObserveCliEnv(): NodeJS.ProcessEnv {
  return {
    ...(buildLocalPreflightEnv() ?? process.env),
    // Why: notices are written next to the JSON and are noise for a status probe.
    OPENOBSERVE_CLI_NO_UPDATE_NOTIFIER: '1',
    OPENOBSERVE_CLI_NO_SKILL_HINT: '1',
    OPENOBSERVE_FORMAT: 'json'
  }
}

export async function resolveOpenObserveCliProgram(): Promise<{
  program: string
  env: NodeJS.ProcessEnv
} | null> {
  const env = openObserveCliEnv()
  const program = await resolveCommandOnLocalPath(OPENOBSERVE_CLI_COMMAND, {
    env
  })
  return program ? { program, env } : null
}

export async function runOpenObserveCli(args: readonly string[]): Promise<ProcessResult> {
  const cli = await resolveOpenObserveCliProgram()
  if (!cli) {
    throw new OpenObserveCliNotInstalledError()
  }
  return runProcess({
    program: cli.program,
    args,
    env: cli.env,
    // Why: the CLI reads a `.env` from its cwd, which would silently override the
    // user's config with whatever project Dolphin happened to start in.
    cwd: homedir(),
    timeoutMs: OPENOBSERVE_COMMAND_TIMEOUT_MS
  })
}

/** Reads the CLI's structured stderr error (`{error: {message, hint}}`) when present. */
export function readOpenObserveCliError(result: ProcessResult): string {
  if (result.timedOut) {
    return 'openobserve-cli timed out'
  }
  try {
    const parsed: unknown = JSON.parse(result.stderr)
    const error =
      parsed && typeof parsed === 'object' && 'error' in parsed ? parsed.error : undefined
    if (error && typeof error === 'object') {
      const message = 'message' in error && typeof error.message === 'string' ? error.message : ''
      const hint = 'hint' in error && typeof error.hint === 'string' ? error.hint : ''
      if (message) {
        return hint ? `${message}. ${hint}` : message
      }
    }
  } catch {
    // Not the CLI's JSON envelope; fall back to the raw text below.
  }
  return result.stderr.trim() || `openobserve-cli exited with code ${result.code}`
}

export function parseOpenObserveCliJson(result: ProcessResult): unknown {
  if (result.code !== 0 || result.timedOut) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(result.stdout)
    return parsed
  } catch {
    return null
  }
}
