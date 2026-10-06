import { CONSOLE_PATH } from './console-session.js'
import { CONSOLE_STYLE } from './console-style.js'
import { escapeHtml } from './html-escape.js'
import type { UserRow } from './store.js'

export type PageMessage = { kind: 'error' | 'notice'; text: string }
export type SignedIn = { user: UserRow; csrf: string }
export type ConsoleSection = 'organization' | 'members' | 'office'

// Lucide paths, inlined so the console ships no assets.
const ICON_PATHS = {
  building:
    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4M10 10h4M10 14h4M10 18h4"/>',
  users:
    '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  panel: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash:
    '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  alert: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  office:
    '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
} as const

export function icon(name: keyof typeof ICON_PATHS): string {
  return `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${ICON_PATHS[name]}</svg>`
}

// resources/logo-gradient.svg; `id` keeps the gradient reference unique when a page shows the logo twice.
export function logo(id: string): string {
  return `<svg class="logo" viewBox="96 90 338 338" role="img" aria-label="Dolphin"><defs><linearGradient id="${id}" x1="80" y1="60" x2="430" y2="450" gradientUnits="userSpaceOnUse"><stop stop-color="#2563EB"/><stop offset=".52" stop-color="#06B6D4"/><stop offset="1" stop-color="#1D4ED8"/></linearGradient></defs><path fill="url(#${id})" fill-rule="evenodd" d="M102 315c-9-72 23-146 94-190 53-33 118-42 178-15-38 4-73 20-101 46 57-9 112 3 157 37-31 0-61 8-88 24-33 20-57 49-68 84-16 51-9 91 12 126-62-17-124-49-156-112-13 16-20 35-28 55zM177 296c27-44 66-75 113-91-29 25-47 54-54 86-8 36-1 72 18 107-39-17-64-45-77-78z"/><path fill="#06B6D4" d="M124 147c27-24 62-42 102-48-28 18-50 39-67 66-18-6-34-11-35-18z"/></svg>`
}

const SIDEBAR_KEY = 'dolphin-console-sidebar'

// Runs in <head> so a collapsed sidebar never flashes open.
const HEAD_SCRIPT = `try{if(localStorage.getItem('${SIDEBAR_KEY}')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch{}`

const BODY_SCRIPT = `(()=>{const r=document.documentElement,narrow=matchMedia('(max-width:768px)');
document.querySelectorAll('[data-toggle-sidebar]').forEach(b=>b.addEventListener('click',()=>{
if(narrow.matches){r.dataset.drawer=r.dataset.drawer==='open'?'':'open';return}
const next=r.dataset.sidebar==='collapsed'?'':'collapsed';r.dataset.sidebar=next;
document.querySelectorAll('.collapse').forEach(c=>c.setAttribute('aria-expanded',String(!next)));
try{localStorage.setItem('${SIDEBAR_KEY}',next)}catch{}}));
document.querySelector('.backdrop')?.addEventListener('click',()=>{r.dataset.drawer=''});
document.querySelectorAll('[data-reveal]').forEach(b=>b.addEventListener('click',()=>{const i=b.previousElementSibling,
show=i.type==='password';i.type=show?'text':'password';b.textContent=show?'Ocultar':'Mostrar'}));
document.querySelectorAll('details.pop').forEach(d=>d.addEventListener('toggle',()=>{if(d.open){
document.querySelectorAll('details.pop[open]').forEach(o=>{if(o!==d)o.open=false});d.querySelector('input:not([type=hidden])')?.focus()}}));
document.addEventListener('keydown',e=>{if(e.key==='Escape'){r.dataset.drawer='';
document.querySelectorAll('details.pop[open]').forEach(d=>{d.open=false})}});
document.querySelectorAll('form').forEach(f=>f.addEventListener('submit',()=>
f.querySelector('button[type=submit]')?.setAttribute('aria-busy','true')));
addEventListener('pageshow',()=>document.querySelectorAll('[aria-busy]').forEach(b=>b.removeAttribute('aria-busy')))})()`

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

export function csrfField(csrf: string): string {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">`
}

export function message(msg: PageMessage | undefined): string {
  if (!msg) {
    return ''
  }
  const role = msg.kind === 'error' ? 'alert' : 'status'
  return `<p class="alert ${msg.kind}" role="${role}">${icon(msg.kind === 'error' ? 'alert' : 'check')}<span>${escapeHtml(msg.text)}</span></p>`
}

export function field(label: string, input: string): string {
  return `<label>${label}${input}</label>`
}

export function passwordField(label: string, attrs: string): string {
  return field(
    label,
    `<span class="password"><input type="password" ${attrs}><button type="button" class="ghost" data-reveal aria-label="Mostrar senha">Mostrar</button></span>`
  )
}

