import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TelegramSentMessage } from '../telegram/telegram-notice-transitions'
import {
  _resetAzureCliDeviceCodeEvents,
  emitAzureCliDeviceCodeOutcome,
  emitAzureCliDeviceCodePrompt,
  hasAzureCliDeviceCodeChannel,
  type AzureCliDeviceCodeOutcome
} from './azure-cli-device-code-events'
import {
  type AzureCliNewCodeRequest,
  shutdownAzureCliDeviceCodeRelay,
  startAzureCliDeviceCodeRelay,
  type AzureCliDeviceCodeButton,
  type AzureCliDeviceCodeMobilePort,
  type AzureCliDeviceCodeTelegramPort
} from './azure-cli-device-code-relay'

vi.mock('electron', () => ({ app: { getLocale: () => 'en-US' } }))

const PROMPT = {
  attemptId: 'a1',
  verificationUrl: 'https://login.microsoft.com/device',
  userCode: 'FU3HPB3RT',
  expiresAtMs: 1_000
}
const SENT: TelegramSentMessage[] = [{ chatId: 42, messageId: 7 }]

function makeRelay(options: { telegramReady?: boolean; mobileReady?: boolean } = {}) {
  const releases: ReturnType<typeof vi.fn>[] = []
  const telegram = {
    canDeliver: vi.fn(() => options.telegramReady ?? true),
    send: vi.fn(async (_html: string) => SENT),
    edit: vi.fn(async (_messages: readonly TelegramSentMessage[], _html: string) => {}),
    offerButton: vi.fn(
      (
        _messages: readonly TelegramSentMessage[],
        _html: string,
        _button: AzureCliDeviceCodeButton
      ) => {
        const release = vi.fn()
        releases.push(release)
        return { edited: Promise.resolve(), release }
      }
    )
  } satisfies AzureCliDeviceCodeTelegramPort
  const mobile = {
    canDeliver: vi.fn(() => options.mobileReady ?? true),
    notify: vi.fn(),
    dismiss: vi.fn()
  } satisfies AzureCliDeviceCodeMobilePort
  const requestNewCode = vi.fn((): AzureCliNewCodeRequest => 'started')
  const settledListeners = new Set<() => void>()
  const failedListeners = new Set<() => void>()
  const relay = startAzureCliDeviceCodeRelay({
    telegram,
    mobile,
    hostName: 'mac-studio',
    requestNewCode,
    subscribeSessionSettled: (listener) => {
      settledListeners.add(listener)
      return () => settledListeners.delete(listener)
    },
    subscribeSignInFailed: (listener) => {
      failedListeners.add(listener)
      return () => failedListeners.delete(listener)
    },
    formatTime: () => '14:32'
  })
  const settleSession = (): void => {
    for (const listener of settledListeners) {
      listener()
    }
  }
  const failSignIn = (): void => {
    for (const listener of failedListeners) {
      listener()
    }
  }
  return {
    telegram,
    mobile,
    requestNewCode,
    relay,
    releases,
    settleSession,
    settledListeners,
    failSignIn
  }
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function outcome(value: AzureCliDeviceCodeOutcome['outcome']): AzureCliDeviceCodeOutcome {
  return { attemptId: PROMPT.attemptId, outcome: value }
}

async function expireWithButton(harness: ReturnType<typeof makeRelay>) {
  emitAzureCliDeviceCodePrompt(PROMPT)
  emitAzureCliDeviceCodeOutcome(outcome('expired'))
  await flush()
  expect(harness.telegram.offerButton).toHaveBeenCalledTimes(1)
  return harness.telegram.offerButton.mock.calls[0]
}

afterEach(() => _resetAzureCliDeviceCodeEvents())

describe('startAzureCliDeviceCodeRelay', () => {
  it('sends the code to Telegram and pushes it to the phone', () => {
    const { telegram, mobile } = makeRelay()
    emitAzureCliDeviceCodePrompt(PROMPT)
    expect(telegram.send).toHaveBeenCalledWith(expect.stringContaining('<code>FU3HPB3RT</code>'))
    expect(mobile.notify).toHaveBeenCalledWith({
      notificationId: 'azure-cli-device-code:a1',
      title: 'Azure sign-in',
      body: 'Open https://login.microsoft.com/device and enter FU3HPB3RT'
    })
  })

  it('skips a channel that cannot deliver', () => {
    const { telegram, mobile } = makeRelay({ telegramReady: false, mobileReady: false })
    emitAzureCliDeviceCodePrompt(PROMPT)
    expect(telegram.send).not.toHaveBeenCalled()
    expect(mobile.notify).not.toHaveBeenCalled()
  })

  it('reports a channel only while one of them can deliver', () => {
    const { telegram, mobile, relay } = makeRelay({ telegramReady: false, mobileReady: false })
    expect(hasAzureCliDeviceCodeChannel()).toBe(false)
    mobile.canDeliver.mockReturnValue(true)
    expect(hasAzureCliDeviceCodeChannel()).toBe(true)
    mobile.canDeliver.mockReturnValue(false)
    telegram.canDeliver.mockReturnValue(true)
    expect(hasAzureCliDeviceCodeChannel()).toBe(true)
    relay.dispose()
    expect(hasAzureCliDeviceCodeChannel()).toBe(false)
  })

  it('rewrites the message without the code and dismisses the push once renewed', async () => {
    const { telegram, mobile } = makeRelay()
    emitAzureCliDeviceCodePrompt(PROMPT)
    emitAzureCliDeviceCodeOutcome(outcome('renewed'))
    await flush()
    expect(mobile.dismiss).toHaveBeenCalledWith('azure-cli-device-code:a1')
    expect(telegram.offerButton).not.toHaveBeenCalled()
    const [messages, html] = telegram.edit.mock.calls[0]
    expect(messages).toEqual(SENT)
    expect(html).toContain('Azure session renewed')
    expect(html).not.toContain('FU3HPB3RT')
  })

  it.each(['expired', 'failed'] as const)(
    'offers a New code button once %s, and the tap starts a new sign-in',
    async (value) => {
      const { telegram, requestNewCode } = makeRelay()
      emitAzureCliDeviceCodePrompt(PROMPT)
      emitAzureCliDeviceCodeOutcome(outcome(value))
      await flush()
      const [, html, button] = telegram.offerButton.mock.calls[0]
      expect(html).not.toContain('FU3HPB3RT')
      expect(button.label).toBe('New code')
      expect(requestNewCode).not.toHaveBeenCalled()
      expect(button.onTap()).toBe('Requesting a new code…')
      expect(requestNewCode).toHaveBeenCalledTimes(1)
    }
  )

  it('removes the code without a button when cancelled', async () => {
    const { telegram } = makeRelay()
    emitAzureCliDeviceCodePrompt(PROMPT)
    emitAzureCliDeviceCodeOutcome(outcome('cancelled'))
    await flush()
    expect(telegram.offerButton).not.toHaveBeenCalled()
    expect(telegram.edit.mock.calls[0][1]).toContain('Azure sign-in cancelled')
    expect(telegram.edit.mock.calls[0][1]).not.toContain('FU3HPB3RT')
  })

  it('withdraws the New code button when the next code arrives', async () => {
    const harness = makeRelay()
    await expireWithButton(harness)
    emitAzureCliDeviceCodePrompt({ ...PROMPT, attemptId: 'a2', userCode: 'NEXTCODE1' })
    expect(harness.releases[0]).toHaveBeenCalledTimes(1)
    const [messages, html] = harness.telegram.edit.mock.calls[0]
    expect(messages).toEqual(SENT)
    expect(html).toContain('Azure sign-in code expired')
  })

  it('withdraws the New code button once the session is renewed another way', async () => {
    const harness = makeRelay()
    const [, offeredHtml] = await expireWithButton(harness)
    harness.settleSession()
    expect(harness.releases[0]).toHaveBeenCalledTimes(1)
    expect(harness.telegram.edit).toHaveBeenCalledWith(SENT, offeredHtml)
  })

  it('refuses a tap the session no longer needs and takes the button away', async () => {
    const harness = makeRelay()
    const [, , button] = await expireWithButton(harness)
    harness.requestNewCode.mockReturnValue('not-needed')
    expect(button.onTap()).toBe('No longer needed.')
    expect(harness.releases[0]).toHaveBeenCalledTimes(1)
    expect(harness.telegram.edit).toHaveBeenCalledTimes(1)
  })

  it('acks a second tap while the new code is on its way and keeps the button', async () => {
    const harness = makeRelay()
    const [, , button] = await expireWithButton(harness)
    button.onTap()
    harness.requestNewCode.mockReturnValue('in-progress')
    expect(button.onTap()).toBe('Requesting a new code…')
    expect(harness.releases[0]).not.toHaveBeenCalled()
    expect(harness.telegram.edit).not.toHaveBeenCalled()
  })

  it('says so, and keeps a button, when a requested code never arrives', async () => {
    const harness = makeRelay()
    const [messages, html, button] = await expireWithButton(harness)
    button.onTap()
    harness.failSignIn()
    expect(harness.releases[0]).toHaveBeenCalledTimes(1)
    expect(harness.telegram.offerButton).toHaveBeenCalledTimes(2)
    const [againMessages, againHtml, againButton] = harness.telegram.offerButton.mock.calls[1]
    expect(againMessages).toEqual(messages)
    expect(againHtml).toBe(`${html}\nCould not get a new code.`)
    expect(againButton.label).toBe('New code')
    harness.failSignIn()
    expect(harness.telegram.offerButton).toHaveBeenCalledTimes(2)
  })

  it('reports no failure when nobody asked for a new code, or the code arrived', async () => {
    const harness = makeRelay()
    const [, , button] = await expireWithButton(harness)
    harness.failSignIn()
    expect(harness.telegram.offerButton).toHaveBeenCalledTimes(1)
    button.onTap()
    emitAzureCliDeviceCodePrompt({ ...PROMPT, attemptId: 'a2' })
    harness.failSignIn()
    expect(harness.telegram.offerButton).toHaveBeenCalledTimes(1)
  })

  it('offers no button when the session settled before the expiry edit', async () => {
    const harness = makeRelay()
    emitAzureCliDeviceCodePrompt(PROMPT)
    emitAzureCliDeviceCodeOutcome(outcome('expired'))
    harness.settleSession()
    await flush()
    expect(harness.telegram.offerButton).not.toHaveBeenCalled()
    expect(harness.telegram.edit).toHaveBeenCalledTimes(1)
  })

  it('offers no button when a newer code arrived before the expiry edit', async () => {
    const { telegram } = makeRelay()
    emitAzureCliDeviceCodePrompt(PROMPT)
    emitAzureCliDeviceCodeOutcome(outcome('expired'))
    emitAzureCliDeviceCodePrompt({ ...PROMPT, attemptId: 'a2' })
    await flush()
    expect(telegram.offerButton).not.toHaveBeenCalled()
    expect(telegram.edit).toHaveBeenCalledTimes(1)
  })

  it('ignores an outcome for an attempt it never relayed', async () => {
    const { telegram, mobile } = makeRelay()
    emitAzureCliDeviceCodeOutcome(outcome('renewed'))
    await flush()
    expect(telegram.edit).not.toHaveBeenCalled()
    expect(mobile.dismiss).not.toHaveBeenCalled()
  })

  it('stops listening and releases a live button once disposed', async () => {
    const harness = makeRelay()
    await expireWithButton(harness)
    harness.relay.dispose()
    expect(harness.releases[0]).toHaveBeenCalledTimes(1)
    expect(harness.settledListeners.size).toBe(0)
    emitAzureCliDeviceCodePrompt({ ...PROMPT, attemptId: 'a2' })
    expect(harness.telegram.send).toHaveBeenCalledTimes(1)
  })
})

describe('shutdownAzureCliDeviceCodeRelay', () => {
  it('lets the cancelled edit land before disposing', async () => {
    const { telegram, relay } = makeRelay()
    emitAzureCliDeviceCodePrompt(PROMPT)
    const cancel = vi.fn(() => {
      setTimeout(() => emitAzureCliDeviceCodeOutcome(outcome('cancelled')), 10)
    })
    await shutdownAzureCliDeviceCodeRelay(relay, cancel, 1_000)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(telegram.edit).toHaveBeenCalledTimes(1)
    expect(telegram.edit.mock.calls[0][1]).toContain('Azure sign-in cancelled')
    expect(telegram.edit.mock.calls[0][1]).not.toContain('FU3HPB3RT')
  })

  it('removes the code itself when the cancel never reports back, within the budget', async () => {
    const { telegram, relay } = makeRelay()
    emitAzureCliDeviceCodePrompt(PROMPT)
    const startedAt = Date.now()
    await shutdownAzureCliDeviceCodeRelay(relay, () => {}, 100)
    expect(Date.now() - startedAt).toBeLessThan(1_000)
    expect(telegram.edit).toHaveBeenCalledTimes(1)
    expect(telegram.edit.mock.calls[0][1]).not.toContain('FU3HPB3RT')
  })

  it('returns at the deadline even when Telegram never answers', async () => {
    const { telegram, relay } = makeRelay()
    telegram.edit.mockReturnValue(new Promise(() => {}))
    emitAzureCliDeviceCodePrompt(PROMPT)
    const startedAt = Date.now()
    await shutdownAzureCliDeviceCodeRelay(relay, () => {}, 100)
    expect(Date.now() - startedAt).toBeLessThan(1_000)
  })
})
