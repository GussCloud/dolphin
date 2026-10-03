import { HeadlessEmulator } from '../daemon/headless-emulator'
import { DESKTOP_TERMINAL_SCROLLBACK_ROWS_DEFAULT } from '../../shared/terminal-scrollback-policy'
import { MAX_TERMINAL_READ_LIMIT } from './terminal-tail-limits'
import { MOBILE_SUBSCRIBE_SCROLLBACK_ROWS } from './scrollback-limits'

/** How many scrollback rows main's per-PTY headless model retains. The model is
 *  a second full grid beside the daemon's, so its depth is main's dominant
 *  per-terminal heap term. */
export type HeadlessModelBinding = 'pane-less' | 'desktop-bound'

// Why: without a desktop pane, readers are CLI/orchestration reads (capped at
// MAX_TERMINAL_READ_LIMIT) and mobile/remote subscribes (MOBILE_SUBSCRIBE_SCROLLBACK_ROWS by default).
export const PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS = Math.max(
  MAX_TERMINAL_READ_LIMIT,
  MOBILE_SUBSCRIBE_SCROLLBACK_ROWS
)

// Why: a hidden desktop pane drops its renderer bytes and is rebuilt from this
// model on reveal (pty:snapshot clears the xterm and replays), so the model must
// hold the default desktop scrollback or reveal silently shortens history.
export const DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS = DESKTOP_TERMINAL_SCROLLBACK_ROWS_DEFAULT

export function headlessModelScrollbackRows(binding: HeadlessModelBinding): number {
  return binding === 'desktop-bound'
    ? DESKTOP_BOUND_HEADLESS_MODEL_SCROLLBACK_ROWS
    : PANE_LESS_HEADLESS_MODEL_SCROLLBACK_ROWS
}

/** Main's per-PTY model. Depth only grows: lowering would discard history a
 *  reader may still restore. The runtime never grows a disposed model, because
 *  disposeHeadlessTerminal unmaps a model before disposing it. */
export class DepthGrowingHeadlessEmulator extends HeadlessEmulator {
  get scrollbackRows(): number {
    return this.terminal.options.scrollback ?? 0
  }

  growScrollbackRows(rows: number): void {
    if (Number.isSafeInteger(rows) && rows > this.scrollbackRows) {
      this.terminal.options.scrollback = rows
    }
  }
}
