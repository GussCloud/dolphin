/* Auto-fit zoom for wall displays: the largest scale at which every room fits without scrolling.
 * Pure and dependency-free; office-engine.js calls it from its layout pass only.
 */
;(function (root) {
  'use strict'

  // Whole scales keep pixels square; the halves fill a screen better when a whole step overflows.
  const FIT_SCALES = [4, 3, 2.5, 2, 1.5, 1]
  // Doors are small and many: capped at 3x, and never below 1x (a huge office scrolls instead).
  const DOOR_SCALES = [3, 2.5, 2, 1.5, 1]

  /** Mirrors the engine's room grid: rooms flow left to right, each row as tall as its tallest room. */
  function contentSize(vw, scale, heights, g) {
    const worldW = vw / scale
    const cols = Math.max(1, Math.floor((worldW - g.gap) / (g.roomW + g.gap)))
    const used = Math.min(cols, heights.length || 1) * (g.roomW + g.gap) + g.gap
    let h = g.gap / 2
    for (let i = 0; i < heights.length; i += cols) {
      if (i > 0) h += g.gap
      h += g.plateH + Math.max(...heights.slice(i, i + cols))
    }
    return { width: used, height: h + g.gap }
  }

  /**
   * @param vw viewport width in CSS px
   * @param vh viewport height in CSS px
   * @param heights room heights in world px, in display order
   * @param g { roomW, gap, plateH } in world px
   */
  function pickFitScale(vw, vh, heights, g) {
    if (!heights.length) return vw >= 900 ? 3 : 2
    for (const scale of FIT_SCALES) {
      const size = contentSize(vw, scale, heights, g)
      if (size.width * scale <= vw && size.height * scale <= vh) return scale
    }
    return FIT_SCALES[FIT_SCALES.length - 1]
  }

  /**
   * Door grid for the hallway view: the largest scale at which `count` doors fit the viewport, then the
   * fewest rows and the columns that balance them.
   * @param cell { w, h, gap } of one door cell in world px
   * @returns { scale, cols, rows }
   */
  function pickDoorGrid(vw, vh, count, cell) {
    if (count <= 0) return { scale: vw >= 900 ? 3 : 2, cols: 1, rows: 1 }
    const grid = (scale) => {
      const maxCols = Math.max(1, Math.floor((vw / scale - cell.gap) / (cell.w + cell.gap)))
      const rows = Math.ceil(count / maxCols)
      return { scale, cols: Math.ceil(count / rows), rows, fits: (rows * (cell.h + cell.gap) + cell.gap) * scale <= vh }
    }
    for (const scale of DOOR_SCALES) {
      const g = grid(scale)
      if (g.fits) return { scale, cols: g.cols, rows: g.rows }
    }
    const g = grid(DOOR_SCALES[DOOR_SCALES.length - 1])
    return { scale: g.scale, cols: g.cols, rows: g.rows }
  }

  root.DolphinOfficeFit = { FIT_SCALES, DOOR_SCALES, pickFitScale, pickDoorGrid }
})(typeof window !== 'undefined' ? window : globalThis)
