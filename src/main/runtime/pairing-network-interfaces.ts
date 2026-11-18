import { networkInterfaces } from 'node:os'
import {
  isVirtualBridgeInterface,
  selectAutoAdvertisedPairingAddress
} from '../../shared/pairing-address-auto-selection'
import { isLinkLocalAddress } from '../../shared/network/link-local-address'
import { isTailnetIPv4Address } from '../../shared/tailnet-address'
import { getWindowsDefaultRouteInterfaceNames } from './windows-default-route-interfaces'

export type NetworkInterface = {
  name: string
  address: string
  hasDefaultRoute?: boolean
}

export type DefaultRouteInterfaceLookup = () => Promise<ReadonlySet<string> | null>

function isProxyFakeIpIPv4Address(address: string): boolean {
  return /^198\.(?:18|19)\./.test(address)
}

export async function getPairingNetworkInterfaces(
  getDefaultRouteInterfaceNames: DefaultRouteInterfaceLookup = getWindowsDefaultRouteInterfaceNames
): Promise<NetworkInterface[]> {
  const result: NetworkInterface[] = []
  const interfaces = networkInterfaces()
  const hasHyperVInterface = Object.keys(interfaces).some((name) => /^vEthernet /i.test(name))
  // Why: an unavailable route query is unknown, so no vEthernet adapter receives reachability proof.
  const defaultRouteInterfaceNames = hasHyperVInterface
    ? await getDefaultRouteInterfaceNames()
    : new Set<string>()
  const normalizedDefaultRouteInterfaceNames =
    defaultRouteInterfaceNames === null
      ? null
      : new Set([...defaultRouteInterfaceNames].map((name) => name.toLowerCase()))

  for (const [name, addrs] of Object.entries(interfaces)) {
    for (const addr of addrs ?? []) {
      if (
        addr.internal ||
        (addr.family !== 'IPv4' && addr.family !== 'IPv6') ||
        (addr.family === 'IPv4' && isProxyFakeIpIPv4Address(addr.address)) ||
        // Why: an APIPA/idle adapter's 169.254 or fe80 address is never dialable from the phone.
        isLinkLocalAddress(addr.address)
      ) {
        continue
      }
      result.push({
        name,
        address: addr.address,
        ...(normalizedDefaultRouteInterfaceNames?.has(name.toLowerCase())
          ? { hasDefaultRoute: true }
          : {})
      })
    }
  }
  return result.sort((a, b) => rankInterface(a) - rankInterface(b))
}

function rankInterface({ name, address, hasDefaultRoute }: NetworkInterface): number {
  if (isTailnetIPv4Address(address)) {
    return 0
  }
  const bridgePenalty = isVirtualBridgeInterface(name, hasDefaultRoute) ? 2 : 0
  return (address.includes(':') ? 2 : 1) + bridgePenalty
}

export async function getDefaultPairingAddress(
  getDefaultRouteInterfaceNames: DefaultRouteInterfaceLookup = getWindowsDefaultRouteInterfaceNames
): Promise<string | null> {
  return (
    selectAutoAdvertisedPairingAddress(
      await getPairingNetworkInterfaces(getDefaultRouteInterfaceNames)
    ) ?? null
  )
}
