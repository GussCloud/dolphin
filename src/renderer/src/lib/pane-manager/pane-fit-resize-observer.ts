import type { ManagedPane, ManagedPaneInternal } from './pane-manager-types'
import { cancelPendingSafeFitContinuations, safeFitAndThen } from './pane-tree-ops'

type ProposedDimensions = {
  cols: number
  rows: number
}

type StableFitPane = ManagedPane &
  Partial<Pick<ManagedPaneInternal, 'xtermContainer' | 'pendingObservedFitRafId'>>

type RowFlipHold = { cols: number; lowRows: number; highRows: number }
type LastFit = { cols: number; rows: number; at: number }

const MAX_STABILITY_FRAMES = 8
// Why: a fit that lands the box on a cell boundary can make the next measure propose the rows it
// just left; that feedback reverses within a frame or two, a user resize does not.
const ROW_FLIP_WINDOW_MS = 250
const pendingStableFitRafIds = new WeakMap<StableFitPane, number>()
const stableFitCallbacks = new WeakMap<StableFitPane, Set<() => void>>()
const lastFitByPane = new WeakMap<StableFitPane, LastFit>()
const rowFlipHoldByPane = new WeakMap<StableFitPane, RowFlipHold>()

function getPendingObservedFitRafId(pane: StableFitPane): number | null {
  return pane.pendingObservedFitRafId ?? pendingStableFitRafIds.get(pane) ?? null
}

function setPendingObservedFitRafId(pane: StableFitPane, id: number | null): void {
  if ('pendingObservedFitRafId' in pane) {
    pane.pendingObservedFitRafId = id
    return
  }
  if (id === null) {
    pendingStableFitRafIds.delete(pane)
  } else {
    pendingStableFitRafIds.set(pane, id)
  }
}

function getFitElement(pane: StableFitPane): HTMLElement {
  return pane.xtermContainer ?? pane.container
}

function getProposedDimensions(pane: StableFitPane): ProposedDimensions | null {
  try {
    return pane.fitAddon.proposeDimensions() ?? null
  } catch {
    return null
  }
}

function dimensionsEqual(a: ProposedDimensions | null, b: ProposedDimensions | null): boolean {
  return a?.cols === b?.cols && a?.rows === b?.rows
}

function terminalDimensionsEqual(pane: StableFitPane, dims: ProposedDimensions): boolean {
  return pane.terminal.cols === dims.cols && pane.terminal.rows === dims.rows
}

function hasVisibleFitGeometry(pane: StableFitPane): boolean {
  const rect = getFitElement(pane).getBoundingClientRect?.()
  return !rect || (rect.width > 0 && rect.height > 0)
}

function addStableFitCallback(pane: StableFitPane, callback: (() => void) | undefined): void {
  if (!callback) {
    return
  }
  const callbacks = stableFitCallbacks.get(pane) ?? new Set()
  callbacks.add(callback)
  stableFitCallbacks.set(pane, callbacks)
}

function flushStableFitCallbacks(pane: StableFitPane): void {
  const callbacks = stableFitCallbacks.get(pane)
  if (!callbacks) {
    return
  }
  stableFitCallbacks.delete(pane)
  for (const callback of callbacks) {
    callback()
  }
}

function isOneRowReversal(pane: StableFitPane, next: ProposedDimensions): boolean {
  const last = lastFitByPane.get(pane)
  return (
    last !== undefined &&
    Date.now() - last.at < ROW_FLIP_WINDOW_MS &&
    next.cols === last.cols &&
    next.rows === last.rows &&
    next.cols === pane.terminal.cols &&
    Math.abs(next.rows - pane.terminal.rows) === 1
  )
}

