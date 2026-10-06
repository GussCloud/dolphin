/* Dolphin Office: 2D pixel-art office of an organization's devs and their agents.
 *
 *  - Each connected dev (account) gets a room with a featured desk.
 *  - Each open project is a block of desks with its own plate and color, stacked in front of the dev.
 *  - A new agent gets a desk that "builds" itself, then walks in through the door to it.
 *
 * Why it stays light: one viewport-sized <canvas>, the static scene drawn once into a 1x canvas and
 * redrawn only on layout change, code-generated 16x24 sprites, a ~15 fps loop that pauses when the
 * tab is hidden or the canvas is off screen, zero dependencies and zero assets.
 *
 * API:
 *   const office = createOffice(hostEl, { fps, scale })
 *   office.upsertDev({ id, name, machine, offline }, { instant })
 *   office.removeDev(id)        // agents leave, the dev says goodbye, the room closes
 *   office.upsertProject({ id, devId, name })
 *   office.removeProject(id)    // the project's agents leave and the block closes
 *   office.upsertAgent({ id, devId, projectId, name, cli, status, title }, { instant })  // 'working' | 'permission' | 'idle'
 *   office.removeAgent(id)      // the agent walks out the door
 *   office.say(id, text, ms)    // agent or dev id
 *   office.zoom(+1 | -1), office.setScale(s), office.setAutoFit(on), office.stats(), office.destroy()
 *   opts.autoFit: pick the largest scale that shows every room without scrolling (wall displays)
 *
 * Speech bubbles only report real transitions; the scene never invents what an agent is doing.
 */
