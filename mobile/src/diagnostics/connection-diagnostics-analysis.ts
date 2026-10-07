import { isTailscaleEndpoint } from '../../../src/shared/remote-runtime-tailscale-hint'
import {
  relayHostReachabilityForCloseCode,
  type RelayHostReachabilityFromCloseCode
} from '../transport/relay-host-reachability'
import type {
  ConnectionLogEntry,
  ConnectionState,
  MobileConnectionDiagnosticPath
} from '../transport/types'
import type { SupportedUiLocale } from '../../../src/shared/ui-locale'
import { diagnosticsCatalog } from '../i18n/catalogs/diagnostics'
import type { diagnosticsEn } from '../i18n/catalogs/diagnostics/en'
import {
  formatMobileCatalogMessage,
  type MobileCatalogKey,
  type MobileTranslate,
  type MobileTranslateArgs
} from '../i18n/mobile-i18n-catalog'
import { getActiveMobileLocale } from '../i18n/mobile-locale-state'

type DiagnosticsTranslate = MobileTranslate<typeof diagnosticsEn>

export type ConnectionDiagnosis = {
  likelyCause: string
  nextStep: string
  reportability: 'none' | 'dolphin-relay'
}

type DiagnoseConnectionArgs = {
  endpoint: string
  state: ConnectionState
  activePath?: MobileConnectionDiagnosticPath
  pendingPath?: MobileConnectionDiagnosticPath | null
  entries: readonly ConnectionLogEntry[]
  /** The shareable report passes `en` so support reads one language; the screen omits it. */
  locale?: SupportedUiLocale
}

function diagnosticsTranslator(locale: SupportedUiLocale): DiagnosticsTranslate {
  return <Key extends MobileCatalogKey<typeof diagnosticsEn>>(
    key: Key,
    ...args: MobileTranslateArgs<typeof diagnosticsEn, Key>
  ) => formatMobileCatalogMessage(diagnosticsCatalog, locale, key, args[0])
}

export function diagnoseConnection(args: DiagnoseConnectionArgs): ConnectionDiagnosis {
  const t = diagnosticsTranslator(args.locale ?? getActiveMobileLocale())
  if (args.state === 'connected') {
    return {
      likelyCause: args.activePath
        ? t('causeHealthyVia', { path: formatPath(args.activePath, t) })
        : t('causeHealthy'),
      nextStep: t('nextNoAction'),
      reportability: 'none'
    }
  }
  const selected = selectDiagnosticFailure(args.entries)
  const failure = selected?.entry
  const evidence = failure ? diagnosticEvidence(failure) : ''
  const diagnosis = diagnoseFailure(args, failure, evidence, t)
  if (!selected?.staleSince) {
    return diagnosis
  }
  // Evidence from before the last resume or network change is still the best
  // account of a host that has not answered since; it is just not a current,
  // sendable incident.
  return {
    likelyCause:
      selected.staleSince === 'network-changed'
        ? t('causeBeforeNetworkChange', { cause: diagnosis.likelyCause })
        : t('causeBeforeResume', { cause: diagnosis.likelyCause }),
    nextStep: diagnosis.nextStep,
    reportability: 'none'
  }
}

