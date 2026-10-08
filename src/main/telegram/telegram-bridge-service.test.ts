import { describe, expect, it, vi } from 'vitest'
import type { EnrichedAgentHookEventPayload } from '../agent-hooks/server/server-types'
import type {
  AgentStatusClearIpcPayload,
  AgentStatusIpcPayload
} from '../../shared/agent-status-types'
import type { SecretStore } from '../../shared/secret-store'
import type { TelegramSendOptions } from './telegram-bot-api'
import { TelegramBridgeService, type TelegramBridgeApi } from './telegram-bridge-service'
import { TelegramSettingsStore } from './telegram-settings'

vi.mock('electron', () => ({ app: { getLocale: () => 'en-US' } }))

const TOKEN = '123456789:AAEabcdefghijklmnopqrstuvwxyz012345'
const PANE = 'tab-1:11111111-1111-4111-8111-111111111111'
const CHAT = 42

const secretStore: SecretStore = {
  isEncryptionAvailable: () => true,
  encryptString: (text) => Buffer.from(text),
  decryptString: (cipher) => cipher.toString(),
  describeProtectionGap: () => null
}

function makeHarness(options: { snapshot?: AgentStatusIpcPayload[] } = {}) {
  const listeners = {
    status: new Set<(payload: EnrichedAgentHookEventPayload) => void>(),
    clear: new Set<(clear: AgentStatusClearIpcPayload) => void>(),
    drop: new Set<(paneKey: string) => void>()
  }
  const subscribe =
    <T>(set: Set<T>) =>
    (listener: T) => {
      set.add(listener)
      return () => set.delete(listener)
    }
  let nextMessageId = 100
  const api = {
    getMe: vi.fn(async () => ({ username: 'dolphin_bot' })),
    // Why: never resolve, so the poll loop parks instead of spinning in the test.
    getUpdates: vi.fn(() => new Promise<never>(() => {})),
    sendMessage: vi.fn(
      async (_chatId: number, _html: string, _options?: TelegramSendOptions) => nextMessageId++
    ),
    editMessageText: vi.fn(async () => {}),
    answerCallbackQuery: vi.fn(async () => {})
  } satisfies TelegramBridgeApi
  const settings = new TelegramSettingsStore({
    filePath: 'telegram.json',
    secretStore,
    readFile: () => null,
    writeFile: () => {}
  })
  settings.setToken(TOKEN)
  settings.consumePairingCode(settings.issuePairingCode().code, { chatId: CHAT, label: '@me' })
  let now = 1_000_000
  const bridge = new TelegramBridgeService({
    statusSource: {
      subscribeEnrichedStatus: subscribe(listeners.status),
      subscribePaneStatusClear: subscribe(listeners.clear),
      subscribeStatusDrop: subscribe(listeners.drop),
      getStatusSnapshot: () => options.snapshot ?? [],
      getStatusSnapshotForPane: (paneKey) =>
        (options.snapshot ?? []).filter((row) => row.paneKey === paneKey)
    },
    settings,
    resolveWorktreeName: (id) => (id === 'repo::/api' ? 'api' : null),
    createApi: () => api,
    now: () => now
  })
  bridge.start()
  const emit = async (
    state: EnrichedAgentHookEventPayload['payload']['state'],
    stateStartedAt: number,
    extra: Partial<EnrichedAgentHookEventPayload> = {},
    payload: Partial<EnrichedAgentHookEventPayload['payload']> = {}
  ): Promise<void> => {
    now += 10_000
    for (const listener of listeners.status) {
      listener({
        paneKey: PANE,
        connectionId: null,
        worktreeId: 'repo::/api',
        receivedAt: now,
        stateStartedAt,
        payload: { state, prompt: 'ship it', agentType: 'claude', ...payload },
        ...extra
      })
    }
    await bridge.whenIdle()
  }
  return { bridge, api, settings, listeners, emit }
}

