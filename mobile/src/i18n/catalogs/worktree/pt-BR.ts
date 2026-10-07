import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { worktreeEn } from './en'

export const worktreePtBR: MobileLocaleMessages<typeof worktreeEn> = {
  // Agent states (mirror desktop agentStateLabel)
  agentWorking: 'Trabalhando',
  agentMonitoring: 'Monitorando tarefas em segundo plano',
  agentBlocked: 'Bloqueado',
  agentWaiting: 'Aguardando resposta',
  agentInterrupted: 'Interrompido',
  agentDone: 'Concluído',
  agentIdle: 'Ocioso',
  agentUnverifiable: 'Não verificável',
  teammate: 'Colega de equipe',
  // Host card summary
  worktreeListUnavailable: 'Lista de worktrees indisponível',
  worktreeCount: { one: '{count} worktree', other: '{count} worktrees' },
  worktreeCountWithActive: '{worktrees} · {active} ativos',
  lastKnown: 'Último status: {summary}',
  // Workspace list states
  catalogLoadError: 'Não foi possível carregar os workspaces deste host',
  catalogLoadErrorDetail: '{command} falhou ({error}) — tentando novamente automaticamente',
  emptySearch: 'Nenhum worktree correspondente',
  emptyFiltered: 'Nenhum worktree corresponde aos filtros',
  empty: 'Nenhum worktree',
  // Sections
  sectionPinned: 'Fixados',
  sectionAll: 'Todos',
  prGroupDone: 'Concluído',
  prGroupInReview: 'Em revisão',
  prGroupInProgress: 'Em andamento',
  prGroupClosed: 'Fechado',
  // Sort and group pickers
  sortSmart: 'Atividade dos agentes',
  sortSmartSubtitle: 'Agentes que precisam de atenção, depois atividade recente',
  sortName: 'Nome',
  sortNameSubtitle: 'Ordem alfabética por nome',
  sortRecent: 'Recentes',
  sortRecentSubtitle: 'Saída mais recente primeiro',
  sortRepo: 'Repositório',
  sortRepoSubtitle: 'Repositório, depois nome do workspace',
  sortManual: 'Manual',
  sortManualSubtitle: 'Ordem do servidor',
  groupNone: 'Sem agrupamento',
  groupStatus: 'Status',
  groupRepository: 'Repositório',
  groupPrStatus: 'Status do PR',
  // Relative time (desktop formatTimeAgo thresholds)
  timeJustNow: 'agora mesmo',
  timeMinutes: '{minutes} min',
  timeHours: '{hours} h',
  timeDays: '{days} d'
}
