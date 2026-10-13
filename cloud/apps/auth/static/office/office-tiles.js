/* Dolphin Office: loader for the generated tileset (tiles/office-tiles.{png,json}).
 * Plain browser script; exposes window.DolphinOfficeTiles. `ready` resolves true once the atlas is
 * usable and false when it failed, in which case callers keep the procedural drawing.
 */
;(function (root) {
  'use strict'

  const script = document.currentScript
  const base = script && script.src ? script.src.slice(0, script.src.lastIndexOf('/') + 1) : ''
  const tintCache = new Map()
  let atlas = null
  let image = null
  let sprites = {}

  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }

  function load() {
    const meta = fetch(base + 'office-tiles.json').then((r) => { if (!r.ok) throw new Error('atlas json ' + r.status); return r.json() })
    const img = new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('atlas png'))
      el.src = base + 'office-tiles.png'
    })
    return Promise.all([meta, img]).then(([m, el]) => {
      atlas = m
      sprites = m.sprites || {}
      image = el
      return true
    }).catch(() => false)
  }

  const has = (name) => Boolean(image && sprites[name])
  const size = (name) => (sprites[name] ? { w: sprites[name].fw || sprites[name].w, h: sprites[name].h } : null)

  function rectOf(name, frame) {
    const s = sprites[name]
    if (frame === 'all') return { sx: s.x, sy: s.y, sw: s.w, sh: s.h }
    const fw = s.fw || s.w
    return { sx: s.x + (frame || 0) * fw, sy: s.y, sw: fw, sh: s.h }
  }

  /** Draws sprite `name` (or one `frame` of it) with its top-left at (x, y); false when unavailable. */
  function draw(g, name, x, y, frame) {
    if (!has(name)) return false
    const r = rectOf(name, frame)
    g.drawImage(image, r.sx, r.sy, r.sw, r.sh, x, y, r.sw, r.sh)
    return true
  }

  /** Draws only the (sx, sy, sw, sh) window of a sprite, e.g. a slice of the dev desk. */
  function drawPart(g, name, sx, sy, sw, sh, x, y) {
    if (!has(name)) return false
    const s = sprites[name]
    g.drawImage(image, s.x + sx, s.y + sy, sw, sh, x, y, sw, sh)
    return true
  }

  /** Grayscale sprite multiplied by `color` (any CSS color); frame 'all' tints the whole strip; cached. */
  function tinted(name, color, frame) {
    if (!has(name)) return null
    const key = name + '|' + (frame || 0) + '|' + color
    let c = tintCache.get(key)
    if (!c) {
      const r = rectOf(name, frame)
      c = mkCanvas(r.sw, r.sh)
      const g = c.getContext('2d')
      g.drawImage(image, r.sx, r.sy, r.sw, r.sh, 0, 0, r.sw, r.sh)
      g.globalCompositeOperation = 'multiply'
      g.fillStyle = color
      g.fillRect(0, 0, r.sw, r.sh)
      g.globalCompositeOperation = 'destination-in'
      g.drawImage(image, r.sx, r.sy, r.sw, r.sh, 0, 0, r.sw, r.sh)
      tintCache.set(key, c)
    }
    return c
  }

  function drawTinted(g, name, color, x, y, frame) {
    const c = tinted(name, color, frame)
    if (!c) return false
    g.drawImage(c, x, y)
    return true
  }

  /** Fills a w×h area by repeating a (tinted) sprite from (x, y). */
  function tile(g, name, color, x, y, w, h) {
    const s = size(name)
    const src = color ? tinted(name, color) : null
    if (!s || (color && !src)) return false
    for (let ty = 0; ty < h; ty += s.h) {
      for (let tx = 0; tx < w; tx += s.w) {
        const cw = Math.min(s.w, w - tx)
        const ch = Math.min(s.h, h - ty)
        if (src) g.drawImage(src, 0, 0, cw, ch, x + tx, y + ty, cw, ch)
        else drawPart(g, name, 0, 0, cw, ch, x + tx, y + ty)
      }
    }
    return true
  }

  const characterCache = new Map()

  /** 13-frame 16x24 strip for `look` ({ skin, hair, shirt, pants, style, accent }), or null without the atlas. */
  function character(look, headset) {
    // Needs every layer; an older cached atlas missing one falls back to the procedural strip.
    for (const n of ['ch_pants', 'ch_shirt', 'ch_skin', 'ch_fixed', 'ch_headset', 'ch_cap', 'ch_outline_cap']) if (!has(n)) return null
    for (const st of ['short', 'long', 'bun', 'spiky']) {
      if (!has('ch_hair_' + st) || !has('ch_outline_' + st) || !has('ch_outline_' + st + '_h')) return null
    }
    const key = [look.skin, look.hair, look.shirt, look.pants, look.style, look.accent, headset ? 1 : 0].join('|')
    let c = characterCache.get(key)
    if (c) return c
    const cap = look.style === 'cap' && !headset
    const hair = look.style === 'cap' ? 'short' : look.style
    const outline = cap ? 'cap' : hair + (headset ? '_h' : '')
    const layers = [
      ['ch_outline_' + outline, null],
      ['ch_pants', look.pants],
      ['ch_shirt', look.shirt],
      ['ch_skin', look.skin],
      ['ch_hair_' + hair, look.hair],
      ['ch_fixed', null]
    ]
    if (cap) layers.push(['ch_cap', look.accent])
    if (headset) layers.push(['ch_headset', null])
    c = mkCanvas(sprites.ch_skin.fw * sprites.ch_skin.frames, sprites.ch_skin.h)
    const g = c.getContext('2d')
    for (const [name, color] of layers) {
      const layer = color ? tinted(name, color, 'all') : null
      if (layer) g.drawImage(layer, 0, 0)
      else if (!color) draw(g, name, 0, 0, 'all')
    }
    characterCache.set(key, c)
    return c
  }

  root.DolphinOfficeTiles = {
    ready: load(),
    has, size, draw, drawPart, tinted, drawTinted, tile, character,
    image: () => image,
    get atlas() { return atlas }
  }
})(typeof window !== 'undefined' ? window : globalThis)
