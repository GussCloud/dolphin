import { pollRemoteServerUpdater } from '../../../src/shared/remote-server-updater-polling'
import { projectDesktopUpdateOffer, type DesktopUpdateRun } from './desktop-update-offer'
import type { DesktopUpdaterSnapshot } from './desktop-update-reply-schema'

export type DesktopUpdatePort = {
  getStatus: () => Promise<DesktopUpdaterSnapshot>
  download: () => Promise<unknown>
  install: () => Promise<{ targetVersion: string }>
  wait: (milliseconds: number) => Promise<void>
  now?: () => number
}

const DESKTOP_UPDATE_TIMING = { operationTimeoutMs: 10 * 60 * 1000, pollIntervalMs: 1000 }

/** Finishes the desktop's pending update: download if needed, then install (the desktop restarts). */
export async function runDesktopUpdate(
  port: DesktopUpdatePort,
  onRun: (run: DesktopUpdateRun) => void
): Promise<void> {
  const offer = projectDesktopUpdateOffer(await port.getStatus())
  if (!offer) {
    throw new Error('remote_update_not_available')
  }
  let version = offer.version
  onRun({ phase: 'starting', version })
  if (offer.phase === 'available') {
    await port.download()
  }
  if (offer.phase !== 'ready') {
    const downloaded = await pollRemoteServerUpdater(
      '',
      { getUpdaterStatus: port.getStatus, wait: port.wait, now: port.now },
      DESKTOP_UPDATE_TIMING,
      (snapshot) => snapshot.status.state === 'downloaded',
      (snapshot) => {
        if (snapshot.status.state === 'downloading') {
          onRun({ phase: 'downloading', version, percent: snapshot.status.percent ?? 0 })
        }
      }
    )
    version = downloaded.status.version ?? version
  }
  const install = await port.install()
  onRun({ phase: 'installing', version: install.targetVersion || version })
}
