import type { AzureDevOpsOrgProof } from './config.js'
import { CONSOLE_PATH } from './console-session.js'
import { escapeHtml } from './html-escape.js'
import type { AzureDevOpsLinkRow, MemberView, OrganizationRow } from './organization-store.js'
import type { UserRow } from './store.js'

export type PageMessage = { kind: 'error' | 'notice'; text: string }

// Values copied from src/renderer/src/assets/main.css (:root and .dark) so the console matches the app.
const STYLE = `:root{color-scheme:light dark;--background:#fff;--foreground:#0b1220;--card:#fff;--muted:#f1f5f9;
--muted-foreground:#64748b;--primary:#2563eb;--primary-foreground:#f8fafc;--destructive:#e40014;--border:#e2e8f0;
--input:#e2e8f0;--ring:#60a5fa;--status-success:#15803d;--radius:.625rem}
@media (prefers-color-scheme:dark){:root{--background:#0b1220;--foreground:#f8fafc;--card:#111a2e;--muted:#1a2438;
--muted-foreground:#94a3b8;--destructive:#ff6568;--border:rgb(255 255 255/.07);--input:rgb(255 255 255/.15);
--ring:#3b82f6;--status-success:#86efac}}
*{box-sizing:border-box}
body{margin:0;font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--background);color:var(--foreground)}
header{display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid var(--border)}
header strong{font-size:15px}header form{display:flex;align-items:center;gap:12px}
main{max-width:720px;margin:0 auto;padding:24px 16px;display:grid;gap:16px}
section{background:var(--card);border:1px solid var(--border);border-radius:var(--radius);padding:20px;display:grid;gap:12px}
h1{font-size:20px;margin:0}h2{font-size:16px;margin:0}p{margin:0}
form{display:grid;gap:12px}label{display:grid;gap:4px;font-weight:500}
input{font:inherit;padding:8px 10px;border-radius:calc(var(--radius) - 2px);border:1px solid var(--input);background:transparent;color:inherit;width:100%}
button{font:inherit;font-weight:500;padding:8px 14px;border-radius:calc(var(--radius) - 2px);border:1px solid var(--border);background:var(--muted);color:var(--foreground);cursor:pointer;justify-self:start}
button.primary{background:var(--primary);border-color:var(--primary);color:var(--primary-foreground)}
input:focus-visible,button:focus-visible,a:focus-visible{outline:2px solid var(--ring);outline-offset:1px}
a{color:var(--primary)}.muted{color:var(--muted-foreground)}.error{color:var(--destructive)}.notice{color:var(--status-success)}
.table{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:8px 6px;border-bottom:1px solid var(--border);white-space:nowrap}
th{font-weight:500;color:var(--muted-foreground)}
dl{display:grid;grid-template-columns:max-content 1fr;gap:4px 12px;margin:0}dt{color:var(--muted-foreground)}dd{margin:0;overflow-wrap:anywhere}`

const ROLE_LABEL = { owner: 'Proprietário', member: 'Membro' } as const
const SOURCE_LABEL = { web: 'Console web', 'azure-devops': 'Azure DevOps' } as const

function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

function csrfField(csrf: string): string {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(csrf)}">`
}

function message(msg: PageMessage | undefined): string {
  if (!msg) {
    return ''
  }
  const role = msg.kind === 'error' ? 'alert' : 'status'
  return `<p class="${msg.kind}" role="${role}">${escapeHtml(msg.text)}</p>`
}

function layout(title: string, body: string, signedIn?: { user: UserRow; csrf: string }): string {
  const account = signedIn
    ? `<form method="post" action="${CONSOLE_PATH}/logout">${csrfField(signedIn.csrf)}
<span class="muted">${escapeHtml(signedIn.user.email)}</span><button type="submit">Sair</button></form>`
    : ''
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} · Dolphin</title>
<style>${STYLE}</style></head><body><header><strong>Dolphin · Console</strong>${account}</header>
<main>${body}</main></body></html>`
}

function field(label: string, input: string): string {
  return `<label>${label}${input}</label>`
}

export function renderLoginPage(params: { csrf: string; email?: string; message?: PageMessage }): string {
  return layout(
    'Entrar',
    `<section><h1>Entrar no console</h1>${message(params.message)}
<form method="post" action="${CONSOLE_PATH}/login">${csrfField(params.csrf)}
${field('E-mail', `<input name="email" type="email" autocomplete="username" required value="${escapeHtml(params.email ?? '')}">`)}
${field('Senha', '<input name="password" type="password" autocomplete="current-password" required>')}
<button class="primary" type="submit">Entrar</button></form>
<p class="muted">Recebeu um convite? <a href="${CONSOLE_PATH}/signup">Crie sua conta</a>.</p></section>`
  )
}

export type SignupValues = { email?: string; displayName?: string; organizationName?: string }

export function renderSignupPage(params: { csrf: string; values?: SignupValues; message?: PageMessage }): string {
  const v = params.values ?? {}
  return layout(
    'Criar conta',
    `<section><h1>Criar conta e organização</h1>
