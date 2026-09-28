import { describe, expect, it } from 'vitest'
import {
  bindHostIsNetworkExposed,
  describeDolphindBindExposure,
  DOLPHIND_LOOPBACK_BIND_HOST,
  DolphindBindAddressError,
  resolveDolphindBindHost
} from './dolphind-bind-address'

describe('resolveDolphindBindHost', () => {
  it('defaults to loopback when the operator asked for nothing', () => {
    expect(resolveDolphindBindHost()).toBe(DOLPHIND_LOOPBACK_BIND_HOST)
    expect(DOLPHIND_LOOPBACK_BIND_HOST).toBe('127.0.0.1')
  })

  it('accepts literal IPv4 and IPv6 addresses, including explicit wide binds', () => {
    expect(resolveDolphindBindHost('0.0.0.0')).toBe('0.0.0.0')
    expect(resolveDolphindBindHost('10.1.2.3')).toBe('10.1.2.3')
    expect(resolveDolphindBindHost('::1')).toBe('::1')
    expect(resolveDolphindBindHost('localhost')).toBe('127.0.0.1')
    expect(resolveDolphindBindHost(' 127.0.0.1 ')).toBe('127.0.0.1')
  })

  it('refuses hostnames, because DNS would decide which interface got bound', () => {
    expect(() => resolveDolphindBindHost('internal.example')).toThrow(DolphindBindAddressError)
    expect(() => resolveDolphindBindHost('')).toThrow(DolphindBindAddressError)
    expect(() => resolveDolphindBindHost('0.0.0.0:80')).toThrow(DolphindBindAddressError)
  })
})

describe('bindHostIsNetworkExposed', () => {
  it('separates local-only addresses from network-reachable ones', () => {
    expect(bindHostIsNetworkExposed('127.0.0.1')).toBe(false)
    expect(bindHostIsNetworkExposed('127.5.5.5')).toBe(false)
    expect(bindHostIsNetworkExposed('::1')).toBe(false)
    expect(bindHostIsNetworkExposed('0.0.0.0')).toBe(true)
    expect(bindHostIsNetworkExposed('::')).toBe(true)
    expect(bindHostIsNetworkExposed('10.1.2.3')).toBe(true)
  })

  it('says out loud when a deployment is reachable from the network', () => {
    expect(describeDolphindBindExposure('0.0.0.0')).toContain('reachable from the network')
    expect(describeDolphindBindExposure('127.0.0.1')).toContain('local only')
  })
})
