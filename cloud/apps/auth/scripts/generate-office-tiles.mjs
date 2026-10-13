#!/usr/bin/env node
/* Generates the office tileset atlas (static/office/tiles/office-tiles.{png,json}).
 * Every pixel is drawn here with a seeded RNG: no third-party art, byte-identical on every run.
 * Run: pnpm --filter @dolphin-cloud/auth generate:office-tiles
 *
 * Theming: wall/carpet/rug/sticky sprites and the character layers are grayscale (white = the
 * theme color, darker = shade) and the browser tints them with canvas `multiply`. Everything else
 * has fixed colors.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../static/office/tiles')
const ATLAS_W = 512
const FW = 16
const FH = 24
const FRAMES = 13

/* ---------- png ---------- */
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length)
  out.writeUInt32BE(data.length, 0)
  out.write(type, 4, 'latin1')
  data.copy(out, 8)
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length)
  return out
}
export function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/* ---------- drawing primitives ---------- */
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const hex = (s, a = 255) => {
  const n = parseInt(s.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255, a]
}
const gray = (v, a = 255) => [v, v, v, a]
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)))
const shade = (c, k) => [
  ...c.slice(0, 3).map((v) => clamp(k < 0 ? v * (1 + k) : v + (255 - v) * k)),
  c[3] ?? 255
]
const mix = (a, b, t) => [0, 1, 2, 3].map((i) => clamp(a[i] + (b[i] - a[i]) * t))
const col = (c) => (typeof c === 'string' ? hex(c) : c)

class Img {
  constructor(w, h) {
    this.w = w
    this.h = h
    this.data = new Uint8ClampedArray(w * h * 4)
  }
  /** Source-over blend; (x, y) outside the image is ignored. */
  set(x, y, c) {
    c = col(c)
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return
    const i = (y * this.w + x) * 4
    const a = c[3] / 255
    if (a >= 1) {
      this.data.set(c, i)
      return
    }
    const d = this.data
    const da = d[i + 3] / 255
    const oa = a + da * (1 - a)
    if (oa === 0) return
    for (let k = 0; k < 3; k++) d[i + k] = (c[k] * a + d[i + k] * da * (1 - a)) / oa
    d[i + 3] = oa * 255
  }
  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return [0, 0, 0, 0]
    const i = (y * this.w + x) * 4
    return [...this.data.subarray(i, i + 4)]
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c)
  }
  hline(x, y, w, c) {
    this.rect(x, y, w, 1, c)
  }
  vline(x, y, h, c) {
    this.rect(x, y, 1, h, c)
  }
  /** 1px bevel: lit top/left, shaded bottom/right. */
  bevel(x, y, w, h, light, dark) {
    this.hline(x, y, w, light)
    this.vline(x, y, h, light)
    this.hline(x, y + h - 1, w, dark)
    this.vline(x + w - 1, y, h, dark)
  }
  /** Copies `src` onto this image at (x, y) with blending. */
  blit(src, x, y) {
    for (let j = 0; j < src.h; j++) for (let i = 0; i < src.w; i++) this.set(x + i, y + j, src.get(i, j))
  }
  /** Multiplies every opaque pixel's color by `c` (used to bake fixed-color variants). */
  multiply(c) {
    for (let i = 0; i < this.data.length; i += 4) for (let k = 0; k < 3; k++) this.data[i + k] = (this.data[i + k] * c[k]) / 255
  }
}

/** Ordered-dither threshold (4x4 Bayer) so gradients band like pixel art instead of blurring. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bayer = (x, y) => (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16

/** Vertical gradient between two colors with ordered dithering. */
function vgradient(img, x, y, w, h, top, bottom) {
  for (let j = 0; j < h; j++) {
    const t = h === 1 ? 0 : j / (h - 1)
    for (let i = 0; i < w; i++) {
      const steps = 4
      const q = Math.floor(t * steps + bayer(x + i, y + j) - 0.5 + 0.5) / steps
      img.set(x + i, y + j, mix(top, bottom, Math.max(0, Math.min(1, q))))
    }
  }
}

/** Horizontal wood grain: dark/base/light streaks with occasional knots. */
function wood(img, x, y, w, h, ramp, rnd) {
  const [dark, base, light] = ramp.map(col)
  const tones = [dark, mix(dark, base, 0.5), base, mix(base, light, 0.5), light]
  for (let j = 0; j < h; j++) {
    const t = rnd()
    const rowTone = t < 0.18 ? 1 : t > 0.82 ? 3 : 2
    let i = 0
    while (i < w) {
      const len = 3 + Math.floor(rnd() * 11)
      const drift = rnd() < 0.3 ? (rnd() < 0.5 ? -1 : 1) : 0
      const tone = tones[Math.max(0, Math.min(4, rowTone + drift))]
      img.hline(x + i, y + j, Math.min(len, w - i), tone)
      i += len
    }
  }
  const knots = Math.floor((w * h) / 400)
  for (let k = 0; k < knots; k++) {
    const kx = x + 2 + Math.floor(rnd() * (w - 5))
    const ky = y + Math.floor(rnd() * (h - 1))
    img.hline(kx, ky, 3, tones[0])
    img.hline(kx + 1, ky + 1, 1, tones[1])
  }
}

