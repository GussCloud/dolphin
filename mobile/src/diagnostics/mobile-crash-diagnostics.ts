import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { Platform, Share } from 'react-native'
import { MobileCrashSessionJournal, type MobileCrashSessionSnapshot } from './mobile-crash-session'
import {
  installMobileGlobalErrorCapture,
  resolveReleaseRejectionTracker
} from './mobile-global-error-capture'

const journal = new MobileCrashSessionJournal(AsyncStorage)

export function startMobileCrashSession(): Promise<MobileCrashSessionSnapshot | null> {
  return journal.start()
}

/** Journals uncaught JS errors and (release) unhandled rejections; never sends them anywhere. */
export function installMobileGlobalCrashCapture(): void {
  installMobileGlobalErrorCapture({
    errorUtils: typeof ErrorUtils === 'undefined' ? null : ErrorUtils,
    enableRejectionTracker: resolveReleaseRejectionTracker(
      typeof HermesInternal === 'undefined' ? undefined : HermesInternal,
      __DEV__
    ),
    record: (error, kind) => journal.recordUncaughtError(error, kind)
  })
}

export function recordMobileRouteBreadcrumb(segments: readonly string[]): Promise<void> {
  return journal.recordRoute(segments)
}

export function recordMobileAppState(state: string): Promise<void> {
  return journal.recordAppState(state)
}

export function recordMobileRenderError(
  error: unknown,
  componentStack?: string | null
): Promise<void> {
  return journal.recordRenderError(error, componentStack)
}

export function getPreviousMobileCrashSession(): Promise<MobileCrashSessionSnapshot | null> {
  return journal.getLatestAbnormalSession()
}

export function getUndismissedPreviousMobileCrashSession(): Promise<MobileCrashSessionSnapshot | null> {
  return journal.getUndismissedLatestAbnormalSession()
}

export function dismissPreviousMobileCrashSession(openedAt: string): Promise<void> {
  return journal.dismissLatestAbnormalSession(openedAt)
}

export function buildMobileCrashDiagnosticsReport(): Promise<string> {
  return journal.buildReport({
    version: Constants.expoConfig?.version ?? 'unknown',
    platform: `${Platform.OS} ${Platform.Version ?? ''}`.trim()
  })
}

export async function shareMobileCrashDiagnostics(): Promise<void> {
  await Share.share({
    title: 'Dolphin Mobile crash diagnostics',
    message: await buildMobileCrashDiagnosticsReport()
  })
}
