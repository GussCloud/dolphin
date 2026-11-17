import type { BrowserWindow } from 'electron'
import type { AzureCliSignInMode, AzureCliSignInResult } from '../../shared/azure-devops-auth'
import { runProcess, type ProcessResult } from '../../shared/child-process/run-process'
import {
  DEVICE_CODE_LOGIN_TIMEOUT_MS,
  isDeviceCodeExpiry,
  redactDeviceCode,
  reportAzureCliDeviceCodeOutcome,
  watchAzureCliDeviceCodePrompt,
  type DeviceCodeWatch
} from './azure-cli-device-code-sign-in'
import {
  readCurrentAzureCliAccount,
  readKnownAzureCliUsers,
  rejectDifferentAzureCliUser,
  restoreDefaultAzureCliSubscription
} from './azure-cli-account-continuity'
import { resolveAzureCliProgram } from './azure-cli-runner'
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
  deviceCode: DeviceCodeWatch | null
  deviceCodeExpired: boolean
}

let inFlight: Promise<AzureCliSignInResult> | null = null
let activeAttempt: Attempt | null = null

function newAttempt(): Attempt {
  return {
    controller: new AbortController(),
    cancelled: false,
    captureFailure: null,
    window: null,
    deviceCode: null,
    deviceCodeExpired: false
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

function describeExitFailure(result: ProcessResult, attempt: Attempt): string {
  if (attempt.deviceCodeExpired) {
    return 'The Azure sign-in code expired before it was used.'
  }
  if (result.timedOut) {
    return 'Azure sign-in timed out.'
  }
  const lines = result.stderr
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  // Why: az ends an error with recommendation lines whose last one is a bare `az login`.
  const reason = lines.findLast((line) => line.startsWith('ERROR:')) ?? lines.at(-1)
  return (reason || `az login exited with code ${result.code}`).slice(0, MAX_ERROR_LENGTH)
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
  parent: BrowserWindow | null,
  configDir?: string
): Promise<AzureCliSignInResult> {
  let capture: SignInUrlCapture | null = null
  try {
    const cli = await resolveAzureCliProgram()
    if (!cli) {
      return { ok: false, error: 'Azure CLI (az) is not installed or not on PATH' }
    }
    // Why tenant: keeps the renewed session on the directory the user originally chose.
    // A managed account starts from an empty config dir, so it has none to keep.
    const account = configDir ? null : await readCurrentAzureCliAccount()
    if (attempt.cancelled) {
      return { ok: false, error: SIGN_IN_CANCELLED }
    }
    capture = mode === 'in-app' ? await prepareSignInUrlCapture(process.execPath) : null
    const deviceCode = mode === 'device-code'
    // Why device-code only: a browser sign-in is chosen at the desk and may switch accounts.
    const identity =
      deviceCode && account?.user
        ? { user: account.user, knownUsers: await readKnownAzureCliUsers() }
        : null
    if (deviceCode) {
      attempt.deviceCode = watchAzureCliDeviceCodePrompt({
        // Why also on the desktop: a phone push can be delayed or suppressed.
        onPrompt: ({ verificationUrl, userCode, expiresAtMs }) =>
          setAzureCliSignInState({
            kind: 'signing-in',
            mode,
            deviceCode: { verificationUrl, userCode, expiresAtMs }
          }),
        onMissing: () => {
          attempt.captureFailure = 'Azure CLI did not show a sign-in code in time.'
          attempt.controller.abort()
        }
      })
    }
    const exit = runProcess({
      program: cli.program,
      args: [
        ...cli.prefixArgs,
        'login',
        ...(account?.tenantId ? ['--tenant', account.tenantId] : []),
        ...(deviceCode ? ['--use-device-code'] : []),
        // Why: Azure DevOps-only users often have no Azure subscription, which fails a plain login.
        ...(configDir ? ['--allow-no-subscriptions'] : []),
        '--output',
        'none'
      ],
      env: { ...cli.env, ...capture?.env, ...(configDir ? { AZURE_CONFIG_DIR: configDir } : {}) },
      timeoutMs: deviceCode ? DEVICE_CODE_LOGIN_TIMEOUT_MS : LOGIN_TIMEOUT_MS,
      signal: attempt.controller.signal,
      // Why: az keeps its loopback listener alive until killed, so cancel must end the tree.
      terminationBarrier: true,
      onStderr: attempt.deviceCode?.onStderr
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
    if (result.code !== 0 || result.timedOut) {
      attempt.deviceCodeExpired = deviceCode && isDeviceCodeExpiry(result.stderr, result.timedOut)
      return { ok: false, error: describeExitFailure(result, attempt) }
    }
    const identityError = identity
      ? await rejectDifferentAzureCliUser(identity.user, identity.knownUsers)
      : null
    if (identityError) {
      return { ok: false, error: identityError }
    }
    if (account?.subscriptionId) {
      await restoreDefaultAzureCliSubscription(account.subscriptionId)
    }
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  } finally {
    attempt.deviceCode?.dispose()
    attempt.window?.close()
    await capture?.dispose().catch(() => undefined)
  }
}

// Why one place: the desktop notice, the IPC caller and the phone relays all show this error.
function redactAttemptResult(result: AzureCliSignInResult, attempt: Attempt): AzureCliSignInResult {
  if (result.ok || !attempt.deviceCode) {
    return result
  }
  const userCode = attempt.deviceCode.publishedPrompt()?.userCode ?? null
  return { ok: false, error: redactDeviceCode(result.error, userCode) }
}

/** Runs `az login` for the user's own session. Single-flight: a second call joins the first. */
export function startAzureCliSignIn(
  mode: AzureCliSignInMode,
  options: { parent?: BrowserWindow | null } = {}
): Promise<AzureCliSignInResult> {
  if (inFlight) {
    return inFlight
  }
  const attempt = newAttempt()
  activeAttempt = attempt
  setAzureCliSignInState({ kind: 'signing-in', mode })
  inFlight = runSignIn(mode, attempt, options.parent ?? null)
    .then((raw) => {
      const result = redactAttemptResult(raw, attempt)
      finish(result, attempt)
      if (attempt.deviceCode) {
        reportAzureCliDeviceCodeOutcome(attempt.deviceCode, result, {
          cancelled: attempt.cancelled,
          expired: attempt.deviceCodeExpired
        })
      }
      return result
    })
    .finally(() => {
      inFlight = null
      activeAttempt = null
    })
  return inFlight
}

/** Registered with the lapse handler by main startup; skipped after `az logout`. */
export async function startAutomaticDeviceCodeSignIn(): Promise<void> {
  // Why: after `az logout` there is no session to renew, only one the user chose to end.
  if (!(await readCurrentAzureCliAccount())) {
    return
  }
  console.info('[azure-devops] starting an automatic device-code sign-in')
  await startAzureCliSignIn('device-code')
}

let managedAttempt: Attempt | null = null

/**
 * `az login` into an isolated config dir for a Dolphin-managed account. Separate from the
 * single-flight above: it must neither join nor change the user's own az session state.
 */
export async function runAzureCliManagedSignIn(
  mode: AzureCliSignInMode,
  configDir: string,
  options: { parent?: BrowserWindow | null } = {}
): Promise<AzureCliSignInResult> {
  if (managedAttempt) {
    return { ok: false, error: 'Another Azure DevOps account sign-in is already in progress.' }
  }
  // Why: the relays present a code as renewing the user's own session, not adding an account.
  if (mode === 'device-code') {
    return { ok: false, error: 'Device-code sign-in is not available for added accounts.' }
  }
  const attempt = newAttempt()
  managedAttempt = attempt
  try {
    return await runSignIn(mode, attempt, options.parent ?? null, configDir)
  } finally {
    managedAttempt = null
  }
}

export function cancelAzureCliSignIn(): void {
  if (activeAttempt) {
    cancelAttempt(activeAttempt)
  }
  if (managedAttempt) {
    cancelAttempt(managedAttempt)
  }
}

/** @internal - tests need a clean single-flight slot between cases. */
export function _resetAzureCliInteractiveSignIn(): void {
  inFlight = null
  activeAttempt = null
  managedAttempt = null
}
