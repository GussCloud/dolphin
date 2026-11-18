import type * as NodeOs from 'node:os'
import type { NetworkInterfaceInfo } from 'node:os'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { networkInterfacesMock } = vi.hoisted(() => ({
  networkInterfacesMock: vi.fn<() => NodeJS.Dict<NetworkInterfaceInfo[]>>()
}))

vi.mock('node:os', async (importOriginal) => ({
  ...(await importOriginal<typeof NodeOs>()),
  networkInterfaces: networkInterfacesMock
}))

import { getDefaultPairingAddress, getPairingNetworkInterfaces } from './pairing-network-interfaces'

function ipv4(address: string, internal = false): NetworkInterfaceInfo {
  return {
    address,
    family: 'IPv4',
    internal,
    netmask: '255.255.0.0',
    mac: '00:00:00:00:00:00',
    cidr: null
  }
}

function ipv6(address: string): NetworkInterfaceInfo {
  return {
    address,
    family: 'IPv6',
    internal: false,
    netmask: 'ffff:ffff:ffff:ffff::',
    mac: '00:00:00:00:00:00',
    cidr: null,
    scopeid: 0
  }
}

const noDefaultRoute = async (): Promise<ReadonlySet<string>> => new Set()

describe('getPairingNetworkInterfaces', () => {
  beforeEach(() => {
    networkInterfacesMock.mockReset()
  })

  it('never offers link-local or loopback addresses', async () => {
    networkInterfacesMock.mockReturnValue({
      'Ethernet 2': [ipv4('169.254.83.107'), ipv6('fe80::1234')],
      Loopback: [ipv4('127.0.0.1', true)],
      'Wi-Fi': [ipv4('192.168.1.20')]
    })

    const interfaces = await getPairingNetworkInterfaces(noDefaultRoute)

    expect(interfaces.map((iface) => iface.address)).toEqual(['192.168.1.20'])
  })

  it('offers no direct address when only link-local adapters exist', async () => {
    networkInterfacesMock.mockReturnValue({
      'Ethernet 2': [ipv4('169.254.83.107'), ipv6('fe80::1234')]
    })

    await expect(getDefaultPairingAddress(noDefaultRoute)).resolves.toBeNull()
  })

  it('advertises a LAN address over an APIPA adapter listed first', async () => {
    networkInterfacesMock.mockReturnValue({
      'Ethernet 2': [ipv4('169.254.83.107')],
      'Wi-Fi': [ipv4('192.168.1.20')]
    })

    await expect(getDefaultPairingAddress(noDefaultRoute)).resolves.toBe('192.168.1.20')
  })
})
