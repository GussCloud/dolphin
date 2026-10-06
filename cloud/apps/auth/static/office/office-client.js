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
  const office = window.createOffice(host, { fps: 15, autoFit: tv })
  const conn = stage.querySelector('.office-conn')

  const CLI_NAMES = {
    claude: 'Claude', codex: 'Codex', opencode: 'OpenCode', gemini: 'Gemini', pi: 'Pi', cursor: 'Cursor',
    copilot: 'Copilot', droid: 'Droid', amp: 'Amp', qwen: 'Qwen', antigravity: 'Antigravity'
  }
  const cliName = (cli) => CLI_NAMES[cli.toLowerCase()] || cli.charAt(0).toUpperCase() + cli.slice(1)

  // agentId -> { devId, name }: names like "Claude 2" stay put while the agent lives.
  const agentNames = new Map()
  function nameFor(devId, agent) {
    const known = agentNames.get(agent.id)
    if (known) return known.name
    const base = cliName(agent.cli)
    const used = new Set()
    for (const info of agentNames.values()) if (info.devId === devId) used.add(info.name)
    let n = 1
    while (used.has(base + ' ' + n)) n++
    const name = base + ' ' + n
    agentNames.set(agent.id, { devId, name })
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
