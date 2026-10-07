import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { agentHistoryEn } from './en'

export const agentHistoryPtBR: MobileLocaleMessages<typeof agentHistoryEn> = {
  // Screen chrome
  title: 'Histórico de sessões de agentes',
  back: 'Voltar',
  refresh: 'Atualizar sessões de agentes',
  retry: 'Tentar novamente',
  sourceControl: 'Controle de código-fonte',
  // Scope tabs and search
  scopeWorkspace: 'Workspace',
  scopeProject: 'Projeto',
  scopeAll: 'Tudo',
  searchPlaceholder: 'Buscar sessões, repo:, path:',
  transcriptsSkipped: {
    one: '{count} transcrição ignorada',
    other: '{count} transcrições ignoradas'
  },
  // States
  unavailableTitle: 'Histórico de sessões de agentes indisponível',
  unavailableBody: 'Atualize o Dolphin neste host para ver o histórico de sessões de agentes.',
  loadErrorTitle: 'Não foi possível carregar',
  emptyTitle: 'Nenhuma sessão de agente',
  emptySearch: 'Nenhuma sessão corresponde à sua busca.',
  emptyScope: 'Nenhuma sessão de agente anterior neste escopo.',
  waitingForHost: 'Aguardando o host…',
  hostUnreachable: 'Não foi possível acessar o host',
  sessionsLoadError: 'Não foi possível carregar as sessões de agentes',
  // Session cards
  untitledSession: 'Sessão sem título',
  messageCount: { one: '{count} mensagem', other: '{count} mensagens' },
  currentWorktree: 'worktree atual',
  resumeSession: 'Retomar sessão de agente',
  // Resume
  missingResumeId: 'Esta sessão não tem um ID de retomada.',
  unknownHostPlatform: 'Não foi possível determinar a plataforma do host.',
  sessionQueued: 'Sessão de agente na fila.',
  resumeFailed: 'Falha ao retomar a sessão.',
  workspaceMetadataError: 'Não foi possível carregar os metadados do workspace.',
  blockedRuntime: 'Retomar pelo histórico não está disponível em workspaces hospedados no runtime.',
  blockedSsh:
    'Esta sessão está salva na máquina host, então não pode ser retomada em um workspace SSH. Abra um workspace local para este projeto.',
  blockedNoLocal: 'Abra um workspace local antes de retomar uma sessão.'
}
