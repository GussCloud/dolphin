import { MOBILE_REMOTE_UPDATE_CAPABILITY } from '../../../src/shared/protocol-version'
import {
  hostStatusProbe,
  readProbedHostCapabilities
} from '../transport/host-status-probe-operations'
import type { RpcClient } from '../transport/rpc-client'
import { desktopUpdaterStatusRead } from './desktop-update-operations'
import { projectDesktopUpdateOffer, type DesktopUpdateOffer } from './desktop-update-offer'

export type DesktopUpdateOffersSetter = (
  updater: (
    previous: Record<string, DesktopUpdateOffer | null>
  ) => Record<string, DesktopUpdateOffer | null>
) => void

/** Reads the desktop's own updater state; a refused read keeps whatever the card already shows. */
export function fetchDesktopUpdateOffer(
  client: RpcClient,
  hostId: string,
  setOffers: DesktopUpdateOffersSetter,
  disposed: () => boolean
): void {
  void (async () => {
    const capabilities = readProbedHostCapabilities(
      await hostStatusProbe.requestSingleFlight(client, hostId)
    )
    if (capabilities === null) {
      return
    }
    let offer: DesktopUpdateOffer | null = null
    // Why: older desktops refuse updater.* from a mobile token, so ask only when advertised.
    if (capabilities.includes(MOBILE_REMOTE_UPDATE_CAPABILITY)) {
      const status = desktopUpdaterStatusRead.interpret(
        await desktopUpdaterStatusRead.requestSingleFlight(client, hostId)
      )
      if (!status.accepted) {
        return
      }
      offer = projectDesktopUpdateOffer(status.value)
    }
    if (!disposed()) {
      setOffers((previous) => ({ ...previous, [hostId]: offer }))
    }
  })().catch(() => {})
}
