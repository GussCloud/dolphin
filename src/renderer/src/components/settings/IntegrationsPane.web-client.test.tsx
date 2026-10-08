// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { getIntegrationsPaneSearchEntries } from './integrations-search'
import { IntegrationsPane } from './IntegrationsPane'

vi.mock('./source-control-integration-cards', () => ({
  AzureDevOpsIntegrationCard: () => null,
  BitbucketIntegrationCard: () => null,
  GiteaIntegrationCard: () => null,
  GitHubIntegrationCard: () => null,
  GitLabIntegrationCard: () => null
}))
vi.mock('./task-tracker-integration-cards', () => ({
  JiraIntegrationCard: () => null,
  LinearIntegrationCard: () => null
}))
vi.mock('./openobserve-integration-card', () => ({ OpenObserveIntegrationCard: () => null }))
vi.mock('./use-integration-provider-status-refresh', () => ({
  useIntegrationProviderStatusRefresh: () => undefined
}))
vi.mock('./telegram-integration-card', () => ({
  TelegramIntegrationCard: () => <div data-testid="telegram-card" />
}))

let root: Root | null = null
let container: HTMLDivElement | null = null

function setWebClient(value: boolean): void {
  Object.assign(window, { __DOLPHIN_WEB_CLIENT__: value })
}

async function renderPane(): Promise<HTMLDivElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root?.render(<IntegrationsPane />))
  return container
}

function hasTelegramSearchEntry(): boolean {
  return getIntegrationsPaneSearchEntries().some(
    (entry) => entry.keywords?.includes('telegram') === true
  )
}

describe('IntegrationsPane Telegram visibility', () => {
  afterEach(async () => {
    if (root) {
      await act(async () => root?.unmount())
    }
    root = null
    container?.remove()
    container = null
    setWebClient(false)
  })

  it('shows the Telegram card and search entry on desktop', async () => {
    setWebClient(false)
    const host = await renderPane()
    expect(host.querySelector('[data-testid="telegram-card"]')).not.toBeNull()
    expect(hasTelegramSearchEntry()).toBe(true)
  })

  it('hides the Telegram card and search entry in the web client', async () => {
    setWebClient(true)
    const host = await renderPane()
    expect(host.querySelector('[data-testid="telegram-card"]')).toBeNull()
    expect(host.textContent).not.toContain('Agent notices')
    expect(hasTelegramSearchEntry()).toBe(false)
  })
})
