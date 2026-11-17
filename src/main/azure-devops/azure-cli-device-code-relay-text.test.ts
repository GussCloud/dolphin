import { describe, expect, it, vi } from 'vitest'
import {
  azureCliDeviceCodeOutcomeHtml,
  azureCliDeviceCodePromptHtml,
  azureCliDeviceCodePush
} from './azure-cli-device-code-relay-text'

vi.mock('electron', () => ({ app: { getLocale: () => 'en-US' } }))

const PROMPT = {
  attemptId: 'a1',
  verificationUrl: 'https://login.microsoft.com/device',
  userCode: 'FU3HPB3RT',
  expiresAtMs: 0
}

describe('device-code relay text', () => {
  it('shows the link, the tap-to-copy code, the host and the expiry', () => {
    const html = azureCliDeviceCodePromptHtml(PROMPT, 'mac-studio', '14:32')
    expect(html).toContain('<b>Azure sign-in needed</b>')
    expect(html).toContain('Computer: mac-studio')
    expect(html).toContain(
      '1. Open <a href="https://login.microsoft.com/device">https://login.microsoft.com/device</a>'
    )
    expect(html).toContain('2. Enter the code <code>FU3HPB3RT</code>')
    expect(html).toContain('valid until 14:32.')
  })

  it('escapes every value that comes from outside', () => {
    const html = azureCliDeviceCodePromptHtml(
      { ...PROMPT, verificationUrl: 'https://x/?a=1&b="2"', userCode: '<b>' },
      'host<&>',
      '<t>'
    )
    expect(html).toContain('href="https://x/?a=1&amp;b=&quot;2&quot;"')
    expect(html).toContain('<code>&lt;b&gt;</code>')
    expect(html).toContain('Computer: host&lt;&amp;&gt;')
    expect(html).toContain('until &lt;t&gt;.')
  })

  it.each(['renewed', 'expired', 'failed', 'cancelled'] as const)(
    'drops the code once the attempt is %s',
    (outcome) => {
      const html = azureCliDeviceCodeOutcomeHtml({ attemptId: 'a1', outcome }, 'mac-studio')
      expect(html).not.toContain(PROMPT.userCode)
      expect(html).not.toContain('<code>')
      expect(html).toContain('Computer: mac-studio')
    }
  )

  it('reads each outcome plainly and escapes a failure reason', () => {
    expect(azureCliDeviceCodeOutcomeHtml({ attemptId: 'a', outcome: 'renewed' }, 'h')).toContain(
      '✅ <b>Azure session renewed</b>'
    )
    expect(azureCliDeviceCodeOutcomeHtml({ attemptId: 'a', outcome: 'expired' }, 'h')).toContain(
      'Tap New code to try again.'
    )
    expect(
      azureCliDeviceCodeOutcomeHtml({ attemptId: 'a', outcome: 'failed', error: 'AADSTS<1>' }, 'h')
    ).toContain('AADSTS&lt;1&gt;')
  })

  it('puts the link and the code in the push body', () => {
    expect(azureCliDeviceCodePush(PROMPT)).toEqual({
      title: 'Azure sign-in',
      body: 'Open https://login.microsoft.com/device and enter FU3HPB3RT'
    })
  })
})
