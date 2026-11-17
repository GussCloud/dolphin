import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessResult, ProcessSpec } from '../../shared/child-process/run-process'
import {
  _resetAzureCliDeviceCodeEvents,
  type AzureCliDeviceCodeOutcome,
  type AzureCliDeviceCodePrompt,
  onAzureCliDeviceCodeOutcome,
  onAzureCliDeviceCodePrompt,
  registerAzureCliDeviceCodeChannel
} from './azure-cli-device-code-events'
import { isAzureCliSignInLapse, redactDeviceCode } from './azure-cli-device-code-sign-in'
import {
  _resetAzureCliInteractiveSignIn,
  cancelAzureCliSignIn,
  handleAzureCliSessionLapsed,
  runAzureCliManagedSignIn,
  startAzureCliSignIn
} from './azure-cli-interactive-sign-in'
import {
  _resetAzureCliSignInNotice,
  getAzureCliSignInState,
  noticeAzureCliSessionWorking
} from './azure-cli-sign-in-notice'

const mocks = vi.hoisted(() => ({
  resolveProgram: vi.fn(),
  runAzureCli: vi.fn(),
  runAzureCliJson: vi.fn(),
  runProcess: vi.fn(),
  noticeEnabled: vi.fn()
}))

vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: () => ({
    method: 'azure-cli',
    autoRenewCliSession: mocks.noticeEnabled()
  })
}))
vi.mock('./azure-cli-session-store', () => ({ getAzureCliTokenExpiresAt: () => 1 }))
vi.mock('./azure-cli-runner', () => ({
  resolveAzureCliProgram: mocks.resolveProgram,
  runAzureCli: mocks.runAzureCli,
  runAzureCliJson: mocks.runAzureCliJson
}))
vi.mock('../../shared/child-process/run-process', () => ({ runProcess: mocks.runProcess }))
vi.mock('./azure-cli-sign-in-url-capture', () => ({ prepareSignInUrlCapture: vi.fn() }))
vi.mock('./azure-devops-sign-in-window', () => ({ openAzureDevOpsSignInWindow: vi.fn() }))

const LAPSE =
  "ERROR: AADSTS70043: The refresh token has expired due to inactivity. Please run 'az login'.\n"
const PROMPT_LINE =
  'To sign in, use a web browser to open the page https://login.microsoft.com/device and enter the code FU3HPB3RT to authenticate.\n'

type FakeAz = { spec: ProcessSpec; exit: (result: Partial<ProcessResult>) => void }

let launches: FakeAz[] = []

function result(partial: Partial<ProcessResult>): ProcessResult {
  return { code: 0, signal: null, stdout: '', stderr: '', timedOut: false, ...partial }
}

beforeEach(() => {
  _resetAzureCliInteractiveSignIn()
  _resetAzureCliSignInNotice()
  _resetAzureCliDeviceCodeEvents()
  vi.clearAllMocks()
  launches = []
  mocks.noticeEnabled.mockReturnValue(true)
  mocks.resolveProgram.mockResolvedValue({ program: 'az', prefixArgs: [], env: {} })
  mocks.runAzureCliJson.mockResolvedValue({ tenantId: 'tenant-1', id: 'sub-dev' })
  mocks.runAzureCli.mockResolvedValue(result({}))
  mocks.runProcess.mockImplementation(
    (spec: ProcessSpec) =>
      new Promise<ProcessResult>((resolve) => {
        launches.push({ spec, exit: (partial) => resolve(result(partial)) })
        spec.signal?.addEventListener('abort', () => resolve(result({ code: null })))
      })
  )
})

afterEach(() => {
  vi.useRealTimers()
})

async function untilAzStarted(count = 1): Promise<FakeAz> {
  await vi.waitFor(() => expect(launches).toHaveLength(count))
  const started = launches.at(-1)
  if (!started) {
    throw new Error('az did not start')
  }
  return started
}