/* ---------- sprites ---------- */
const sprites = []
const sprite = (name, w, h, draw, opts = {}) => {
  const img = new Img(w, h)
  draw(img, mulberry32(hashName(name)))
  sprites.push({ name, img, frames: opts.frames ?? 1, fw: opts.fw ?? w, meta: opts.meta })
}
function hashName(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Wall segment (16x32, tiles horizontally): cornice, plaster, dado rail, wainscot, baseboard. */
function paintWall(img, rnd, base) {
  img.rect(0, 0, 16, 32, base)
  const k = (v) => shade(base, v)
  // plaster: soft vertical light falloff, sparse speckle
  for (let y = 3; y < 25; y++) {
    const fall = (y - 3) / 22
    for (let x = 0; x < 16; x++) {
      const dither = bayer(x, y) < fall * 0.55 ? -0.035 : 0
      const speck = rnd() < 0.1 ? -0.03 : rnd() < 0.05 ? 0.025 : 0
      img.set(x, y, k(dither + speck))
    }
  }
  // cornice
  img.hline(0, 0, 16, k(-0.3))
  img.hline(0, 1, 16, k(-0.2))
  img.hline(0, 2, 16, k(-0.1))
  img.hline(0, 3, 16, k(-0.07))
  // dado rail with a lit top and shadow below
  img.hline(0, 25, 16, k(0.1))
  img.hline(0, 26, 16, k(-0.18))
  // wainscot panel with a groove per tile
  img.rect(0, 27, 16, 2, k(-0.08))
  img.vline(0, 27, 2, k(-0.2))
  img.vline(1, 27, 2, k(-0.02))
  // baseboard
  img.hline(0, 29, 16, k(-0.12))
  img.hline(0, 30, 16, k(-0.24))
  img.hline(0, 31, 16, k(-0.36))
}

sprite('wall', 16, 32, (img, rnd) => paintWall(img, rnd, gray(244)))
sprite('corridor_wall', 16, 32, (img, rnd) => paintWall(img, rnd, hex('#d9c8a8')))

/** Carpet: woven noise, seamless (no edge features). Two seeds so the checker keeps its rhythm. */
for (const name of ['carpet_a', 'carpet_b']) {
  sprite(name, 16, 16, (img, rnd) => {
    const tones = [226, 233, 240, 246, 252]
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const r = rnd()
        let v = tones[r < 0.1 ? 0 : r < 0.3 ? 1 : r < 0.6 ? 2 : r < 0.88 ? 3 : 4]
        if ((x + y) % 2 === 0) v -= 4
        img.set(x, y, gray(v))
      }
    for (let k = 0; k < 6; k++) img.hline(Math.floor(rnd() * 13), Math.floor(rnd() * 16), 3, gray(222))
  })
}

/** Rug 80x31: fringe, inner border stripe, diamond pattern. */
sprite('rug', 80, 31, (img, rnd) => {
  img.rect(0, 0, 80, 31, gray(255))
  for (let x = 0; x < 80; x += 2) {
    img.set(x, 0, gray(226))
    img.set(x, 30, gray(226))
  }
  img.rect(2, 2, 76, 27, gray(236))
  img.bevel(2, 2, 76, 27, gray(250), gray(206))
  img.rect(5, 5, 70, 21, gray(228))
  img.bevel(5, 5, 70, 21, gray(196), gray(246))
  for (let y = 7; y < 24; y++)
    for (let x = 7; x < 73; x++) {
      const dx = Math.abs(((x - 7) % 8) - 4)
      const dy = Math.abs(((y - 7) % 8) - 4)
      if (dx + dy === 3 && (x + y) % 2 === 0) img.set(x, y, gray(204))
      else if (rnd() < 0.08) img.set(x, y, gray(220))
    }
})

sprite('sticky_accent', 5, 5, (img) => {
  img.rect(0, 0, 5, 5, gray(255))
  img.hline(0, 4, 5, gray(200))
  img.vline(4, 0, 5, gray(222))
  img.hline(1, 1, 3, gray(226))
})

/** Whiteboard 38x20: metal frame, glossy white, scribbles, marker tray. */
sprite('whiteboard', 38, 20, (img, rnd) => {
  img.rect(0, 0, 38, 20, '#b9bec7')
  img.bevel(0, 0, 38, 20, '#dfe3e9', '#8a909b')
  img.rect(1, 1, 36, 17, '#f7f8f9')
  for (let k = 0; k < 7; k++) img.set(3 + k * 2, 16 - k, '#ffffff')
  img.hline(1, 1, 36, '#e5e8ec')
  img.vline(1, 1, 17, '#e5e8ec')
  for (const [x, y, w] of [[4, 5, 14], [4, 8, 10], [4, 11, 16]]) {
    for (let i = 0; i < w; i++) if (rnd() < 0.85) img.set(x + i, y, '#c3c9d1')
  }
  img.rect(1, 18, 36, 1, '#8a909b')
  img.rect(8, 18, 4, 1, '#d14a3f')
  img.rect(14, 18, 4, 1, '#3d7fd0')
  img.hline(2, 19, 34, [0, 0, 0, 40])
})

