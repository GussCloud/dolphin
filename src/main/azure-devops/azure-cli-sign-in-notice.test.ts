import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  _resetAzureCliSignInNotice,
  dismissAzureCliSignInNotice,
  getAzureCliSignInState,
  hostCanOpenSignInBrowser,
  noticeAzureCliSessionLapsed,
  noticeAzureCliSessionWorking,
  onAzureCliSignInStateChanged,
  setAzureCliSignInState
} from './azure-cli-sign-in-notice'

const mocks = vi.hoisted(() => ({
  preference: vi.fn(),
  expiresAt: vi.fn(),
  runProcess: vi.fn()
}))

vi.mock('./azure-devops-auth-preference-store', () => ({
  getAzureDevOpsAuthPreference: mocks.preference
}))
vi.mock('./azure-cli-session-store', () => ({ getAzureCliTokenExpiresAt: mocks.expiresAt }))
vi.mock('../../shared/child-process/run-process', () => ({ runProcess: mocks.runProcess }))

describe('azure CLI sign-in notice', () => {
  beforeEach(() => {
    _resetAzureCliSignInNotice()
    vi.clearAllMocks()
    mocks.preference.mockReturnValue({ method: 'azure-cli', autoRenewCliSession: true })
    mocks.expiresAt.mockReturnValue(1_000)
  })

  it('asks for sign-in on a lapsed session without running az login', () => {
    const listener = vi.fn()
    onAzureCliSignInStateChanged(listener)
    noticeAzureCliSessionLapsed()
    expect(getAzureCliSignInState()).toEqual({ kind: 'required' })
    expect(listener).toHaveBeenCalledWith({ kind: 'required' })
    expect(mocks.runProcess).not.toHaveBeenCalled()
  })

  it('stays quiet unless the user opted into the notice', () => {
    mocks.preference.mockReturnValue({ method: 'azure-cli', autoRenewCliSession: false })
    noticeAzureCliSessionLapsed()
    mocks.preference.mockReturnValue({ method: 'token', autoRenewCliSession: true })
    noticeAzureCliSessionLapsed()
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
  })

  it('does not ask a host that never had a session', () => {
    mocks.expiresAt.mockReturnValue(null)
    noticeAzureCliSessionLapsed()
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
  })

  it('leaves a sign-in in progress alone', () => {
    setAzureCliSignInState({ kind: 'signing-in', mode: 'in-app' })
    noticeAzureCliSessionLapsed()
    noticeAzureCliSessionWorking()
    dismissAzureCliSignInNotice()
    expect(getAzureCliSignInState()).toEqual({ kind: 'signing-in', mode: 'in-app' })
  })

  it('clears the notice once a token is issued again', () => {
    noticeAzureCliSessionLapsed()
    noticeAzureCliSessionWorking()
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
    setAzureCliSignInState({ kind: 'failed', error: 'x' })
    noticeAzureCliSessionWorking()
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
  })

  it('clears the notice when the user signs out', () => {
    noticeAzureCliSessionLapsed()
    dismissAzureCliSignInNotice()
    expect(getAzureCliSignInState()).toEqual({ kind: 'idle' })
  })

  it('does not re-broadcast an unchanged state', () => {
    const listener = vi.fn()
    onAzureCliSignInStateChanged(listener)
    noticeAzureCliSessionLapsed()
    noticeAzureCliSessionLapsed()
    expect(listener).toHaveBeenCalledOnce()
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('hostCanOpenSignInBrowser', () => {
  it('requires a display on Linux', () => {
    expect(hostCanOpenSignInBrowser('win32', {})).toBe(true)
    expect(hostCanOpenSignInBrowser('darwin', {})).toBe(true)
    expect(hostCanOpenSignInBrowser('linux', {})).toBe(false)
    expect(hostCanOpenSignInBrowser('linux', { WAYLAND_DISPLAY: 'wayland-0' })).toBe(true)
  })
})
