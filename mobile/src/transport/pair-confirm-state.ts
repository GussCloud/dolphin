import { parsePairingCode } from './pairing'
import type { PairingOffer } from './types'
import { transportText } from './transport-text'

export type PairConfirmRouteState =
  | { kind: 'ready'; offer: PairingOffer; errorMessage: '' }
  | { kind: 'error'; offer: null; errorMessage: string }

export function resolvePairConfirmRouteState(code: string | undefined): PairConfirmRouteState {
  if (!code) {
    return { kind: 'error', offer: null, errorMessage: transportText('missingPairingCode') }
  }

  const offer = parsePairingCode(code)
  if (!offer) {
    return { kind: 'error', offer: null, errorMessage: transportText('invalidPairingCode') }
  }

  return { kind: 'ready', offer, errorMessage: '' }
}