function diagnoseFailure(
  args: DiagnoseConnectionArgs,
  failure: ConnectionLogEntry | undefined,
  evidence: string,
  t: DiagnosticsTranslate
): ConnectionDiagnosis {
  if (/relay director resolve failed \(401\)/i.test(evidence)) {
    return {
      likelyCause: t('causeRelayCredentialRejected'),
      nextStep: t('nextRelayCredentialRejected'),
      reportability: 'none'
    }
  }

  if (/relay director resolve failed \(503\)/i.test(evidence)) {
    const retryMs = parseRetryDelayMs(evidence)
    return {
      likelyCause:
        retryMs == null
          ? t('causeRelayUnavailable')
          : t('causeRelayUnavailableRetry', { delay: formatDelay(retryMs, t) }),
      nextStep: t('nextRelayUnavailable'),
      reportability: 'none'
    }
  }

  // After the director branches: a director error also arrives as a relay dial failure.
  const relayDial = relayDialFailure(failure, t)
  if (relayDial) {
    return relayDial
  }

  if (/liveness-timeout|liveness timeout|connection health check failed/i.test(evidence)) {
    const relayLiveness = failure?.code === 'liveness-timeout' && failure.path === 'relay'
    const structuredDirectLiveness =
      failure?.code === 'liveness-timeout' &&
      (failure.path === 'lan' || failure.path === 'tailscale')
    const viaRelay = relayLiveness || (!structuredDirectLiveness && args.activePath === 'relay')
    return {
      likelyCause: viaRelay ? t('causeRelayLiveness') : t('causeHostLiveness'),
      nextStep: t('nextLiveness'),
      reportability: relayLiveness ? 'dolphin-relay' : 'none'
    }
  }

  if (/relay-session-failed|active relay session failed/i.test(evidence)) {
    return {
      likelyCause: t('causeRelaySessionFailed'),
      nextStep: t('nextRelaySessionFailed'),
      reportability:
        failure?.code === 'relay-session-failed' && failure.path === 'relay'
          ? 'dolphin-relay'
          : 'none'
    }
  }

  if (/authentication-rejected|unauthorized|pairing may be revoked/i.test(evidence)) {
    return {
      likelyCause: t('causeAuthRejected'),
      nextStep: t('nextAuthRejected'),
      reportability: 'none'
    }
  }

  if (/connect-timeout|websocket connect timeout/i.test(evidence)) {
    return {
      likelyCause: isTailscaleEndpoint(args.endpoint)
        ? t('causeTailscaleTimeout')
        : t('causeDirectTimeout'),
      nextStep:
        args.pendingPath === 'relay' ? t('nextRelayRecoveryInProgress') : t('nextCheckNetwork'),
      reportability: 'none'
    }
  }

  if (/handshake-timeout|handshake timeout/i.test(evidence)) {
    return {
      likelyCause: t('causeHandshakeTimeout'),
      nextStep: t('nextHandshakeTimeout'),
      reportability: 'none'
    }
  }

  if (args.pendingPath === 'relay') {
    return {
      likelyCause: t('causeRelayRecoveryPending'),
      nextStep: t('nextRelayRecoveryPending'),
      reportability: 'none'
    }
  }

  return {
    likelyCause: t('causeUnknown'),
    nextStep: t('nextUnknown'),
    reportability: 'none'
  }
}

export function getReportableConnectionIncidentId(args: DiagnoseConnectionArgs): string | null {
  const selected = selectDiagnosticFailure(args.entries)
  if (!selected || selected.staleSince) {
    return null
  }
  const t = diagnosticsTranslator(args.locale ?? getActiveMobileLocale())
  return diagnoseFailure(args, selected.entry, diagnosticEvidence(selected.entry), t)
    .reportability === 'dolphin-relay'
    ? selected.entry.id
    : null
}

// Reads to the relay close code behind a failed dial. Longer than the host
// row's copy on purpose: this is the line the user pastes into a bug report.
const RELAY_DIAL_ADVICE = {
  'host-offline': { likelyCause: 'causeRelayHostOffline', nextStep: 'nextRelayHostOffline' },
  'credential-refused': {
    likelyCause: 'causeRelayCredentialRefused',
    nextStep: 'nextRelayCredentialRefused'
  },
  unreachable: { likelyCause: 'causeRelayUnreachable', nextStep: 'nextRelayUnreachable' },
  connecting: { likelyCause: 'causeRelayConnecting', nextStep: 'nextRelayConnecting' }
} as const satisfies Record<
  RelayHostReachabilityFromCloseCode,
  { likelyCause: string; nextStep: string }
>

