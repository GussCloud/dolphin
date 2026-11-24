import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CdpWsProxy } from './cdp-ws-proxy'
import { connect, createMockWebContents, type MockWebContents } from './cdp-ws-proxy-test-harness'

vi.mock('electron', () => ({
  webContents: { fromId: vi.fn() }
}))

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 20))
}

describe('CdpWsProxy rendering hold', () => {
  let mock: MockWebContents
  let proxy: CdpWsProxy
  let endpoint: string

  beforeEach(async () => {
    mock = createMockWebContents()
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the mock implements every WebContents member the proxy calls.
    proxy = new CdpWsProxy(mock.webContents as never, () => () => {})
    endpoint = await proxy.start()
  })

  afterEach(async () => {
    await proxy.stop()
  })

  it('leaves the guest throttled while no automation client is connected', () => {
    expect(mock.webContents.setBackgroundThrottling).not.toHaveBeenCalled()
  })

  it('keeps the guest unthrottled only while an automation client is connected', async () => {
    const client = await connect(endpoint)
    await settle()
    expect(mock.webContents.setBackgroundThrottling.mock.calls).toEqual([[false]])

    client.close()
    await settle()
    expect(mock.webContents.setBackgroundThrottling.mock.calls).toEqual([[false], [true]])
  })

  it('releases the hold once when a client replaces another', async () => {
    const first = await connect(endpoint)
    await settle()
    const second = await connect(endpoint)
    await settle()
    expect(mock.webContents.setBackgroundThrottling.mock.calls).toEqual([[false]])

    second.close()
    first.close()
    await settle()
    expect(mock.webContents.setBackgroundThrottling.mock.calls).toEqual([[false], [true]])
  })

  it('releases the hold when the proxy stops with a client still connected', async () => {
    await connect(endpoint)
    await settle()

    await proxy.stop()
    expect(mock.webContents.setBackgroundThrottling.mock.calls).toEqual([[false], [true]])
  })
})