sprite('sticky_yellow', 5, 5, (img) => {
  img.rect(0, 0, 5, 5, '#f2d36b')
  img.hline(0, 4, 5, '#d1b04c')
  img.hline(1, 1, 3, '#f7e08f')
})

/** Window 36x16: framed panes with a sky gradient, clouds and a skyline. */
sprite('window', 36, 16, (img, rnd) => {
  img.rect(0, 0, 36, 16, '#eef2f4')
  img.bevel(0, 0, 36, 16, '#ffffff', '#b8c2c9')
  img.hline(0, 15, 36, '#9aa5ad')
  for (const px of [2, 19]) {
    vgradient(img, px, 2, 15, 12, hex('#5fa8d6'), hex('#cde9f6'))
    // skyline silhouette along the bottom of the pane
    let h = 2
    for (let x = 0; x < 15; x += 3) {
      h = 1 + Math.floor(rnd() * 3)
      img.rect(px + x, 14 - h, 3, h, '#7fa3ba')
      if (rnd() < 0.5) img.set(px + x + 1, 14 - h + 1, '#cde9f6')
    }
    img.hline(px, 13, 15, '#7fa3ba')
    // cloud
    img.hline(px + 3, 4, 5, '#ffffff')
    img.hline(px + 2, 5, 7, '#ffffff')
    img.hline(px + 3, 5, 5, '#f4fbff')
    // glass glint
    img.set(px + 11, 3, [255, 255, 255, 190])
    img.set(px + 12, 4, [255, 255, 255, 130])
    img.bevel(px - 1, 1, 17, 14, '#c9d2d8', '#e8eef1')
  }
  img.vline(17, 1, 14, '#d6dde2')
  img.vline(18, 1, 14, '#c0c9cf')
})

/** Agent desk 32x20: soft shadow, oak top with grain, front lip, metal legs. */
sprite('desk', 32, 20, (img, rnd) => {
  img.rect(1, 15, 32, 2, [0, 0, 0, 36])
  wood(img, 0, 2, 32, 10, ['#c29a68', '#cfa574', '#dab88a'], rnd)
  img.hline(0, 2, 32, '#e8cfa6')
  img.hline(0, 11, 32, '#b08a5c')
  img.hline(0, 12, 32, '#e6c99e') // caller recolors this lip with the project stripe
  img.rect(0, 13, 32, 2, '#9c7448')
  img.hline(0, 13, 32, '#a97d4f')
  img.hline(0, 14, 32, '#86613b')
  for (const lx of [1, 29]) {
    img.rect(lx, 15, 2, 4, '#6b6a73')
    img.vline(lx, 15, 4, '#8b8a95')
  }
})

/** Monitor 16x13 facing the viewer: bezel, dim screen with glow and reflection, stand. */
sprite(
  'monitor',
  16,
  13,
  (img, rnd) => {
    img.rect(0, 0, 16, 11, '#2c3140')
    img.hline(0, 0, 16, '#4a5063')
    img.vline(0, 0, 11, '#3d4354')
    img.hline(0, 10, 16, '#1d212b')
    img.rect(1, 1, 14, 8, '#17222e')
    for (let y = 1; y < 9; y++)
      for (let x = 1; x < 15; x++) {
        const glow = (9 - y) / 8
        if (bayer(x, y) < glow * 0.45) img.set(x, y, '#1c3140')
        if (y % 2 === 0 && rnd() < 0.18) img.set(x, y, '#21394a')
      }
    for (let k = 0; k < 4; k++) img.set(2 + k * 2, 2 + (k % 2), '#2e5167')
    img.set(14, 9, '#3fc9a8')
    img.rect(7, 11, 2, 2, '#3d4354')
    img.hline(5, 12, 6, '#555b69')
    img.hline(5, 12, 6, '#4a505f')
  },
  { meta: { screen: { x: 1, y: 1, w: 14, h: 8 } } }
)

sprite('keyboard', 14, 4, (img, rnd) => {
  img.rect(0, 0, 10, 3, '#5d6372')
  img.hline(0, 0, 10, '#7b8192')
  img.hline(0, 2, 10, '#464b59')
  for (let x = 1; x < 9; x += 2) for (const y of [1]) img.set(x, y, rnd() < 0.5 ? '#a4abbb' : '#8d94a5')
  img.rect(12, 0, 2, 3, '#5d6372')
  img.set(12, 0, '#7b8192')
})