export function initials(text: string): string {
  const parts = text.split(/[\s@._-]+/).filter(Boolean)
  return escapeHtml(((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase())
}

/** `head` and `tail` are trusted markup (fonts, page scripts); callers escape any user text first. */
export function consoleDocument(title: string, body: string, extra: { head?: string; tail?: string } = {}): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Dolphin</title>
<script>${HEAD_SCRIPT}</script><style>${CONSOLE_STYLE}</style>${extra.head ?? ''}</head><body>${body}<script>${BODY_SCRIPT}</script>${extra.tail ?? ''}</body></html>`
}

/** Sign-in / sign-up shell: brand panel beside the form, the panel folds into a logo on small screens. */
export function authLayout(title: string, card: string): string {
  return consoleDocument(
    title,
    `<div class="auth"><aside class="brand-panel"><div class="brand-mark">${logo('brand-logo')}Dolphin</div>
<div class="brand-copy"><h2>Console da organização</h2>
<p>Gerencie quem da sua organização usa o Dolphin com a conta do Azure DevOps.</p>
<ul class="brand-points"><li>${icon('check')}Conecte a organização do Azure DevOps</li>
<li>${icon('check')}Acompanhe e organize os membros</li><li>${icon('check')}Acesso protegido por convite</li></ul></div>
<p class="brand-foot">© Dolphin</p></aside>
<main class="auth-main"><div class="auth-card"><div class="mobile-logo">${logo('mobile-logo')}Dolphin</div>${card}</div></main></div>`
  )
}

function navItem(section: ConsoleSection, current: ConsoleSection, href: string, label: string, extra = ''): string {
  const iconName = section === 'organization' ? 'building' : section === 'members' ? 'users' : 'office'
  const aria = section === current ? ' aria-current="page"' : ''
  return `<a class="nav-item" href="${href}"${aria} title="${label}">${icon(iconName)}<span class="side-label">${label}</span>${extra}</a>`
}

/** Signed-in shell with the collapsible left sidebar, mirroring the desktop app's navigation. */
export function appLayout(params: {
  title: string
  heading: string
  subtitle?: string
  section: ConsoleSection
  auth: SignedIn
  body: string
  memberCount?: number
  hasOrganization: boolean
  /** Member of any corporate org, owned or not; unlocks the work view. Defaults to hasOrganization. */
  hasMembership?: boolean
  /** Full-width page body, for the work view canvas. */
  wide?: boolean
  head?: string
  tail?: string
}): string {
  const { auth } = params
  const name = auth.user.display_name ?? auth.user.email
  const members =
    params.hasOrganization
      ? navItem(
          'members',
          params.section,
          `${CONSOLE_PATH}/members`,
          'Membros',
          params.memberCount === undefined ? '' : `<span class="count badge">${params.memberCount}</span>`
        )
      : ''
  const office =
    (params.hasMembership ?? params.hasOrganization)
      ? navItem('office', params.section, `${CONSOLE_PATH}/office`, 'Escritório dos agentes')
      : ''
  return consoleDocument(
    params.title,
    `<div class="shell"><aside class="sidebar" id="sidebar">
<div class="side-head"><a class="side-brand" href="${CONSOLE_PATH}">${logo('side-logo')}<span class="side-label">Dolphin</span></a>
<button type="button" class="ghost collapse" data-toggle-sidebar aria-controls="sidebar" aria-expanded="true" title="Recolher menu" aria-label="Recolher menu">${icon('panel')}</button></div>
<nav aria-label="Console"><span class="nav-section">Organização</span>
${navItem('organization', params.section, CONSOLE_PATH, 'Cadastro da organização')}${members}${office}</nav>
<div class="side-foot"><div class="account" title="${escapeHtml(auth.user.email)}"><span class="avatar">${initials(name)}</span>
<span class="side-label"><strong>${escapeHtml(name)}</strong><br><span class="muted">${escapeHtml(auth.user.email)}</span></span></div>
<form method="post" action="${CONSOLE_PATH}/logout">${csrfField(auth.csrf)}<button type="submit" class="ghost" title="Sair">${icon('logout')}<span class="side-label">Sair</span></button></form></div></aside>
<div class="backdrop"></div><div class="content"><header class="topbar">
<button type="button" class="ghost menu" data-toggle-sidebar aria-controls="sidebar" aria-label="Abrir menu">${icon('menu')}</button>
<span class="muted">Console</span><span class="muted">/</span><strong>${escapeHtml(params.heading)}</strong></header>
<main class="page${params.wide ? ' wide' : ''}"><div class="page-head"><h1>${escapeHtml(params.heading)}</h1>${params.subtitle ? `<p class="muted">${escapeHtml(params.subtitle)}</p>` : ''}</div>
${params.body}</main></div></div>`,
    { head: params.head, tail: params.tail }
  )
}
