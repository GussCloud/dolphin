// Structural so the mobile client's looser reply schema polls through the same loop.
type PolledUpdaterSnapshot = { status: { state: string; message?: string } }

type PollingTransport<Snapshot extends PolledUpdaterSnapshot> = {
  getUpdaterStatus: (environmentId: string) => Promise<Snapshot>
  now?: () => number
  wait: (milliseconds: number) => Promise<void>
}

type PollingTiming = {
  operationTimeoutMs: number
  pollIntervalMs: number
}

export async function pollRemoteServerUpdater<Snapshot extends PolledUpdaterSnapshot>(
  environmentId: string,
  transport: PollingTransport<Snapshot>,
  timing: PollingTiming,
  accept: (snapshot: Snapshot) => boolean,
  onSnapshot: (snapshot: Snapshot) => void
): Promise<Snapshot> {
  const now = transport.now ?? Date.now
  const deadline = now() + timing.operationTimeoutMs
  while (now() < deadline) {
    const snapshot = await transport.getUpdaterStatus(environmentId)
    if (snapshot.status.state === 'error') {
      throw new Error(snapshot.status.message ?? 'remote_update_failed')
    }
    onSnapshot(snapshot)
    if (accept(snapshot)) {
      return snapshot
    }
    await transport.wait(timing.pollIntervalMs)
  }
  throw new Error('remote_update_updater_timeout')
}
