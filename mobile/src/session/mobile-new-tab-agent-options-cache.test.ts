import { describe, expect, it } from 'vitest'
import type { RpcClient } from '../transport/rpc-client'
import type { MobileNewTabAgentOption } from './mobile-new-tab-agent-options'
import {
  readCachedNewTabAgentOptions,
  writeCachedNewTabAgentOptions
} from './mobile-new-tab-agent-options-cache'

function fakeClient(): RpcClient {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the cache only uses the client as a WeakMap key.
  return {} as RpcClient
}

function fakeOptions(label: string): MobileNewTabAgentOption[] {
  // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the cache stores options opaquely; only identity is asserted.
  return [{ label } as unknown as MobileNewTabAgentOption]
}

describe('new-tab agent options cache', () => {
  it('returns what the same connection detected for the same workspace', () => {
    const client = fakeClient()
    const options = fakeOptions('claude')

    writeCachedNewTabAgentOptions(client, 'repo::/wt-a', options)

    expect(readCachedNewTabAgentOptions(client, 'repo::/wt-a')).toBe(options)
  })

  it('keeps workspaces apart', () => {
    const client = fakeClient()
    writeCachedNewTabAgentOptions(client, 'repo::/wt-a', fakeOptions('claude'))

    expect(readCachedNewTabAgentOptions(client, 'repo::/wt-b')).toBeUndefined()
  })

  it('does not carry detections over to a new connection', () => {
    const firstConnection = fakeClient()
    writeCachedNewTabAgentOptions(firstConnection, 'repo::/wt-a', fakeOptions('claude'))

    expect(readCachedNewTabAgentOptions(fakeClient(), 'repo::/wt-a')).toBeUndefined()
  })
})
