/* Work view rules with no DOM: counts, project state, agent names, TV rotation and fit scale.
 * A plain browser script registered on globalThis so vitest can import it too.
 */
;(function () {
  'use strict'

  const STATES = ['working', 'permission', 'idle']
  // Project colors cycle through this many tokens (--office-project-1..N in console-style.ts).
  const PROJECT_COLORS = 6
  // Below this the tree's text stops being readable; past it the tree scrolls sideways instead.
  const MIN_FIT_SCALE = 0.7
  const ROTATION_KEY = 'dolphin.office.rotation'

  const CLI_NAMES = {
    claude: 'Claude', codex: 'Codex', opencode: 'OpenCode', gemini: 'Gemini', pi: 'Pi', cursor: 'Cursor',
    copilot: 'Copilot', droid: 'Droid', amp: 'Amp', qwen: 'Qwen', antigravity: 'Antigravity', deepseek: 'DeepSeek'
  }
  const cliName = (cli) => CLI_NAMES[cli.toLowerCase()] || cli.charAt(0).toUpperCase() + cli.slice(1)

  function tally(agents) {
    const t = { working: 0, permission: 0, idle: 0, total: agents.length }
    for (const a of agents) t[STATES.includes(a.state) ? a.state : 'idle']++
    return t
  }

  const devAgents = (dev) => dev.projects.flatMap((p) => p.agents)

  /** An approval waiting outranks work, so it is never hidden behind a calmer color. */
  function groupState(agents) {
    const t = tally(agents)
    return t.permission > 0 ? 'permission' : t.working > 0 ? 'working' : 'idle'
  }

  // Cuts at 28 UTF-16 units without leaving half of a surrogate pair.
  function clipName(s) {
    const cut = s.slice(0, 28)
    return /[\ud800-\udbff]$/.test(cut) ? cut.slice(0, -1).trimEnd() : cut.trimEnd()
  }

  /** Visible agent names, stable while the agent lives: the stream's `name`, else "Claude 1"; same-dev clashes get " 2". */
  function createAgentNamer() {
    const names = new Map()
    function nameFor(devId, agent) {
      const given = typeof agent.name === 'string' ? clipName(agent.name.trim()) : ''
      const known = names.get(agent.id)
      if (known && known.given === given) return known.name
      const used = new Set()
      for (const [id, info] of names) if (info.devId === devId && id !== agent.id) used.add(info.name)
      let name = given
      if (given) {
        for (let n = 2; used.has(name); n++) name = given + ' ' + n
      } else {
        const base = cliName(agent.cli)
        let n = 1
        while (used.has(base + ' ' + n)) n++
        name = base + ' ' + n
      }
      names.set(agent.id, { devId, given, name })
      return name
    }
    /** Forgets agents missing from the latest view so their names free up. */
    function retain(liveIds) {
      for (const id of [...names.keys()]) if (!liveIds.has(id)) names.delete(id)
    }
    return { nameFor, retain }
  }

  /** TV order: devs with an approval waiting first; offline devs with nothing left are skipped. */
  function rotationQueue(devs) {
    const shown = devs.filter((d) => d.status !== 'offline' || devAgents(d).length > 0)
    const urgent = (d) => d.status !== 'offline' && tally(devAgents(d)).permission > 0
    return [...shown.filter(urgent), ...shown.filter((d) => !urgent(d))].map((d) => d.id)
  }

  /** Rotation is off unless this browser turned it on. Storage can be missing or throw (private mode). */
  function readRotation(storage) {
    try {
      return storage?.getItem(ROTATION_KEY) === 'on'
    } catch {
      return false
    }
  }
  function writeRotation(storage, on) {
    try {
      if (on) storage?.setItem(ROTATION_KEY, 'on')
      else storage?.removeItem(ROTATION_KEY)
    } catch {
      // Best effort: the toggle still works for this visit.
    }
  }

  function fitScale(naturalWidth, availableWidth) {
    if (!(naturalWidth > 0) || !(availableWidth > 0)) return 1
    return Math.max(MIN_FIT_SCALE, Math.min(1, availableWidth / naturalWidth))
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/).filter(Boolean)
    const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts.slice(0, 1)
    return letters.map((p) => Array.from(p)[0] ?? '').join('').toUpperCase() || '?'
  }

  /** 1-based project color slot, by position under its dev so neighbours never share a color. */
  const projectColor = (index) => (index % PROJECT_COLORS) + 1

  globalThis.DolphinOfficeModel = {
    STATES, MIN_FIT_SCALE, ROTATION_KEY,
    cliName, tally, devAgents, groupState, createAgentNamer, rotationQueue,
    readRotation, writeRotation, fitScale, initials, projectColor
  }
})()
