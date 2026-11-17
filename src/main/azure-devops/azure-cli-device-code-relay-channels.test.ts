import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SecretStore } from '../../shared/secret-store'
import type { TelegramInlineButton, TelegramUpdate } from '../telegram/telegram-bot-api'
import type { TelegramInboundHandler } from '../telegram/telegram-inbound'
import { TelegramBridgeService, type TelegramBridgeApi } from '../telegram/telegram-bridge-service'
import { TelegramSettingsStore } from '../telegram/telegram-settings'
import {
  _resetAzureCliDeviceCodeEvents,
  emitAzureCliDeviceCodeOutcome,
  emitAzureCliDeviceCodePrompt
} from './azure-cli-device-code-events'
import {
  startAzureCliDeviceCodeRelay,
  type AzureCliNewCodeRequest
} from './azure-cli-device-code-relay'
import {
  createMobileDeviceCodePort,
  createTelegramDeviceCodePort
} from './azure-cli-device-code-relay-channels'

vi.mock('electron', () => ({ app: { getLocale: () => 'en-US' } }))

const TOKEN = '123456789:AAEabcdefghijklmnopqrstuvwxyz012345'
const CHAT = 42
const PROMPT = {
  attemptId: 'a1',
  verificationUrl: 'https://login.microsoft.com/device',
  userCode: 'FU3HPB3RT',
  expiresAtMs: 1_000
}

const secretStore: SecretStore = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(text),
  decryptString: (cipher) => cipher.toString(),
  describeProtectionGap: () => null
}

function makeBridge(options: { paired?: boolean } = {}) {
  const polls: ((updates: TelegramUpdate[]) => void)[] = []
  let nextMessageId = 100
  const api = {
    getMe: vi.fn(async () => ({ username: 'dolphin_bot' })),
    getUpdates: vi.fn(
      (_offset: number, _timeoutSec: number, _signal?: AbortSignal) =>
        new Promise<TelegramUpdate[]>((resolve) => polls.push(resolve))
    ),
    sendMessage: vi.fn(async (_chatId: number, _html: string) => nextMessageId++),
    editMessageText: vi.fn(
      async (
        _chatId: number,
        _messageId: number,
        _html: string,
        _buttons?: TelegramInlineButton[][]
      ) => {}
    ),
    answerCallbackQuery: vi.fn(async (_id: string, _text?: string) => {})
  } satisfies TelegramBridgeApi
  const settings = new TelegramSettingsStore({
    filePath: 'telegram.json',
    secretStore,
    readFile: () => null,
    writeFile: () => {}
  })
  settings.setToken(TOKEN)
  if (options.paired !== false) {
    settings.consumePairingCode(settings.issuePairingCode().code, {
      chatId: CHAT,
      label: '@me'
    })
  }
  const bridge = new TelegramBridgeService({
    statusSource: {
      subscribeEnrichedStatus: () => () => {},
      subscribePaneStatusClear: () => () => {},
      subscribeStatusDrop: () => () => {},
      getStatusSnapshot: () => [],
      getStatusSnapshotForPane: () => []
    },
    settings,
    resolveWorktreeName: () => null,
    createApi: () => api
  })
  bridge.start()
  const deliver = async (update: TelegramUpdate): Promise<void> => {
    await vi.waitFor(() => expect(polls.length).toBeGreaterThan(0))
    polls.shift()?.([update])
  }
  return { bridge, api, settings, deliver }
}

afterEach(() => _resetAzureCliDeviceCodeEvents())