sprite('deco_notes', 6, 7, (img) => {
  img.rect(0, 0, 6, 6, '#f7f8f9')
  img.hline(0, 0, 6, '#dfe3e9')
  img.hline(0, 5, 6, '#c9ced6')
  img.hline(1, 2, 3, '#b5bcc7')
  img.hline(1, 3, 4, '#b5bcc7')
  img.rect(0, 6, 6, 1, [0, 0, 0, 40])
})
sprite('deco_plant', 6, 9, (img) => {
  img.rect(0, 5, 6, 4, '#c8794a')
  img.hline(0, 5, 6, '#dd9468')
  img.hline(0, 8, 6, '#9c5a33')
  img.rect(2, 1, 2, 4, '#4f9150')
  img.rect(0, 2, 2, 3, '#5fa35a')
  img.rect(4, 3, 2, 2, '#5fa35a')
  img.set(2, 0, '#7bc274')
  img.set(1, 2, '#7bc274')
  img.set(5, 3, '#7bc274')
})
sprite('deco_books', 7, 7, (img) => {
  img.rect(0, 4, 7, 2, '#3d7fd0')
  img.hline(0, 4, 7, '#6a9fe0')
  img.hline(0, 5, 7, '#2c5fa0')
  img.rect(1, 2, 5, 2, '#d9654b')
  img.hline(1, 2, 5, '#ec8d77')
  img.rect(0, 6, 7, 1, [0, 0, 0, 40])
})
sprite('deco_duck', 8, 7, (img) => {
  img.rect(0, 3, 6, 3, '#f2c94c')
  img.hline(0, 3, 6, '#f8de85')
  img.rect(3, 0, 3, 3, '#f2c94c')
  img.hline(3, 0, 3, '#f8de85')
  img.set(4, 1, '#2b2230')
  img.rect(6, 1, 2, 1, '#e8873a')
  img.hline(0, 5, 6, '#d4a52f')
  img.rect(0, 6, 7, 1, [0, 0, 0, 40])
})

/** Agent chair seen from behind: padded backrest, seat, stem and caster feet. */
sprite('chair_back', 12, 13, (img, rnd) => {
  img.rect(1, 0, 10, 5, '#4a4f5c')
  img.hline(1, 0, 10, '#6a7083')
  img.vline(1, 0, 5, '#5a6072')
  img.hline(1, 4, 10, '#363a46')
  img.rect(0, 5, 12, 5, '#3b3f4a')
  img.hline(0, 5, 12, '#5d6374')
  img.hline(0, 9, 12, '#2a2d37')
  for (let k = 0; k < 8; k++) img.set(1 + Math.floor(rnd() * 10), 1 + Math.floor(rnd() * 3), '#555b69')
  img.rect(5, 10, 2, 1, '#2a2d35')
  img.hline(2, 11, 8, '#2a2d35')
  img.rect(1, 12, 2, 1, '#1d1f26')
  img.rect(9, 12, 2, 1, '#1d1f26')
  img.rect(5, 12, 2, 1, '#1d1f26')
})

/** Dev chair 18x16: tall padded back. */
sprite('chair_dev', 18, 16, (img, rnd) => {
  img.rect(0, 0, 18, 16, '#2e3340')
  img.hline(0, 0, 18, '#5a6074')
  img.hline(0, 1, 18, '#454b5a')
  img.vline(0, 0, 16, '#3c4252')
  img.vline(17, 0, 16, '#22262f')
  img.vline(1, 2, 12, '#454b5a')
  img.hline(0, 15, 18, '#1f232b')
  for (let y = 3; y < 14; y += 3) img.hline(3, y, 12, '#272b36')
  for (let k = 0; k < 14; k++) img.set(3 + Math.floor(rnd() * 12), 2 + Math.floor(rnd() * 12), '#3a404f')
})

/** Dev monitor from behind 16x13: shell, vent slits, stand neck. */
sprite('dev_monitor_back', 16, 13, (img) => {
  img.rect(0, 0, 16, 11, '#3a3f4c')
  img.hline(0, 0, 16, '#5a6074')
  img.hline(1, 1, 14, '#4a505f')
  img.vline(0, 0, 11, '#4a505f')
  img.hline(0, 10, 16, '#2a2e38')
  for (let x = 3; x < 13; x += 2) img.vline(x, 4, 3, '#2f3440')
  img.set(7, 3, '#3fc9a8')
  img.rect(7, 11, 2, 2, '#2c3140')
})

/** Dev desk 56x17: wood top with grain, drawers in the front, soft shadow underneath. */
sprite(
  'dev_desk',
  56,
  17,
  (img, rnd) => {
    wood(img, 0, 0, 56, 11, ['#9a6a40', '#a97448', '#bf8a5c'], rnd)
    img.hline(0, 0, 56, '#d2a070')
    img.vline(0, 0, 11, '#bf8a5c')
    img.hline(0, 10, 56, '#8a5c37')
    img.rect(0, 11, 56, 5, '#7a5032')
    img.hline(0, 11, 56, '#8e6040')
    img.hline(0, 15, 56, '#5c3a22')
    for (const x of [0, 18, 37, 55]) img.vline(x, 11, 5, '#5c3a22')
    for (const x of [1, 19, 38]) {
      img.hline(x + 1, 12, 15, '#946846')
      img.rect(x + 7, 13, 4, 1, '#d6b27a')
      img.set(x + 7, 13, '#f0d9a6')
    }
    img.hline(1, 16, 56, [0, 0, 0, 40])
  },
  { meta: { top: 0, front: 11 } }
)