function recordEvents(): {
  prompts: AzureCliDeviceCodePrompt[]
  outcomes: AzureCliDeviceCodeOutcome[]
} {
  const prompts: AzureCliDeviceCodePrompt[] = []
  const outcomes: AzureCliDeviceCodeOutcome[] = []
  onAzureCliDeviceCodePrompt((prompt) => prompts.push(prompt))
  onAzureCliDeviceCodeOutcome((outcome) => outcomes.push(outcome))
  return { prompts, outcomes }
}

describe('isAzureCliSignInLapse', () => {
  it('starts a sign-in only for an auth refusal that is not a network failure', () => {
    expect(isAzureCliSignInLapse(LAPSE)).toBe(true)
    expect(isAzureCliSignInLapse('ERROR: interaction_required')).toBe(true)
    expect(isAzureCliSignInLapse('ERROR: invalid_grant')).toBe(true)
    expect(isAzureCliSignInLapse("ERROR: Please run 'az login' to setup account.")).toBe(true)
    for (const network of [
      "HTTPSConnectionPool(host='login.microsoftonline.com', port=443): Max retries exceeded. Please run 'az login'",
      'Failed to resolve login.microsoftonline.com: getaddrinfo ENOTFOUND (AADSTS)',
      'ConnectionError: invalid_grant',
      "The request timed out. Please run 'az login'"
    ]) {
      expect(isAzureCliSignInLapse(network), network).toBe(false)
    }
    expect(isAzureCliSignInLapse("ERROR: 'devops' is misspelled or not recognized")).toBe(false)
    expect(isAzureCliSignInLapse('')).toBe(false)
  })
})

describe('redactDeviceCode', () => {
  it('removes the published code and any prompt-shaped code', () => {
    expect(redactDeviceCode(PROMPT_LINE, 'FU3HPB3RT')).not.toContain('FU3HPB3RT')
    expect(redactDeviceCode('enter the code ABCD1234 now', null)).toBe('enter the code ••• now')
  })
})

