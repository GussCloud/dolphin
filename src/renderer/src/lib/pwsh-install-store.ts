import { useSyncExternalStore } from 'react'
import type { PwshInstallResult } from '../../../shared/pwsh-install'
import { refreshWindowsTerminalCapabilities } from './windows-terminal-capabilities'

export type PwshInstallPhase =
  | { kind: 'idle' }
  | { kind: 'installing' }
  | { kind: 'installed'; pwshAvailable: boolean }
  | { kind: 'failed'; message: string }
  | { kind: 'timed-out' }
  | { kind: 'winget-unavailable' }

const IDLE: PwshInstallPhase = { kind: 'idle' }

// Why module state: onboarding and Settings share one install, and it must outlive the view that started it.
let phase: PwshInstallPhase = IDLE
const listeners = new Set<() => void>()

function setPhase(next: PwshInstallPhase): void {
  phase = next
  for (const listener of listeners) {
    listener()
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function phaseFromResult(result: PwshInstallResult): PwshInstallPhase {
  switch (result.status) {
    case 'installed':
      return { kind: 'installed', pwshAvailable: result.pwshAvailable }
    case 'failed':
      return { kind: 'failed', message: result.message }
    case 'timed-out':
      return { kind: 'timed-out' }
    case 'winget-unavailable':
      return { kind: 'winget-unavailable' }
    case 'cancelled':
    case 'unsupported':
      return IDLE
  }
}

export function isPwshInstallSupported(): boolean {
  return typeof window !== 'undefined' && window.api?.pwsh?.installSupported === true
}

export async function startPwshInstall(): Promise<void> {
  if (phase.kind === 'installing') {
    return
  }
  setPhase({ kind: 'installing' })
  let result: PwshInstallResult
  try {
    result = await window.api.pwsh.install()
  } catch (error) {
    result = { status: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
  if (result.status === 'installed') {
    // Main already re-probed; this pushes the fresh answer to every capability subscriber.
    await refreshWindowsTerminalCapabilities('local').catch(() => undefined)
  }
  setPhase(phaseFromResult(result))
}

export function cancelPwshInstall(): void {
  void window.api.pwsh.cancelInstall().catch(() => undefined)
}

export function usePwshInstallPhase(): PwshInstallPhase {
  return useSyncExternalStore(subscribe, () => phase)
}

export function resetPwshInstallStoreForTests(): void {
  phase = IDLE
  listeners.clear()
}
