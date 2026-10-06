import type { AzureDevOpsOrgProof } from './config.js'
import {
  appLayout,
  authLayout,
  csrfField,
  field,
  formatDate,
  icon,
  message,
  passwordField,
  type PageMessage,
  type SignedIn
} from './console-layout.js'
import { CONSOLE_PATH } from './console-session.js'
import { escapeHtml } from './html-escape.js'
import type { AzureDevOpsLinkRow, OrganizationRow } from './organization-store.js'

export type { PageMessage } from './console-layout.js'

export function renderLoginPage(params: { csrf: string; email?: string; message?: PageMessage }): string {
  return authLayout(
    'Entrar',
    `<div class="card-head"><h1>Entrar no console</h1><p class="muted">Use o e-mail e a senha da sua conta Dolphin.</p></div>
${message(params.message)}<form method="post" action="${CONSOLE_PATH}/login">${csrfField(params.csrf)}
${field('E-mail', `<input name="email" type="email" autocomplete="username" required autofocus placeholder="voce@empresa.com" value="${escapeHtml(params.email ?? '')}">`)}
${passwordField('Senha', 'name="password" autocomplete="current-password" required')}
<button class="primary block" type="submit">Entrar</button></form>
<p class="muted auth-foot">Recebeu um convite? <a href="${CONSOLE_PATH}/signup">Crie sua conta</a>.</p>`
  )
}

export type SignupValues = { email?: string; displayName?: string; organizationName?: string }

export function renderSignupPage(params: { csrf: string; values?: SignupValues; message?: PageMessage }): string {
  const v = params.values ?? {}
  return authLayout(
    'Criar conta',
    `<div class="card-head"><h1>Criar conta e organização</h1>
<p class="muted">O cadastro exige um código de convite de uso único.</p></div>${message(params.message)}
<form method="post" action="${CONSOLE_PATH}/signup">${csrfField(params.csrf)}
${field('E-mail', `<input name="email" type="email" autocomplete="username" required value="${escapeHtml(v.email ?? '')}">`)}
${passwordField('Senha (mínimo 12 caracteres)', 'name="password" autocomplete="new-password" minlength="12" required')}
${field('Seu nome', `<input name="displayName" autocomplete="name" required maxlength="100" value="${escapeHtml(v.displayName ?? '')}">`)}
${field('Nome da organização', `<input name="organizationName" required maxlength="100" value="${escapeHtml(v.organizationName ?? '')}">`)}
${field('Código de convite', '<input name="inviteCode" autocomplete="off" required>')}
<button class="primary block" type="submit">Criar conta</button></form>
<p class="muted auth-foot">Já tem conta? <a href="${CONSOLE_PATH}/login">Entre</a>.</p>`
  )
}

export function renderCreateOrganizationPage(
  params: SignedIn & { memberships: OrganizationRow[]; organizationName?: string; message?: PageMessage }
): string {
  const memberships =
    params.memberships.length > 0
      ? `<section class="card"><h2>Organizações das quais você participa</h2><ul>${params.memberships
          .map((org) => `<li>${escapeHtml(org.name)}</li>`)
          .join('')}</ul></section>`
      : ''
  return appLayout({
    title: 'Criar organização',
    heading: 'Criar organização',
    subtitle: 'Sua conta ainda não administra uma organização. Informe um código de convite para criar uma.',
    section: 'organization',
    auth: params,
    hasOrganization: false,
    body: `<section class="card">${message(params.message)}<form method="post" action="${CONSOLE_PATH}/organization">${csrfField(params.csrf)}
${field('Nome da organização', `<input name="organizationName" required maxlength="100" value="${escapeHtml(params.organizationName ?? '')}">`)}
${field('Código de convite', '<input name="inviteCode" autocomplete="off" required>')}
<button class="primary" type="submit">Criar organização</button></form></section>${memberships}`
  })
}

function azureDevOpsSection(params: {
  csrf: string
  link: AzureDevOpsLinkRow | undefined
  proof: AzureDevOpsOrgProof
  organizationUrl?: string
}): string {
  const state = params.link
    ? `<dl><dt>Status</dt><dd><span class="badge ok">${icon('check')}Conectado</span></dd>
<dt>Organização</dt><dd>${escapeHtml(params.link.organization_name)}</dd>
<dt>ID da instância</dt><dd>${escapeHtml(params.link.instance_id)}</dd>
<dt>Verificado em</dt><dd>${formatDate(params.link.verified_at)}</dd></dl>`
    : '<p><span class="badge">Não conectado</span></p><p class="muted">Nenhuma organização do Azure DevOps conectada.</p>'
  const requirement =
    params.proof === 'admin'
      ? 'O token precisa ser de um Administrador da Coleção de Projetos (Project Collection Administrator).'
      : 'Modo de desenvolvimento: qualquer membro da organização pode conectá-la.'
  return `<section class="card"><div class="card-head"><h2>Azure DevOps</h2>
<p class="muted">${requirement} O token é usado só nesta verificação e não é guardado.</p></div>${state}
<form method="post" action="${CONSOLE_PATH}/organization/azure-devops" autocomplete="off">${csrfField(params.csrf)}
${field('URL da organização', `<input name="organizationUrl" type="url" required placeholder="https://dev.azure.com/sua-org" value="${escapeHtml(params.organizationUrl ?? '')}">`)}
${passwordField('Personal Access Token (PAT)', 'name="pat" autocomplete="off" required')}
<button class="primary" type="submit">${icon('link')}${params.link ? 'Verificar novamente' : 'Conectar Azure DevOps'}</button></form></section>`
}

export function renderOverviewPage(
  params: SignedIn & {
    organization: OrganizationRow
    link: AzureDevOpsLinkRow | undefined
    memberCount: number
    proof: AzureDevOpsOrgProof
    organizationUrl?: string
    message?: PageMessage
  }
): string {
  const org = params.organization
  return appLayout({
    title: org.name,
    heading: 'Cadastro da organização',
    subtitle: 'Dados da organização e conexão com o Azure DevOps.',
    section: 'organization',
    auth: params,
    hasOrganization: true,
    memberCount: params.memberCount,
    body: `${message(params.message)}<section class="card"><div class="card-head"><h2>${escapeHtml(org.name)}</h2>
<p class="muted">Criada em ${formatDate(org.created_at)} · ${params.memberCount} ${params.memberCount === 1 ? 'membro' : 'membros'}</p></div>
<form method="post" action="${CONSOLE_PATH}/organization/name">${csrfField(params.csrf)}
${field('Nome da organização', `<input name="organizationName" required maxlength="100" value="${escapeHtml(org.name)}">`)}
<button type="submit">Salvar nome</button></form></section>${azureDevOpsSection(params)}`
  })
}
