import { useCallback, useEffect, useRef, useState } from 'react'
import { createHostConnectRefetchGate } from '../transport/host-connect-refetch-gate'
import type { RpcClient } from '../transport/rpc-client'
import {
  desktopUpdateDownload,
  desktopUpdateInstall,
  desktopUpdaterStatusPoll
} from './desktop-update-operations'
import type { DesktopUpdateOffersSetter } from './desktop-update-offer-fetch'
import {
  desktopUpdateErrorMessage,
  settleInstalledDesktopUpdate,
  type DesktopUpdateRun
} from './desktop-update-offer'
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
function settleRunOnReconnect(
  client: RpcClient,
  targetVersion: string,
  clear: () => void,
  fail: (run: DesktopUpdateRun) => void
): () => void {
  const gate = createHostConnectRefetchGate()
  gate.observe(client.getState())
  let disposed = false
  const unsubscribe = client.onStateChange((state) => {
    if (!gate.observe(state)) {
      return
    }
    void desktopUpdaterStatusPoll
      .request(client)
      .then((reply) =>
        settleInstalledDesktopUpdate(targetVersion, desktopUpdaterStatusPoll.interpret(reply))
      )
      // Why: an unreadable status is unverifiable, not a failure; fall back to the offer refetch.
      .catch(() => null)
      .then((failed) => {
        if (disposed) {
          return
        }
        if (!failed) {
          dispose()
          clear()
          return
        }
        // Why: keep watching — a later reconnect on the target version still settles the run.
        fail(failed)
      })
  })
  const dispose = (): void => {
    disposed = true
    unsubscribe()
  }
  return dispose
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
          const failRun = (failed: DesktopUpdateRun): void => {
            setRuns((previous) => ({ ...previous, [hostId]: failed }))
          }
          cleanupsRef.current.set(
            hostId,
            settleRunOnReconnect(client, run.version, clearRun, failRun)
          )
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
