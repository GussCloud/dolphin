import { HOST_SIDEBAR_MAX_WIDTH, HOST_SIDEBAR_MIN_WIDTH } from '../storage/preferences'

// Keep at least this much room for the detail pane when resizing the sidebar.
const MIN_DETAIL_WIDTH = 320
// Apple's rubber-band constant: how strongly the edge resists past a limit.
const RUBBER_BAND_CONSTANT = 0.55

function sidebarMaxWidth(windowWidth: number): number {
  'worklet'
  return Math.max(
    HOST_SIDEBAR_MIN_WIDTH,
    Math.min(HOST_SIDEBAR_MAX_WIDTH, windowWidth - MIN_DETAIL_WIDTH)
  )
}

/**
 * Clamps a sidebar width to the bounds and to the current window, so a width saved on a larger
 * device can't starve the detail pane on a narrower one.
 */
export function clampSidebarToWindow(width: number, windowWidth: number): number {
  'worklet'
  return Math.min(sidebarMaxWidth(windowWidth), Math.max(HOST_SIDEBAR_MIN_WIDTH, Math.round(width)))
}

function rubberBand(overshoot: number, dimension: number): number {
  'worklet'
  return (
    (overshoot * dimension * RUBBER_BAND_CONSTANT) /
    (dimension + RUBBER_BAND_CONSTANT * Math.abs(overshoot))
  )
}

/** Where the resize guide sits for a dragged width: free inside the limits, resisting past them. */
export function resolveSidebarDragEdge(width: number, windowWidth: number): number {
  'worklet'
  const max = sidebarMaxWidth(windowWidth)
  if (width > max) {
    return max + rubberBand(width - max, windowWidth)
  }
  if (width < HOST_SIDEBAR_MIN_WIDTH) {
    return HOST_SIDEBAR_MIN_WIDTH - rubberBand(HOST_SIDEBAR_MIN_WIDTH - width, windowWidth)
  }
  return width
}
