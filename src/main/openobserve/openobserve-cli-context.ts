import {
  isValidOpenObserveContextName,
  parseOpenObserveSaveContextInput,
  type OpenObserveCommandResult,
  type OpenObserveSaveContextInput
} from '../../shared/openobserve-cli'
import { parseOpenObserveContexts } from './openobserve-cli-status'
import {
  parseOpenObserveCliJson,
  readOpenObserveCliError,
  runOpenObserveCli
} from './openobserve-cli-runner'

function failure(error: unknown): OpenObserveCommandResult {
  return {
    ok: false,
    error: error instanceof Error ? error.message : String(error)
  }
}

async function contextExists(name: string): Promise<boolean> {
  const result = await runOpenObserveCli(['config', 'contexts'])
  return parseOpenObserveContexts(parseOpenObserveCliJson(result)).some(
    (context) => context.name === name
  )
}

/**
 * Writes a credential-free context preset and activates it (`config set-context`).
 * Credentials are added afterwards by `auth login`, which owns the OS keychain.
 */
export async function saveOpenObserveContext(
  input: OpenObserveSaveContextInput
): Promise<OpenObserveCommandResult> {
  const parsed = parseOpenObserveSaveContextInput(input)
  if (!parsed.ok) {
    return { ok: false, error: `Invalid OpenObserve ${parsed.field}` }
  }
  const { name, baseUrl, org, authScheme } = parsed.value
  try {
    // Why: editing an existing context from the form is an explicit overwrite; the
    // CLI still preserves the stored identity and credential.
    const overwrite = (await contextExists(name)) ? ['--overwrite'] : []
    const result = await runOpenObserveCli([
      'config',
      'set-context',
      name,
      '--base-url',
      baseUrl,
      '--org',
      org,
      '--auth-scheme',
      authScheme,
      '--activate',
      ...overwrite
    ])
    return result.code === 0 && !result.timedOut
      ? { ok: true }
      : { ok: false, error: readOpenObserveCliError(result) }
  } catch (error) {
    return failure(error)
  }
}

export async function activateOpenObserveContext(name: string): Promise<OpenObserveCommandResult> {
  if (!isValidOpenObserveContextName(name)) {
    return { ok: false, error: 'Invalid OpenObserve context name' }
  }
  try {
    const result = await runOpenObserveCli(['config', 'use-context', name])
    return result.code === 0 && !result.timedOut
      ? { ok: true }
      : { ok: false, error: readOpenObserveCliError(result) }
  } catch (error) {
    return failure(error)
  }
}
