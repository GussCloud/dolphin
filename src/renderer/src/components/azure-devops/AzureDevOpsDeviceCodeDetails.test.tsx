// @vitest-environment happy-dom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AzureDevOpsDeviceCodeDetails } from './AzureDevOpsDeviceCodeDetails'

const toastMocks = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
vi.mock('sonner', () => ({ toast: toastMocks }))

const DEVICE_CODE = {
  verificationUrl: 'https://login.microsoft.com/device',
  userCode: 'FU3HPB3RT',
  expiresAtMs: 1_000
}

let root: Root | null = null

function installApi(writeClipboardText: () => Promise<void>) {
  const calls: string[] = []
  const api = {
    ui: {
      writeClipboardText: vi.fn(async (text: string) => {
        calls.push(`copy:${text}`)
        await writeClipboardText()
      })
    },
    shell: { openUrl: vi.fn(async (url: string) => void calls.push(`open:${url}`)) }
  }
  Object.defineProperty(window, 'api', { configurable: true, value: api })
  return calls
}

async function clickCopyAndOpen(): Promise<HTMLElement> {
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => root?.render(<AzureDevOpsDeviceCodeDetails deviceCode={DEVICE_CODE} />))
  const button = [...container.querySelectorAll('button')].find((candidate) =>
    candidate.textContent?.includes('Copy code and open')
  )
  await act(async () => button?.click())
  return container
}

afterEach(() => {
  act(() => root?.unmount())
  root = null
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

describe('AzureDevOpsDeviceCodeDetails', () => {
  it('copies the code, confirms it, then opens the verification page', async () => {
    const calls = installApi(() => Promise.resolve())
    const rendered = await clickCopyAndOpen()
    expect(calls).toEqual(['copy:FU3HPB3RT', 'open:https://login.microsoft.com/device'])
    expect(toastMocks.success).toHaveBeenCalledOnce()
    expect(rendered.querySelector('code')?.textContent).toBe('FU3HPB3RT')
  })

  it('still opens the page when the copy fails, telling the user to type the code', async () => {
    const calls = installApi(() => Promise.reject(new Error('denied')))
    await clickCopyAndOpen()
    expect(calls).toEqual(['copy:FU3HPB3RT', 'open:https://login.microsoft.com/device'])
    expect(toastMocks.error).toHaveBeenCalledOnce()
    expect(toastMocks.success).not.toHaveBeenCalled()
  })
})
