// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AzureCliAutoRenewControl } from './azure-cli-auto-renew-control'

const mocks = vi.hoisted(() => ({ setAutoRenew: vi.fn() }))

vi.mock('@/store', () => ({
  useAppStore: (selector: (state: { settings: object }) => unknown) => selector({ settings: {} })
}))
vi.mock('@/lib/azure-devops-host-client', () => ({ setAzureCliAutoRenew: mocks.setAutoRenew }))

let root: Root | null = null
let container: HTMLDivElement | null = null

async function render(props: { enabled: boolean; available: boolean }): Promise<HTMLElement> {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(<AzureCliAutoRenewControl {...props} tokenExpiresAt={null} onChanged={vi.fn()} />)
  })
  return container
}

function checkbox(rendered: HTMLElement): HTMLButtonElement | null {
  return rendered.querySelector('button[role="checkbox"]')
}

describe('AzureCliAutoRenewControl', () => {
  afterEach(async () => {
    await act(async () => root?.unmount())
    root = null
    container?.remove()
    container = null
    mocks.setAutoRenew.mockReset()
  })

  it('toggles auto-renew on a host that can open the browser sign-in', async () => {
    mocks.setAutoRenew.mockResolvedValue(undefined)
    const rendered = await render({ enabled: false, available: true })
    expect(checkbox(rendered)?.disabled).toBe(false)
    await act(async () => {
      checkbox(rendered)?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(mocks.setAutoRenew).toHaveBeenCalledWith({}, true)
  })

  it('shows the control disabled and unchecked with an explanation on a headless host', async () => {
    const rendered = await render({ enabled: true, available: false })
    expect(checkbox(rendered)?.disabled).toBe(true)
    expect(checkbox(rendered)?.getAttribute('data-state')).toBe('unchecked')
    expect(rendered.textContent).toContain('Not available on this host')
  })
})
