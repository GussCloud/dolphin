// When a paired client (phone, remote desktop) last typed into a PTY through the runtime. The
// renderer's own keystrokes live in `lastInputAtByPty`; neither records Dolphin's own injections.
import { performance } from 'node:perf_hooks'

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
