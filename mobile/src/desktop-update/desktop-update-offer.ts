import type { DesktopUpdaterSnapshot } from './desktop-update-reply-schema'

/** What the desktop's own updater holds that this phone may finish for it. */
export type DesktopUpdateOffer =
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'ready'; version: string }

/** An update this phone started; it outranks the host's offer on the card until it settles. */
export type DesktopUpdateRun =
  | { phase: 'starting'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'installing'; version: string }
  | { phase: 'failed'; version: string; message: string }

export type DesktopUpdateTag = {
  label: string
  tone: 'accent' | 'progress' | 'error'
  actionable: boolean
}

export function projectDesktopUpdateOffer(
  snapshot: DesktopUpdaterSnapshot | null
): DesktopUpdateOffer | null {
  // Why: manual-install hosts (deb/rpm, unsupervised serve, dev builds) get no tag at all.
  if (!snapshot?.support.automatic) {
    return null
  }
  const { state, version, percent } = snapshot.status
  if (!version) {
    return null
  }
  switch (state) {
    case 'available':
      return { phase: 'available', version }
    case 'downloading':
      return { phase: 'downloading', version, percent: percent ?? 0 }
    case 'downloaded':
      return { phase: 'ready', version }
    default:
      return null
  }
}

export function desktopUpdateTag(
  offer: DesktopUpdateOffer | null,
  run: DesktopUpdateRun | null
): DesktopUpdateTag | null {
  const current = run ?? offer
  if (!current) {
    return null
  }
  switch (current.phase) {
    case 'available':
      return { label: 'Update available', tone: 'accent', actionable: true }
    case 'ready':
      return { label: 'Update ready', tone: 'accent', actionable: true }
    case 'starting':
      return { label: 'Starting update…', tone: 'progress', actionable: false }
    case 'downloading':
      return {
        label: `Downloading ${Math.round(current.percent)}%`,
        tone: 'progress',
        // Why: a download the desktop started on its own can still be finished from here.
        actionable: run === null
      }
    case 'installing':
      return { label: 'Restarting desktop…', tone: 'progress', actionable: false }
    case 'failed':
      return { label: 'Update failed · Retry', tone: 'error', actionable: true }
  }
}

export function desktopUpdateConfirmMessage(
  hostName: string,
  offer: DesktopUpdateOffer | null,
  run: DesktopUpdateRun | null
): string {
  const version = run?.version || offer?.version
  const target = version ? `Dolphin ${version}` : 'the latest Dolphin'
  const failure =
    run?.phase === 'failed'
      ? `Last attempt failed: ${run.message}

`
      : ''
  return `${failure}Install ${target} on "${hostName}"? Dolphin will restart on that desktop.`
}

export function desktopUpdateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  switch (message) {
    case 'remote_update_manual_required':
      return 'This desktop must be updated manually.'
    case 'remote_update_not_available':
      return 'The desktop no longer reports an available update.'
    case 'remote_update_not_downloaded':
      return 'The update has not finished downloading on the desktop.'
    case 'remote_update_updater_timeout':
      return 'Timed out waiting for the desktop updater.'
    default:
      return message
  }
}
