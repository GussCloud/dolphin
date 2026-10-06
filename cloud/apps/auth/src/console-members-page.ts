import {
  appLayout,
  csrfField,
  field,
  formatDate,
  icon,
  initials,
  message,
  type PageMessage,
  type SignedIn
} from './console-layout.js'
import { CONSOLE_PATH } from './console-session.js'
import { escapeHtml } from './html-escape.js'
import type { MemberView, OrganizationRow } from './organization-store.js'

/** Raw query values, echoed back into the filter form and carried through edit/remove redirects. */
export type MemberFilterValues = { q?: string; from?: string; to?: string }

const ROLE_LABEL = { owner: 'Proprietário', member: 'Membro' } as const
const SOURCE_LABEL = { web: 'Console web', 'azure-devops': 'Azure DevOps' } as const

export function memberDisplayName(m: MemberView): string {
  return m.nickname ?? m.display_name ?? m.email
}

function filterFields(values: MemberFilterValues): string {
  return (['q', 'from', 'to'] as const)
    .map((k) => (values[k] ? `<input type="hidden" name="${k}" value="${escapeHtml(values[k])}">` : ''))
    .join('')
}

function filtersForm(values: MemberFilterValues): string {
  const active = Boolean(values.q || values.from || values.to)
  return `<form class="filters" method="get" action="${CONSOLE_PATH}/members" role="search">
${field('Buscar', `<input name="q" type="search" placeholder="Nome ou e-mail" maxlength="100" value="${escapeHtml(values.q ?? '')}">`)}
${field('Entrou a partir de', `<input name="from" type="date" value="${escapeHtml(values.from ?? '')}">`)}
${field('Entrou até', `<input name="to" type="date" value="${escapeHtml(values.to ?? '')}">`)}
<div class="actions"><button type="submit" class="primary">${icon('search')}Filtrar</button>
${active ? `<a class="button" href="${CONSOLE_PATH}/members">Limpar</a>` : ''}</div></form>`
}

function memberActions(m: MemberView, csrf: string, values: MemberFilterValues): string {
  const base = `${CONSOLE_PATH}/members/${encodeURIComponent(m.user_id)}`
  const name = escapeHtml(memberDisplayName(m))
  const accountName = escapeHtml(m.display_name ?? m.email)
  const edit = `<details class="pop"><summary class="button ghost" title="Editar nome">${icon('pencil')}<span>Editar</span></summary>
<div class="pop-panel"><form method="post" action="${base}/name">${csrfField(csrf)}${filterFields(values)}
${field('Nome nesta organização', `<input name="nickname" maxlength="100" placeholder="${accountName}" value="${escapeHtml(m.nickname ?? '')}">`)}
<p class="muted">Deixe em branco para usar o nome da conta (${accountName}).</p>
<div class="buttons"><button type="submit" class="primary">Salvar</button></div></form></div></details>`
  if (m.role === 'owner') {
    return edit
  }
  const remove = `<details class="pop"><summary class="button ghost" title="Remover membro">${icon('trash')}<span>Remover</span></summary>
<div class="pop-panel"><form method="post" action="${base}/delete">${csrfField(csrf)}${filterFields(values)}
<p><strong>Remover ${name}?</strong></p>
<p class="muted">A pessoa sai desta organização. Se entrar de novo pelo Azure DevOps, volta como membro.</p>
<div class="buttons"><button type="submit" class="danger">Remover</button></div></form></div></details>`
  return edit + remove
}

function memberRow(m: MemberView, csrf: string, values: MemberFilterValues): string {
  const name = memberDisplayName(m)
  return `<tr><td class="person-cell"><div class="person"><span class="avatar">${initials(name)}</span><div>
<strong>${escapeHtml(name)}</strong><span class="muted">${escapeHtml(m.email)}</span></div></div></td>
<td data-label="Papel"><span class="badge${m.role === 'owner' ? ' brand' : ''}">${ROLE_LABEL[m.role]}</span></td>
<td data-label="Origem">${SOURCE_LABEL[m.source]}</td><td data-label="Entrou em">${formatDate(m.joined_at)}</td>
<td><div class="row-actions">${memberActions(m, csrf, values)}</div></td></tr>`
}

export function renderMembersPage(
  params: SignedIn & {
    organization: OrganizationRow
    members: MemberView[]
    total: number
    filters: MemberFilterValues
    message?: PageMessage
  }
): string {
  const { members, total } = params
  const shown = members.length === total ? `${total}` : `${members.length} de ${total}`
  const table =
    members.length > 0
      ? `<div class="table"><table><thead><tr><th>Pessoa</th><th>Papel</th><th>Origem</th><th>Entrou em</th>
<th><span hidden>Ações</span></th></tr></thead><tbody>${members.map((m) => memberRow(m, params.csrf, params.filters)).join('')}</tbody></table></div>`
      : `<div class="empty">${icon('search')}<strong>Nenhum membro encontrado</strong><p class="muted">Ajuste os filtros e tente de novo.</p></div>`
  return appLayout({
    title: `Membros · ${params.organization.name}`,
    heading: 'Membros',
    subtitle: `Pessoas de ${params.organization.name} que usam o Dolphin.`,
    section: 'members',
    auth: params,
    hasOrganization: true,
    memberCount: total,
    body: `${message(params.message)}<section class="card">${filtersForm(params.filters)}</section>
<section class="card"><div class="card-head"><h2>Membros <span class="badge">${shown}</span></h2></div>${table}</section>`
  })
}
