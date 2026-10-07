import type { MobileConnectionPath } from './stable-logical-rpc-client'
import { transportText } from './transport-text'

export function mobileConnectionPathLabel(path: MobileConnectionPath): string {
  if (path === 'relay') {
    return 'Dolphin Relay'
  }
  return path === 'tailscale'
    ? transportText('pathDirectTailscale')
    : transportText('pathDirectLan')
}
