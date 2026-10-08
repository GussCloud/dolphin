import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SecretStore } from '../../shared/secret-store'
import { _internals, agentHookServer } from '../agent-hooks/server'
import { buildBody, LEAF_1, PANE, postHookEvent } from '../agent-hooks/server.test-fixtures'
import { DolphinRuntimeService } from '../runtime/dolphin-runtime'
import type { RpcRequest, RpcResponse } from '../runtime/rpc/core'
import { startMainProcessTelegramAnswers } from '../startup/main-process-telegram-answers'
import { telegramAnswerText } from './telegram-answer-text'
import { TelegramBotApi, type TelegramFetch } from './telegram-bot-api'
import { TelegramBridgeService } from './telegram-bridge-service'
import { TelegramSettingsStore } from './telegram-settings'

// Real hook listener, bridge, Bot API client and runtime; only the network and terminal.send are faked.
const dispatched = vi.hoisted((): RpcRequest[] => [])

vi.mock('electron', () => ({
  app: { getLocale: () => 'en-US', getPath: () => '/tmp' },
  BrowserWindow: { fromId: () => null },
  webContents: { fromId: () => null },
  ipcMain: { on: () => undefined, removeListener: () => undefined }
}))
vi.mock('../telemetry/client', () => ({ track: () => undefined }))
vi.mock('../telemetry/cohort-classifier', () => ({ getCohortAtEmit: () => ({}) }))
vi.mock('../runtime/rpc/dispatcher', () => ({
  RpcDispatcher: class {
    async dispatch(request: RpcRequest): Promise<RpcResponse> {
      dispatched.push(request)
      return {
        id: request.id,
        ok: true,
        result: { send: { accepted: true } },
        _meta: { runtimeId: 'r' }
      }
    }
  }
}))

const TOKEN = '123456789:AAEabcdefghijklmnopqrstuvwxyz012345'
const CHAT = 42
const PTY_ID = 'pty-claude'
const secretStore: SecretStore = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(text),
  decryptString: (cipher) => cipher.toString(),
  describeProtectionGap: () => null
}
const disposers: (() => void | Promise<void>)[] = []

afterEach(async () => {
  for (const dispose of disposers.splice(0).toReversed()) {
    await dispose()
  }
  dispatched.splice(0)
})

/** Telegram over a fake network: records Bot API calls and feeds queued updates to getUpdates. */
function fakeTelegram() {
  const calls: { method: string; body: Record<string, unknown> }[] = []
  const pending: unknown[] = []
  let wake = (): void => undefined
  let nextMessageId = 100
  const reply = (result: unknown): Response => new Response(JSON.stringify({ ok: true, result }))
  const fetchImpl: TelegramFetch = async (url, init) => {
    const method = url.slice(url.lastIndexOf('/') + 1)
    const body: Record<string, unknown> = JSON.parse(String(init.body))
    if (method === 'getMe') {
      return reply({ username: 'dolphin_bot' })
    }
    if (method === 'getUpdates') {
      while (pending.length === 0) {
        await new Promise<void>((resolve) => {
          wake = resolve
          init.signal?.addEventListener('abort', () => resolve(), { once: true })
        })
        if (init.signal?.aborted) {
          throw new DOMException('aborted', 'AbortError')
        }
      }
      return reply(pending.splice(0))
    }
    calls.push({ method, body })
    return reply(method === 'sendMessage' ? { message_id: nextMessageId++ } : true)
  }
  const keyboard = (): { text: string; callback_data: string }[] => {
    const notice = calls.findLast((call) => call.method === 'sendMessage')
    const markup: unknown = notice?.body.reply_markup
    const rows =
      typeof markup === 'object' && markup !== null && 'inline_keyboard' in markup
        ? markup.inline_keyboard
        : []
    return (Array.isArray(rows) ? rows.flat() : []).flatMap((button: unknown) =>
      typeof button === 'object' &&
      button !== null &&
      'text' in button &&
      typeof button.text === 'string' &&
      'callback_data' in button &&
      typeof button.callback_data === 'string'
        ? [{ text: button.text, callback_data: button.callback_data }]
        : []
    )
  }
  let updateId = 1
  const tap = (callbackData: string): void => {
    const message = { message_id: 100, chat: { id: CHAT, type: 'private' } }
    pending.push({
      update_id: updateId++,
      callback_query: { id: `cb-${updateId}`, data: callbackData, message }
    })
    wake()
  }
  const answers = () => calls.filter((call) => call.method === 'answerCallbackQuery')
  return { fetchImpl, keyboard, tap, answers }
}