describe('TelegramBridgeService', () => {
  it('stays idle until enabled', async () => {
    const { api, emit } = makeHarness()
    await emit('working', 1)
    await emit('waiting', 2)
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it('sends a waiting notice and edits it once the pane moves on', async () => {
    const { api, settings, emit } = makeHarness()
    settings.setEnabled(true)
    await emit('working', 1)
    await emit('waiting', 2, {}, { toolName: 'Bash', toolInput: 'ls' })
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(api.sendMessage).toHaveBeenLastCalledWith(
      CHAT,
      '⏳ Waiting for you\n<b>api</b> · Claude\n💬 <i>ship it</i>\n\n🔧 Bash <code>ls</code>',
      { buttons: [] }
    )
    await emit('working', 3)
    expect(api.editMessageText).toHaveBeenCalledWith(
      CHAT,
      100,
      expect.stringContaining('✔ Answered')
    )
    await emit('done', 4, {}, { lastAssistantMessage: 'Shipped.' })
    expect(api.sendMessage).toHaveBeenLastCalledWith(CHAT, expect.stringContaining('Shipped.'), {
      buttons: []
    })
  })

  it('keeps the baseline across an SSH transient clear and ignores replays', async () => {
    const { api, settings, emit, listeners } = makeHarness()
    settings.setEnabled(true)
    await emit('working', 1, { connectionId: 'ssh-1' })
    await emit('waiting', 2, { connectionId: 'ssh-1' })
    for (const listener of listeners.clear) {
      listener({ transient: true, connectionId: 'ssh-1', clearedAt: 0 })
    }
    await emit('waiting', 2, { connectionId: 'ssh-1', isReplay: true })
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
    expect(api.editMessageText).not.toHaveBeenCalled()
  })

  it('lets a registered decorator add buttons with short callback data', async () => {
    const { api, settings, emit, bridge } = makeHarness()
    settings.setEnabled(true)
    bridge.registerNoticeDecorator((notice) => ({
      ...notice,
      buttons: [[{ label: 'Yes', action: 'a0' }]]
    }))
    await emit('working', 1)
    await emit('waiting', 2)
    const options = vi.mocked(api.sendMessage).mock.lastCall?.[2]
    expect(options?.buttons?.[0]?.[0]?.callbackData).toMatch(/^[A-Za-z0-9]{8}:a0$/)
  })

  it('sends plain text to allowed chats, escaped and threaded under nothing by default', async () => {
    const { api, settings, bridge } = makeHarness()
    settings.setEnabled(true)
    await bridge.sendToAllowedChats('a <b>')
    expect(api.sendMessage).toHaveBeenLastCalledWith(CHAT, 'a &lt;b&gt;', {
      buttons: [],
      replyToMessageId: undefined
    })
  })

  it('suppresses a notice a registered filter rejects', async () => {
    const { api, settings, emit, bridge } = makeHarness()
    settings.setEnabled(true)
    const dispose = bridge.registerNoticeFilter((notice) => notice.kind !== 'waiting')
    await emit('working', 1)
    await emit('waiting', 2)
    expect(api.sendMessage).not.toHaveBeenCalled()
    dispose()
    await emit('working', 3)
    await emit('waiting', 4)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })

  it('creates routes from the store row and sends buttons threaded under the route', async () => {
    const row: AgentStatusIpcPayload = {
      paneKey: PANE,
      worktreeId: 'repo::/api',
      connectionId: 'ssh-1',
      agentType: 'claude',
      terminalHandle: 'term-1',
      state: 'waiting',
      prompt: '',
      receivedAt: 1,
      stateStartedAt: 1
    }
    const { api, settings, bridge } = makeHarness({ snapshot: [row] })
    settings.setEnabled(true)
    const route = bridge.createRoute(PANE)
    expect(route).toMatchObject({
      paneKey: PANE,
      worktreeId: 'repo::/api',
      connectionId: 'ssh-1',
      agentType: 'claude',
      terminalHandle: 'term-1'
    })
    expect(bridge.createRoute('other-pane')).toMatchObject({ paneKey: 'other-pane' })
    await bridge.sendToAllowedChats('Allow?', {
      replyToRoute: route,
      buttons: [[{ label: 'Yes', action: 'chp-allow-ab12' }]]
    })
    await bridge.sendToAllowedChats('follow-up', { replyToRoute: route })
    expect(api.sendMessage).toHaveBeenNthCalledWith(1, CHAT, 'Allow?', {
      buttons: [[{ text: 'Yes', callbackData: `${route.routeId}:chp-allow-ab12` }]],
      replyToMessageId: undefined
    })
    expect(api.sendMessage).toHaveBeenNthCalledWith(2, CHAT, 'follow-up', {
      buttons: [],
      replyToMessageId: 100
    })
  })

  it('resolves /to worktree queries against the status snapshot', () => {
    const row = (paneKey: string, worktreeId: string): AgentStatusIpcPayload => ({
      paneKey,
      worktreeId,
      state: 'working',
      prompt: '',
      connectionId: null,
      receivedAt: 1,
      stateStartedAt: 1
    })
    const { bridge } = makeHarness({
      snapshot: [row('p1', 'repo::/api'), row('p2', 'repo::/api'), row('p3', 'repo::/web')]
    })
    expect(bridge.resolveWorktreeQuery('API')).toEqual([
      { worktreeId: 'repo::/api', paneKeys: ['p1', 'p2'] }
    ])
    expect(bridge.resolveWorktreeQuery('nope')).toEqual([])
  })

  it('reports disabled / not-configured / connecting status', () => {
    const { bridge, settings } = makeHarness()
    expect(bridge.getConnectionStatus().state).toBe('disabled')
    settings.setEnabled(true)
    expect(['connecting', 'ok']).toContain(bridge.getConnectionStatus().state)
    settings.clearToken()
    expect(bridge.getConnectionStatus().state).toBe('disabled')
  })
})