describe('createTelegramDeviceCodePort', () => {
  it('can deliver only with an enabled bridge and a paired chat', () => {
    const unpaired = makeBridge({ paired: false })
    const port = createTelegramDeviceCodePort(unpaired.bridge).port
    unpaired.settings.setEnabled(true)
    expect(port.canDeliver()).toBe(false)

    const paired = makeBridge()
    const pairedPort = createTelegramDeviceCodePort(paired.bridge).port
    expect(pairedPort.canDeliver()).toBe(false)
    paired.settings.setEnabled(true)
    expect(pairedPort.canDeliver()).toBe(true)
    paired.bridge.dispose()
    unpaired.bridge.dispose()
  })

  it('sends the code, swaps it for New code on expiry, and the tap starts a new sign-in', async () => {
    const { bridge, api, settings, deliver } = makeBridge()
    settings.setEnabled(true)
    const telegram = createTelegramDeviceCodePort(bridge)
    const requestNewCode = vi.fn((): AzureCliNewCodeRequest => 'started')
    // Why: a pane-answer handler is registered too; the tap must not reach it.
    const paneHandler = {
      handleCallback: vi.fn()
    } satisfies TelegramInboundHandler
    bridge.registerInboundHandler(paneHandler)
    const relay = startAzureCliDeviceCodeRelay({
      telegram: telegram.port,
      mobile: null,
      hostName: 'mac-studio',
      requestNewCode,
      subscribeSessionSettled: () => () => {},
      subscribeSignInFailed: () => () => {},
      formatTime: () => '14:32'
    })

    emitAzureCliDeviceCodePrompt(PROMPT)
    await vi.waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1))
    expect(api.sendMessage.mock.calls[0][0]).toBe(CHAT)
    expect(api.sendMessage.mock.calls[0][1]).toContain('<code>FU3HPB3RT</code>')

    emitAzureCliDeviceCodeOutcome({ attemptId: 'a1', outcome: 'expired' })
    await vi.waitFor(() => expect(api.editMessageText).toHaveBeenCalledTimes(1))
    const [chatId, messageId, html, buttons] = api.editMessageText.mock.calls[0]
    expect([chatId, messageId]).toEqual([CHAT, 100])
    expect(html).not.toContain('FU3HPB3RT')
    const button = buttons?.[0]?.[0]
    expect(button?.text).toBe('New code')
    expect(button?.callbackData).toMatch(/^[A-Za-z0-9]{8}:new-code$/)

    await deliver({
      updateId: 1,
      callbackQuery: {
        id: 'q1',
        data: button?.callbackData,
        chatId: CHAT,
        messageId: 100
      }
    })
    await vi.waitFor(() =>
      expect(api.answerCallbackQuery).toHaveBeenCalledWith('q1', 'Requesting a new code…')
    )
    expect(requestNewCode).toHaveBeenCalledTimes(1)
    expect(paneHandler.handleCallback).not.toHaveBeenCalled()

    relay.dispose()
    telegram.dispose()
    bridge.dispose()
  })

  it('a released button no longer starts a sign-in', async () => {
    const { bridge, api, settings, deliver } = makeBridge()
    settings.setEnabled(true)
    const telegram = createTelegramDeviceCodePort(bridge)
    const onTap = vi.fn(() => 'ack')
    const offer = telegram.port.offerButton([{ chatId: CHAT, messageId: 100 }], 'expired', {
      label: 'New code',
      onTap
    })
    await offer.edited
    const callbackData = api.editMessageText.mock.calls[0][3]?.[0]?.[0]?.callbackData
    offer.release()
    await deliver({
      updateId: 1,
      callbackQuery: { id: 'q1', data: callbackData, chatId: CHAT, messageId: 100 }
    })
    await vi.waitFor(() =>
      expect(api.answerCallbackQuery).toHaveBeenCalledWith(
        'q1',
        'This message expired. Use the latest notice.'
      )
    )
    expect(onTap).not.toHaveBeenCalled()
    bridge.dispose()
  })
})

describe('createMobileDeviceCodePort', () => {
  const runtime = () => ({
    dispatchMobileNotification: vi.fn(),
    dismissMobileNotification: vi.fn()
  })

  it('can deliver only with a live phone push registration', () => {
    const host = runtime()
    let devices: { scope: string; pushRegistration?: { expiresAt: number } }[] = []
    const port = createMobileDeviceCodePort({
      runtime: host,
      listDevices: () => devices,
      now: () => 1_000
    })
    expect(port.canDeliver()).toBe(false)
    devices = [{ scope: 'mobile', pushRegistration: { expiresAt: 999 } }]
    expect(port.canDeliver()).toBe(false)
    devices = [{ scope: 'runtime', pushRegistration: { expiresAt: 2_000 } }]
    expect(port.canDeliver()).toBe(false)
    devices = [{ scope: 'mobile' }]
    expect(port.canDeliver()).toBe(false)
    devices = [{ scope: 'mobile', pushRegistration: { expiresAt: 2_000 } }]
    expect(port.canDeliver()).toBe(true)
  })

  it('pushes as a plugin notification and dismisses by the same id', () => {
    const host = runtime()
    const port = createMobileDeviceCodePort({
      runtime: host,
      listDevices: () => []
    })
    port.notify({
      notificationId: 'n1',
      title: 'Azure sign-in',
      body: 'Open x and enter y'
    })
    expect(host.dispatchMobileNotification).toHaveBeenCalledWith({
      type: 'notification',
      source: 'plugin',
      ignoreDesktopAwayFilter: true,
      title: 'Azure sign-in',
      body: 'Open x and enter y',
      notificationId: 'n1'
    })
    port.dismiss('n1')
    expect(host.dismissMobileNotification).toHaveBeenCalledWith('n1')
  })
})
