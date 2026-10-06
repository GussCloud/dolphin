import { beforeAll, describe, expect, it } from 'vitest'

type PickFitScale = (vw: number, vh: number, heights: number[], g: { roomW: number; gap: number; plateH: number }) => number

// Same geometry as office-scene.js: 160 px rooms, 16 px gaps, 26 px name plates.
const G = { roomW: 160, gap: 16, plateH: 26 }
// Room with no projects (6 rows of 16 px) and one with a single project of up to 3 agents.
const EMPTY_ROOM = 96
const ONE_PROJECT = 144

let pickFitScale: PickFitScale

beforeAll(async () => {
  // A plain browser script: it registers itself on globalThis.
  const script = '../static/office/office-fit.js'
  await import(script)
  const fit: unknown = Reflect.get(globalThis, 'DolphinOfficeFit')
  if (!fit || typeof fit !== 'object' || typeof Reflect.get(fit, 'pickFitScale') !== 'function') {
    throw new Error('office-fit.js did not register DolphinOfficeFit')
  }
  pickFitScale = Reflect.get(fit, 'pickFitScale')
})

describe('pickFitScale', () => {
  it('falls back to the default zoom with no rooms', () => {
    expect(pickFitScale(1920, 1080, [], G)).toBe(3)
    expect(pickFitScale(800, 600, [], G)).toBe(2)
  })

  it('uses the largest zoom when a single room fits', () => {
    expect(pickFitScale(1920, 1080, [ONE_PROJECT], G)).toBe(4)
  })

  it('shrinks until every room is visible without scrolling', () => {
    // 3x gives 3 rooms per row, so 8 rooms need 3 rows (1698 px tall); 2.5x gives 4 per row, 2 rows (950 px).
    expect(pickFitScale(1920, 1080, Array(8).fill(ONE_PROJECT), G)).toBe(2.5)
  })

  it('takes a half step when the whole step below would waste the screen', () => {
    // At 3x only 2 rooms fit per row and 2 rows overflow 500 px; at 2.5x all 3 share one row (365 px).
    expect(pickFitScale(1500, 500, [EMPTY_ROOM, EMPTY_ROOM, EMPTY_ROOM], G)).toBe(2.5)
    expect(pickFitScale(1500, 900, [EMPTY_ROOM, EMPTY_ROOM, EMPTY_ROOM], G)).toBe(3)
  })

  it('never goes below 1x, even when the rooms cannot all fit', () => {
    expect(pickFitScale(400, 300, Array(40).fill(ONE_PROJECT), G)).toBe(1)
  })

  it('accounts for the tallest room of each row', () => {
    const short = pickFitScale(1920, 700, [EMPTY_ROOM, EMPTY_ROOM], G)
    const tall = pickFitScale(1920, 700, [EMPTY_ROOM, 400], G)
    expect(tall).toBeLessThan(short)
  })
})
