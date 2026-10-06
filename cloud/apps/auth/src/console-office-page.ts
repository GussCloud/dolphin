import {
  appLayout,
  consoleDocument,
  csrfField,
  field,
  formatDate,
  icon,
  message,
  type PageMessage,
  type SignedIn
} from './console-layout.js'
import { CONSOLE_PATH } from './console-session.js'
import { escapeHtml } from './html-escape.js'
import type { OfficeDisplayLinkRow } from './office-display-link-store.js'
import type { OrganizationRow } from './organization-store.js'

export const OFFICE_PATH = `${CONSOLE_PATH}/office`
export const TV_PATH = `${CONSOLE_PATH}/tv`
export const OFFICE_ASSETS_PATH = `${CONSOLE_PATH}/assets/office`
export const OFFICE_SCRIPTS = ['office-scene.js', 'office-fit.js', 'office-engine.js', 'office-client.js'] as const

const FONT_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@500;600;700&display=swap" rel="stylesheet">`

const SCRIPTS = OFFICE_SCRIPTS.map((name) => `<script src="${OFFICE_ASSETS_PATH}/${name}"></script>`).join('')

const LEGEND = `<div class="office-legend"><span><i class="office-dot" style="background:#3fc9a8"></i>Trabalhando</span>
<span><i class="office-dot" style="background:#f2a93b"></i>Aguardando aprovação</span>
<span><i class="office-dot" style="background:#9aa6b0"></i>Ocioso</span>
<span><i class="office-dot" style="background:#45d16b;border-radius:50%"></i>Dev conectado</span>
<span><i class="office-dot" style="background:#9aa6b0;border-radius:50%"></i>Sem sinal</span></div>`

function stage(params: { streamUrl: string; title?: string; tv?: boolean }): string {
  const title = params.title ? `<strong>${escapeHtml(params.title)}</strong>` : ''
  return `<section class="office-stage${params.tv ? ' tv' : ''}" id="office-stage" data-autofit="${params.tv ? 'on' : 'off'}" aria-label="Escritório virtual com os devs conectados e seus agentes">
<div class="office-bar">${title}<span class="office-stats"><b data-stat="devs">0</b> devs · <b data-stat="projects">0</b> projetos · <b data-stat="agents">0</b> agentes</span>
<span class="office-conn" data-conn="connecting" role="status">Conectando…</span>
<span class="office-tools"><button type="button" class="ghost" data-office-zoom="-1" aria-label="Diminuir zoom">−</button>
<button type="button" class="ghost" data-office-zoom="1" aria-label="Aumentar zoom">+</button>
<button type="button" class="ghost" data-office-fit aria-pressed="false" title="Ajustar o zoom para mostrar todas as salas">Ajustar</button>
<button type="button" class="ghost" data-office-fullscreen title="Tela cheia">${icon('maximize')}<span>Tela cheia</span></button></span></div>
<div class="office-host" id="office" data-stream="${escapeHtml(params.streamUrl)}"></div>${LEGEND}</section>`
}

function displayLinksCard(csrf: string, links: OfficeDisplayLinkRow[], createdPath?: string): string {
  const created = createdPath
    ? `<div class="alert notice" role="status">${icon('check')}<div style="display:grid;gap:8px;flex:1">
<span>Link criado. Copie agora: ele não será mostrado de novo.</span>
<div class="office-copy"><input readonly data-absolute-path="${escapeHtml(createdPath)}" value="${escapeHtml(createdPath)}" aria-label="Link de exibição">
<button type="button" data-copy-link>Copiar</button></div></div></div>`
    : ''
  const list =
    links.length > 0
      ? `<ul class="office-links">${links
          .map(
            (link) => `<li><div><strong>${escapeHtml(link.label)}</strong><br><span class="muted">Criado em ${formatDate(link.created_at)}</span></div>
<form method="post" action="${OFFICE_PATH}/display-links/${encodeURIComponent(link.id)}/revoke">${csrfField(csrf)}
<button type="submit" class="ghost">${icon('trash')}<span>Revogar</span></button></form></li>`
          )
          .join('')}</ul>`
      : '<p class="muted">Nenhum link de exibição ativo.</p>'
  return `<section class="card"><div class="card-head"><h2>Links de exibição (TV)</h2>
<p class="muted">Abra o escritório numa TV ou monitor sem entrar com uma conta. Quem tiver o link vê a tela; revogue quando não usar mais.</p></div>
${created}${list}<form class="office-new-link" method="post" action="${OFFICE_PATH}/display-links">${csrfField(csrf)}
${field('Nome do link', '<input name="label" required maxlength="60" placeholder="TV da sala de reunião">')}
<button type="submit" class="primary">${icon('link')}Criar link</button></form></section>`
}

const COPY_SCRIPT = `<script>document.querySelectorAll('[data-absolute-path]').forEach(i=>{i.value=location.origin+i.dataset.absolutePath});
document.querySelectorAll('[data-copy-link]').forEach(b=>b.addEventListener('click',()=>{const i=b.previousElementSibling;
i.select();navigator.clipboard?.writeText(i.value).then(()=>{b.textContent='Copiado'}).catch(()=>{})}))</script>`

export function renderOfficePage(
  params: SignedIn & {
    organization: OrganizationRow
    isOwner: boolean
    links: OfficeDisplayLinkRow[]
    createdPath?: string
    message?: PageMessage
  }
): string {
  const links = params.isOwner ? displayLinksCard(params.csrf, params.links, params.createdPath) : ''
  return appLayout({
    title: `Escritório · ${params.organization.name}`,
    heading: 'Escritório dos agentes',
    subtitle: `Devs de ${params.organization.name} com o Dolphin aberto, os projetos em andamento e os agentes trabalhando, em tempo real.`,
    section: 'office',
    auth: params,
    hasOrganization: params.isOwner,
    hasMembership: true,
    wide: true,
    head: FONT_HEAD,
    tail: `${SCRIPTS}${COPY_SCRIPT}`,
    body: `${message(params.message)}${stage({ streamUrl: `${OFFICE_PATH}/stream` })}${links}`
  })
}

/** Wall display: just the scene, no console chrome. */
export function renderTvPage(params: { organization: OrganizationRow; token: string }): string {
  return consoleDocument(
    `Escritório · ${params.organization.name}`,
    stage({
      streamUrl: `${TV_PATH}/${encodeURIComponent(params.token)}/stream`,
      title: params.organization.name,
      tv: true
    }),
    { head: FONT_HEAD, tail: SCRIPTS }
  )
}