describe('startAzureCliSignIn device-code', () => {
  it('publishes the parsed code, then the renewal, and restores the default subscription', async () => {
    const events = recordEvents()
    const pending = startAzureCliSignIn('device-code')
    expect(getAzureCliSignInState()).toEqual({ kind: 'signing-in', mode: 'device-code' })
    const az = await untilAzStarted()
    expect(az.spec.args).toEqual([
      'login',
      '--tenant',
      'tenant-1',
      '--use-device-code',
      '--output',
      'none'
    ])
    expect(az.spec.timeoutMs).toBe(16 * 60_000)
    az.spec.onStderr?.(PROMPT_LINE.slice(0, 109))
    expect(events.prompts).toEqual([])
    az.spec.onStderr?.(PROMPT_LINE.slice(109))
    expect(events.prompts).toEqual([
      {
        attemptId: expect.any(String),
        verificationUrl: 'https://login.microsoft.com/device',
        userCode: 'FU3HPB3RT',
        expiresAtMs: expect.any(Number)
      }
    ])
    expect(getAzureCliSignInState()).toEqual({
      kind: 'signing-in',
      mode: 'device-code',
      deviceCode: {
        verificationUrl: 'https://login.microsoft.com/device',
        userCode: 'FU3HPB3RT',
        expiresAtMs: events.prompts[0]?.expiresAtMs
      }
    })
    az.exit({ code: 0 })
    await expect(pending).resolves.toEqual({ ok: true })
    expect(mocks.runAzureCli).toHaveBeenCalledWith(['account', 'set', '--subscription', 'sub-dev'])
    expect(events.outcomes).toEqual([
      { attemptId: events.prompts[0]?.attemptId, outcome: 'renewed' }
    ])
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
  })

  it('reports az exiting on its own at the code lifetime as expired', async () => {
    const events = recordEvents()
    const pending = startAzureCliSignIn('device-code')
    const az = await untilAzStarted()
    az.spec.onStderr?.(PROMPT_LINE)
    // Shape az 2.92 prints when MSAL's device-flow poll is still pending at expiry.
    az.exit({
      code: 1,
      stderr:
        `${PROMPT_LINE}ERROR: AADSTS70016: OAuth 2.0 device flow error. Authorization is pending.\n` +
        'Run the command below to authenticate interactively; additional arguments may be added as needed:\n' +
        'az login\n'
    })
    await pending
    expect(events.outcomes).toMatchObject([{ outcome: 'expired' }])
  })

  it('describes a failure by its ERROR line, not the trailing az login hint', async () => {
    const pending = startAzureCliSignIn('system-browser')
    const az = await untilAzStarted()
    az.exit({
      code: 1,
      stderr: 'ERROR: AADSTS50076: MFA required.\nRun the command below:\naz login\n'
    })
    await expect(pending).resolves.toEqual({
      ok: false,
      error: 'ERROR: AADSTS50076: MFA required.'
    })
  })

  it('reports an unused code as expired and leaves the notice failed', async () => {
    const events = recordEvents()
    const pending = startAzureCliSignIn('device-code')
    const az = await untilAzStarted()
    az.spec.onStderr?.(PROMPT_LINE)
    az.exit({
      code: 1,
      stderr: `${PROMPT_LINE}ERROR: AADSTS70020: This device code has expired.\n`
    })
    await expect(pending).resolves.toMatchObject({
      ok: false,
      error: expect.stringMatching(/expired/)
    })
    expect(events.outcomes).toMatchObject([{ outcome: 'expired' }])
    expect(getAzureCliSignInState().kind).toBe('failed')
    expect(mocks.runAzureCli).not.toHaveBeenCalled()
  })

  it('keeps the code out of a failure reason taken from the prompt line', async () => {
    const events = recordEvents()
    const pending = startAzureCliSignIn('device-code')
    const az = await untilAzStarted()
    az.spec.onStderr?.(PROMPT_LINE)
    az.exit({ code: 1, stderr: PROMPT_LINE })
    const outcome = await pending
    expect(events.outcomes).toMatchObject([{ outcome: 'failed' }])
    expect(events.outcomes[0]?.error).toContain('login.microsoft.com/device')
    expect(events.outcomes[0]?.error).not.toContain('FU3HPB3RT')
    expect(JSON.stringify(outcome)).not.toContain('FU3HPB3RT')
    expect(JSON.stringify(getAzureCliSignInState())).not.toContain('FU3HPB3RT')
  })

  it('reports a cancel and kills az', async () => {
    const events = recordEvents()
    const pending = startAzureCliSignIn('device-code')
    const az = await untilAzStarted()
    az.spec.onStderr?.(PROMPT_LINE)
    cancelAzureCliSignIn()
    await expect(pending).resolves.toEqual({ ok: false, error: 'cancelled' })
    expect(az.spec.signal?.aborted).toBe(true)
    expect(events.outcomes).toMatchObject([{ outcome: 'cancelled' }])
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
  })

  it('fails when az never prints a code', async () => {
    vi.useFakeTimers()
    const events = recordEvents()
    const pending = startAzureCliSignIn('device-code')
    const az = await untilAzStarted()
    vi.advanceTimersByTime(59_000)
    expect(az.spec.signal?.aborted).toBe(false)
    vi.advanceTimersByTime(1_000)
    await expect(pending).resolves.toEqual({
      ok: false,
      error: 'Azure CLI did not show a sign-in code in time.'
    })
    expect(az.spec.signal?.aborted).toBe(true)
    expect(events.prompts).toEqual([])
    expect(events.outcomes).toEqual([])
  })

  it('is refused for a managed account', async () => {
    const outcome = await runAzureCliManagedSignIn('device-code', '/tmp/managed')
    expect(outcome.ok).toBe(false)
    expect(mocks.runProcess).not.toHaveBeenCalled()
  })
})

