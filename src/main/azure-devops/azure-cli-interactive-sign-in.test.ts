import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as UrlCapture from './azure-cli-sign-in-url-capture'
import type { ProcessResult, ProcessSpec } from '../../shared/child-process/run-process'
import {
  _resetAzureCliInteractiveSignIn,
  cancelAzureCliSignIn,
  startAzureCliSignIn
} from './azure-cli-interactive-sign-in'
import {
  _resetAzureCliSignInNotice,
  getAzureCliSignInState,
  onAzureCliSessionRenewed
} from './azure-cli-sign-in-notice'

const mocks = vi.hoisted(() => ({
  resolveProgram: vi.fn(),
  runAzureCliJson: vi.fn(),
  runProcess: vi.fn(),
  prepareCapture: vi.fn(),
  waitForUrl: vi.fn(),
  dispose: vi.fn(),
  openWindow: vi.fn(),
  closeWindow: vi.fn()
}))

vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: () => ({ method: 'azure-cli', autoRenewCliSession: true })
}))
vi.mock('./azure-cli-session-store', () => ({ getAzureCliTokenExpiresAt: () => 1 }))
vi.mock('./azure-cli-runner', () => ({
  resolveAzureCliProgram: mocks.resolveProgram,
  runAzureCliJson: mocks.runAzureCliJson
}))
vi.mock('../../shared/child-process/run-process', () => ({ runProcess: mocks.runProcess }))
vi.mock('./azure-cli-sign-in-url-capture', async () => ({
  ...(await vi.importActual<typeof UrlCapture>('./azure-cli-sign-in-url-capture')),
  prepareSignInUrlCapture: mocks.prepareCapture
}))
vi.mock('./azure-devops-sign-in-window', () => ({
  openAzureDevOpsSignInWindow: mocks.openWindow
}))

const SIGN_IN_URL =
  'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize?redirect_uri=http%3A%2F%2Flocalhost%3A50123'

type FakeAz = { spec: ProcessSpec; exit: (result: Partial<ProcessResult>) => void }

let az: FakeAz | null = null

function result(partial: Partial<ProcessResult>): ProcessResult {
  return { code: 0, signal: null, stdout: '', stderr: '', timedOut: false, ...partial }
}

beforeEach(() => {
  _resetAzureCliInteractiveSignIn()
  _resetAzureCliSignInNotice()
  vi.clearAllMocks()
  az = null
  mocks.resolveProgram.mockResolvedValue({ program: 'python', prefixArgs: ['-m'], env: {} })
  mocks.runAzureCliJson.mockResolvedValue({ tenantId: 'tenant-1' })
  mocks.prepareCapture.mockResolvedValue({
    env: { BROWSER: 'capture', ELECTRON_RUN_AS_NODE: '1' },
    waitForUrl: mocks.waitForUrl,
    dispose: mocks.dispose
  })
  mocks.dispose.mockResolvedValue(undefined)
  mocks.waitForUrl.mockResolvedValue(SIGN_IN_URL)
  mocks.openWindow.mockReturnValue({ close: mocks.closeWindow })
  mocks.runProcess.mockImplementation(
    (spec: ProcessSpec) =>
      new Promise<ProcessResult>((resolve) => {
        az = { spec, exit: (partial) => resolve(result(partial)) }
        spec.signal?.addEventListener('abort', () => resolve(result({ code: null })))
      })
  )
})

async function untilAzStarted(): Promise<FakeAz> {
  await vi.waitFor(() => expect(az).not.toBeNull())
  if (!az) {
    throw new Error('az did not start')
  }
  return az
}