/** Coffee bar 24x34: espresso machine on a counter with a cabinet below. */
sprite('coffee_bar', 24, 34, (img, rnd) => {
  // machine (x3..13, y0..10)
  img.rect(3, 0, 10, 11, '#3a3f4a')
  img.hline(3, 0, 10, '#5d6374')
  img.vline(3, 0, 11, '#4a505f')
  img.vline(12, 0, 11, '#2a2e38')
  img.rect(4, 1, 8, 3, '#555b69')
  img.hline(4, 1, 8, '#7b8192')
  img.set(6, 2, '#e86a5a')
  img.set(8, 2, '#3fc9a8')
  img.rect(5, 5, 6, 1, '#1d212b')
  img.rect(7, 6, 2, 2, '#c9ced6')
  img.rect(6, 9, 4, 2, '#8a909b')
  img.hline(6, 10, 4, '#555b69')
  // counter top
  wood(img, 0, 11, 24, 3, ['#b78a5c', '#c99b6c', '#dcb283'], rnd)
  img.hline(0, 11, 24, '#e6c294')
  img.hline(0, 13, 24, '#8a6342')
  // cup + saucer
  img.rect(16, 7, 4, 4, '#f4f1ea')
  img.hline(16, 7, 4, '#ffffff')
  img.hline(16, 10, 4, '#c9c3b6')
  img.set(20, 8, '#c9c3b6')
  img.hline(16, 8, 4, '#7a4a2a')
  // cabinet
  wood(img, 0, 14, 24, 20, ['#946b45', '#a77a50', '#b98a5d'], rnd)
  img.rect(0, 14, 24, 1, '#7a5636')
  img.vline(11, 15, 18, '#5c3f26')
  img.vline(12, 15, 18, '#c59868')
  for (const x of [1, 13]) {
    img.bevel(x, 16, 10, 16, '#c59868', '#7a5636')
  }
  img.rect(9, 22, 1, 4, '#e0c28a')
  img.rect(14, 22, 1, 4, '#e0c28a')
  img.hline(0, 33, 24, '#5c3f26')
})

/** Water cooler 10x30: glass bottle with water, body, taps and drip tray. */
sprite('water_cooler', 10, 30, (img) => {
  img.rect(1, 0, 8, 11, '#a9d8f0')
  img.hline(1, 0, 8, '#d6eef9')
  img.vline(1, 0, 11, '#cbe9f7')
  img.vline(8, 0, 11, '#7fb9d8')
  img.rect(3, 0, 4, 1, '#7fb9d8')
  img.vline(2, 1, 8, '#e4f5fc')
  img.hline(1, 3, 8, '#8cc6e2')
  img.set(5, 6, '#e4f5fc')
  img.set(6, 8, '#e4f5fc')
  img.rect(0, 11, 10, 19, '#e3e7ec')
  img.vline(0, 11, 19, '#f5f7fa')
  img.vline(9, 11, 19, '#b9c0c9')
  img.hline(0, 11, 10, '#f5f7fa')
  img.rect(2, 16, 2, 2, '#4f7cc9')
  img.rect(6, 16, 2, 2, '#d9654b')
  img.rect(1, 21, 8, 2, '#9aa3ae')
  img.hline(1, 21, 8, '#7b8592')
  img.hline(0, 29, 10, '#b9c0c9')
  img.rect(2, 24, 6, 4, '#d3d9e0')
})

/** Potted plants: three-tone leaves, terracotta pot with rim. */
function leaf(img, cx, cy, rx, ry, rnd) {
  const dark = '#3f7a42'
  const mid = '#5fa35a'
  const light = '#86c97c'
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const d = (x * x) / (rx * rx + 0.5) + (y * y) / (ry * ry + 0.5)
      if (d > 1) continue
      const lit = x + y < -1 ? light : x + y > 1 ? dark : mid
      img.set(cx + x, cy + y, lit)
    }
  img.set(cx, cy, rnd() < 0.5 ? mid : dark)
}
sprite('plant_big', 10, 20, (img, rnd) => {
  img.vline(5, 8, 5, '#3f7a42')
  leaf(img, 5, 3, 2, 3, rnd)
  leaf(img, 2, 7, 2, 3, rnd)
  leaf(img, 8, 6, 2, 3, rnd)
  leaf(img, 5, 9, 2, 2, rnd)
  img.rect(1, 12, 8, 8, '#c8794a')
  img.rect(0, 12, 10, 2, '#dd9468')
  img.hline(0, 13, 10, '#b3653a')
  img.vline(8, 14, 6, '#a45a33')
  img.hline(1, 19, 8, '#8a4a2a')
  img.hline(2, 14, 6, '#5c3f26')
})
sprite('plant_small', 6, 9, (img, rnd) => {
  leaf(img, 3, 1, 1, 2, rnd)
  leaf(img, 1, 3, 1, 2, rnd)
  leaf(img, 5, 3, 1, 2, rnd)
  img.rect(0, 5, 6, 4, '#c8794a')
  img.hline(0, 5, 6, '#dd9468')
  img.hline(0, 8, 6, '#9c5a33')
})