// The cell's close code names the desktop's state; a direct timeout in the same
// window only says the phone is off the LAN, so the relay verdict wins. Never
// reportable: every cause here is the desktop's or the phone's, not Relay's.
function relayDialFailure(
  failure: ConnectionLogEntry | undefined,
  t: DiagnosticsTranslate
): ConnectionDiagnosis | null {
  if (failure?.code !== 'relay-dial-failed') {
    return null
  }
  const code = failure.relayCloseCode
  if (code == null) {
    return {
      likelyCause: t('causeRelayDialNoAnswer'),
      nextStep: t(RELAY_DIAL_ADVICE.unreachable.nextStep),
      reportability: 'none'
    }
  }
  const advice = RELAY_DIAL_ADVICE[relayHostReachabilityForCloseCode(code)]
  return {
    likelyCause: t(advice.likelyCause, { code }),
    nextStep: t(advice.nextStep),
    reportability: 'none'
  }
}

// Newest failure since the last resume/network change; failing that, the newest
// since the last connection or session start, flagged stale. The window used to
// stop at every resume, and iOS resumes the app often enough that a host that
// never answers left the window empty and the report cause-less.
function selectDiagnosticFailure(
  entries: readonly ConnectionLogEntry[]
): { entry: ConnectionLogEntry; staleSince: ResumeBoundary | null } | undefined {
  const sessionStart = entries.findLastIndex(isSessionBoundary) + 1
  const sinceSession = entries.slice(sessionStart)
  const boundaryIndex = sinceSession.findLastIndex(isResumeBoundary)
  const current = newestFailure(sinceSession.slice(boundaryIndex + 1))
  if (current) {
    return { entry: current, staleSince: null }
  }
  const stale = newestFailure(sinceSession.slice(0, boundaryIndex + 1))
  const boundary = sinceSession[boundaryIndex]?.code
  return stale && isResumeBoundaryCode(boundary)
    ? { entry: stale, staleSince: boundary }
    : undefined
}

// Relay-path evidence outranks a newer direct failure: off the LAN every direct
// dial times out, which says nothing, while the relay names the desktop's state.
// Among relay failures the newest wins, so a fresh session close or director
// error is never hidden behind an older verdict.
function newestFailure(entries: readonly ConnectionLogEntry[]): ConnectionLogEntry | undefined {
  const newestFirst = entries.toReversed().filter(isDiagnosticFailure)
  return newestFirst.find((entry) => entry.path === 'relay') ?? newestFirst[0]
}

function isSessionBoundary(entry: ConnectionLogEntry): boolean {
  return (
    entry.code === 'client-session-started' ||
    entry.code === 'relay-connected' ||
    entry.code === 'direct-connected' ||
    entry.message === 'Authenticated'
  )
}

type ResumeBoundary = 'app-resumed' | 'network-changed'

function isResumeBoundaryCode(code: ConnectionLogEntry['code']): code is ResumeBoundary {
  return code === 'app-resumed' || code === 'network-changed'
}

function isResumeBoundary(entry: ConnectionLogEntry): boolean {
  return isResumeBoundaryCode(entry.code)
}

function diagnosticEvidence(entry: ConnectionLogEntry): string {
  return `${entry.code ?? ''} ${entry.message} ${entry.detail ?? ''}`
}

function isDiagnosticFailure(entry: ConnectionLogEntry): boolean {
  return /relay director resolve failed \((?:401|503)\)|liveness-timeout|liveness timeout|connection health check failed|relay-dial-failed|relay dial failed|relay-session-failed|active relay session failed|authentication-rejected|unauthorized|pairing may be revoked|connect-timeout|websocket connect timeout|handshake-timeout|handshake timeout/i.test(
    diagnosticEvidence(entry)
  )
}

function parseRetryDelayMs(evidence: string): number | null {
  const match = /retry(?:-|\s)?after(?:=|\s)(\d+)ms/i.exec(evidence)
  return match ? Number(match[1]) : null
}

function formatDelay(ms: number, t: DiagnosticsTranslate): string {
  return ms < 60_000
    ? t('delaySeconds', { seconds: Math.round(ms / 1000) })
    : t('delayMinutes', { minutes: Math.round(ms / 60_000) })
}

function formatPath(path: MobileConnectionDiagnosticPath, t: DiagnosticsTranslate): string {
  if (path === 'relay') {
    return 'Relay'
  }
  return path === 'tailscale' ? t('pathTailscaleDirect') : t('pathLanDirect')
}