/** True when `next` would re-enter a row flip, so the pane keeps its current grid instead. */
function shouldHoldRowFlip(pane: StableFitPane, next: ProposedDimensions): boolean {
  const hold = rowFlipHoldByPane.get(pane)
  if (hold) {
    if (next.cols === hold.cols && (next.rows === hold.lowRows || next.rows === hold.highRows)) {
      // Why the smaller grid wins: holding the larger one would clip the bottom row.
      return next.rows === hold.highRows
    }
    rowFlipHoldByPane.delete(pane)
    return false
  }
  if (!isOneRowReversal(pane, next)) {
    return false
  }
  rowFlipHoldByPane.set(pane, {
    cols: next.cols,
    lowRows: Math.min(next.rows, pane.terminal.rows),
    highRows: Math.max(next.rows, pane.terminal.rows)
  })
  return next.rows > pane.terminal.rows
}

function releaseHeldFit(pane: StableFitPane): void {
  setPendingObservedFitRafId(pane, null)
  flushStableFitCallbacks(pane)
}

function finishStableFit(pane: StableFitPane, next?: ProposedDimensions): void {
  setPendingObservedFitRafId(pane, null)
  if (next && !terminalDimensionsEqual(pane, next)) {
    lastFitByPane.set(pane, { cols: pane.terminal.cols, rows: pane.terminal.rows, at: Date.now() })
  }
  // Why: an equal grid still proves a restored pane is measurable, so it must
  // release reattach continuations that were parked while the tab was hidden.
  safeFitAndThen(pane, 'stable-pane-fit', () => flushStableFitCallbacks(pane))
}

export function requestStablePaneFit(pane: StableFitPane, onSettled?: () => void): void {
  addStableFitCallback(pane, onSettled)
  if (getPendingObservedFitRafId(pane) !== null) {
    return
  }
  if (!hasVisibleFitGeometry(pane)) {
    stableFitCallbacks.delete(pane)
    return
  }
  // Why: keep xterm fit work off the divider pointermove hot path and let
  // the browser coalesce drag-driven size changes the same way Superset does.
  //
  // Windows can report a short-lived one-column anchor/scrollbar wobble when
  // the right sidebar is open. Requiring a stable proposed grid before fitting
  // prevents Codex from receiving a rapid SIGWINCH loop and visibly vibrating.
  let previous = getProposedDimensions(pane)
  let frameCount = 0
  const waitForStableGrid = (): void => {
    setPendingObservedFitRafId(
      pane,
      requestAnimationFrame(() => {
        if (!hasVisibleFitGeometry(pane)) {
          setPendingObservedFitRafId(pane, null)
          stableFitCallbacks.delete(pane)
          return
        }
        const next = getProposedDimensions(pane)
        frameCount += 1

        if (!next) {
          finishStableFit(pane)
          return
        }

        if (terminalDimensionsEqual(pane, next)) {
          finishStableFit(pane)
          return
        }

        if (shouldHoldRowFlip(pane, next)) {
          releaseHeldFit(pane)
          return
        }

        if (dimensionsEqual(previous, next)) {
          finishStableFit(pane, next)
          return
        }

        previous = next
        if (frameCount >= MAX_STABILITY_FRAMES) {
          finishStableFit(pane, next)
          return
        }

        waitForStableGrid()
      })
    )
  }
  waitForStableGrid()
}

export function attachPaneFitResizeObserver(pane: ManagedPaneInternal): void {
  detachPaneFitResizeObserver(pane)

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  const observer = new ResizeObserver(() => {
    requestStablePaneFit(pane)
  })

  observer.observe(pane.xtermContainer)
  pane.fitResizeObserver = observer
}

export function detachPaneFitResizeObserver(pane: ManagedPaneInternal): void {
  pane.fitResizeObserver?.disconnect()
  pane.fitResizeObserver = null

  const pendingObservedFitRafId = getPendingObservedFitRafId(pane)
  if (pendingObservedFitRafId !== null) {
    cancelAnimationFrame(pendingObservedFitRafId)
    setPendingObservedFitRafId(pane, null)
  }
  stableFitCallbacks.delete(pane)
  cancelPendingSafeFitContinuations(pane)
}