async function setup() {
  _internals.resetCachesForTests()
  await agentHookServer.start({ env: 'production' })
  disposers.push(() => agentHookServer.stop())
  const runtime = new DolphinRuntimeService(null)
  runtime.syncWindowGraph(1, {
    tabs: [
      { tabId: 'tab-1', worktreeId: 'wt-1', title: 'claude', activeLeafId: LEAF_1, layout: null }
    ],
    leaves: [
      {
        tabId: 'tab-1',
        worktreeId: 'wt-1',
        leafId: LEAF_1,
        paneRuntimeId: 1,
        ptyId: PTY_ID,
        paneTitle: null
      }
    ]
  })
  const telegram = fakeTelegram()
  const settings = new TelegramSettingsStore({
    filePath: 'telegram.json',
    secretStore,
    readFile: () => null,
    writeFile: () => {}
  })
  settings.setToken(TOKEN)
  settings.consumePairingCode(settings.issuePairingCode().code, { chatId: CHAT, label: '@me' })
  settings.setEnabled(true)
  const bridge = new TelegramBridgeService({
    statusSource: agentHookServer,
    settings,
    resolveWorktreeName: () => 'api',
    createApi: (token) => new TelegramBotApi(token, telegram.fetchImpl)
  })
  bridge.start()
  disposers.push(() => bridge.dispose())
  disposers.push(startMainProcessTelegramAnswers(bridge, runtime))
  return { runtime, telegram }
}

async function postClaude(payload: Record<string, unknown>): Promise<void> {
  const response = await postHookEvent(
    agentHookServer,
    buildBody({ session_id: 's-1', ...payload })
  )
  expect(response.status).toBe(204)
}

async function noticeButtons(telegram: ReturnType<typeof fakeTelegram>) {
  await vi.waitFor(() => expect(telegram.keyboard().length).toBeGreaterThan(0))
  // The local HTTP hook row is exactly what the bug saw: no terminal handle.
  expect(agentHookServer.getStatusSnapshotForPane(PANE)[0]?.terminalHandle).toBeUndefined()
  return telegram.keyboard()
}

const QUESTION = {
  hook_event_name: 'PreToolUse',
  tool_name: 'AskUserQuestion',
  tool_input: {
    questions: [{ question: 'Color?', options: [{ label: 'Red' }, { label: 'Blue' }] }]
  }
}

describe('Telegram answers to a local Claude hook pane', () => {
  it('answers an AskUserQuestion tap into the live terminal the runtime resolves', async () => {
    const { runtime, telegram } = await setup()
    await postClaude({ hook_event_name: 'UserPromptSubmit', prompt: 'pick a color' })
    await postClaude(QUESTION)
    const blue = (await noticeButtons(telegram)).find((button) => button.text.includes('Blue'))
    telegram.tap(blue!.callback_data)
    await vi.waitFor(() => expect(telegram.answers()).toHaveLength(1))
    expect(telegram.answers()[0]!.body.text).toBe(telegramAnswerText.sent())
    const handle = runtime.getLiveTerminalHandleForPaneKey(PANE)
    expect(handle).toEqual(expect.any(String))
    expect(dispatched.map((request) => request.params)).toEqual([
      { terminal: handle, text: '2', enter: false }
    ])
  })

  it('answers a PermissionRequest Allow tap with "1" into the live terminal', async () => {
    const { runtime, telegram } = await setup()
    await postClaude({ hook_event_name: 'UserPromptSubmit', prompt: 'list files' })
    await postClaude({
      hook_event_name: 'PermissionRequest',
      tool_name: 'Bash',
      tool_input: { command: 'ls' }
    })
    telegram.tap((await noticeButtons(telegram))[0]!.callback_data)
    await vi.waitFor(() => expect(telegram.answers()).toHaveLength(1))
    expect(telegram.answers()[0]!.body.text).toBe(telegramAnswerText.sent())
    expect(dispatched.map((request) => request.params)).toEqual([
      { terminal: runtime.getLiveTerminalHandleForPaneKey(PANE), text: '1', enter: false }
    ])
  })

  it('reports no terminal and sends nothing once the pane terminal is gone', async () => {
    const { runtime, telegram } = await setup()
    await postClaude({ hook_event_name: 'UserPromptSubmit', prompt: 'pick a color' })
    await postClaude(QUESTION)
    const buttons = await noticeButtons(telegram)
    runtime.onPtyExit(PTY_ID, 0)
    telegram.tap(buttons[0]!.callback_data)
    await vi.waitFor(() => expect(telegram.answers()).toHaveLength(1))
    expect(telegram.answers()[0]!.body.text).toBe(telegramAnswerText.noTerminal())
    expect(dispatched).toEqual([])
  })
})
