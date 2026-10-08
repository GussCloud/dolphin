// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TelegramBridgeState } from '../../../../shared/telegram-bridge-state'
import { TooltipProvider } from '../ui/tooltip'
import { TelegramIntegrationCard } from './telegram-integration-card'

const BASE: TelegramBridgeState = {
  available: true,
  enabled: false,
  channelsEnabled: false,
  tokenConfigured: false,
  allowedChats: [],
  pairingCode: null,
  protectionGap: null,
  connection: { state: 'disabled' }
}

const telegram = {
  getState: vi.fn(),
  setEnabled: vi.fn(),
  setChannelsEnabled: vi.fn(),
  saveToken: vi.fn(),
  clearToken: vi.fn(),
  issuePairingCode: vi.fn(),
  removeChat: vi.fn(),
  onChanged: vi.fn(() => () => undefined)
}

let root: Root | null = null
let container: HTMLDivElement | null = null

async function renderCard(state: TelegramBridgeState): Promise<HTMLDivElement> {
  telegram.getState.mockResolvedValue(state)
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <TelegramIntegrationCard />
      </TooltipProvider>
    )
  })
  return container
}

function button(host: HTMLElement, label: string): HTMLButtonElement {
  const match = Array.from(host.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === label
  )
  if (!match) {
    throw new Error(`button "${label}" not rendered`)
  }
  return match
}

describe('TelegramIntegrationCard', () => {
  beforeEach(() => {
    for (const fn of Object.values(telegram)) {
      fn.mockClear()
    }
    Object.assign(window, { api: { telegram, shell: { openUrl: vi.fn() } } })
  })

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount())
    }
    root = null
    container?.remove()
    container = null
  })

  it('asks for a token and never renders a saved one', async () => {
    const host = await renderCard(BASE)
    expect(host.textContent).toContain('Off')
    expect(host.querySelector('input[type="password"]')).not.toBeNull()
    expect(button(host, 'Pair a chat').disabled).toBe(true)
    const channels = host.querySelector('#telegram-claude-channels')
    expect(channels?.getAttribute('aria-checked')).toBe('false')
    expect(host.textContent).toContain('local development channel')
  })

  it('shows the saved bot, paired chats and the pairing command', async () => {
    telegram.removeChat.mockResolvedValue({ ...BASE, tokenConfigured: true })
    const host = await renderCard({
      ...BASE,
      enabled: true,
      tokenConfigured: true,
      allowedChats: [{ chatId: 42, label: '@ana', pairedAt: 1 }],
      pairingCode: { code: 'ABCD2345', expiresAt: 0 },
      connection: { state: 'ok', botUsername: 'dolphin_bot' }
    })
    expect(host.textContent).toContain('Connected')
    expect(host.textContent).toContain('Token saved for @dolphin_bot.')
    expect(host.textContent).toContain('/pair ABCD2345')
    expect(host.textContent).toContain('@ana')
    expect(host.querySelector('input[type="password"]')).toBeNull()
    const remove = host.querySelector<HTMLButtonElement>('button[aria-label="Remove chat"]')
    await act(async () => remove?.click())
    expect(telegram.removeChat).toHaveBeenCalledWith(42)
  })

  it('does not crash when the API resolves nothing (fallback proxy)', async () => {
    telegram.getState.mockResolvedValue(undefined)
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root?.render(
        <TooltipProvider>
          <TelegramIntegrationCard />
        </TooltipProvider>
      )
    })
    expect(container.textContent).toContain('Telegram')
    expect(container.querySelector('input')).toBeNull()
  })

  it('explains a polling conflict inline', async () => {
    const host = await renderCard({
      ...BASE,
      enabled: true,
      tokenConfigured: true,
      connection: { state: 'conflict' }
    })
    expect(host.textContent).toContain('Another app is polling')
    expect(host.textContent).toContain('HTTP 409')
  })
})