;(function (root) {
  'use strict'

  const S0 = root.DolphinOfficeScene
  const { T, ROOM_W, PLATE_H, GAP, FW, FH, FIRST_PROJECT_ROW, LOUNGE_Y, COL_X, DOOR_X, DEV_X, DEV_SPRITE_Y, DD, CORRIDOR } = S0
  const { PROJECT_COLORS, STATUS_COLOR, STATUS_LABEL, SPOTS } = S0
  const { hash, pick, mkCanvas, lookFor, themeFor, buildSprites } = S0
  const { drawCorridor, floorTile, devDeskSlice, drawRoom, projectRows, seatGeom } = S0
  const { pickFitScale } = root.DolphinOfficeFit
  const FIT_GEOMETRY = { roomW: ROOM_W, gap: GAP, plateH: PLATE_H }

  const SPEED = 34
  const DESK_BUILD = 0.6
  const OFFLINE_DOT = '#9aa6b0'
  const ONLINE_DOT = '#45d16b'

  function rand(a, b) { return a + Math.random() * (b - a) }

  function createOffice(host, opts = {}) {
    const fps = opts.fps || 15
    const reduced = opts.reducedMotion ?? (root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches)

    if (getComputedStyle(host).position === 'static') host.style.position = 'relative'
    const canvas = document.createElement('canvas')
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block'
    const scroller = document.createElement('div')
    scroller.style.cssText = 'position:absolute;inset:0;overflow:auto;-webkit-overflow-scrolling:touch'
    const spacer = document.createElement('div')
    scroller.appendChild(spacer)
    host.append(canvas, scroller)
    const ctx = canvas.getContext('2d', { alpha: false })

    const devs = new Map()
    const projects = new Map()
    const agents = new Map()
    function* agentsOf(d) { for (const p of d.projects) for (const a of p.seats) if (a) yield a }
    function hasAgents(d) { for (const _ of agentsOf(d)) return true; return false }
    let order = []
    let S = opts.scale || 0
    let autoFit = !!opts.autoFit
    let dpr = 1
    let vw = 0
    let vh = 0
    let worldW = 0
    let worldH = 0
    let staticCanvas = mkCanvas(1, 1)
    let dirty = true
    let now = 0
    let hover = null
    let raf = 0
    let running = false
    let visible = true
    let last = 0
    let frames = 0
    let fpsT = 0
    let fpsVal = 0
    let drawMs = 0
    const widthCache = new Map()

    /* ---- devs ---- */
    function upsertDev(d, o = {}) {
      let dev = devs.get(d.id)
      if (!dev) {
        dev = {
          id: d.id, projects: [], born: o.instant ? now - 1 : now, x: 0, y: 0, h: 0, leaving: false, leaveAt: 0,
          theme: themeFor(d.id), sprites: null, skin: '', animT: Math.random(), bubble: null, projectSeq: 0, offline: false
        }
        const look = lookFor('dev:' + d.id)
        dev.sprites = buildSprites(look, true)
        dev.skin = look.skin
        devs.set(d.id, dev)
        order.push(d.id)
        if (!o.instant) dev.bubble = { text: 'olá 👋', until: now + 2.6 }
      }
      // Back before the goodbye finished: stay.
      if (dev.leaving) { dev.leaving = false; dev.bubble = null }
      const offline = !!d.offline
      if (offline !== dev.offline) {
        dev.offline = offline
        dev.bubble = offline ? null : { text: 'voltei!', until: now + 2.2 }
      }
      dev.name = d.name ?? dev.name ?? d.id
      dev.machine = d.machine ?? dev.machine ?? ''
      dirty = true
      return dev
    }

    function dropDev(id) {
      const dev = devs.get(id)
      if (!dev) return
      for (const a of agentsOf(dev)) agents.delete(a.id)
      for (const p of dev.projects) projects.delete(p.id)
      devs.delete(id)
      order = order.filter((x) => x !== id)
      dirty = true
    }

    function removeDev(id) {
      const dev = devs.get(id)
      if (!dev || dev.leaving) return
      dev.leaving = true
      dev.offline = false
      dev.leaveAt = now + 2.5
      dev.bubble = { text: 'até amanhã 👋', until: now + 3 }
      for (const a of [...agentsOf(dev)]) removeAgent(a.id)
    }

    /* ---- projects ---- */
    function upsertProject(d) {
      let p = projects.get(d.id)
      if (!p) {
        const dev = devs.get(d.devId) || upsertDev({ id: d.devId, name: d.devId }, { instant: true })
        p = { id: d.id, dev, seats: [], row: -1, leaving: false, color: PROJECT_COLORS[dev.projectSeq++ % PROJECT_COLORS.length] }
        dev.projects.push(p)
        projects.set(d.id, p)
        dirty = true
      }
      if (p.leaving) { p.leaving = false; dirty = true }
      p.name = d.name ?? p.name ?? d.id
      return p
    }

    function removeProject(id) {
      const p = projects.get(id)
      if (!p || p.leaving) return
      p.leaving = true
      dirty = true
      for (const a of p.seats) if (a) removeAgent(a.id)
      if (projects.has(id) && !p.seats.some(Boolean)) dropProject(p)
    }

    function dropProject(p) {
      projects.delete(p.id)
      p.dev.projects = p.dev.projects.filter((x) => x !== p)
      dirty = true
    }

    /* ---- agents ---- */
    function upsertAgent(d, o = {}) {
      let a = agents.get(d.id)
      if (!a) {
        const project = projects.get(d.projectId) || upsertProject({ id: d.projectId, devId: d.devId })
        const dev = project.dev
        let seat = project.seats.indexOf(null)
        if (seat < 0) seat = project.seats.length
        a = {
          id: d.id, dev, project, seat, sprites: buildSprites(lookFor(d.id), false),
          x: DOOR_X, y: LOUNGE_Y, path: [], goal: 'seat', at: 'lounge', facing: 'down',
          walkT: 0, animT: Math.random(), nextWander: now + rand(8, 20),
          standUntil: 0, bubble: null, leaving: false,
          deskBorn: Math.max(now, dev.born + 0.5), enterAt: 0
        }
        a.enterAt = a.deskBorn + DESK_BUILD + 0.2
        project.seats[seat] = a
        agents.set(d.id, a)
        dirty = true
        if (o.instant) {
          // Already at work when the page opened: skip the build-and-walk-in. The seat is placed by
          // layout(), since a new project has no row yet.
          a.deskBorn = now - DESK_BUILD
          a.enterAt = now
          a.snap = true
          a.at = 'seat'
          a.facing = 'up'
        }
      } else if (a.leaving) {
        a.leaving = false
        a.bubble = null
        if (a.at !== 'seat') walk(a, 'seat')
      }
      const prev = a.status
      a.name = d.name ?? a.name ?? d.id
      a.cli = d.cli ?? a.cli
      a.title = d.title ?? a.title
      a.status = d.status ?? a.status ?? 'idle'
      if (prev && prev !== a.status) {
        if (a.status === 'permission') a.bubble = { text: 'preciso de aprovação', until: now + 3 }
        else if (prev === 'permission' && !a.dev.leaving) {
          a.dev.bubble = { text: 'aprovado ✓', until: now + 2.2 }
          a.bubble = { text: 'valeu!', until: now + 2.2 }
        } else if (prev === 'working' && a.status === 'idle') a.bubble = { text: 'terminei!', until: now + 2.6 }
        if (a.status !== 'idle' && a.at !== 'seat' && !a.path.length) walk(a, 'seat')
      }
      return a
    }

    function removeAgent(id) {
      const a = agents.get(id)
      if (!a || a.leaving) return
      a.leaving = true
      a.bubble = { text: 'até mais 👋', until: now + 2 }
      if (now < a.enterAt) return finishLeave(a)
      if (!a.path.length) walk(a, 'door')
    }

    function finishLeave(a) {
      agents.delete(a.id)
      const p = a.project
      p.seats[a.seat] = null
      while (p.seats.length && p.seats[p.seats.length - 1] === null) p.seats.pop()
      if (p.leaving && !p.seats.length) dropProject(p)
      dirty = true
    }

    function say(id, text, ms = 3000) {
      const who = agents.get(id) || devs.get(id)
      if (who) who.bubble = { text, until: now + ms / 1000 }
    }

    /* ---- paths: always along the aisles (door column and free rows) ---- */
    function walk(a, goal, spotX) {
      const g = seatGeom(a.project, a.seat)
      const p = []
      if (a.at === 'seat') p.push([g.seatX, g.aisleY], [COL_X, g.aisleY], [COL_X, LOUNGE_Y])
      else p.push([COL_X, LOUNGE_Y])
      if (goal === 'seat') p.push([COL_X, g.aisleY], [g.seatX, g.aisleY], [g.seatX, g.seatY])
      else if (goal === 'spot') p.push([spotX, LOUNGE_Y])
      else p.push([DOOR_X, LOUNGE_Y])
      a.path = p
      a.goal = goal
      a.at = 'moving'
    }

    function arrive(a) {
      a.at = a.goal === 'seat' ? 'seat' : 'lounge'
      if (a.goal === 'door') { if (a.leaving) finishLeave(a); return }
      if (a.leaving) return walk(a, 'door')
      a.facing = 'up'
      if (a.goal === 'seat') a.nextWander = now + rand(8, 20)
      else a.standUntil = now + rand(4, 8)
      if (a.goal === 'spot' && a.status !== 'idle') walk(a, 'seat')
    }

    function update(dt) {
      for (const d of [...devs.values()]) {
        if (!d.offline) d.animT += dt
        if (d.leaving && now > d.leaveAt && !hasAgents(d)) dropDev(d.id)
      }
      for (const a of agents.values()) {
        // A room without signal freezes: we no longer know what its agents are doing.
        if (now < a.enterAt || (a.dev.offline && !a.leaving)) continue
        if (a.at === 'lounge' && a.x === DOOR_X && !a.path.length && !a.leaving) walk(a, 'seat')
        a.animT += dt
        if (a.path.length) {
          const [tx, ty] = a.path[0]
          const dx = tx - a.x
          const dy = ty - a.y
          const step = SPEED * dt * (a.leaving ? 1.8 : 1)
          if (Math.abs(dx) + Math.abs(dy) <= step) {
            a.x = tx; a.y = ty; a.path.shift()
            if (!a.path.length) arrive(a)
          } else if (Math.abs(dx) > 0.01) {
            a.x += Math.sign(dx) * Math.min(step, Math.abs(dx)); a.facing = 'down'
          } else {
            a.y += Math.sign(dy) * Math.min(step, Math.abs(dy)); a.facing = dy < 0 ? 'up' : 'down'
          }
          a.walkT += dt
        } else if (a.at === 'seat' && a.status === 'idle' && !reduced && now > a.nextWander) {
          walk(a, 'spot', pick(Math.random, SPOTS) + rand(-3, 3))
        } else if (a.at === 'lounge' && now > a.standUntil && !a.leaving) {
          walk(a, 'seat')
        }
      }
    }

    /* ---- layout: rooms flow in a grid that fits the available width ---- */
    function layout() {
      for (const id of order) placeProjects(devs.get(id))
      if (autoFit) S = pickFitScale(vw, vh, order.map((id) => devs.get(id).h), FIT_GEOMETRY)
      const cols = Math.max(1, Math.floor((vw / S - GAP) / (ROOM_W + GAP)))
      const used = Math.min(cols, order.length || 1) * (ROOM_W + GAP) + GAP
      const ox = Math.max(0, Math.floor((vw / S - used) / 2))
      let rowTop = GAP / 2
      let rowH = 0
      order.forEach((id, i) => {
        const dev = devs.get(id)
        const col = i % cols
        if (col === 0 && i > 0) { rowTop += PLATE_H + rowH + GAP; rowH = 0 }
        dev.x = ox + GAP + col * (ROOM_W + GAP)
        dev.y = rowTop + PLATE_H
        rowH = Math.max(rowH, dev.h)
      })
      const contentH = rowTop + PLATE_H + rowH + GAP
      worldW = Math.max(used + ox, Math.ceil(vw / S))
      worldH = Math.max(contentH, Math.ceil(vh / S))
      // Sized to the content, not the corridor fill, so a fitted view never shows scrollbars.
      spacer.style.width = Math.floor((used + ox) * S) + 'px'
      spacer.style.height = Math.floor(contentH * S) + 'px'
      staticCanvas = mkCanvas(worldW, worldH)
      const g = staticCanvas.getContext('2d')
      drawCorridor(g, worldW, worldH)
      for (const id of order) drawRoom(g, devs.get(id))
      dirty = false
    }

    // Stacks a dev's project blocks and sets the room height; independent of the zoom.
    function placeProjects(dev) {
      let row = FIRST_PROJECT_ROW
      for (const p of dev.projects) {
        // When an earlier block grew, this one moves down with its desks and the people at them.
        if (p.row >= 0 && p.row !== row) shiftProject(p, (row - p.row) * T)
        p.row = row
        for (const a of p.seats) {
          if (!a || !a.snap) continue
          const g = seatGeom(p, a.seat)
          a.x = g.seatX
          a.y = g.seatY
          a.snap = false
        }
        row += projectRows(p)
      }
      dev.h = Math.max(row, FIRST_PROJECT_ROW + 1) * T
    }

    function shiftProject(p, dy) {
      for (const a of p.seats) {
        if (!a) continue
        if (a.y > LOUNGE_Y + 2) a.y += dy
        for (const pt of a.path) if (pt[1] > LOUNGE_Y + 2) pt[1] += dy
      }
    }

    function resize() {
      const r = host.getBoundingClientRect()
      vw = Math.max(1, r.width)
      vh = Math.max(1, r.height)
      dpr = Math.min(2, root.devicePixelRatio || 1)
      if (!S) S = vw >= 900 ? 3 : 2
      canvas.width = Math.round(vw * dpr)
      canvas.height = Math.round(vh * dpr)
      dirty = true
    }

    /* ---- drawing ---- */
    const FONT = '"Pixelify Sans", "Silkscreen", ui-monospace, monospace'
    function textW(font, s) {
      const k = font + s
      let w = widthCache.get(k)
      if (w === undefined) {
        ctx.font = font; w = ctx.measureText(s).width
        if (widthCache.size > 500) widthCache.clear()
        widthCache.set(k, w)
      }
      return w
    }
    function pill(x, y, w, h, fill) {
      ctx.fillStyle = fill
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, h / 2)
      else ctx.rect(x, y, w, h)
      ctx.fill()
    }
    function bubble(x, by, text, tint) {
      const font = '500 6px ' + FONT
      const bw = Math.min(110, textW(font, text)) + 10
      const bx = Math.round(x - bw / 2)
      ctx.fillStyle = '#2b2733'
      ctx.fillRect(bx, by - 1, bw, 13); ctx.fillRect(bx - 1, by, bw + 2, 11)
      ctx.fillStyle = tint; ctx.fillRect(bx, by, bw, 11)
      ctx.fillStyle = '#2b2733'; ctx.fillRect(x - 2, by + 12, 4, 1); ctx.fillRect(x - 1, by + 13, 2, 1)
      ctx.fillStyle = tint; ctx.fillRect(x - 2, by + 11, 4, 1)
      ctx.save(); ctx.beginPath(); ctx.rect(bx + 2, by, bw - 4, 11); ctx.clip()
      ctx.font = font; ctx.fillStyle = '#2b2733'; ctx.fillText(text, bx + 5, by + 6)
      ctx.restore()
    }
    function tag(x, ty, label, dot, fill, font) {
      const w = textW(font, label) + 12
      const tx = x - w / 2
      pill(tx, ty, w, 9, fill)
      ctx.fillStyle = dot
      ctx.beginPath(); ctx.arc(tx + 5, ty + 4.5, 1.6, 0, 6.283); ctx.fill()
      ctx.font = font; ctx.fillStyle = '#f2f4f6'; ctx.fillText(label, tx + 8, ty + 5)
    }

    function drawDeskBuild(d, a) {
      const p = (now - a.deskBorn) / DESK_BUILD
      if (p >= 1) return
      const g = seatGeom(a.project, a.seat)
      ctx.save(); ctx.translate(d.x, d.y)
      for (let ty = g.dy - 1; ty <= g.dy + 1; ty++) for (let tx = g.dx; tx <= g.dx + 1; tx++) floorTile(ctx, d.theme, tx, ty)
      if (p > 0) {
        const x = g.dx * T
        const y = g.dy * T + 2
        const h = Math.max(1, Math.round(13 * p))
        ctx.fillStyle = d.theme.accent
        ctx.fillRect(x, y + 13 - h, 1, h); ctx.fillRect(x + 2 * T - 1, y + 13 - h, 1, h)
        ctx.fillRect(x, y + 13 - h, 2 * T, 1); ctx.fillRect(x, y + 12, 2 * T, 1)
        ctx.fillStyle = '#ffffff'
        const k = Math.floor(p * 8)
        ctx.fillRect(x + ((k * 7) % 30), y - 4 - (k % 3), 1, 1)
        ctx.fillRect(x + ((k * 11 + 9) % 30), y - 2 + (k % 2), 1, 1)
      }
      ctx.restore()
    }

    function drawDevAndScreens(d, tick) {
      for (const a of agentsOf(d)) drawDeskBuild(d, a)
      // The dev sits at the featured desk, facing the team.
      let busy = false
      if (!d.offline) for (const a of agentsOf(d)) if (a.status === 'working') { busy = true; break }
      const f = d.leaving || d.offline ? 12 : busy ? 10 + (Math.floor(d.animT * 4) % 2) : Math.floor(d.animT * 0.4) % 3 === 0 ? 12 : 10
      ctx.drawImage(d.sprites, f * FW, 0, FW, FH, d.x + DEV_X - 8, d.y + DEV_SPRITE_Y, FW, FH)
      ctx.save(); ctx.translate(d.x, d.y)
      devDeskSlice(ctx, DEV_X - 9, DEV_X + 9)
      ctx.fillStyle = '#4d5363'; ctx.fillRect(DEV_X - 6, 50, 12, 3)
      ctx.fillStyle = '#6b7182'; ctx.fillRect(DEV_X - 5, 50, 10, 1)
      const up = busy && tick % 2
      ctx.fillStyle = d.skin
      ctx.fillRect(DEV_X - 5, up ? 48 : 49, 2, 2)
      ctx.fillRect(DEV_X + 3, up ? 49 : 48, 2, 2)
      ctx.restore()
      // agent screens
      for (const a of agentsOf(d)) {
        if (a.at !== 'seat') continue
        const g = seatGeom(a.project, a.seat)
        const x = d.x + g.seatX - 6
        const y = d.y + g.dy * T - 4
        if (a.status === 'working' && !d.offline) {
          const h = hash(a.id)
          for (let l = 0; l < 3; l++) {
            const w = 3 + ((h >>> (l * 3)) + tick + l * 5) % 8
            ctx.fillStyle = l === 1 ? '#f2b84b' : l === 2 ? '#e87fa8' : '#5fd4c4'
            ctx.fillRect(x + (l === 1 ? 2 : 0), y + l * 2, w, 1)
          }
        } else if (a.status === 'permission' && !d.offline) {
          ctx.fillStyle = tick % 2 ? '#f2a93b' : '#8a5f22'; ctx.fillRect(x, y, 12, 6)
        } else {
          ctx.fillStyle = '#24384a'; ctx.fillRect(x + 4, y + 2, 4, 2)
        }
      }
    }

    function drawPlates(visibleDevs) {
      const projFont = '700 6px ' + FONT
      for (const d of visibleDevs) {
        for (const p of d.projects) {
          const label = p.leaving ? p.name + ' (fechando)' : p.name
          const w = textW(projFont, label) + 10
          const x = d.x + 20
          const y = d.y + p.row * T + 1
          ctx.fillStyle = p.color
          ctx.fillRect(x, y + 1, w, 8); ctx.fillRect(x + 1, y, w - 2, 10)
          ctx.font = projFont; ctx.fillStyle = '#ffffff'; ctx.fillText(label, x + 5, y + 5.5)
        }
      }
    }

    function agentFrame(a) {
      if (a.at === 'seat') {
        if (a.dev.offline) return 9
        if (a.status === 'working') return 6 + (Math.floor(a.animT * 5) % 2)
        if (a.status === 'permission') return 8
        return Math.floor(a.animT * 0.5) % 4 === 0 ? 9 : 6
      }
      if (a.path.length) {
        const step = 1 + (Math.floor(a.walkT * 8) % 2)
        return a.facing === 'up' ? 3 + step : step
      }
      return a.facing === 'up' ? 3 : 0
    }

    function drawRoomPlate(d) {
      const plateFont = '600 7px ' + FONT
      const machineFont = '500 6px ' + FONT
      const title = d.name
      const sub = d.leaving ? 'desconectando…' : d.offline ? 'sem sinal' : d.machine
      let n = 0
      for (const _ of agentsOf(d)) n++
      const w = textW(plateFont, title) + (sub ? textW(machineFont, sub) + 5 : 0) + 14 + n * 5 + Math.max(0, d.projects.length - 1) * 3
      const px = d.x + ROOM_W / 2 - w / 2
      const py = d.y - PLATE_H + 6
      pill(px, py, w, 13, 'rgba(255,255,255,.8)')
      ctx.font = plateFont; ctx.fillStyle = '#4b4650'
      ctx.fillText(title, px + 7, py + 7)
      let dx = px + 7 + textW(plateFont, title) + 5
      if (sub) {
        ctx.font = machineFont; ctx.fillStyle = d.offline ? '#b0543f' : '#8a838f'
        ctx.fillText(sub, dx, py + 7.5)
        dx += textW(machineFont, sub) + 5
      }
      d.projects.forEach((p, pi) => {
        if (pi > 0) dx += 3
        for (const a of p.seats) {
          if (!a) continue
          ctx.fillStyle = d.offline ? OFFLINE_DOT : STATUS_COLOR[a.status]; ctx.fillRect(dx, py + 5, 3, 3); dx += 5
        }
      })
    }

    function draw() {
      const t0 = performance.now()
      if (dirty) layout()
      const sx = scroller.scrollLeft
      const sy = scroller.scrollTop
      const k = S * dpr
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.imageSmoothingEnabled = false
      ctx.setTransform(k, 0, 0, k, -Math.round(sx * dpr), -Math.round(sy * dpr))
      ctx.drawImage(staticCanvas, 0, 0)
      const vx0 = sx / S - 24
      const vy0 = sy / S - 40
      const vx1 = (sx + vw) / S + 24
      const vy1 = (sy + vh) / S + 40
      const tick = Math.floor(now * 6)
      ctx.textBaseline = 'middle'

      const visibleDevs = []
      for (const id of order) {
        const d = devs.get(id)
        if (d.x + ROOM_W < vx0 || d.x > vx1 || d.y + d.h < vy0 || d.y - PLATE_H > vy1) continue
        visibleDevs.push(d)
      }
      for (const d of visibleDevs) drawDevAndScreens(d, tick)
      drawPlates(visibleDevs)

      // A new room reveals from top to bottom.
      for (const d of visibleDevs) {
        const p = Math.min(1, (now - d.born) / 0.7)
        if (p < 1) {
          const cut = d.y - 2 + (d.h + 4) * p
          ctx.fillStyle = CORRIDOR; ctx.fillRect(d.x - 2, cut, ROOM_W + 4, d.y + d.h + 2 - cut)
          ctx.fillStyle = d.theme.accent; ctx.fillRect(d.x - 2, cut, ROOM_W + 4, 1)
        }
      }

      // agents, sorted by depth
      const list = []
      for (const a of agents.values()) {
        if (now < a.enterAt) continue
        const wx = a.dev.x + a.x
        const wy = a.dev.y + a.y
        a.wx = wx; a.wy = wy
        if (wx < vx0 || wx > vx1 || wy < vy0 || wy > vy1) continue
        list.push(a)
      }
      list.sort((p, q) => p.wy - q.wy)
      for (const a of list) {
        const f = agentFrame(a)
        const x = Math.round(a.wx) - 8
        const y = Math.round(a.wy) - 23
        if (a.at !== 'seat') { ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x + 4, y + 22, 8, 2) }
        ctx.drawImage(a.sprites, f * FW, 0, FW, FH, x, y, FW, FH)
        if (a.at === 'seat') {
          ctx.fillStyle = '#3b3f4a'; ctx.fillRect(x + 2, y + 17, 12, 5)
          ctx.fillStyle = '#555b69'; ctx.fillRect(x + 2, y + 17, 12, 1)
        }
      }

      // Rooms without signal are greyed out under their labels.
      for (const d of visibleDevs) {
        if (!d.offline) continue
        ctx.fillStyle = 'rgba(96,104,112,.55)'; ctx.fillRect(d.x - 2, d.y - 2, ROOM_W + 4, d.h + 4)
      }

      for (const d of visibleDevs) drawRoomPlate(d)

      // dev badge and bubble
      const devFont = '700 6.5px ' + FONT
      for (const d of visibleDevs) {
        const x = d.x + DEV_X
        const ty = d.y + 21
        const hovered = hover && hover.dev === d
        tag(x, ty, d.name, d.leaving || d.offline ? OFFLINE_DOT : ONLINE_DOT, 'rgba(29,36,48,.9)', devFont)
        let text = null
        if (hovered) {
          let n = 0
          let w = 0
          for (const a of agentsOf(d)) { n++; if (a.status === 'working') w++ }
          const np = d.projects.length
          text = d.offline
            ? 'sem sinal do Dolphin deste dev'
            : np + (np === 1 ? ' projeto, ' : ' projetos, ') + n + (n === 1 ? ' agente, ' : ' agentes, ') + w + ' trabalhando'
        } else if (d.bubble && d.bubble.until > now) text = d.bubble.text
        if (text) bubble(x, ty - 14, text, hovered ? '#eaf8f5' : '#fffbea')
      }

      // agent badges, bubbles and the approval marker
      const tagFont = '600 6px ' + FONT
      for (const a of list) {
        const x = Math.round(a.wx)
        const y = Math.round(a.wy)
        const seated = a.at === 'seat'
        const hovered = hover && hover.agent === a
        const ty = seated ? y + 1 : y - 33
        const dot = a.dev.offline ? OFFLINE_DOT : STATUS_COLOR[a.status]
        tag(x, ty, a.name, dot, hovered ? '#1d2430' : 'rgba(29,36,48,.86)', tagFont)
        if (a.status === 'permission' && !a.leaving && !a.dev.offline) {
          const bob = tick % 4 < 2 ? 0 : -1
          ctx.fillStyle = '#f2a93b'; ctx.fillRect(x + 7, y - 26 + bob, 6, 7)
          ctx.fillStyle = '#3a2a10'; ctx.fillRect(x + 9, y - 25 + bob, 2, 3); ctx.fillRect(x + 9, y - 21 + bob, 2, 1)
        }
        let text = null
        if (hovered) text = (a.cli ? a.cli + ': ' : '') + STATUS_LABEL[a.status] + (a.title ? ' em ' + a.title : '') + ' (' + a.project.name + ')'
        else if (a.bubble && a.bubble.until > now) text = a.bubble.text
        if (text) bubble(x, seated ? y - 52 : ty - 14, text, hovered ? '#eaf8f5' : '#ffffff')
      }

      if (!order.length) {
        ctx.font = '600 8px ' + FONT; ctx.fillStyle = '#8a7a62'; ctx.textAlign = 'center'
        ctx.fillText('Nenhum dev conectado agora', (sx + vw / 2) / S, (sy + vh / 2) / S)
        ctx.textAlign = 'start'
      }
      drawMs = drawMs * 0.9 + (performance.now() - t0) * 0.1
    }

    function frame(t) {
      raf = requestAnimationFrame(frame)
      if (t - last < 1000 / fps - 2) return
      const dt = Math.min(0.1, (t - last) / 1000)
      last = t
      now += dt
      if (dirty) layout()
      update(dt)
      draw()
      frames++
      if (t - fpsT >= 1000) { fpsVal = Math.round((frames * 1000) / (t - fpsT)); frames = 0; fpsT = t }
    }
    function start() { if (!running && visible && !document.hidden) { running = true; last = performance.now(); fpsT = last; raf = requestAnimationFrame(frame) } }
    function stop() { running = false; cancelAnimationFrame(raf) }
    const onVis = () => (document.hidden ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    const io = root.IntersectionObserver ? new IntersectionObserver((e) => { visible = e[0].isIntersecting; visible ? start() : stop() }) : null
    if (io) io.observe(host)
    const ro = root.ResizeObserver ? new ResizeObserver(resize) : null
    if (ro) ro.observe(host)
    else root.addEventListener('resize', resize)

    function hitTest(ev) {
      const r = host.getBoundingClientRect()
      const wx = (ev.clientX - r.left + scroller.scrollLeft) / S
      const wy = (ev.clientY - r.top + scroller.scrollTop) / S
      let best = null
      for (const a of agents.values()) {
        if (a.wx === undefined || now < a.enterAt) continue
        const top = a.at === 'seat' ? a.wy - 24 : a.wy - 34
        const bottom = a.at === 'seat' ? a.wy + 10 : a.wy + 1
        if (wx > a.wx - 9 && wx < a.wx + 9 && wy > top && wy < bottom && (!best || a.wy > best.wy)) best = a
      }
      if (best) return { agent: best }
      for (const d of devs.values()) {
        const lx = wx - d.x
        const ly = wy - d.y
        if (lx > DEV_X - 12 && lx < DEV_X + 12 && ly > 20 && ly < DD.bottom) return { dev: d }
      }
      return null
    }
    scroller.addEventListener('pointermove', (ev) => { hover = hitTest(ev) })
    scroller.addEventListener('pointerleave', () => { hover = null })

    if (document.fonts && document.fonts.load) document.fonts.load('600 12px "Pixelify Sans"').then(() => widthCache.clear()).catch(() => {})
    resize()
    start()

    return {
      upsertDev, removeDev, upsertProject, removeProject, upsertAgent, removeAgent, say,
      /** Manual zoom; turns auto-fit off until setAutoFit(true). */
      zoom(delta) { autoFit = false; S = Math.max(1, Math.min(4, Math.round(S) + delta)); dirty = true },
      setScale(scale) { autoFit = false; S = Math.max(1, Math.min(4, scale)); dirty = true },
      setAutoFit(on) { autoFit = !!on; dirty = true },
      scale: () => S,
      autoFit: () => autoFit,
      stats: () => ({ fps: fpsVal, drawMs, agents: agents.size, devs: devs.size, projects: projects.size }),
      destroy() {
        stop()
        document.removeEventListener('visibilitychange', onVis)
        if (io) io.disconnect()
        if (ro) ro.disconnect()
        canvas.remove(); scroller.remove()
      }
    }
  }

  root.createOffice = createOffice
})(typeof window !== 'undefined' ? window : globalThis)
