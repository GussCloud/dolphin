/* Feeds the office engine from the work view stream: each `snapshot` event is the whole org view,
 * diffed here into upsert/remove calls so the scene animates only what changed.
 */
;(function () {
  'use strict'

  const host = document.getElementById('office')
  const stage = document.getElementById('office-stage')
  if (!host || !stage || !window.createOffice) return
  // The TV page always fits the screen; the console page fits only while fullscreen.
  const tv = stage.dataset.autofit === 'on'
  // The TV page rotates by itself (doors, then each room); the console page is click-through.
  const office = window.createOffice(host, { fps: 15, autoFit: tv, clickable: !tv, onView: (v) => syncView(v) })
  const conn = stage.querySelector('.office-conn')
  const back = stage.querySelector('[data-office-back]')
  const tools = stage.querySelectorAll('[data-office-zoom], [data-office-fit]')

  // Rotation timing (TV).
  const DOORS_MS = 10000
  const DOORS_GAP_MS = 2500
  const ROOM_MS = 12000

  function syncView(v) {
    if (back) back.hidden = tv || v.mode !== 'room'
    // Zoom only applies to a room; the doors always fit the screen.
    tools.forEach((b) => { b.disabled = v.mode !== 'room' })
  }
  syncView(office.view())
  if (back) back.addEventListener('click', () => office.showDoors())
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !tv && office.view().mode === 'room') office.showDoors()
  })

  const CLI_NAMES = {
    claude: 'Claude', codex: 'Codex', opencode: 'OpenCode', gemini: 'Gemini', pi: 'Pi', cursor: 'Cursor',
    copilot: 'Copilot', droid: 'Droid', amp: 'Amp', qwen: 'Qwen', antigravity: 'Antigravity'
  }
  const cliName = (cli) => CLI_NAMES[cli.toLowerCase()] || cli.charAt(0).toUpperCase() + cli.slice(1)

  // agentId -> { devId, given, name }: the visible name stays put while the agent lives. `given` is the
  // agent's own name from the stream ('' when absent); same-dev duplicates get " 2", " 3"; with no name
  // we fall back to "Claude 1", "Claude 2"...
  const agentNames = new Map()
  // Cuts at 28 UTF-16 units without leaving half of a surrogate pair.
  function clipName(s) {
    const cut = s.slice(0, 28)
    return /[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1).trimEnd() : cut.trimEnd()
  }
  function nameFor(devId, agent) {
    const given = typeof agent.name === 'string' ? clipName(agent.name.trim()) : ''
    const known = agentNames.get(agent.id)
    if (known && known.given === given) return known.name
    const used = new Set()
    for (const [id, info] of agentNames) if (info.devId === devId && id !== agent.id) used.add(info.name)
    let name = given
    if (given) {
      for (let n = 2; used.has(name); n++) name = given + ' ' + n
    } else {
      const base = cliName(agent.cli)
      let n = 1
      while (used.has(base + ' ' + n)) n++
      name = base + ' ' + n
    }
    agentNames.set(agent.id, { devId, given, name })
    return name
  }

  let seen = { devs: new Set(), projects: new Set(), agents: new Set() }
  let first = true

  function apply(view) {
    // The first snapshot shows everyone already at work instead of a crowd walking in.
    const instant = first
    first = false
    const next = { devs: new Set(), projects: new Set(), agents: new Set() }
    for (const dev of view.devs) {
      next.devs.add(dev.id)
      office.upsertDev({ id: dev.id, name: dev.name, machine: dev.machines.join(', '), offline: dev.status === 'offline' }, { instant })
      for (const p of dev.projects) {
        next.projects.add(p.id)
        office.upsertProject({ id: p.id, devId: dev.id, name: p.name })
        for (const a of p.agents) {
          next.agents.add(a.id)
          office.upsertAgent(
            { id: a.id, devId: dev.id, projectId: p.id, name: nameFor(dev.id, a), cli: cliName(a.cli), status: a.state, title: a.branch || undefined },
            { instant }
          )
        }
      }
    }
    for (const id of seen.agents) if (!next.agents.has(id)) { office.removeAgent(id); agentNames.delete(id) }
    for (const id of seen.projects) if (!next.projects.has(id)) office.removeProject(id)
    for (const id of seen.devs) if (!next.devs.has(id)) office.removeDev(id)
    seen = next
    setStat('devs', next.devs.size)
    setStat('projects', next.projects.size)
    setStat('agents', next.agents.size)
  }

  function setStat(name, value) {
    const el = stage.querySelector('[data-stat="' + name + '"]')
    if (el) el.textContent = String(value)
  }

  function setConn(state, text) {
    if (!conn) return
    conn.dataset.conn = state
    conn.textContent = text
  }

  let retryMs = 1000
  function connect() {
    const source = new EventSource(host.dataset.stream)
    source.addEventListener('snapshot', (e) => {
      retryMs = 1000
      setConn('live', 'Ao vivo')
      try { apply(JSON.parse(e.data)) } catch (err) { console.error('[office] bad snapshot', err) }
    })
    source.onopen = () => setConn('live', 'Ao vivo')
    source.onerror = () => {
      setConn('retrying', 'Reconectando…')
      // The browser retries dropped connections itself; a refused one (401/404) is CLOSED and needs us.
      if (source.readyState === EventSource.CLOSED) {
        source.close()
        setTimeout(connect, retryMs)
        retryMs = Math.min(retryMs * 2, 30000)
      }
    }
  }
  connect()

  // TV: doors for DOORS_MS, then each room for ROOM_MS with a short doors break in between. Rooms with an
  // approval waiting go first; offline devs with no agents are skipped. The queue is rebuilt every cycle.
  function rotationQueue() {
    const rooms = office.devSummaries().filter((d) => d.agents > 0 || !d.offline)
    return [...rooms.filter((d) => d.permission > 0 && !d.offline), ...rooms.filter((d) => !(d.permission > 0 && !d.offline))].map((d) => d.id)
  }
  function startRotation() {
    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
    ;(async function loop() {
      for (;;) {
        office.showDoors()
        await wait(DOORS_MS)
        const queue = rotationQueue()
        for (let i = 0; i < queue.length; i++) {
          office.openRoom(queue[i])
          await wait(ROOM_MS)
          office.showDoors()
          if (i < queue.length - 1) await wait(DOORS_GAP_MS)
        }
      }
    })()
  }
  if (tv) startRotation()

  const fit = stage.querySelector('[data-office-fit]')
  const syncFit = () => { if (fit) fit.setAttribute('aria-pressed', String(office.autoFit())) }
  stage.querySelectorAll('[data-office-zoom]').forEach((b) => b.addEventListener('click', () => {
    office.zoom(Number(b.dataset.officeZoom))
    syncFit()
  }))
  if (fit) fit.addEventListener('click', () => { office.setAutoFit(true); syncFit() })
  syncFit()

  const fullscreen = stage.querySelector('[data-office-fullscreen]')
  let wakeLock = null
  if (fullscreen) {
    if (!stage.requestFullscreen) fullscreen.hidden = true
    fullscreen.addEventListener('click', () => {
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
      stage.requestFullscreen().catch(() => {})
      // Keeps a wall display from sleeping while it shows the office.
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then((lock) => { wakeLock = lock }).catch(() => {})
    })
    let scaleBeforeFullscreen = 0
    document.addEventListener('fullscreenchange', () => {
      if (document.fullscreenElement === stage) {
        if (!tv) scaleBeforeFullscreen = office.scale()
        office.setAutoFit(true)
      } else if (!document.fullscreenElement) {
        if (!tv && scaleBeforeFullscreen) office.setScale(scaleBeforeFullscreen)
        if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null }
      }
      syncFit()
    })
  }
})()
