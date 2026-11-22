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
import type { AvatarSettings } from './user-avatar-store.js'

export const OFFICE_PATH = `${CONSOLE_PATH}/office`
export const TV_PATH = `${CONSOLE_PATH}/tv`
export const OFFICE_ASSETS_PATH = `${CONSOLE_PATH}/assets/office`
export const OFFICE_SCRIPTS = ['office-model.js', 'office-view.js', 'office-client.js'] as const

const SCRIPTS = OFFICE_SCRIPTS.map((name) => `<script src="${OFFICE_ASSETS_PATH}/${name}"></script>`).join('')

const LEGEND = `<div class="office-legend"><span><i class="office-dot is-working"></i>Trabalhando</span>
<span><i class="office-dot is-permission"></i>Aguardando aprovação</span><span><i class="office-dot is-idle"></i>Ocioso</span>
<span>Toque num dev ou agente para ver detalhes</span></div>`

const DRAWER = `<div class="office-backdrop" data-office-backdrop hidden></div>
<aside class="office-drawer" data-office-drawer aria-label="Detalhes" hidden><div class="office-drawer-head"><div>
<span class="office-tag" data-office-drawer-kicker></span><h2 data-office-drawer-title></h2></div>
<button type="button" class="ghost" data-office-drawer-close aria-label="Fechar">${icon('x')}</button></div>
<div class="office-drawer-body" data-office-drawer-body></div></aside>`

function stage(params: { streamUrl: string; avatarsUrl: string; title?: string; tv?: boolean }): string {
  const title = params.title ? `<strong class="office-title">${escapeHtml(params.title)}</strong>` : ''
  // Why off by default, TV included: rotation starts only once this browser turns it on (remembered locally).
  return `<section class="office-stage${params.tv ? ' tv' : ''}" id="office-stage" data-mode="macro" aria-label="Escritório com os devs conectados e seus agentes">
<div class="office-bar">${title}<div class="office-seg" role="group" aria-label="Modo de visão">
<button type="button" data-office-mode="macro" aria-pressed="true">Visão macro</button>
<button type="button" data-office-mode="detail" aria-pressed="false">Detalhada</button></div>
<span class="office-stats"><b data-stat="devs">0</b> devs online · <b data-stat="projects">0</b> projetos · <b data-stat="agents">0</b> agentes</span>
<span class="office-conn" data-conn="connecting" role="status">Conectando…</span>
<span class="office-tools"><label class="office-rotation"><span>Rotação automática</span>
<button type="button" class="office-switch" role="switch" aria-checked="false" data-office-rotation title="Alterna sozinho entre a visão macro e cada dev"></button></label>
<button type="button" class="ghost" data-office-fullscreen title="Tela cheia">${icon('maximize')}<span>Tela cheia</span></button></span></div>
<div class="office-body" id="office" data-stream="${escapeHtml(params.streamUrl)}" data-avatars="${escapeHtml(params.avatarsUrl)}">
<div class="office-macro" data-office-macro><div class="office-grid" data-office-grid></div></div>
<div class="office-detail" data-office-detail hidden><div class="office-crumbs"><div class="office-path">
<button type="button" class="ghost" data-office-back title="Voltar à visão macro (Esc)">← Visão macro</button><span class="muted">/</span><strong data-office-crumb></strong></div>
<div class="office-tabs" data-office-tabs role="group" aria-label="Trocar de dev"></div></div>
<div class="office-scroll" data-office-scroll><div class="office-tree-stage" data-office-tree-stage>
<svg class="office-cables" data-office-cables aria-hidden="true"></svg><svg class="office-ports" data-office-ports aria-hidden="true"></svg>
<div class="office-tree" data-office-tree><div class="office-root-wrap"><button type="button" class="office-node office-root" data-office-root data-node="dev"></button></div>
<div class="office-branches" data-office-branches></div></div></div></div></div></div>
${LEGEND}${DRAWER}</section>`
}

function radio(value: string, checked: boolean, label: string, hint: string, disabled = false): string {
  return `<label class="office-avatar-option${disabled ? ' is-disabled' : ''}"><input type="radio" name="source" value="${value}"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}>
<span><strong>${label}</strong><span class="muted">${hint}</span></span></label>`
}

function avatarCard(csrf: string, settings: AvatarSettings): string {
  const current = settings.source ?? (settings.hasAzureDevOpsImage ? 'azure-devops' : 'initials')
  const devopsHint = settings.hasAzureDevOpsImage
    ? 'A foto da sua conta, buscada quando você entrou no Dolphin com o Azure DevOps.'
    : 'Indisponível: entre no Dolphin com o Azure DevOps para buscá-la. Contas com token pessoal (PAT) precisam do escopo “Graph (Read)”.'
  return `<section class="card"><div class="card-head"><h2>Sua foto no escritório</h2>
<p class="muted">Aparece no seu card e na sua árvore para todos da organização, inclusive nos links de TV.</p></div>
<form class="office-avatar-form" method="post" action="${OFFICE_PATH}/avatar">${csrfField(csrf)}
<fieldset class="office-avatar-options"><legend class="muted">De onde vem a foto</legend>
${radio('azure-devops', current === 'azure-devops', 'Azure DevOps', devopsHint, !settings.hasAzureDevOpsImage)}
${radio('github', current === 'github', 'GitHub', 'A foto pública do seu perfil no GitHub.')}
${radio('initials', current === 'initials', 'Iniciais', 'Sem foto: mostra as iniciais do seu nome.')}</fieldset>
${field('Usuário do GitHub', `<input name="githubLogin" maxlength="39" autocomplete="off" spellcheck="false" placeholder="seu-usuario" value="${escapeHtml(settings.githubLogin ?? '')}">`)}
<button type="submit" class="primary">${icon('check')}Salvar foto</button></form></section>`
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
    avatar: AvatarSettings
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
    tail: `${SCRIPTS}${COPY_SCRIPT}`,
    body: `${message(params.message)}${stage({ streamUrl: `${OFFICE_PATH}/stream`, avatarsUrl: `${OFFICE_PATH}/avatars` })}${avatarCard(params.csrf, params.avatar)}${links}`
  })
}

/** Wall display: just the scene, no console chrome. */
export function renderTvPage(params: { organization: OrganizationRow; token: string }): string {
  return consoleDocument(
    `Escritório · ${params.organization.name}`,
    stage({
      streamUrl: `${TV_PATH}/${encodeURIComponent(params.token)}/stream`,
      avatarsUrl: `${TV_PATH}/${encodeURIComponent(params.token)}/avatars`,
      title: params.organization.name,
      tv: true
    }),
    { tail: SCRIPTS }
  )
}