/** Corridor floor: long low-contrast boards (no vertical seams, so it never reads as brick), seamless on both axes. */
sprite('corridor_floor', 16, 16, (img, rnd) => {
  wood(img, 0, 0, 16, 16, ['#e1d1ae', '#e6d7b6', '#ebdcbd'], rnd)
  img.hline(0, 0, 16, '#d9c8a3')
  img.hline(0, 8, 16, '#dccba6')
})

/** Door, three layers drawn in order: frame (24x32, fixed), leaf (16x28, grayscale, tinted per room), hardware (24x32). */
sprite('door_frame', 24, 32, (img) => {
  img.rect(0, 0, 24, 32, '#5a3d28')
  img.hline(0, 0, 24, '#7a563a')
  img.hline(0, 1, 24, '#6a4a32')
  img.vline(0, 0, 32, '#6a4a32')
  img.vline(23, 0, 32, '#46301f')
  img.rect(3, 3, 18, 29, '#2a1c11')
  img.hline(0, 31, 24, '#2a1c11')
})
sprite('door_leaf', 16, 28, (img, rnd) => {
  wood(img, 0, 0, 16, 28, ['#c4c4c4', '#dcdcdc', '#efefef'], rnd)
  img.vline(0, 0, 28, gray(250))
  img.vline(15, 0, 28, gray(178))
  for (const [py, ph] of [[3, 9], [14, 11]]) {
    img.rect(3, py, 10, ph, gray(208))
    img.bevel(3, py, 10, ph, gray(158), gray(255))
    img.rect(5, py + 2, 6, ph - 4, gray(222))
    img.bevel(5, py + 2, 6, ph - 4, gray(255), gray(166))
  }
})
sprite('door_hw', 24, 32, (img) => {
  img.rect(3, 8, 1, 3, '#2a2d35')
  img.rect(3, 24, 1, 3, '#2a2d35')
  img.rect(16, 15, 3, 2, '#e0c060')
  img.hline(16, 15, 3, '#f6e09a')
  img.rect(15, 16, 2, 1, '#b8923a')
  img.hline(3, 30, 18, [0, 0, 0, 80])
})

/** Brass nameplate 28x8, drawn as a nine-patch (4px corners, 2px top/bottom): bevel, engraved line, polished face. */
sprite('nameplate', 28, 8, (img) => {
  img.rect(0, 0, 28, 8, '#b8923a')
  img.bevel(0, 0, 28, 8, '#f2d57e', '#7a5c1f')
  vgradient(img, 1, 1, 26, 6, hex('#e8ca70'), hex('#d2ae4c'))
  img.hline(1, 1, 26, '#b08a30')
  img.hline(1, 6, 26, '#f2dc90')
  for (const [x, y] of [[1, 1], [26, 1], [1, 6], [26, 6]]) img.set(x, y, '#6a4f18')
})

/** Status lamp, 4 frames of 9x9: 0 green, 1 amber, 2 grey, 3 dim amber (blink off phase); drawn at 2x. */
sprite(
  'lamp',
  36,
  9,
  (img) => {
    const states = [
      { core: '#2fe0a8', hi: '#d8fff2', edge: '#12805f', halo: [47, 224, 168, 90] },
      { core: '#ffb02e', hi: '#fff0c0', edge: '#b86a00', halo: [255, 176, 46, 90] },
      { core: '#9aa6b0', hi: '#d6dde2', edge: '#6a747c', halo: null },
      { core: '#c9811c', hi: '#e8a850', edge: '#7a4a08', halo: [201, 129, 28, 40] }
    ]
    const disc = (ox, n, c) => {
      const o = (9 - n) / 2
      for (let y = 0; y < n; y++)
        for (let x = 0; x < n; x++) {
          const corner = (x === 0 || x === n - 1) && (y === 0 || y === n - 1)
          if (!corner) img.set(ox + o + x, o + y, c)
        }
    }
    states.forEach((s, f) => {
      const ox = f * 9
      if (s.halo) disc(ox, 9, s.halo)
      disc(ox, 7, '#2a2d35')
      disc(ox, 5, s.core)
      img.hline(ox + 3, 5, 3, s.edge)
      img.hline(ox + 3, 3, 2, s.hi)
      img.set(ox + 3, 4, s.hi)
    })
  },
  { frames: 4, fw: 9 }
)

/** Door mat 22x5. */
sprite('door_mat', 22, 5, (img, rnd) => {
  img.rect(0, 0, 22, 5, '#6a5340')
  img.bevel(0, 0, 22, 5, '#85694f', '#4a382a')
  for (let x = 2; x < 20; x++) for (let y = 1; y < 4; y++) if (rnd() < 0.35) img.set(x, y, '#7c614a')
})

