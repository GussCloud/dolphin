import { describe, expect, it, vi } from 'vitest'
import { azureCliNewCodeDecision } from './main-process-azure-cli-device-code-relay'

vi.mock('electron', () => ({
  app: { getLocale: () => 'en-US', getPath: () => '/tmp' },
  BrowserWindow: class {}
}))

describe('azureCliNewCodeDecision', () => {
  it('signs in only while the notice is on and the session still needs it', () => {
    expect(azureCliNewCodeDecision(true, { kind: 'required' })).toBe('start')
    expect(azureCliNewCodeDecision(true, { kind: 'failed', error: 'x' })).toBe('start')
    expect(azureCliNewCodeDecision(true, { kind: 'idle' })).toBe('not-needed')
    expect(azureCliNewCodeDecision(false, { kind: 'required' })).toBe('not-needed')
  })

  it('treats a sign-in under way as a code on its way', () => {
    expect(azureCliNewCodeDecision(true, { kind: 'signing-in', mode: 'device-code' })).toBe(
      'in-progress'
    )
    expect(azureCliNewCodeDecision(false, { kind: 'signing-in', mode: 'device-code' })).toBe(
      'not-needed'
    )
  })
})