describe('subscription restore', () => {
  it('restores the default subscription after a browser sign-in too', async () => {
    const pending = startAzureCliSignIn('system-browser')
    ;(await untilAzStarted()).exit({ code: 0 })
    await expect(pending).resolves.toEqual({ ok: true })
    expect(mocks.runAzureCli).toHaveBeenCalledWith(['account', 'set', '--subscription', 'sub-dev'])
  })

  it('still reports success when the restore fails', async () => {
    mocks.runAzureCli.mockRejectedValue(new Error('boom'))
    const pending = startAzureCliSignIn('system-browser')
    ;(await untilAzStarted()).exit({ code: 0 })
    await expect(pending).resolves.toEqual({ ok: true })
  })
})

describe('identity check', () => {
  const me = { name: 'me@contoso.com', type: 'user' }
  const other = { name: 'other@contoso.com', type: 'user' }

  // az answers `account show` with `shown` in turn, and `account list --all` with `listed`.
  function azAccounts(shown: { name: string; type: string }[], listed = [me]): void {
    const queue = [...shown]
    mocks.runAzureCliJson.mockImplementation(async (args: readonly string[]) =>
      args[1] === 'list'
        ? listed.map((user) => ({ id: 'sub-x', user }))
        : { tenantId: 'tenant-1', id: 'sub-dev', user: queue.shift() ?? shown.at(-1) }
    )
  }

  async function deviceCodeSignIn(): Promise<{
    outcome: Awaited<ReturnType<typeof startAzureCliSignIn>>
    events: ReturnType<typeof recordEvents>
  }> {
    const events = recordEvents()
    const pending = startAzureCliSignIn('device-code')
    const az = await untilAzStarted()
    az.spec.onStderr?.(PROMPT_LINE)
    az.exit({ code: 0 })
    return { outcome: await pending, events }
  }

  it('signs out an account new to az and never reports a renewal', async () => {
    azAccounts([me, other])
    const { outcome, events } = await deviceCodeSignIn()
    expect(outcome).toEqual({ ok: false, error: expect.stringMatching(/signed it out again/) })
    expect(mocks.runAzureCli).toHaveBeenCalledWith(['logout', '--username', 'other@contoso.com'])
    expect(mocks.runAzureCli).not.toHaveBeenCalledWith(expect.arrayContaining(['account', 'set']))
    expect(events.outcomes).toMatchObject([{ outcome: 'failed' }])
    expect(getAzureCliSignInState().kind).toBe('failed')
  })

  it('keeps an account the user already had, and still fails', async () => {
    azAccounts([me, other], [me, { name: 'Other@contoso.com', type: 'user' }])
    const { outcome, events } = await deviceCodeSignIn()
    expect(outcome).toEqual({ ok: false, error: expect.stringMatching(/different Azure account/) })
    expect(mocks.runAzureCli).not.toHaveBeenCalledWith(expect.arrayContaining(['logout']))
    expect(events.outcomes).toMatchObject([{ outcome: 'failed' }])
  })

  it('signs nothing out when the known accounts could not be read', async () => {
    azAccounts([me, other])
    const listed = mocks.runAzureCliJson.getMockImplementation()
    mocks.runAzureCliJson.mockImplementation(async (args: readonly string[]) => {
      if (args[1] === 'list') {
        throw new Error('az failed')
      }
      return listed?.(args)
    })
    const { outcome } = await deviceCodeSignIn()
    expect(outcome.ok).toBe(false)
    expect(mocks.runAzureCli).not.toHaveBeenCalledWith(expect.arrayContaining(['logout']))
  })

  it('accepts the same account regardless of case', async () => {
    azAccounts([me, { name: 'ME@contoso.com', type: 'user' }])
    const { outcome, events } = await deviceCodeSignIn()
    expect(outcome).toEqual({ ok: true })
    expect(events.outcomes).toMatchObject([{ outcome: 'renewed' }])
    expect(mocks.runAzureCli).not.toHaveBeenCalledWith(expect.arrayContaining(['logout']))
  })

  it('lets a browser sign-in switch accounts', async () => {
    azAccounts([me, other])
    const pending = startAzureCliSignIn('system-browser')
    ;(await untilAzStarted()).exit({ code: 0 })
    await expect(pending).resolves.toEqual({ ok: true })
    expect(mocks.runAzureCli).not.toHaveBeenCalledWith(expect.arrayContaining(['logout']))
    expect(mocks.runAzureCliJson).not.toHaveBeenCalledWith(['account', 'list', '--all'])
  })
})

