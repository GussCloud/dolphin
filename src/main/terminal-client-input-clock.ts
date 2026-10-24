// When a paired client (phone, remote desktop) last typed into a PTY through the runtime. The
// renderer's own keystrokes live in `lastInputAtByPty`; neither records Dolphin's own injections.
import { performance } from 'node:perf_hooks'
import { lastInputAtByPty } from './ipc/pty/delivery/visibility-state'

const clientInputAtByPty = new Map<string, number>()

export function noteClientTerminalInput(ptyId: string): void {
  clientInputAtByPty.set(ptyId, performance.now())
}

export function readClientTerminalInputAt(ptyId: string): number | undefined {
  return clientInputAtByPty.get(ptyId)
}

export function forgetClientTerminalInput(ptyId: string): void {
  clientInputAtByPty.delete(ptyId)
}

/** The latest user keystroke on a PTY from any surface; compare two readings for equality only. */
export function readLatestTerminalInputAt(ptyId: string): number | undefined {
  const local = lastInputAtByPty.get(ptyId)
  const client = clientInputAtByPty.get(ptyId)
  return local === undefined ? client : client === undefined ? local : Math.max(local, client)
}
