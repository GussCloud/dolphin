import { compareAppVersions } from '../../../src/shared/app-version'
import type { DesktopUpdaterSnapshot } from './desktop-update-reply-schema'
import { desktopUpdateCatalog } from '../i18n/catalogs/desktop-update'
import { translate } from '../i18n/mobile-locale-state'

/** What the desktop's own updater holds that this phone may finish for it. */
export type DesktopUpdateOffer =
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; version: string; percent: number }
  | { phase: 'ready'; version: string }
  // Why: manual-install hosts (deb/rpm, unsupervised serve, dev builds) can only be told, not driven.
  | { phase: 'manual'; version: string }

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
  if (!snapshot) {
    return null
  }
  const { state, version, percent } = snapshot.status
  if (!version) {
    return null
  }
  if (!snapshot.support.automatic) {
    return ['available', 'downloading', 'downloaded'].includes(state)
      ? { phase: 'manual', version }
      : null
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
      return {
        label: translate(desktopUpdateCatalog, 'tagAvailable'),
        tone: 'accent',
        actionable: true
      }
    case 'ready':
      return {
        label: translate(desktopUpdateCatalog, 'tagReady'),
        tone: 'accent',
        actionable: true
      }
    case 'manual':
      return {
        label: translate(desktopUpdateCatalog, 'tagManual'),
        tone: 'accent',
        actionable: false
      }
    case 'starting':
      return {
        label: translate(desktopUpdateCatalog, 'tagStarting'),
        tone: 'progress',
        actionable: false
      }
    case 'downloading':
      return {
        label: translate(desktopUpdateCatalog, 'tagDownloading', {
          percent: Math.round(current.percent)
        }),
        tone: 'progress',
        // Why: a download the desktop started on its own can still be finished from here.
        actionable: run === null
      }
    case 'installing':
      return {
        label: translate(desktopUpdateCatalog, 'tagInstalling'),
        tone: 'progress',
        actionable: false
      }
    case 'failed':
      return {
        label: translate(desktopUpdateCatalog, 'tagFailed'),
        tone: 'error',
        actionable: true
      }
  }
}

export function desktopUpdateConfirmMessage(
  hostName: string,
  offer: DesktopUpdateOffer | null,
  run: DesktopUpdateRun | null
): string {
  const version = run?.version || offer?.version
  const question = version
    ? translate(desktopUpdateCatalog, 'confirmInstallVersion', { version, hostName })
    : translate(desktopUpdateCatalog, 'confirmInstallLatest', { hostName })
  return run?.phase === 'failed'
    ? `${translate(desktopUpdateCatalog, 'confirmLastAttemptFailed', { message: run.message })}\n\n${question}`
    : question
}

/** A relaunch on an older version than the install promised is a failed install, not success. */
export function settleInstalledDesktopUpdate(
  targetVersion: string,
  snapshot: DesktopUpdaterSnapshot
): DesktopUpdateRun | null {
  if (!targetVersion || compareAppVersions(snapshot.appVersion, targetVersion) >= 0) {
    return null
  }
  return {
    phase: 'failed',
    version: targetVersion,
    message: translate(desktopUpdateCatalog, 'errorRestartedOnOlder', {
      installedVersion: snapshot.appVersion,
      targetVersion
    })
  }
}

export function desktopUpdateErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  switch (message) {
    case 'remote_update_manual_required':
      return translate(desktopUpdateCatalog, 'errorManualRequired')
    case 'remote_update_not_available':
      return translate(desktopUpdateCatalog, 'errorNotAvailable')
    case 'remote_update_not_downloaded':
      return translate(desktopUpdateCatalog, 'errorNotDownloaded')
    case 'remote_update_updater_timeout':
      return translate(desktopUpdateCatalog, 'errorUpdaterTimeout')
    default:
      return message
  }
}