describe('startAzureCliSignIn in-app', () => {
  it('opens the captured page and ends idle with renewal listeners run', async () => {
    const renewed = vi.fn()
    onAzureCliSessionRenewed(renewed)
    const pending = startAzureCliSignIn('in-app')
    expect(getAzureCliSignInState()).toEqual({ kind: 'signing-in', mode: 'in-app' })
    const started = await untilAzStarted()
    expect(started.spec.args).toEqual(['-m', 'login', '--tenant', 'tenant-1', '--output', 'none'])
    expect(started.spec.env).toMatchObject({ BROWSER: 'capture', ELECTRON_RUN_AS_NODE: '1' })
    expect(started.spec.terminationBarrier).toBe(true)
    await vi.waitFor(() => expect(mocks.openWindow).toHaveBeenCalledOnce())
    expect(mocks.openWindow.mock.calls[0]?.[0]).toMatchObject({ redirectPort: 50123 })
    started.exit({ code: 0 })
    await expect(pending).resolves.toEqual({ ok: true })
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
    expect(renewed).toHaveBeenCalledOnce()
    expect(mocks.closeWindow).toHaveBeenCalledOnce()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })

  it('treats a window closed by the user as a cancel and kills az', async () => {
    const pending = startAzureCliSignIn('in-app')
    await vi.waitFor(() => expect(mocks.openWindow).toHaveBeenCalledOnce())
    mocks.openWindow.mock.calls[0]?.[0].onClosedByUser()
    await expect(pending).resolves.toEqual({ ok: false, error: 'cancelled' })
    expect(az?.spec.signal?.aborted).toBe(true)
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })

  it('refuses a sign-in address outside Microsoft identity hosts', async () => {
    mocks.waitForUrl.mockResolvedValue('https://evil.example/authorize')
    const pending = startAzureCliSignIn('in-app')
    const outcome = await pending
    expect(outcome.ok).toBe(false)
    expect(mocks.openWindow).not.toHaveBeenCalled()
    expect(az?.spec.signal?.aborted).toBe(true)
    expect(getAzureCliSignInState()).toMatchObject({
      kind: 'failed',
      error: expect.stringMatching(/unexpected sign-in address.*system browser/)
    })
  })

  it('fails with a system-browser hint when the page is never captured', async () => {
    mocks.waitForUrl.mockResolvedValue(null)
    const outcome = await startAzureCliSignIn('in-app')
    expect(outcome).toEqual({ ok: false, error: expect.stringMatching(/did not open in time/) })
    expect(az?.spec.signal?.aborted).toBe(true)
    expect(getAzureCliSignInState().kind).toBe('failed')
  })

  it('fails before az starts when the capture paths are unsafe', async () => {
    mocks.prepareCapture.mockRejectedValue(new Error('contains ";". Try the system browser.'))
    const outcome = await startAzureCliSignIn('in-app')
    expect(outcome.ok).toBe(false)
    expect(mocks.runProcess).not.toHaveBeenCalled()
    expect(getAzureCliSignInState().kind).toBe('failed')
  })
})

describe('startAzureCliSignIn system-browser', () => {
  it('runs plain az login and reports a non-zero exit as failed', async () => {
    const pending = startAzureCliSignIn('system-browser')
    const started = await untilAzStarted()
    expect(started.spec.env).not.toHaveProperty('BROWSER')
    expect(mocks.prepareCapture).not.toHaveBeenCalled()
    started.exit({ code: 1, stderr: 'WARNING: x\nERROR: AADSTS50058: denied\n' })
    await expect(pending).resolves.toEqual({ ok: false, error: 'ERROR: AADSTS50058: denied' })
    expect(getAzureCliSignInState()).toEqual({
      kind: 'failed',
      error: 'ERROR: AADSTS50058: denied'
    })
    expect(mocks.openWindow).not.toHaveBeenCalled()
  })

  it('reports a timeout as failed', async () => {
    const pending = startAzureCliSignIn('system-browser')
    ;(await untilAzStarted()).exit({ code: null, timedOut: true })
    await expect(pending).resolves.toEqual({ ok: false, error: 'Azure sign-in timed out.' })
  })

  it('shares one az login between concurrent callers and honors cancel', async () => {
    const first = startAzureCliSignIn('system-browser')
    const second = startAzureCliSignIn('in-app')
    expect(second).toBe(first)
    await untilAzStarted()
    cancelAzureCliSignIn()
    await expect(first).resolves.toEqual({ ok: false, error: 'cancelled' })
    expect(mocks.runProcess).toHaveBeenCalledOnce()
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
  })

  it('omits --tenant when az has no current account', async () => {
    mocks.runAzureCliJson.mockRejectedValue(new Error('Please run az login'))
    const pending = startAzureCliSignIn('system-browser')
    const started = await untilAzStarted()
    expect(started.spec.args).toEqual(['-m', 'login', '--output', 'none'])
    started.exit({ code: 0 })
    await expect(pending).resolves.toEqual({ ok: true })
  })
})
