/* Work view controller: SSE snapshots in, macro grid or one dev's tree out.
 * Navigation is manual; the TV rotation runs only after this browser turns it on.
 */
;(function () {
  'use strict'

  const M = globalThis.DolphinOfficeModel
  const V = globalThis.DolphinOfficeView
  const stage = document.getElementById('office-stage')
  const host = document.getElementById('office')
  if (!stage || !host || !M || !V) return

  const MACRO_MS = 10000
  const DEV_MS = 12000

  const q = (sel) => stage.querySelector(sel)
  const parts = {
    macro: q('[data-office-macro]'),
    grid: q('[data-office-grid]'),
    detail: q('[data-office-detail]'),
    tabs: q('[data-office-tabs]'),
    crumb: q('[data-office-crumb]'),
    scroll: q('[data-office-scroll]'),
    tree: q('[data-office-tree]'),
    tstage: q('[data-office-tree-stage]'),
    root: q('[data-office-root]'),
    branches: q('[data-office-branches]'),
    cables: q('[data-office-cables]'),
    ports: q('[data-office-ports]'),
    conn: q('.office-conn'),
    rotation: q('[data-office-rotation]'),
    modeButtons: stage.querySelectorAll('[data-office-mode]'),
    drawer: q('[data-office-drawer]'),
    backdrop: q('[data-office-backdrop]')
  }
  const narrow = window.matchMedia('(max-width: 767px)')
  const namer = M.createAgentNamer()

  let view = { devs: [] }
  let mode = 'macro'
  let activeDev = null
  let drawerFor = null // { kind: 'agent' | 'dev', id }

  // --- Navigation ----------------------------------------------------------------------------

  function show(next, devId) {
    if (next === 'detail') {
      activeDev = devId ?? (view.devs.some((d) => d.id === activeDev) ? activeDev : view.devs[0]?.id ?? null)
      if (!activeDev) next = 'macro'
    }
    mode = next
    parts.macro.hidden = mode !== 'macro'
    parts.detail.hidden = mode !== 'detail'
    stage.dataset.mode = mode
    parts.modeButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.officeMode === mode)))
    render()
  }

  const openDev = (id) => show('detail', id)

  function render() {
    if (mode === 'macro') {
      V.renderMacro(parts.grid, view, openDev)
      return
    }
    V.renderDetail(parts, view, activeDev, namer.nameFor, { onOpen: openDev, onAgent: (id) => openDrawer({ kind: 'agent', id }) })
    requestAnimationFrame(layoutTree)
  }

  // Scales the tree to fit one row (never under MIN_FIT_SCALE); phones get the stacked list instead.
  function layoutTree() {
    if (mode !== 'detail') return
    const { scroll, tstage, tree } = parts
    if (narrow.matches) {
      tree.style.transform = ''
      tstage.style.width = ''
      tstage.style.height = ''
    } else {
      const natural = tree.offsetWidth
      const avail = scroll.clientWidth
      const s = M.fitScale(natural, avail)
      const w = Math.max(avail, natural * s)
      tstage.style.width = w + 'px'
      tstage.style.height = tree.offsetHeight * s + 12 + 'px'
      tree.style.transform = `translateX(${(w - natural * s) / 2}px) scale(${s})`
    }
    V.drawCables(tstage, parts.cables, parts.ports, narrow.matches)
  }
  new ResizeObserver(() => layoutTree()).observe(parts.scroll)
  narrow.addEventListener('change', layoutTree)

  parts.modeButtons.forEach((b) => b.addEventListener('click', () => show(b.dataset.officeMode)))
  q('[data-office-back]').addEventListener('click', () => show('macro'))
  parts.root.addEventListener('click', () => activeDev && openDrawer({ kind: 'dev', id: activeDev }))

  // --- Drawer --------------------------------------------------------------------------------

  function findAgent(id) {
    for (const dev of view.devs) for (const project of dev.projects) {
      const agent = project.agents.find((a) => a.id === id)
      if (agent) return { dev, project, agent }
    }
    return null
  }

  function fillDrawer() {
    if (!drawerFor) return false
    let details = null
    if (drawerFor.kind === 'agent') {
      const found = findAgent(drawerFor.id)
      if (found) details = V.agentDetails(found.dev, found.project, found.agent, namer.nameFor(found.dev.id, found.agent))
    } else {
      const dev = view.devs.find((d) => d.id === drawerFor.id)
      if (dev) details = V.devDetails(dev)
    }
    if (!details) return false
    parts.drawer.querySelector('[data-office-drawer-kicker]').textContent = details.kicker
    parts.drawer.querySelector('[data-office-drawer-title]').textContent = details.title
    parts.drawer.querySelector('[data-office-drawer-body]').replaceChildren(...details.body.filter(Boolean))
    return true
  }

  function openDrawer(target) {
    drawerFor = target
    if (!fillDrawer()) return
    parts.drawer.hidden = false
    parts.backdrop.hidden = false
    requestAnimationFrame(() => stage.classList.add('drawer-open'))
    parts.drawer.querySelector('[data-office-drawer-close]').focus()
  }

  function closeDrawer() {
    drawerFor = null
    stage.classList.remove('drawer-open')
    parts.drawer.hidden = true
    parts.backdrop.hidden = true
  }
  parts.backdrop.addEventListener('click', closeDrawer)
  parts.drawer.querySelector('[data-office-drawer-close]').addEventListener('click', closeDrawer)
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return
    if (drawerFor) closeDrawer()
    else if (mode === 'detail') show('macro')
  })

  // --- Snapshots -----------------------------------------------------------------------------

  function apply(next) {
    view = next
    const live = new Set()
    for (const d of view.devs) for (const p of d.projects) for (const a of p.agents) live.add(a.id)
    namer.retain(live)
    if (mode === 'detail' && !view.devs.some((d) => d.id === activeDev)) show('macro')
    else render()
    if (drawerFor && !fillDrawer()) closeDrawer()
    const agents = view.devs.reduce((n, d) => n + M.devAgents(d).length, 0)
    setStat('devs', view.devs.filter((d) => d.status === 'online').length)
    setStat('projects', view.devs.reduce((n, d) => n + d.projects.length, 0))
    setStat('agents', agents)
  }

  function setStat(name, value) {
    const el = q(`[data-stat="${name}"]`)
    if (el) el.textContent = String(value)
  }

  function setConn(state, text) {
    parts.conn.dataset.conn = state
    parts.conn.textContent = text
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

  // --- Rotation (TV) -------------------------------------------------------------------------

  let rotationRun = 0
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // Macro for MACRO_MS, then each dev for DEV_MS; the queue is rebuilt every cycle.
  async function rotate(run) {
    while (run === rotationRun) {
      show('macro')
      await wait(MACRO_MS)
      for (const id of M.rotationQueue(view.devs)) {
        if (run !== rotationRun) return
        if (!view.devs.some((d) => d.id === id)) continue
        show('detail', id)
        await wait(DEV_MS)
      }
    }
  }

  function setRotation(on, persist) {
    rotationRun++
    parts.rotation.setAttribute('aria-checked', String(on))
    if (persist) M.writeRotation(storage(), on)
    if (on) void rotate(rotationRun)
  }
  function storage() {
    try { return window.localStorage } catch { return null }
  }
  parts.rotation.addEventListener('click', () => setRotation(parts.rotation.getAttribute('aria-checked') !== 'true', true))
  setRotation(M.readRotation(storage()), false)

  // --- Fullscreen ----------------------------------------------------------------------------

  const fullscreen = q('[data-office-fullscreen]')
  let wakeLock = null
  if (fullscreen) {
    if (!stage.requestFullscreen) fullscreen.hidden = true
    fullscreen.addEventListener('click', () => {
      if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return }
      stage.requestFullscreen().catch(() => {})
      // Keeps a wall display from sleeping while it shows the office.
      if (navigator.wakeLock) navigator.wakeLock.request('screen').then((lock) => { wakeLock = lock }).catch(() => {})
    })
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement && wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null }
    })
  }

  show('macro')
})()
