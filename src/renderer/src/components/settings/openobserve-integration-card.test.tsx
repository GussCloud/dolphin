// @vitest-environment happy-dom

import { fireEvent } from '@testing-library/react'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { OpenObserveCliStatus } from '../../../../shared/openobserve-cli'
import { TooltipProvider } from '../ui/tooltip'
import { OpenObserveIntegrationCard } from './openobserve-integration-card'

type StoreState = {
  settings: { activeRuntimeEnvironmentId: string | null }
  openSettingsPage: () => void
  openSettingsTarget: (target: { pane: string; repoId: string | null }) => void
}

const mocks = vi.hoisted(() => {
  const store: StoreState = {
    settings: { activeRuntimeEnvironmentId: null },
    openSettingsPage: () => undefined,
    openSettingsTarget: () => undefined
  }
  return { store, getStatus: vi.fn(), saveContext: vi.fn(), activateContext: vi.fn() }
})

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: StoreState) => unknown) => selector(mocks.store)
}))

vi.mock('@/lib/openobserve-host-client', () => ({
  getOpenObserveCliStatus: mocks.getStatus,
  saveOpenObserveContext: mocks.saveContext,
  activateOpenObserveContext: mocks.activateContext
}))

vi.mock('@/components/onboarding/OnboardingInlineCommandTerminal', () => ({
  OnboardingInlineCommandTerminal: (props: { command: string }) => (
    <div data-testid="inline-terminal">{props.command}</div>
  )
}))

const installed = (
  overrides: Partial<Extract<OpenObserveCliStatus, { installed: true }>> = {}
): OpenObserveCliStatus => ({
  installed: true,
  version: 'v0.14.0',
  contexts: [{ name: 'prod', baseUrl: 'https://o2.example.com', org: 'acme', current: true }],
  activeContext: 'prod',
  baseUrl: 'https://o2.example.com',
  org: 'acme',
  authScheme: 'basic',
  authenticated: true,
  username: 'dev@example.com',
  authError: null,
  skill: { installedAgents: ['claude-code'], outdatedAgents: [] },
  ...overrides
})

let root: Root | null = null
let container: HTMLDivElement | null = null

async function renderCard(): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(
      <TooltipProvider>
        <OpenObserveIntegrationCard />
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

describe('OpenObserveIntegrationCard', () => {
  beforeEach(() => {
    mocks.getStatus.mockReset()
    mocks.saveContext.mockReset()
    mocks.activateContext.mockReset()
  })

  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount())
    }
    root = null
    container?.remove()
    container = null
  })

  it('offers the npm install when the CLI is missing', async () => {
    mocks.getStatus.mockResolvedValue({ installed: false })
    const host = await renderCard()
    expect(host.textContent).toContain('Not installed')
    expect(host.textContent).toContain('npm install -g @angelmsger/openobserve-cli')
    await act(async () => button(host, 'Install with npm').click())
    expect(host.querySelector('[data-testid="inline-terminal"]')?.textContent).toBe(
      'npm install -g @angelmsger/openobserve-cli'
    )
  })

  it('validates the form locally and saves a normalized preset', async () => {
    mocks.getStatus.mockResolvedValue(
      installed({ contexts: [], activeContext: null, baseUrl: null, authenticated: false })
    )
    mocks.saveContext.mockResolvedValue({ ok: true })
    const host = await renderCard()
    expect(host.textContent).toContain('Not configured')

    await act(async () => button(host, 'Save').click())
    expect(mocks.saveContext).not.toHaveBeenCalled()
    expect(host.querySelector('#openobserve-base-url')?.getAttribute('aria-invalid')).toBe('true')

    const url = host.querySelector<HTMLInputElement>('#openobserve-base-url')
    if (!url) {
      throw new Error('server address input not rendered')
    }
    await act(async () => fireEvent.change(url, { target: { value: 'o2.example.com/' } }))
    await act(async () => button(host, 'Save').click())
    expect(mocks.saveContext).toHaveBeenCalledWith(mocks.store.settings, {
      name: 'default',
      baseUrl: 'https://o2.example.com',
      org: 'acme',
      authScheme: 'basic'
    })
  })

  it('opens the browser sign-in for SSO contexts', async () => {
    mocks.getStatus.mockResolvedValue(
      installed({ authenticated: false, authScheme: 'session', username: null })
    )
    const host = await renderCard()
    expect(host.textContent).toContain('Not signed in')
    await act(async () => button(host, 'Sign in').click())
    expect(host.querySelector('[data-testid="inline-terminal"]')?.textContent).toBe(
      'openobserve-cli auth login --browser'
    )
  })

  it('shows the connected account and asks to update an outdated skill', async () => {
    mocks.getStatus.mockResolvedValue(
      installed({ skill: { installedAgents: ['codex'], outdatedAgents: ['codex'] } })
    )
    const host = await renderCard()
    expect(host.textContent).toContain('Connected')
    expect(host.textContent).toContain('Signed in as dev@example.com.')
    await act(async () => button(host, 'Update skill').click())
    expect(host.querySelector('[data-testid="inline-terminal"]')?.textContent).toBe(
      'openobserve-cli skill install'
    )
  })

  it('reports an unavailable host when the status call fails', async () => {
    mocks.getStatus.mockRejectedValue(new Error('Unknown method: openObserve.status'))
    const host = await renderCard()
    expect(host.textContent).toContain('Unavailable')
    expect(host.textContent).toContain('Unknown method: openObserve.status')
  })
})
