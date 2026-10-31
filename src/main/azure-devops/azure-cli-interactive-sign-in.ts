import type { BrowserWindow } from 'electron'
import type { AzureCliSignInMode, AzureCliSignInResult } from '../../shared/azure-devops-auth'
import { runProcess, type ProcessResult } from '../../shared/child-process/run-process'
import { resolveAzureCliProgram, runAzureCliJson } from './azure-cli-runner'
import { notifyAzureCliSessionRenewed, setAzureCliSignInState } from './azure-cli-sign-in-notice'
import {
  parseMicrosoftSignInUrl,
  prepareSignInUrlCapture,
  readLoopbackRedirectPort,
  SYSTEM_BROWSER_HINT,
  type SignInUrlCapture
} from './azure-cli-sign-in-url-capture'
import {
  openAzureDevOpsSignInWindow,
  type AzureDevOpsSignInWindow
} from './azure-devops-sign-in-window'

// Why long: `az login` waits for the user to finish the browser sign-in.
const LOGIN_TIMEOUT_MS = 5 * 60_000
const MAX_ERROR_LENGTH = 300

export const SIGN_IN_CANCELLED = 'cancelled'

type Attempt = {
  controller: AbortController
  cancelled: boolean
  captureFailure: string | null
  window: AzureDevOpsSignInWindow | null
}

let inFlight: Promise<AzureCliSignInResult> | null = null
let activeAttempt: Attempt | null = null

async function readTenantId(): Promise<string | null> {
  try {
    const raw = await runAzureCliJson(['account', 'show'])
    const tenant = raw && typeof raw === 'object' && 'tenantId' in raw ? raw.tenantId : null
    return typeof tenant === 'string' && tenant ? tenant : null
  } catch {
    return null
  }
}

function cancelAttempt(attempt: Attempt): void {
  attempt.cancelled = true
  attempt.controller.abort()
}

function failCapture(attempt: Attempt, message: string): void {
  attempt.captureFailure = `${message} ${SYSTEM_BROWSER_HINT}`
  attempt.controller.abort()
}

async function openCapturedSignIn(
  attempt: Attempt,
  capture: SignInUrlCapture,
  exit: Promise<ProcessResult>,
  parent: BrowserWindow | null
): Promise<void> {
  const stopPolling = new AbortController()
  let exited = false
  const onExit = (): void => {
    exited = true
    stopPolling.abort()
  }
  exit.then(onExit, onExit)
  attempt.controller.signal.addEventListener('abort', () => stopPolling.abort(), { once: true })
  const raw = await capture.waitForUrl(stopPolling.signal)
  if (exited || attempt.controller.signal.aborted) {
    return
  }
  if (raw === null) {
    failCapture(attempt, 'The Azure sign-in page did not open in time.')
    return
  }
  const url = parseMicrosoftSignInUrl(raw)
  if (!url) {
    failCapture(attempt, 'Azure CLI asked to open an unexpected sign-in address.')
    return
  }
  attempt.window = openAzureDevOpsSignInWindow({
    url: url.href,
    redirectPort: readLoopbackRedirectPort(url),
    parent,
    onClosedByUser: () => cancelAttempt(attempt)
  })
}

function describeExitFailure(result: ProcessResult): string {
  if (result.timedOut) {
    return 'Azure sign-in timed out.'
  }
  const lastLine = result.stderr.trim().split(/\r?\n/).at(-1)?.trim()
  return (lastLine || `az login exited with code ${result.code}`).slice(0, MAX_ERROR_LENGTH)
}

function finish(result: AzureCliSignInResult, attempt: Attempt): AzureCliSignInResult {
  if (result.ok) {
    setAzureCliSignInState({ kind: 'idle' })
    notifyAzureCliSessionRenewed()
  } else if (attempt.cancelled) {
    setAzureCliSignInState({ kind: 'required' })
  } else {
    setAzureCliSignInState({ kind: 'failed', error: result.error })
  }
  return result
}

async function runSignIn(
  mode: AzureCliSignInMode,
  attempt: Attempt,
  parent: BrowserWindow | null
): Promise<AzureCliSignInResult> {
  let capture: SignInUrlCapture | null = null
  try {
    const cli = await resolveAzureCliProgram()
    if (!cli) {
      return { ok: false, error: 'Azure CLI (az) is not installed or not on PATH' }
    }
    // Why tenant: keeps the renewed session on the directory the user originally chose.
    const tenant = await readTenantId()
    if (attempt.cancelled) {
      return { ok: false, error: SIGN_IN_CANCELLED }
    }
    capture = mode === 'in-app' ? await prepareSignInUrlCapture(process.execPath) : null
    const exit = runProcess({
      program: cli.program,
      args: [
        ...cli.prefixArgs,
        'login',
        ...(tenant ? ['--tenant', tenant] : []),
        '--output',
        'none'
      ],
      env: { ...cli.env, ...capture?.env },
      timeoutMs: LOGIN_TIMEOUT_MS,
      signal: attempt.controller.signal,
      // Why: az keeps its loopback listener alive until killed, so cancel must end the tree.
      terminationBarrier: true
    })
    if (capture) {
      await openCapturedSignIn(attempt, capture, exit, parent)
    }
    const result = await exit
    if (attempt.cancelled) {
      return { ok: false, error: SIGN_IN_CANCELLED }
    }
    if (attempt.captureFailure) {
      return { ok: false, error: attempt.captureFailure }
    }
    return result.code === 0 && !result.timedOut
      ? { ok: true }
      : { ok: false, error: describeExitFailure(result) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    attempt.window?.close()
    await capture?.dispose().catch(() => undefined)
  }
}

/** Runs `az login` after the user asked for it. Single-flight: a second call joins the first. */
export function startAzureCliSignIn(
  mode: AzureCliSignInMode,
  options: { parent?: BrowserWindow | null } = {}
): Promise<AzureCliSignInResult> {
  if (inFlight) {
    return inFlight
  }
  const attempt: Attempt = {
    controller: new AbortController(),
    cancelled: false,
    captureFailure: null,
    window: null
  }
  activeAttempt = attempt
  setAzureCliSignInState({ kind: 'signing-in', mode })
  inFlight = runSignIn(mode, attempt, options.parent ?? null)
    .then((result) => finish(result, attempt))
    .finally(() => {
      inFlight = null
      activeAttempt = null
    })
  return inFlight
}

export function cancelAzureCliSignIn(): void {
  if (activeAttempt) {
    cancelAttempt(activeAttempt)
  }
}

/** @internal - tests need a clean single-flight slot between cases. */
export function _resetAzureCliInteractiveSignIn(): void {
  inFlight = null
  activeAttempt = null
}