<p class="muted">O cadastro exige um código de convite de uso único.</p>${message(params.message)}
<form method="post" action="${CONSOLE_PATH}/signup">${csrfField(params.csrf)}
${field('E-mail', `<input name="email" type="email" autocomplete="username" required value="${escapeHtml(v.email ?? '')}">`)}
${field('Senha (mínimo 12 caracteres)', '<input name="password" type="password" autocomplete="new-password" minlength="12" required>')}
${field('Seu nome', `<input name="displayName" autocomplete="name" required maxlength="100" value="${escapeHtml(v.displayName ?? '')}">`)}
${field('Nome da organização', `<input name="organizationName" required maxlength="100" value="${escapeHtml(v.organizationName ?? '')}">`)}
${field('Código de convite', '<input name="inviteCode" autocomplete="off" required>')}
<button class="primary" type="submit">Criar conta</button></form>
<p class="muted">Já tem conta? <a href="${CONSOLE_PATH}/login">Entre</a>.</p></section>`
  )
}

export function renderCreateOrganizationPage(params: {
  csrf: string
  user: UserRow
  memberships: OrganizationRow[]
  organizationName?: string
  message?: PageMessage
}): string {
  const memberships =
    params.memberships.length > 0
      ? `<section><h2>Organizações das quais você participa</h2><ul>${params.memberships
          .map((org) => `<li>${escapeHtml(org.name)}</li>`)
          .join('')}</ul></section>`
      : ''
  return layout(
    'Criar organização',
    `<section><h1>Criar organização</h1>
<p class="muted">Sua conta ainda não administra uma organização. Informe um código de convite para criar uma.</p>
${message(params.message)}<form method="post" action="${CONSOLE_PATH}/organization">${csrfField(params.csrf)}
${field('Nome da organização', `<input name="organizationName" required maxlength="100" value="${escapeHtml(params.organizationName ?? '')}">`)}
${field('Código de convite', '<input name="inviteCode" autocomplete="off" required>')}
<button class="primary" type="submit">Criar organização</button></form></section>${memberships}`,
    { user: params.user, csrf: params.csrf }
  )
}

function azureDevOpsSection(params: {
  csrf: string
  link: AzureDevOpsLinkRow | undefined
  proof: AzureDevOpsOrgProof
  organizationUrl?: string
}): string {
  const state = params.link
    ? `<dl><dt>Status</dt><dd class="notice">Conectado</dd>
<dt>Organização</dt><dd>${escapeHtml(params.link.organization_name)}</dd>
<dt>ID da instância</dt><dd>${escapeHtml(params.link.instance_id)}</dd>
<dt>Verificado em</dt><dd>${formatDate(params.link.verified_at)}</dd></dl>`
    : '<p class="muted">Nenhuma organização do Azure DevOps conectada.</p>'
  const requirement =
    params.proof === 'admin'
      ? 'O token precisa ser de um Administrador da Coleção de Projetos (Project Collection Administrator).'
      : 'Modo de desenvolvimento: qualquer membro da organização pode conectá-la.'
  return `<section><h2>Azure DevOps</h2>${state}
<p class="muted">${requirement} O token é usado só nesta verificação e não é guardado.</p>
<form method="post" action="${CONSOLE_PATH}/organization/azure-devops" autocomplete="off">${csrfField(params.csrf)}
${field('URL da organização', `<input name="organizationUrl" type="url" required placeholder="https://dev.azure.com/sua-org" value="${escapeHtml(params.organizationUrl ?? '')}">`)}
${field('Personal Access Token (PAT)', '<input name="pat" type="password" autocomplete="off" required>')}
<button class="primary" type="submit">${params.link ? 'Verificar novamente' : 'Conectar Azure DevOps'}</button></form></section>`
}

function membersSection(members: MemberView[]): string {
  const rows = members
    .map(
      (m) => `<tr><td>${escapeHtml(m.display_name ?? m.email)}<br><span class="muted">${escapeHtml(m.email)}</span></td>
<td>${ROLE_LABEL[m.role]}</td><td>${SOURCE_LABEL[m.source]}</td><td>${formatDate(m.joined_at)}</td></tr>`
    )
    .join('')
  return `<section><h2>Membros</h2><div class="table"><table>
<thead><tr><th>Pessoa</th><th>Papel</th><th>Origem</th><th>Entrou em</th></tr></thead>
<tbody>${rows}</tbody></table></div></section>`
}

export function renderOverviewPage(params: {
  csrf: string
  user: UserRow
  organization: OrganizationRow
  link: AzureDevOpsLinkRow | undefined
  members: MemberView[]
  proof: AzureDevOpsOrgProof
  organizationUrl?: string
  message?: PageMessage
}): string {
  return layout(
    params.organization.name,
    `<section><h1>${escapeHtml(params.organization.name)}</h1>${message(params.message)}
<form method="post" action="${CONSOLE_PATH}/organization/name">${csrfField(params.csrf)}
${field('Nome da organização', `<input name="organizationName" required maxlength="100" value="${escapeHtml(params.organization.name)}">`)}
<button type="submit">Salvar nome</button></form></section>
${azureDevOpsSection(params)}${membersSection(params.members)}`,
    { user: params.user, csrf: params.csrf }
  )
}