/* ---------- characters: grayscale layers, 13 frames of 16x24 ---------- */
const HAIR_STYLES = ['short', 'long', 'bun', 'spiky']
function buildCharacters() {
  const mk = () => new Img(FW * FRAMES, FH)
  const L = { skin: mk(), shirt: mk(), pants: mk(), cap: mk(), fixed: mk(), headset: mk() }
  for (const s of HAIR_STYLES) L[`hair_${s}`] = mk()
  const g = (v) => gray(v)
  const px = (layer, f, x, y, w, h, c) => L[layer].rect(f * FW + x, y, w, h, c)

  function legs(f, lift) {
    px('pants', f, 5, 17, 6, 3, g(255))
    px('pants', f, 5, 19, 6, 1, g(226))
    const ly = lift === 1 ? -1 : 0
    const ry = lift === 2 ? -1 : 0
    px('pants', f, 5, 20 + ly, 2, 2, g(250))
    px('pants', f, 9, 20 + ry, 2, 2, g(250))
    px('pants', f, 6, 20 + ly, 1, 2, g(226))
    px('pants', f, 10, 20 + ry, 1, 2, g(226))
    px('fixed', f, 5, 22 + ly, 2, 1, hex('#2a2733'))
    px('fixed', f, 9, 22 + ry, 2, 1, hex('#2a2733'))
    px('fixed', f, 5, 22 + ly, 1, 1, hex('#4a4658'))
    px('fixed', f, 9, 22 + ry, 1, 1, hex('#4a4658'))
  }
  function seatedPants(f) {
    px('pants', f, 5, 17, 6, 2, g(255))
    px('pants', f, 5, 18, 6, 1, g(226))
  }
  function torso(f, armL, armR) {
    px('skin', f, 7, 11, 2, 1, g(232))
    px('shirt', f, 4, 12, 8, 5, g(255))
    px('shirt', f, 4, 12, 8, 1, g(238))
    px('shirt', f, 11, 13, 1, 4, g(226))
    px('shirt', f, 4, 16, 8, 1, g(202))
    px('shirt', f, 6, 14, 1, 1, g(238))
    px('shirt', f, 9, 15, 1, 1, g(238))
    if (armL) {
      px('shirt', f, 3, 12, 1, armL, g(208))
      px('skin', f, 3, 12 + armL, 1, 1, g(255))
    }
    if (armR) {
      px('shirt', f, 12, 12, 1, armR, g(208))
      px('skin', f, 12, 12 + armR, 1, 1, g(255))
    }
  }
  function hairBase(style, f, back, dy) {
    const h = `hair_${style}`
    if (back) {
      px(h, f, 4, 3 + dy, 8, 8, g(236))
      px(h, f, 5, 3 + dy, 6, 1, g(255))
      px(h, f, 5, 4 + dy, 2, 1, g(255))
      px(h, f, 4, 9 + dy, 8, 2, g(210))
      for (const sx of [5, 8, 10]) px(h, f, sx, 6 + dy, 1, 3, g(214))
      px('skin', f, 3, 7 + dy, 1, 2, g(238))
      px('skin', f, 12, 7 + dy, 1, 2, g(238))
      if (style === 'long') {
        px(h, f, 4, 11 + dy, 8, 3, g(214))
        px(h, f, 6, 11 + dy, 1, 3, g(196))
      }
    } else {
      px('skin', f, 5, 6 + dy, 6, 5, g(255))
      px('skin', f, 5, 10 + dy, 6, 1, g(236))
      px('skin', f, 8, 9 + dy, 1, 1, g(240))
      px('skin', f, 6, 10 + dy, 1, 1, g(220))
      px('skin', f, 9, 10 + dy, 1, 1, g(220))
      px(h, f, 4, 3 + dy, 8, 3, g(238))
      px(h, f, 5, 3 + dy, 5, 1, g(255))
      px(h, f, 4, 5 + dy, 8, 1, g(214))
      px(h, f, 4, 6 + dy, 1, 3, g(222))
      px(h, f, 11, 6 + dy, 1, 3, g(214))
      px(h, f, 6, 5 + dy, 1, 1, g(238))
      px('fixed', f, 6, 8 + dy, 1, 1, hex('#2b2230'))
      px('fixed', f, 9, 8 + dy, 1, 1, hex('#2b2230'))
      if (style === 'long') {
        px(h, f, 4, 9 + dy, 1, 4, g(214))
        px(h, f, 11, 9 + dy, 1, 4, g(206))
      }
    }
    if (style === 'bun') {
      px(h, f, 6, 1 + dy, 4, 2, g(240))
      px(h, f, 7, 1 + dy, 2, 1, g(255))
    }
    if (style === 'spiky') {
      for (const sx of [4, 7, 10]) px(h, f, sx, 2 + dy, 1, 1, g(244))
    }
  }
  function head(f, back, dy) {
    for (const s of HAIR_STYLES) hairBase(s, f, back, dy)
    // Cap sits on the short-hair strip; the browser draws it only for the cap style.
    px('cap', f, 4, 3 + dy, 8, 2, g(255))
    px('cap', f, 4, 3 + dy, 8, 1, g(255))
    px('cap', f, 4, 4 + dy, 8, 1, g(226))
    px('cap', f, back ? 5 : 3, 5 + dy, back ? 6 : 10, 1, g(168))
    px('headset', f, 4, 2 + dy, 8, 1, hex('#2a2d35'))
    px('headset', f, 3, 6 + dy, 2, 3, hex('#2a2d35'))
    px('headset', f, 11, 6 + dy, 2, 3, hex('#2a2d35'))
    px('headset', f, 3, 7 + dy, 1, 1, hex('#3fc9a8'))
    px('headset', f, 4, 3 + dy, 1, 3, hex('#2a2d35'))
    px('headset', f, 11, 3 + dy, 1, 3, hex('#2a2d35'))
  }

  const frame = (f, o) => {
    if (o.legs !== undefined) legs(f, o.legs)
    if (o.seated) seatedPants(f)
    torso(f, o.armL, o.armR)
    head(f, o.back, o.dy ?? 0)
  }
  frame(0, { legs: 0, armL: 4, armR: 4 })
  frame(1, { legs: 1, armL: 3, armR: 5 })
  frame(2, { legs: 2, armL: 5, armR: 3 })
  frame(3, { legs: 0, armL: 4, armR: 4, back: true })
  frame(4, { legs: 1, armL: 3, armR: 5, back: true })
  frame(5, { legs: 2, armL: 5, armR: 3, back: true })
  frame(6, { seated: true, armL: 2, armR: 3, back: true })
  frame(7, { seated: true, armL: 3, armR: 2, back: true, dy: 1 })
  frame(8, { seated: true, armL: 4, armR: 0, back: true })
  px('shirt', 8, 12, 5, 1, 7, g(208))
  px('skin', 8, 12, 4, 1, 1, g(255))
  frame(9, { seated: true, armL: 4, armR: 4, back: true, dy: 1 })
  frame(10, { armL: 3, armR: 3 })
  frame(11, { armL: 3, armR: 3, dy: 1 })
  frame(12, { armL: 4, armR: 4 })

  // Outline: 1px ring per hair style (and per headset), so one style's bun or long hair never leaves a halo on another.
  const ring = (layers) => {
    const out = mk()
    const filled = (x, y) => layers.some((n) => L[n].get(x, y)[3] > 0)
    for (let f = 0; f < FRAMES; f++)
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          if (filled(f * FW + x, y)) continue
          const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
            const nx = x + dx
            return nx >= 0 && nx < FW && filled(f * FW + nx, y + dy)
          })
          if (near) out.set(f * FW + x, y, [24, 20, 30, 170])
        }
    return out
  }
  for (const style of HAIR_STYLES) {
    const body = ['pants', 'shirt', 'skin', `hair_${style}`, 'fixed']
    L[`outline_${style}`] = ring(body)
    L[`outline_${style}_h`] = ring([...body, 'headset'])
  }
  // Cap style: short hair plus the cap, whose brim is wider than the head.
  L.outline_cap = ring(['pants', 'shirt', 'skin', 'hair_short', 'cap', 'fixed'])
  return L
}

