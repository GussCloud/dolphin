import type { WebContents } from 'electron'
import { holdGuestRendering } from './guest-rendering-hold'

type DebuggerLeaseState = {
  attachedByLease: boolean
  owners: Set<symbol>
}

export type ElectronDebuggerLease = {
  release: () => void
}

export type ElectronDebuggerLeaseOptions = {
  // Why: CDP work on a hidden guest needs frames and timers; only a lease that outlives its work opts out.
  holdRendering?: boolean
}

const debuggerLeases = new WeakMap<WebContents, DebuggerLeaseState>()

export function acquireElectronDebugger(
  webContents: WebContents,
  { holdRendering = true }: ElectronDebuggerLeaseOptions = {}
): ElectronDebuggerLease {
  if (webContents.isDestroyed()) {
    throw new Error('Browser tab is no longer available')
  }

  const dbg = webContents.debugger
  let state = debuggerLeases.get(webContents)
  if (!state) {
    state = { attachedByLease: false, owners: new Set() }
    debuggerLeases.set(webContents, state)
  }

  if (!dbg.isAttached()) {
    dbg.attach('1.3')
    state.attachedByLease = true
  }

  const owner = Symbol('electron-debugger-lease')
  state.owners.add(owner)
  const releaseRendering = holdRendering ? holdGuestRendering(webContents) : () => {}
  let released = false

  return {
    release: () => {
      if (released) {
        return
      }
      released = true
      releaseRendering()
      state.owners.delete(owner)
      if (state.owners.size > 0) {
        return
      }
      debuggerLeases.delete(webContents)
      if (!state.attachedByLease || !dbg.isAttached()) {
        return
      }
      try {
        dbg.detach()
      } catch {
        // Best-effort release: the tab may already be gone or DevTools may
        // have taken ownership after Electron emitted a detach event.
      }
    }
  }
}
