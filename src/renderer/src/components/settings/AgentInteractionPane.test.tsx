// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getDefaultSettings } from '../../../../shared/constants'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import { AgentInteractionPane } from './AgentInteractionPane'

const api = vi.hoisted(() => ({
  loadImage: vi.fn(async () => ({ ok: false as const, reason: 'default' as const })),
  loadSound: vi.fn(async () => ({ ok: false as const, reason: 'silent' as const }))
}))

beforeEach(() => {
  api.loadImage.mockClear()
  vi.stubGlobal('window', Object.assign(window, { api: { agentInteractionAvatar: api } }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function renderPane(enabled: boolean) {
  const updateSettings = vi.fn()
  const defaults = getDefaultSettings('/tmp')
  const settings: GlobalSettings = {
    ...defaults,
    agentInteraction: { ...defaults.agentInteraction, enabled }
  }
  render(<AgentInteractionPane settings={settings} updateSettings={updateSettings} />)
  return updateSettings
}

describe('AgentInteractionPane', () => {
  it('lists every event and keeps them disabled until the feature is on', () => {
    renderPane(false)
    const switches = screen.getAllByRole('switch')
    // Master switch plus one per event.
    expect(switches).toHaveLength(10)
    expect(switches.slice(1).every((element) => element.hasAttribute('disabled'))).toBe(true)
  })

  it('writes the whole merged config when one event is toggled', () => {
    const updateSettings = renderPane(true)
    fireEvent.click(screen.getByRole('switch', { name: 'Task finished' }))
    const written = updateSettings.mock.calls[0][0].agentInteraction
    expect(written.enabled).toBe(true)
    expect(written.events['task-done'].enabled).toBe(false)
    expect(written.events['needs-permission'].enabled).toBe(true)
  })

  it('turns the feature on from the master switch', () => {
    const updateSettings = renderPane(false)
    fireEvent.click(screen.getByRole('switch', { name: 'Enable Agent Integration' }))
    expect(updateSettings.mock.calls[0][0].agentInteraction.enabled).toBe(true)
  })
})