describe('handleAzureCliSessionLapsed', () => {
  it('starts one device-code sign-in per lapse when a phone channel is up', async () => {
    registerAzureCliDeviceCodeChannel(() => true)
    handleAzureCliSessionLapsed(LAPSE)
    const first = await untilAzStarted()
    expect(first.spec.args).toContain('--use-device-code')
    first.exit({ code: 1, stderr: 'ERROR: AADSTS70020: expired\n' })
    await vi.waitFor(() => expect(getAzureCliSignInState().kind).toBe('failed'))
    // The user retries from the notice and backs out, which leaves the notice up again.
    const retry = startAzureCliSignIn('system-browser')
    await untilAzStarted(2)
    cancelAzureCliSignIn()
    await retry
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
    const accountReads = mocks.runAzureCliJson.mock.calls.length
    handleAzureCliSessionLapsed(LAPSE)
    // An automatic start reads `az account show` synchronously, so no new read means none began.
    expect(mocks.runAzureCliJson.mock.calls.length).toBe(accountReads)
  })

  it('does not retry after a cancelled automatic attempt', async () => {
    registerAzureCliDeviceCodeChannel(() => true)
    handleAzureCliSessionLapsed(LAPSE)
    await untilAzStarted()
    cancelAzureCliSignIn()
    await vi.waitFor(() => expect(getAzureCliSignInState()).toEqual({ kind: 'required' }))
    const accountReads = mocks.runAzureCliJson.mock.calls.length
    handleAzureCliSessionLapsed(LAPSE)
    expect(mocks.runAzureCliJson.mock.calls.length).toBe(accountReads)
  })

  it('tries again on the next lapse once a token worked', async () => {
    registerAzureCliDeviceCodeChannel(() => true)
    handleAzureCliSessionLapsed(LAPSE)
    ;(await untilAzStarted()).exit({ code: 1, stderr: 'ERROR: denied\n' })
    await vi.waitFor(() => expect(getAzureCliSignInState().kind).toBe('failed'))
    noticeAzureCliSessionWorking()
    handleAzureCliSessionLapsed(LAPSE)
    await untilAzStarted(2)
  })

  it('only raises the notice for an offline host', async () => {
    registerAzureCliDeviceCodeChannel(() => true)
    handleAzureCliSessionLapsed(
      "ERROR: HTTPSConnectionPool(host='login.microsoftonline.com'): Max retries exceeded. Please run 'az login'"
    )
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
    expect(mocks.runAzureCliJson).not.toHaveBeenCalled()
  })

  it('does not sign back in after az logout', async () => {
    registerAzureCliDeviceCodeChannel(() => true)
    mocks.runAzureCliJson.mockRejectedValue(new Error("Please run 'az login' to setup account."))
    handleAzureCliSessionLapsed(LAPSE)
    await vi.waitFor(() => expect(mocks.runAzureCliJson).toHaveBeenCalledOnce())
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(mocks.runProcess).not.toHaveBeenCalled()
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
  })

  it('only raises the notice without a phone channel', async () => {
    registerAzureCliDeviceCodeChannel(() => false)
    handleAzureCliSessionLapsed(LAPSE)
    await Promise.resolve()
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
    expect(mocks.runProcess).not.toHaveBeenCalled()
    expect(mocks.resolveProgram).not.toHaveBeenCalled()
  })

  it('does nothing when the user turned the notice off', async () => {
    mocks.noticeEnabled.mockReturnValue(false)
    registerAzureCliDeviceCodeChannel(() => true)
    handleAzureCliSessionLapsed(LAPSE)
    await Promise.resolve()
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
    expect(mocks.resolveProgram).not.toHaveBeenCalled()
  })
})
