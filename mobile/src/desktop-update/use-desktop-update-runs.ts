import { useCallback, useEffect, useRef, useState } from 'react'
import { createHostConnectRefetchGate } from '../transport/host-connect-refetch-gate'
import type { RpcClient } from '../transport/rpc-client'
import {
  desktopUpdateDownload,
  desktopUpdateInstall,
  desktopUpdaterStatusPoll
} from './desktop-update-operations'
import type { DesktopUpdateOffersSetter } from './desktop-update-offer-fetch'
import { desktopUpdateErrorMessage, type DesktopUpdateRun } from './desktop-update-offer'
import { runDesktopUpdate, type DesktopUpdatePort } from './run-desktop-update'

function desktopUpdatePort(client: RpcClient): DesktopUpdatePort {
  return {
    getStatus: async () =>
      desktopUpdaterStatusPoll.interpret(await desktopUpdaterStatusPoll.request(client)),
    download: async () =>
      desktopUpdateDownload.interpret(await desktopUpdateDownload.request(client)),
    install: async () => desktopUpdateInstall.interpret(await desktopUpdateInstall.request(client)),
    wait: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
  }
}

/** Settles an installing run once the desktop comes back; a drop alone proves nothing. */
function clearRunOnReconnect(client: RpcClient, clear: () => void): () => void {
  const gate = createHostConnectRefetchGate()
  gate.observe(client.getState())
  const unsubscribe = client.onStateChange((state) => {
    if (gate.observe(state)) {
      unsubscribe()
      clear()
    }
  })
  return unsubscribe
}

export function useDesktopUpdateRuns(
  clients: readonly { hostId: string; client: RpcClient }[],
  setOffers: DesktopUpdateOffersSetter
) {
  const [runs, setRuns] = useState<Record<string, DesktopUpdateRun>>({})
  const clientsRef = useRef(clients)
  const cleanupsRef = useRef(new Map<string, () => void>())

  useEffect(() => {
    clientsRef.current = clients
  }, [clients])

  useEffect(() => {
    const cleanups = cleanupsRef.current
    return () => {
      for (const cleanup of cleanups.values()) {
        cleanup()
      }
      cleanups.clear()
    }
  }, [])

  const start = useCallback(
    (hostId: string) => {
      const client = clientsRef.current.find((entry) => entry.hostId === hostId)?.client
      if (!client) {
        return
      }
      cleanupsRef.current.get(hostId)?.()
      cleanupsRef.current.delete(hostId)
      const clearRun = (): void => {
        cleanupsRef.current.delete(hostId)
        setRuns(({ [hostId]: _settled, ...rest }) => rest)
        // Why: the pre-restart offer is stale; the reconnect refetch repopulates it.
        setOffers((previous) => ({ ...previous, [hostId]: null }))
      }
      const setRun = (run: DesktopUpdateRun): void => {
        setRuns((previous) => ({ ...previous, [hostId]: run }))
        if (run.phase === 'installing') {
          cleanupsRef.current.set(hostId, clearRunOnReconnect(client, clearRun))
        }
      }
      runDesktopUpdate(desktopUpdatePort(client), setRun).catch((error: unknown) => {
        setRuns((previous) => ({
          ...previous,
          [hostId]: {
            phase: 'failed',
            version: previous[hostId]?.version ?? '',
            message: desktopUpdateErrorMessage(error)
          }
        }))
      })
    },
    [setOffers]
  )

  return { runs, start }
}
