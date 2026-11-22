/* Work view DOM: the macro grid of devs and one dev's tree (dev → projects → agents) with SVG cables.
 * Every stream string reaches the page through textContent or an attribute, never as markup.
 */
;(function () {
  'use strict'

  const M = globalThis.DolphinOfficeModel
  const SVG_NS = 'http://www.w3.org/2000/svg'
  const STATE_LABEL = { working: 'Trabalhando', permission: 'Aguardando aprovação', idle: 'Ocioso' }
  const STATE_SHORT = { working: 'Trabalhando', permission: 'Aguardando', idle: 'Ocioso' }
  const ICON_PATHS = {
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
    branch: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 9a9 9 0 0 1-9 9',
    terminal: 'm4 17 6-5-6-5M12 19h8',
    laptop: 'M4 5h16v11H4zM2 19h20'
  }

  /** h('div', { class: 'x', onclick }, child, 'text') */
  function h(tag, attrs, ...children) {
    const el = document.createElement(tag)
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === undefined || v === null || v === false) continue
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v)
      else if (k === 'style') el.style.cssText = v
      else el.setAttribute(k, v === true ? '' : String(v))
    }
    for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c)
    return el
  }

  function icon(name) {
    const svg = document.createElementNS(SVG_NS, 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('class', 'icon')
    svg.setAttribute('aria-hidden', 'true')
    const path = document.createElementNS(SVG_NS, 'path')
    path.setAttribute('d', ICON_PATHS[name])
    svg.append(path)
    return svg
  }

  const dot = (state) => h('i', { class: `office-dot is-${state}`, 'aria-hidden': 'true' })

  function avatar(dev, size) {
    return h('span', { class: `office-avatar${dev.status === 'offline' ? ' is-offline' : ''}${size ? ' is-' + size : ''}`, 'aria-hidden': 'true' },
      h('span', { class: 'office-avatar-ring' }),
      h('span', { class: 'office-avatar-face' }, M.initials(dev.name)),
      h('span', { class: 'office-avatar-status' }))
  }

  function statePill(state) {
    return h('span', { class: `office-pill is-${state}` },
      state === 'working' ? h('span', { class: 'office-wave', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')) : dot(state),
      STATE_LABEL[state])
  }

  function devStatusText(dev) {
    return dev.status === 'online' ? 'Conectado' : 'Sem sinal'
  }

  // --- Macro: one card per dev ---------------------------------------------------------------

  function macroCard(dev, onOpen) {
    const t = M.tally(M.devAgents(dev))
    const count = (state, label) =>
      h('div', { class: `office-count${state === 'permission' && t.permission > 0 ? ' is-hot' : ''}` },
        h('b', {}, String(t[state])), h('span', {}, dot(state), label))
    return h('button', { type: 'button', class: `office-dev${dev.status === 'offline' ? ' is-offline' : ''}`, 'data-dev': dev.id, onclick: () => onOpen(dev.id) },
      h('div', { class: 'office-dev-top' }, avatar(dev),
        h('div', {}, h('strong', { class: 'office-dev-name' }, dev.name),
          h('span', { class: 'office-dev-meta' }, devStatusText(dev), ...dev.machines.map((m) => h('span', {}, icon('laptop'), m))))),
      h('div', { class: 'office-counts' }, count('working', 'Trabalhando'), count('permission', 'Aguardando'), count('idle', 'Ociosos')),
      dev.projects.length
        ? h('ul', { class: 'office-proj-list' }, dev.projects.map((p) =>
            h('li', {}, icon('folder'), h('span', { class: 'office-proj-name' }, p.name),
              h('span', { class: 'office-proj-dots' }, p.agents.map((a) => dot(a.state))))))
        : h('p', { class: 'muted office-none' }, 'Nenhum projeto aberto'),
      h('span', { class: 'office-dev-foot' },
        h('span', {}, `${dev.projects.length} projetos · ${t.total} agentes`), h('span', { class: 'office-go' }, 'Abrir →')))
  }

  function renderMacro(grid, view, onOpen) {
    grid.replaceChildren(...(view.devs.length
      ? view.devs.map((d) => macroCard(d, onOpen))
      : [h('div', { class: 'office-empty' }, h('strong', {}, 'Ninguém conectado agora'),
          h('span', { class: 'muted' }, 'Quando um dev abrir o Dolphin, ele aparece aqui com os agentes dele.'))]))
  }

  // --- Detail: one dev's tree ---------------------------------------------------------------

  function agentCard(dev, color, agent, parentId, childCount, nameFor, onAgent) {
    const name = nameFor(dev.id, agent)
    return h('button', { type: 'button', class: `office-node office-agent is-${agent.state}${parentId.startsWith('agent:') ? ' is-child' : ''}`,
      style: `--c:var(--office-project-${color})`, 'data-node': agent.id, 'data-parent': parentId.replace(/^agent:/, ''),
      'data-state': agent.state, onclick: () => onAgent(agent.id) },
      h('span', { class: 'office-agent-top' }, h('span', { class: 'office-agent-icon' }, icon('terminal')), h('span', { class: 'office-agent-name' }, name)),
      h('span', { class: 'office-agent-meta' }, h('span', { class: 'office-cli' }, M.cliName(agent.cli)),
        childCount ? h('span', { class: 'office-team' }, `${childCount} ${childCount === 1 ? 'subagente' : 'subagentes'}`) : null),
      h('span', { class: 'office-agent-branch' }, icon('branch'), h('span', {}, agent.branch || 'sem branch (pasta)')),
      h('span', { class: 'office-agent-foot' }, h('span', { class: `office-state is-${agent.state}` }, STATE_SHORT[agent.state]),
        h('span', { class: 'office-eq', 'aria-hidden': 'true' }, Array.from({ length: 7 }, () => h('i')))))
  }

  // `parentKey` is the project id, or `agent:<id>` under a lead, so leads and projects never collide.
  function agentBranch(dev, color, node, parentKey, nameFor, onAgent) {
    return h('div', { class: 'office-sub' },
      agentCard(dev, color, node.agent, parentKey, node.children.length, nameFor, onAgent),
      node.children.length
        ? h('div', { class: 'office-kids' }, node.children.map((child) => agentBranch(dev, color, child, `agent:${node.agent.id}`, nameFor, onAgent)))
        : null)
  }

  function projectBranch(dev, project, index, nameFor, onAgent) {
    const color = M.projectColor(index)
    const t = M.tally(project.agents)
    const summary = `${t.total} agentes · ${t.working} ativos${t.permission ? ` · ${t.permission} aguardando` : ''}`
    return h('div', { class: 'office-sub' },
      h('div', { class: 'office-node office-project', style: `--c:var(--office-project-${color})`, 'data-node': project.id, 'data-parent': 'dev', 'data-state': M.groupState(project.agents) },
        h('span', { class: 'office-project-icon' }, icon('folder')),
        h('span', { class: 'office-project-text' }, h('span', { class: 'office-tag' }, `Projeto ${String(index + 1).padStart(2, '0')}`),
          h('strong', {}, project.name), h('small', {}, summary))),
      project.agents.length
        ? h('div', { class: 'office-kids' }, M.nestAgents(project.agents).map((node) => agentBranch(dev, color, node, project.id, nameFor, onAgent)))
        : null)
  }

  function renderDetail(parts, view, devId, nameFor, handlers) {
    const dev = view.devs.find((d) => d.id === devId)
    parts.tabs.replaceChildren(...view.devs.map((d) =>
      h('button', { type: 'button', class: 'office-tab', 'aria-pressed': String(d.id === devId), onclick: () => handlers.onOpen(d.id) },
        avatar(d, 'sm'), d.name.split(/\s+/)[0] || d.name)))
    if (!dev) return
    parts.crumb.textContent = dev.name
    const t = M.tally(M.devAgents(dev))
    parts.root.replaceChildren(avatar(dev, 'lg'),
      h('span', { class: 'office-root-text' }, h('span', { class: 'office-tag is-primary' }, `Orquestrador · ${devStatusText(dev)}`),
        h('strong', {}, dev.name),
        h('small', {}, `${dev.projects.length} projetos · ${t.total} agentes · ${dev.machines.length} ${dev.machines.length === 1 ? 'máquina' : 'máquinas'}`)))
    parts.branches.replaceChildren(...(dev.projects.length
      ? dev.projects.map((p, i) => projectBranch(dev, p, i, nameFor, handlers.onAgent))
      : [h('div', { class: 'office-empty' }, h('strong', {}, 'Nenhum projeto aberto'), h('span', { class: 'muted' }, `${dev.name} está conectado, mas sem agentes agora.`))]))
  }

  /** Cables from each node to its parent; drawn after layout, in stage coordinates. */
  function drawCables(stage, cables, ports, vertical) {
    const o = stage.getBoundingClientRect()
    const paths = []
    const dots = []
    for (const el of stage.querySelectorAll('[data-parent]')) {
      const parent = stage.querySelector(`[data-node="${CSS.escape(el.dataset.parent)}"]`)
      if (!parent) continue
      const a = parent.getBoundingClientRect()
      const b = el.getBoundingClientRect()
      let x0, y0, x1, y1, d
      if (vertical) {
        x0 = a.left - o.left + 18; y0 = a.bottom - o.top
        x1 = b.left - o.left; y1 = b.top - o.top + b.height / 2
        d = `M${x0},${y0} V${y1 - 10} Q${x0},${y1} ${x0 + 10},${y1} H${x1}`
      } else {
        x0 = a.left + a.width / 2 - o.left; y0 = a.bottom - o.top
        x1 = b.left + b.width / 2 - o.left; y1 = b.top - o.top
        const m = (y0 + y1) / 2
        d = `M${x0},${y0} C${x0},${m} ${x1},${m} ${x1},${y1}`
      }
      const state = el.dataset.state
      const color = el.style.getPropertyValue('--c') || 'var(--primary)'
      for (const extra of ['is-glow', '']) {
        const p = document.createElementNS(SVG_NS, 'path')
        p.setAttribute('class', `office-cable is-${state} ${extra}`.trim())
        p.setAttribute('d', d)
        p.style.setProperty('--c', color)
        paths.push(p)
      }
      const out = document.createElementNS(SVG_NS, 'circle')
      out.setAttribute('class', 'office-port is-out')
      out.setAttribute('cx', x0); out.setAttribute('cy', y0); out.setAttribute('r', '5')
      out.style.setProperty('--c', color)
      const inn = document.createElementNS(SVG_NS, 'circle')
      inn.setAttribute('class', `office-port is-${state}`)
      inn.setAttribute('cx', x1); inn.setAttribute('cy', y1); inn.setAttribute('r', '4')
      inn.style.setProperty('--c', color)
      dots.push(out, inn)
    }
    cables.replaceChildren(...paths)
    ports.replaceChildren(...dots)
  }

  // --- Drawer -------------------------------------------------------------------------------

  function kv(label, value, wide) {
    return h('div', { class: wide ? 'is-wide' : undefined }, h('dt', {}, label), h('dd', {}, value))
  }

  function teamList(lead, members, nameFor, dev) {
    if (!lead && members.length === 0) return null
    return h('div', {}, h('p', { class: 'office-label' }, 'Equipe'),
      h('ul', { class: 'office-list' },
        lead ? h('li', {}, h('span', { class: 'muted' }, 'Líder'), nameFor(dev.id, lead)) : null,
        members.map((m) => h('li', {}, dot(m.state), nameFor(dev.id, m)))))
  }

  function agentDetails(dev, project, agent, name, nameFor) {
    const lead = agent.parentId ? project.agents.find((a) => a.id === agent.parentId && a.id !== agent.id) : undefined
    const members = project.agents.filter((a) => a.parentId === agent.id && a.id !== agent.id)
    return {
      kicker: `Agente · ${M.cliName(agent.cli)}`,
      title: name,
      state: agent.state,
      body: [
        h('div', { class: 'office-box' }, h('div', { class: 'office-box-head' }, h('span', { class: 'office-label' }, 'Estado'), statePill(agent.state)),
          h('dl', { class: 'office-kv' }, kv('CLI', M.cliName(agent.cli)), kv('Projeto', project.name),
            kv('Branch', agent.branch || 'sem branch (pasta)', true), kv('Dev', dev.name, true),
            kv(dev.machines.length === 1 ? 'Máquina' : 'Máquinas do dev', dev.machines.join(' · ') || '—', true))),
        agent.state === 'permission'
          ? h('div', { class: 'office-box is-warn' }, h('strong', {}, 'Parado esperando aprovação'),
              h('span', { class: 'muted' }, `${dev.name} precisa aprovar no Dolphin, no computador ou no celular, para o agente continuar.`))
          : null,
        teamList(lead, members, nameFor, dev)
      ]
    }
  }

  function devDetails(dev) {
    const t = M.tally(M.devAgents(dev))
    return {
      kicker: 'Orquestrador',
      title: dev.name,
      state: dev.status === 'online' ? 'working' : 'idle',
      body: [
        h('div', { class: 'office-box' }, h('dl', { class: 'office-kv' }, kv('Status', devStatusText(dev)), kv('Agentes', String(t.total)),
          kv('Trabalhando', String(t.working)), kv('Aguardando', String(t.permission)),
          kv(dev.machines.length === 1 ? 'Máquina' : 'Máquinas', dev.machines.join(' · ') || '—', true))),
        h('div', {}, h('p', { class: 'office-label' }, 'Projetos'),
          h('ul', { class: 'office-list' }, dev.projects.map((p) => h('li', {}, dot(M.groupState(p.agents)), `${p.name} · ${p.agents.length} agentes`))))
      ]
    }
  }

  globalThis.DolphinOfficeView = { h, renderMacro, renderDetail, drawCables, agentDetails, devDetails, STATE_LABEL }
})()
