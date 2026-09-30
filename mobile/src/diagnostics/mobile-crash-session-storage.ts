import {
  sanitizeCrashReportBreadcrumbs,
  sanitizeCrashReportString,
  type CrashReportBreadcrumb,
  type CrashReportBreadcrumbInput
} from '../../../src/shared/crash-reporting'
import { isRecord } from '../../../src/shared/agent-status-child-work-value-guards'

export type MobileCrashStorage = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
}

export type MobileCrashSessionSnapshot = {
  openedAt: string
  breadcrumbs: CrashReportBreadcrumb[]
  endedAbnormally: boolean
}

export type PersistedMobileCrashSession = Omit<MobileCrashSessionSnapshot, 'endedAbnormally'> & {
  marker: 'open' | 'closed'
}

export type PersistedMobileCrashJournal = {
  version: 1
  activeSession: PersistedMobileCrashSession
  latestAbnormalSession?: MobileCrashSessionSnapshot
  dismissedAbnormalSessionOpenedAt?: string
}

export const MOBILE_CRASH_SESSION_STORAGE_KEY = 'dolphin.mobile-crash-session.v1'
export const MAX_MOBILE_CRASH_DIAGNOSTICS_CHARS = 24_000
export const MAX_STORED_MOBILE_CRASH_BREADCRUMBS = 30

export function snapshotMobileCrashSession(
  session: PersistedMobileCrashSession
): MobileCrashSessionSnapshot {
  return {
    openedAt: session.openedAt,
    endedAbnormally: session.marker === 'open',
    breadcrumbs: session.breadcrumbs.map((breadcrumb) => ({
      ...breadcrumb,
      ...(breadcrumb.data ? { data: { ...breadcrumb.data } } : {})
    }))
  }
}

export function parseMobileCrashJournal(raw: string): PersistedMobileCrashJournal | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1) {
      return null
    }
    const activeSession = parseSession(parsed.activeSession)
    if (!activeSession) {
      return null
    }
    const latestAbnormalSession = parseSnapshot(parsed.latestAbnormalSession)
    const dismissedAbnormalSessionOpenedAt =
      typeof parsed.dismissedAbnormalSessionOpenedAt === 'string'
        ? sanitizeCrashReportString(parsed.dismissedAbnormalSessionOpenedAt, 80)
        : null
    return {
      version: 1,
      activeSession,
      ...(latestAbnormalSession ? { latestAbnormalSession } : {}),
      ...(dismissedAbnormalSessionOpenedAt ? { dismissedAbnormalSessionOpenedAt } : {})
    }
  } catch {
    return null
  }
}

export function serializeMobileCrashJournal(journal: PersistedMobileCrashJournal): string {
  const bounded: PersistedMobileCrashJournal = {
    version: 1,
    activeSession: {
      ...journal.activeSession,
      breadcrumbs: [...journal.activeSession.breadcrumbs]
    },
    ...(journal.latestAbnormalSession
      ? {
          latestAbnormalSession: {
            ...journal.latestAbnormalSession,
            breadcrumbs: [...journal.latestAbnormalSession.breadcrumbs]
          }
        }
      : {}),
    ...(journal.dismissedAbnormalSessionOpenedAt
      ? { dismissedAbnormalSessionOpenedAt: journal.dismissedAbnormalSessionOpenedAt }
      : {})
  }
  let serialized = JSON.stringify(bounded)
  while (serialized.length > MAX_MOBILE_CRASH_DIAGNOSTICS_CHARS) {
    const previous = bounded.latestAbnormalSession?.breadcrumbs
    const active = bounded.activeSession.breadcrumbs
    if (active.length > 1) {
      active.shift()
    } else if (previous && previous.length > 1) {
      previous.shift()
    } else {
      break
    }
    serialized = JSON.stringify(bounded)
  }
  return serialized
}

function parseSession(value: unknown): PersistedMobileCrashSession | null {
  const session = parseSessionData(value)
  if (
    !isRecord(value) ||
    !session ||
    (value.marker !== 'open' && value.marker !== 'closed')
  ) {
    return null
  }
  return {
    ...session,
    marker: value.marker
  }
}

function parseSnapshot(value: unknown): MobileCrashSessionSnapshot | null {
  const session = parseSessionData(value)
  if (!isRecord(value) || !session) {
    return null
  }
  const endedAbnormally =
    typeof value.endedAbnormally === 'boolean'
      ? value.endedAbnormally
      : !session.breadcrumbs.some((breadcrumb) => breadcrumb.name === 'render_error_contained')
  return { ...session, endedAbnormally }
}

function parseSessionData(
  value: unknown
): Omit<MobileCrashSessionSnapshot, 'endedAbnormally'> | null {
  if (!isRecord(value)) {
    return null
  }
  if (typeof value.openedAt !== 'string' || !Array.isArray(value.breadcrumbs)) {
    return null
  }
  const recentBreadcrumbs = value.breadcrumbs
    .filter(isStoredBreadcrumb)
    .slice(-MAX_STORED_MOBILE_CRASH_BREADCRUMBS)
  const breadcrumbs = recentBreadcrumbs.flatMap(
    (breadcrumb) => sanitizeCrashReportBreadcrumbs([breadcrumb]) ?? []
  )
  return {
    openedAt: sanitizeCrashReportString(value.openedAt, 80),
    breadcrumbs
  }
}

// Why a guard: the journal is read back from device storage, so each row is re-checked, not trusted.
function isStoredBreadcrumb(value: unknown): value is CrashReportBreadcrumbInput {
  return (
    isRecord(value) &&
    typeof value.createdAt === 'string' &&
    typeof value.name === 'string' &&
    (value.data === undefined || isRecord(value.data)) &&
    (value.origin === undefined || typeof value.origin === 'string')
  )
}