const characterLayers = buildCharacters()
for (const name of [...HAIR_STYLES.flatMap((st) => [`outline_${st}`, `outline_${st}_h`]), 'outline_cap', 'pants', 'shirt', 'skin', 'hair_short', 'hair_long', 'hair_bun', 'hair_spiky', 'cap', 'fixed', 'headset']) {
  sprites.push({ name: `ch_${name}`, img: characterLayers[name], frames: FRAMES, fw: FW })
}

/* ---------- atlas ---------- */
export function build() {
  const order = [...sprites].sort((a, b) => b.img.h - a.img.h || b.img.w - a.img.w || (a.name < b.name ? -1 : 1))
  const placed = {}
  let x = 0
  let y = 0
  let rowH = 0
  for (const s of order) {
    if (x + s.img.w + 1 > ATLAS_W) {
      x = 0
      y += rowH + 1
      rowH = 0
    }
    placed[s.name] = { x, y, w: s.img.w, h: s.img.h }
    x += s.img.w + 1
    rowH = Math.max(rowH, s.img.h)
  }
  const height = y + rowH
  const atlas = new Img(ATLAS_W, height)
  const map = {}
  for (const s of sprites) {
    const p = placed[s.name]
    atlas.blit(s.img, p.x, p.y)
    map[s.name] = { ...p, ...(s.frames > 1 ? { frames: s.frames, fw: s.fw } : {}), ...(s.meta ?? {}) }
  }
  const sorted = Object.fromEntries(Object.keys(map).sort().map((k) => [k, map[k]]))
  return { atlas, map: sorted, sprites }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { atlas, map } = build()
  const png = encodePng(atlas.w, atlas.h, atlas.data)
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(join(OUT_DIR, 'office-tiles.png'), png)
  writeFileSync(
    join(OUT_DIR, 'office-tiles.json'),
    `${JSON.stringify({ version: 1, tile: 16, width: atlas.w, height: atlas.h, sprites: map }, null, 1)}\n`
  )
  console.log(`office-tiles.png ${atlas.w}x${atlas.h} ${png.length} bytes, ${Object.keys(map).length} sprites`)
}
