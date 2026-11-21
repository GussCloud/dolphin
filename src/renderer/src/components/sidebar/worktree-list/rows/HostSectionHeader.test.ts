import { describe, expect, it } from 'vitest'
import { getHostContactVerdict } from './HostSectionHeader'

describe('getHostContactVerdict', () => {
  it('shows live only for a connected SSH host', () => {
    expect(
      getHostContactVerdict({ kind: 'ssh', health: 'available', connectionStatus: 'connected' })
    ).toBe('live')
  })

  it('reports lost or pending SSH contact as unverifiable, never exited', () => {
    for (const connectionStatus of [
      'connecting',
      'deploying-relay',
      'reconnecting',
      'reconnection-failed',
      'error',
      'disconnected'
    ] as const) {
      expect(getHostContactVerdict({ kind: 'ssh', health: 'connecting', connectionStatus })).toBe(
        'unverifiable'
      )
    }
  })

  it('shows nothing when the SSH host refused us or no status is known', () => {
    expect(
      getHostContactVerdict({ kind: 'ssh', health: 'error', connectionStatus: 'auth-failed' })
    ).toBeNull()
    expect(getHostContactVerdict({ kind: 'ssh', health: 'available' })).toBeNull()
  })

  it('needs a status answer before calling a runtime host live', () => {
    expect(
      getHostContactVerdict({
        kind: 'runtime',
        health: 'available',
        compatibility: { kind: 'ok', clientProtocolVersion: 1, serverProtocolVersion: 1 }
      })
    ).toBe('live')
    // Fallback rows default to 'available' without any host answer.
    expect(getHostContactVerdict({ kind: 'runtime', health: 'available' })).toBeNull()
  })

  it('keeps refused, retired and ambiguous runtime states out of the pill', () => {
    expect(getHostContactVerdict({ kind: 'runtime', health: 'connecting' })).toBe('unverifiable')
    for (const health of ['blocked', 'disconnected', 'error'] as const) {
      expect(getHostContactVerdict({ kind: 'runtime', health })).toBeNull()
    }
  })

  it('shows nothing for the local host', () => {
    expect(getHostContactVerdict({ kind: 'local', health: 'local' })).toBeNull()
  })
})
