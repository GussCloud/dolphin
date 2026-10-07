import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesEn } from './en'

export const hostRoutesPtBR: MobileLocaleMessages<typeof hostRoutesEn> = {
  // Route titles
  routeHost: 'Host',
  routeAccounts: 'Contas',
  routeTasks: 'Tarefas',
  routeTerminal: 'Terminal',
  routeSourceControl: 'Controle de código-fonte',
  routeAgentHistory: 'Histórico de sessões do agente',
  routeChanges: 'Alterações',
  routePullRequest: 'Pull Request',
  routeWorkspace: 'Workspace',

  // Edit host
  editHost: 'Editar host',
  back: 'Voltar',
  save: 'Salvar',
  saveHostA11y: 'Salvar host',
  goBack: 'Voltar',
  missingHost: 'Host ausente.',
  hostRemoved: 'Este host foi removido deste celular.',
  failedToLoadHost: 'Falha ao carregar o host.',
  failedToSaveHost: 'Falha ao salvar o host.',
  editHelp:
    'Altere o nome de exibição ou o endereço de conexão. Deixe o nome vazio para usar o nome informado pelo desktop. Alterar o endereço só muda para onde este celular se conecta — não refaz o pareamento. Use isso quando o mesmo desktop estiver acessível por outro IP (por exemplo, LAN de casa vs. Tailscale).',
  name: 'Nome',
  hostNamePlaceholder: 'Nome do host',
  address: 'Endereço',
  addressHint: 'Aceita IP, host:porta ou ws:// / wss://. Sem porta, usa a porta atual (ou 6768).',
  connectsTo: 'Conecta a {endpoint}',

  // Accounts
  accounts: 'Contas',
  invalidSnapshot: 'Dados de contas inválidos recebidos do host',
  hostNotFound: 'Host não encontrado',
  couldNotSwitchAccount: 'Não foi possível trocar de conta',
  systemDefault: 'Padrão do sistema',
  useAgentLogin: 'Usar o login do próprio agente',
  connectingToHost: 'Conectando a {host}…',
  connectingToHostGeneric: 'Conectando ao host…',
  loadingAccounts: 'Carregando contas…',
  addAccountsHint: 'Adicione ou reautentique contas em Configurações → Contas no desktop.'
}
