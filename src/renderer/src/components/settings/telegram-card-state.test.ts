import { describe, expect, it } from 'vitest'
import type { TelegramBridgeState } from '../../../../shared/telegram-bridge-state'
import { telegramChannelAvailabilityHint } from './telegram-card-state'

const state: TelegramBridgeState = {
  available: true,
  enabled: true,
  channelsEnabled: true,
  tokenConfigured: true,
  allowedChats: [],
  pairingCode: null,
  protectionGap: null,
  connection: { state: 'ok' }
}

describe('telegramChannelAvailabilityHint', () => {
  it('explains why the channel cannot open on this host', () => {
    expect(
      telegramChannelAvailabilityHint({ ...state, channelAvailability: 'claude-too-old' })
    ).toContain('2.1.234')
    expect(
      telegramChannelAvailabilityHint({ ...state, channelAvailability: 'config-unavailable' })
    ).toContain('terminal')
    expect(
      telegramChannelAvailabilityHint({ ...state, channelAvailability: 'claude-not-found' })
    ).toContain('Claude Code')
  })

  it('stays quiet while it works, is checking, is off, or on hosts without the channel', () => {
    for (const channelAvailability of ['ready', 'checking', 'off'] as const) {
      expect(telegramChannelAvailabilityHint({ ...state, channelAvailability })).toBeNull()
    }
    expect(telegramChannelAvailabilityHint(state)).toBeNull()
    expect(telegramChannelAvailabilityHint(null)).toBeNull()
  })
})
