/* Dolphin Office: pixel-art geometry, palette, sprites and the static (1x) scene.
 * Plain browser script, no dependencies or assets; exposes window.DolphinOfficeScene for office-engine.js.
 */
;(function (root) {
  'use strict'

  const T = 16
  const ROOM_W = 10 * T
  const PER_ROW = 3
  const PLATE_H = 26
  const GAP = T
  const FW = 16
  const FH = 24
  const FIRST_PROJECT_ROW = 5
  const LOUNGE_Y = 4 * T + 12
  const COL_X = 8
  const DOOR_X = -12
  // Dev desk
  const DEV_X = 80
  const DEV_SPRITE_Y = 30
  const DD = { x0: 52, x1: 108, top: 47, front: 58, bottom: 63 }
  const CORRIDOR = '#e8d9bf'

  const PROJECT_COLORS = ['#e07a5f', '#3d7fd0', '#8a63c9', '#d29a2e', '#3f9a62', '#d0578a']
  const STATUS_COLOR = { working: '#3fc9a8', permission: '#f2a93b', idle: '#9aa6b0' }
  const STATUS_LABEL = { working: 'trabalhando', permission: 'aguardando aprovação', idle: 'ocioso' }
  const THEMES = [
    { wall: '#7fb2aa', wallD: '#5a8f87', carpet: '#adc1bd', carpet2: '#a5b9b5', accent: '#2f9c86' },
    { wall: '#7f9cc9', wallD: '#5d78a6', carpet: '#aab6c6', carpet2: '#a2afc0', accent: '#4f7cc9' },
    { wall: '#d6917c', wallD: '#b06e5b', carpet: '#c7b3aa', carpet2: '#bfaba2', accent: '#d9654b' },
    { wall: '#8fb38a', wallD: '#6c8f67', carpet: '#b3c1aa', carpet2: '#abb9a2', accent: '#57a773' },
    { wall: '#a993c9', wallD: '#8670a8', carpet: '#bbb2c8', carpet2: '#b3aac0', accent: '#8c6cc9' },
    { wall: '#d1b06b', wallD: '#ab8c4b', carpet: '#c8bfa5', carpet2: '#c0b79d', accent: '#c9962f' }
  ].map((t) => ({ ...t, rug: shade(t.accent, 0.35), rugD: t.accent, trim: '#f4f1ea' }))
  const SKINS = ['#f2c9a0', '#e0ac7e', '#c68a5c', '#9a6440', '#6e452b', '#f5d6b8']
  const HAIRS = ['#2b2230', '#5a3a24', '#8a5a2b', '#d9a54a', '#b2452f', '#3d3f52', '#e8e2d6']
  const SHIRTS = ['#4f7cc9', '#d9654b', '#57a773', '#8c6cc9', '#e0b84a', '#3fa9b5', '#c95f8f', '#5d6675']
  const PANTS = ['#3a4256', '#2f3a4a', '#4a3f36', '#3d4a3a']
  const STYLES = ['short', 'long', 'bun', 'cap', 'short', 'spiky']
  // Where idle agents wander: coffee bar, water cooler, the dev's desk.
  const SPOTS = [16, 147, DEV_X, DEV_X - 10, DEV_X + 10]

  function hash(s) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
    return h >>> 0
  }
  function rng(seed) {
    let s = seed || 1
    return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000 }
  }
  function pick(r, a) { return a[Math.floor(r() * a.length)] }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16)
    const f = (v) => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k)))
    return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0')
  }
  function lookFor(id) {
    const r = rng(hash(id))
    return { skin: pick(r, SKINS), hair: pick(r, HAIRS), shirt: pick(r, SHIRTS), pants: pick(r, PANTS), style: pick(r, STYLES), accent: pick(r, SHIRTS) }
  }
  // Stable per dev, so a reloaded wall display keeps every room's colors.
  function themeFor(id) { return THEMES[hash('theme:' + id) % THEMES.length] }

  /* ---------- sprites ---------- */
  // 0 front idle, 1-2 front walking, 3 back idle, 4-5 back walking,
  // 6-7 seated typing (back), 8 hand raised, 9 seated idle,
  // 10-11 seated facing front (dev), 12 dev idle.
  function buildSprites(look, headset) {
    const c = mkCanvas(FW * 13, FH)
    const g = c.getContext('2d')
    const { skin, hair, shirt, pants, style, accent } = look
    const shirtD = shade(shirt, -0.2)
    const px = (f, x, y, w, h, col) => { g.fillStyle = col; g.fillRect(f * FW + x, y, w, h) }

    function legs(f, lift) {
      px(f, 5, 17, 6, 3, pants)
      const ly = lift === 1 ? -1 : 0
      const ry = lift === 2 ? -1 : 0
      px(f, 5, 20 + ly, 2, 2, pants); px(f, 9, 20 + ry, 2, 2, pants)
      px(f, 5, 22 + ly, 2, 1, '#2a2733'); px(f, 9, 22 + ry, 2, 1, '#2a2733')
    }
    function torso(f, armL, armR) {
      px(f, 7, 11, 2, 1, skin)
      px(f, 4, 12, 8, 5, shirt)
      px(f, 4, 16, 8, 1, shirtD)
      if (armL) { px(f, 3, 12, 1, armL, shirtD); px(f, 3, 12 + armL, 1, 1, skin) }
      if (armR) { px(f, 12, 12, 1, armR, shirtD); px(f, 12, 12 + armR, 1, 1, skin) }
    }
    function head(f, back, dy) {
      if (back) {
        px(f, 4, 3 + dy, 8, 8, hair)
        px(f, 3, 7 + dy, 1, 2, skin); px(f, 12, 7 + dy, 1, 2, skin)
        if (style === 'long') px(f, 4, 11 + dy, 8, 3, hair)
      } else {
        px(f, 5, 6 + dy, 6, 5, skin)
        px(f, 4, 3 + dy, 8, 3, hair)
        px(f, 4, 6 + dy, 1, 3, hair); px(f, 11, 6 + dy, 1, 3, hair)
        px(f, 6, 8 + dy, 1, 1, '#2b2230'); px(f, 9, 8 + dy, 1, 1, '#2b2230')
        px(f, 6, 10 + dy, 1, 1, shade(skin, -0.12)); px(f, 9, 10 + dy, 1, 1, shade(skin, -0.12))
        if (style === 'long') { px(f, 4, 9 + dy, 1, 4, hair); px(f, 11, 9 + dy, 1, 4, hair) }
      }
      if (style === 'bun') px(f, 6, 1 + dy, 4, 2, hair)
      if (style === 'spiky') { px(f, 4, 2 + dy, 1, 1, hair); px(f, 7, 2 + dy, 1, 1, hair); px(f, 10, 2 + dy, 1, 1, hair) }
      if (style === 'cap' && !headset) {
        px(f, 4, 3 + dy, 8, 2, accent)
        px(f, back ? 5 : 3, 5 + dy, back ? 6 : 10, 1, shade(accent, -0.3))
      }
      if (headset) {
        px(f, 4, 2 + dy, 8, 1, '#2a2d35')
        px(f, 3, 6 + dy, 2, 3, '#2a2d35'); px(f, 11, 6 + dy, 2, 3, '#2a2d35')
        px(f, 3, 7 + dy, 1, 1, '#3fc9a8')
      }
    }
    const seatedPants = (f) => px(f, 5, 17, 6, 2, pants)

    legs(0, 0); torso(0, 4, 4); head(0, false, 0)
    legs(1, 1); torso(1, 3, 5); head(1, false, 0)
    legs(2, 2); torso(2, 5, 3); head(2, false, 0)
    legs(3, 0); torso(3, 4, 4); head(3, true, 0)
    legs(4, 1); torso(4, 3, 5); head(4, true, 0)
    legs(5, 2); torso(5, 5, 3); head(5, true, 0)
    seatedPants(6); torso(6, 2, 3); head(6, true, 0)
    seatedPants(7); torso(7, 3, 2); head(7, true, 1)
    seatedPants(8); torso(8, 4, 0); px(8, 12, 5, 1, 7, shirtD); px(8, 12, 4, 1, 1, skin); head(8, true, 0)
    seatedPants(9); torso(9, 4, 4); head(9, true, 1)
    torso(10, 3, 3); head(10, false, 0)
    torso(11, 3, 3); head(11, false, 1)
    torso(12, 4, 4); head(12, false, 0)
    return c
  }

  /* ---------- static scene (1x) ---------- */
  function drawCorridor(g, w, h) {
    g.fillStyle = CORRIDOR; g.fillRect(0, 0, w, h)
    g.fillStyle = '#ddcbaa'
    for (let y = 0; y < h; y += 8) {
      g.fillRect(0, y, w, 1)
      const off = (y / 8) % 2 ? 0 : 24
      for (let x = off; x < w; x += 48) g.fillRect(x, y, 1, 8)
    }
  }

  function floorTile(g, th, tx, ty) {
    g.fillStyle = tx % 2 === ty % 2 ? th.carpet2 : th.carpet
    g.fillRect(tx * T, ty * T, T, T)
  }

  // The slice of the dev desk in front of the dev is redrawn over them every frame.
  function devDeskSlice(g, x0, x1) {
    const w = x1 - x0
    g.fillStyle = '#a97448'; g.fillRect(x0, DD.top, w, DD.front - DD.top)
    g.fillStyle = '#bf8a5c'; g.fillRect(x0, DD.top, w, 1)
    g.fillStyle = '#7a5032'; g.fillRect(x0, DD.front, w, DD.bottom - DD.front)
    g.fillStyle = '#6a452b'; g.fillRect(x0, DD.bottom - 1, w, 1)
  }

  // A project is 1 plate row plus desk rows (desk, chair, aisle).
  function projectRows(p) { return 1 + Math.max(1, Math.ceil(p.seats.length / PER_ROW) * 3) }
  function seatGeom(p, i) {
    const r = Math.floor(i / PER_ROW)
    const c = i % PER_ROW
    const dx = 1 + c * 3
    const dy = p.row + 1 + r * 3
    return { dx, dy, seatX: (dx + 1) * T, seatY: dy * T + 30, aisleY: (dy + 1) * T + 24 }
  }

  function drawDesk(g, p, i, agent) {
    const { dx, dy, seatX } = seatGeom(p, i)
    const x = dx * T
    const y = dy * T
    const cx = seatX
    const r = rng(hash(String(i) + (agent ? agent.id : '')))
    g.fillStyle = 'rgba(0,0,0,.10)'; g.fillRect(x + 1, y + 15, 2 * T, 2)
    g.fillStyle = '#f4f1ea'; g.fillRect(x, y + 2, 2 * T, 11)
    g.fillStyle = '#c8c1b4'; g.fillRect(x, y + 12, 2 * T, 3)
    g.fillStyle = p.color; g.fillRect(x, y + 12, 2 * T, 1)
    g.fillStyle = '#6b6a73'; g.fillRect(x + 1, y + 15, 2, 4); g.fillRect(x + 2 * T - 3, y + 15, 2, 4)
    if (agent) {
      g.fillStyle = '#2c3140'; g.fillRect(cx - 8, y - 6, 16, 11)
      g.fillStyle = '#17222e'; g.fillRect(cx - 7, y - 5, 14, 8)
      g.fillStyle = '#3d4354'; g.fillRect(cx - 1, y + 5, 2, 2); g.fillRect(cx - 3, y + 6, 6, 1)
      g.fillStyle = '#5d6372'; g.fillRect(cx - 5, y + 8, 10, 3)
      g.fillStyle = '#7b8192'; g.fillRect(cx - 4, y + 8, 8, 1)
      g.fillStyle = '#5d6372'; g.fillRect(cx + 7, y + 8, 2, 3)
      const deco = Math.floor(r() * 4)
      if (deco === 0) { g.fillStyle = '#f7f8f9'; g.fillRect(x + 2, y + 6, 4, 4); g.fillStyle = pick(r, SHIRTS); g.fillRect(x + 2, y + 6, 4, 1) }
      if (deco === 1) { g.fillStyle = '#c8794a'; g.fillRect(x + 2, y + 6, 4, 4); g.fillStyle = '#5fa35a'; g.fillRect(x + 2, y + 2, 4, 4) }
      if (deco === 2) { g.fillStyle = pick(r, SHIRTS); g.fillRect(x + 1, y + 7, 6, 2); g.fillStyle = pick(r, SHIRTS); g.fillRect(x + 2, y + 5, 5, 2) }
      if (deco === 3) { g.fillStyle = '#f2c94c'; g.fillRect(x + 26, y + 1, 4, 3); g.fillRect(x + 25, y + 3, 6, 3); g.fillStyle = '#e8873a'; g.fillRect(x + 31, y + 4, 1, 1) }
    }
    const sy = y + 30
    g.fillStyle = '#4a4f5c'; g.fillRect(cx - 5, sy - 11, 10, 5)
    g.fillStyle = '#3b3f4a'; g.fillRect(cx - 6, sy - 6, 12, 5)
    g.fillStyle = '#555b69'; g.fillRect(cx - 6, sy - 6, 12, 1)
    g.fillStyle = '#2a2d35'; g.fillRect(cx - 4, sy - 1, 8, 1); g.fillRect(cx - 5, sy, 2, 1); g.fillRect(cx + 3, sy, 2, 1)
  }

  function drawRoom(g, room) {
    const th = room.theme
    const H = room.h
    g.save(); g.translate(room.x, room.y)
    for (let ty = 2; ty < H / T; ty++) for (let tx = 0; tx < ROOM_W / T; tx++) floorTile(g, th, tx, ty)
    // wall
    g.fillStyle = th.wall; g.fillRect(0, 0, ROOM_W, 2 * T)
    g.fillStyle = th.wallD; g.fillRect(0, 0, ROOM_W, 3); g.fillRect(0, 2 * T - 3, ROOM_W, 3)
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(0, 2 * T, ROOM_W, 2)
    // whiteboard
    g.fillStyle = '#b9bec7'; g.fillRect(6, 4, 38, 20)
    g.fillStyle = '#f7f8f9'; g.fillRect(7, 5, 36, 18)
    g.fillStyle = '#c9ced6'; g.fillRect(10, 9, 14, 1); g.fillRect(10, 12, 10, 1); g.fillRect(10, 15, 16, 1)
    g.fillStyle = th.accent; g.fillRect(30, 8, 5, 5)
    g.fillStyle = '#f2d36b'; g.fillRect(36, 8, 5, 5); g.fillRect(33, 15, 5, 5)
    // window
    g.fillStyle = '#eef2f4'; g.fillRect(116, 5, 36, 16)
    g.fillStyle = '#9ccbe6'; g.fillRect(118, 7, 15, 12); g.fillRect(135, 7, 15, 12)
    g.fillStyle = '#c4e3f3'; g.fillRect(118, 7, 15, 3); g.fillRect(135, 7, 15, 3)
    // dev area rug
    g.fillStyle = th.trim; g.fillRect(40, 33, 80, 31)
    g.fillStyle = th.rug; g.fillRect(42, 35, 76, 27)
    g.fillStyle = th.rugD
    for (let x = 44; x < 116; x += 4) { g.fillRect(x, 36, 2, 1); g.fillRect(x, 60, 2, 1) }
    // dev chair (high back)
    g.fillStyle = '#2e3340'; g.fillRect(71, 30, 18, 16)
    g.fillStyle = '#454b5a'; g.fillRect(71, 30, 18, 2); g.fillRect(72, 32, 1, 12)
    // dev monitors (seen from behind) and desk
    for (const mx of [54, 90]) {
      g.fillStyle = '#3a3f4c'; g.fillRect(mx, 36, 16, 11)
      g.fillStyle = '#4a505f'; g.fillRect(mx + 1, 37, 14, 1)
      g.fillStyle = '#2c3140'; g.fillRect(mx + 7, 47, 2, 2)
    }
    devDeskSlice(g, DD.x0, DD.x1)
    g.fillStyle = '#f4f1ea'; g.fillRect(56, 49, 5, 5); g.fillStyle = th.accent; g.fillRect(56, 49, 5, 1)
    g.fillStyle = '#5fa35a'; g.fillRect(100, 43, 2, 5); g.fillRect(98, 45, 2, 3); g.fillRect(102, 44, 2, 4)
    g.fillStyle = '#c8794a'; g.fillRect(98, 48, 6, 4)
    // coffee bar (left) and water cooler (right)
    g.fillStyle = '#a77a50'; g.fillRect(4, 40, 24, 20)
    g.fillStyle = '#c99b6c'; g.fillRect(4, 38, 24, 3)
    g.fillStyle = '#8a6342'; g.fillRect(15, 43, 1, 15)
    g.fillStyle = '#3a3f4a'; g.fillRect(7, 27, 10, 11)
    g.fillStyle = '#555b69'; g.fillRect(8, 28, 8, 3)
    g.fillStyle = '#e86a5a'; g.fillRect(14, 33, 1, 1)
    g.fillStyle = '#f4f1ea'; g.fillRect(20, 34, 4, 4)
    g.fillStyle = '#c8794a'; g.fillRect(30, 52, 7, 8)
    g.fillStyle = '#5fa35a'; g.fillRect(32, 40, 2, 12); g.fillRect(29, 44, 3, 8); g.fillRect(35, 43, 3, 9)
    g.fillStyle = '#e3e7ec'; g.fillRect(142, 42, 10, 18)
    g.fillStyle = '#a9d8f0'; g.fillRect(143, 31, 8, 11)
    g.fillStyle = '#cbe9f7'; g.fillRect(144, 32, 2, 8)
    g.fillStyle = '#4f7cc9'; g.fillRect(146, 47, 2, 2)
    // project blocks: floor stripe + desks in the project's color
    for (const p of room.projects) {
      const y = p.row * T + 5
      g.fillStyle = p.color
      for (let x = 20; x < ROOM_W - 4; x += 6) g.fillRect(x, y, 3, 1)
      for (let i = 0; i < p.seats.length; i++) drawDesk(g, p, i, p.seats[i])
    }
    // borders, with a door on the left at the walkway
    g.fillStyle = th.wallD
    g.fillRect(-2, -2, ROOM_W + 4, 2)
    g.fillRect(ROOM_W, 0, 2, H)
    g.fillRect(-2, H, ROOM_W + 4, 2)
    g.fillRect(-2, 0, 2, 4 * T)
    g.fillRect(-2, 5 * T, 2, H - 5 * T)
    g.restore()
  }

  root.DolphinOfficeScene = {
    T, ROOM_W, PLATE_H, GAP, FW, FH, FIRST_PROJECT_ROW, LOUNGE_Y, COL_X, DOOR_X, DEV_X, DEV_SPRITE_Y, DD, CORRIDOR,
    PROJECT_COLORS, STATUS_COLOR, STATUS_LABEL, SPOTS,
    hash, pick, mkCanvas, lookFor, themeFor, buildSprites,
    drawCorridor, floorTile, devDeskSlice, drawRoom, projectRows, seatGeom
  }
})(typeof window !== 'undefined' ? window : globalThis)
