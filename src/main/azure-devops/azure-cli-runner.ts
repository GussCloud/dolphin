import { existsSync } from 'node:fs'
import path from 'node:path'
import { runProcess, type ProcessResult } from '../../shared/child-process/run-process'
import { resolveCommandOnLocalPath } from '../ipc/command-path-resolver'
import { buildLocalPreflightEnv } from '../ipc/preflight-local-env'

// Why generous: az is a Python CLI and its cold start alone can take seconds on Windows.
const AZ_COMMAND_TIMEOUT_MS = 30_000

type AzureCliProgram = { program: string; prefixArgs: string[]; env: NodeJS.ProcessEnv }

export class AzureCliNotInstalledError extends Error {
  constructor() {
    super('Azure CLI (az) is not installed or not on PATH')
    this.name = 'AzureCliNotInstalledError'
  }
}

function azureCliEnv(): NodeJS.ProcessEnv {
  return {
    ...(buildLocalPreflightEnv() ?? process.env),
    // Why: a prompt would hang a headless child until the timeout.
    AZURE_CORE_ONLY_SHOW_ERRORS: 'true',
    AZURE_CORE_NO_COLOR: 'true',
    AZURE_CORE_SURVEY_MESSAGE: 'false',
    AZURE_EXTENSION_USE_DYNAMIC_INSTALL: 'no'
  }
}

// Why: the MSI's az.cmd only forwards to its bundled python; spawning that
// directly keeps cmd.exe out of the process tree (see windows-edr-posture.md).
function msiPythonProgram(azCmdPath: string, env: NodeJS.ProcessEnv): AzureCliProgram | null {
  if (!/\\wbin\\az\.cmd$/i.test(azCmdPath)) {
    return null
  }
  const python = path.win32.join(path.win32.dirname(azCmdPath), '..', 'python.exe')
  if (!existsSync(python)) {
    return null
  }
  return {
    program: path.win32.normalize(python),
    prefixArgs: ['-IBm', 'azure.cli'],
    env: { ...env, AZ_INSTALLER: 'MSI' }
  }
}

export async function resolveAzureCliProgram(): Promise<AzureCliProgram | null> {
  const env = azureCliEnv()
  const resolved = await resolveCommandOnLocalPath('az', { env })
  if (!resolved) {
    return null
  }
  if (process.platform !== 'win32') {
    return { program: resolved, prefixArgs: [], env }
  }
  const normalized = path.win32.normalize(resolved)
  return msiPythonProgram(normalized, env) ?? { program: normalized, prefixArgs: [], env }
}

export async function runAzureCli(
  args: readonly string[],
  options: { timeoutMs?: number } = {}
): Promise<ProcessResult> {
  const cli = await resolveAzureCliProgram()
  if (!cli) {
    throw new AzureCliNotInstalledError()
  }
  return runProcess({
    program: cli.program,
    args: [...cli.prefixArgs, ...args],
    env: cli.env,
    timeoutMs: options.timeoutMs ?? AZ_COMMAND_TIMEOUT_MS
  })
}

export class AzureCliCommandError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly result: ProcessResult
  ) {
    super(
      result.timedOut
        ? `az ${args[0] ?? ''} timed out`
        : result.stderr.trim() || `az ${args[0] ?? ''} exited with code ${result.code}`
    )
    this.name = 'AzureCliCommandError'
  }
}

/** Runs `az <args> --output json` and parses stdout; throws on a non-zero exit. */
export async function runAzureCliJson(
  args: readonly string[],
  options: { timeoutMs?: number } = {}
): Promise<unknown> {
  const fullArgs = [...args, '--output', 'json']
  const result = await runAzureCli(fullArgs, options)
  if (result.code !== 0 || result.timedOut) {
    throw new AzureCliCommandError(fullArgs, result)
  }
  const parsed: unknown = JSON.parse(result.stdout)
  return parsed
}
