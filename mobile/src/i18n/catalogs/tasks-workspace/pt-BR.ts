import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { tasksWorkspaceEn } from './en'

export const tasksWorkspacePtBR: MobileLocaleMessages<typeof tasksWorkspaceEn> = {
  // Setup hooks source
  setupSourceLegacy: 'hooks locais',
  setupSourceRepository: 'hooks do repositório',

  // Workspace create drawer
  selectRepository: 'Selecionar um repositório',
  sshConnection: 'Conexão SSH',
  remoteRepository: 'Repositório remoto',
  connecting: 'Conectando...',
  workspaceName: 'Nome do workspace',
  optionalHint: '[Opcional]',
  agent: 'Agente',
  connectRepositoryFirst: 'Conecte o repositório primeiro',
  detectingAgents: 'Detectando agentes...',
  advanced: 'Avançado',
  startFrom: 'Começar de',
  defaultBranch: 'Branch padrão',
  createFromRef: 'Criar a partir de {ref}',
  linearWorkspaceNeedsRepository:
    'Adicione um repositório Git antes de criar um workspace do Linear.',
  repositoryNotFound: 'Repositório não encontrado.',
  connectRepository: 'Conectar repositório',

  // Workspace option pickers
  startFromTitle: 'Começar de',
  startFromSubtitle: 'Escolha um branch ou ref existente.',
  searchBranches: 'Pesquisar branches',
  defaultBranchSubtitle: 'Usar a base configurada neste repositório',
  noBranchesMatch: 'Nenhum branch corresponde.',
  branchNameLabel: 'Nome do branch: {branch}',
  sparseCheckoutTitle: 'Sparse checkout',
  fullCheckout: 'Checkout completo',
  fullCheckoutSubtitle: 'Usar o repositório inteiro',
  editPresetLabel: 'Editar {name}',
  newPreset: 'Nova predefinição',

  // Sparse presets and setup trust
  newSparsePreset: 'Nova predefinição de sparse checkout',
  editSparsePreset: 'Editar predefinição de sparse checkout',
  presetName: 'Nome',
  presetDirectories: 'Diretórios',
  directoryCount: { one: '{count} diretório', other: '{count} diretórios' },
  runSetupScriptTitle: 'Executar o script de setup?',
  setupChoiceRequired: '{repo} exige uma escolha de setup antes de criar este workspace.',
  runSetupAndCreate: 'Executar setup e criar',
  skipSetupAndCreate: 'Pular setup e criar',
  setupScriptChanged: 'O script de setup de {repo} mudou',
  runSetupFrom: 'Executar o setup de {repo}?',
  setupTrustWarning:
    'O dolphin.yaml deste repositório é executado na sua máquina antes de o workspace iniciar. Execute-o somente se você confiar neste repositório.',
  newSetupScript: 'Novo script de setup',
  setupScript: 'Script de setup',
  trustSetupScriptError: 'Falha ao confiar no script de setup.',
  runHooks: 'Executar hooks',
  alwaysTrustAndRun: 'Sempre confiar e executar',
  dontRun: 'Não executar',

  // Workspace create operations
  sshConnected: 'Conectado',
  sshConnecting: 'Conectando',
  sshDeployingRelay: 'Implantando relay',
  sshReconnecting: 'Reconectando',
  sshAuthFailed: 'Falha na autenticação',
  sshReconnectFailed: 'Falha ao reconectar',
  sshConnectionFailed: 'Falha na conexão',
  sshDisconnected: 'Desconectado',
  agentLaunchUnsupportedWarning:
    'Workspace criado, mas este computador não pode iniciar o agente pelo celular.',
  agentLaunchFailedWarning: 'Workspace criado, mas o agente não iniciou: {reason}',
  searchFailed: 'Falha na pesquisa',
  sparseDirectoriesInvalid:
    'Use diretórios relativos ao repositório, não a raiz, caminhos absolutos ou segmentos pai.',
  sparseDirectoriesEmpty: 'Adicione pelo menos um diretório.',
  unknownError: 'Erro desconhecido',
  createWorkspaceError: 'Falha ao criar o workspace',

  // Smart workspace source modes
  smartModeSmart: 'Inteligente',
  smartModeBranch: 'Branch',
  smartModeName: 'Nome',

  // Action errors
  resolveBaseBranchError: 'Falha ao resolver o branch base.',
  agentDisabled:
    'O agente selecionado está desabilitado. Escolha um agente habilitado antes de criar.',
  nameRequired: 'O nome é obrigatório.',
  openShellSubtitle: 'Abrir um shell',
  sparsePresetsLoadError: 'Falha ao carregar as predefinições de sparse checkout.',
  branchSearchError: 'Falha ao pesquisar branches.',
  sparsePresetSaveError: 'Falha ao salvar a predefinição de sparse checkout.',
  sshStateReadError: 'Falha ao ler o status da conexão SSH.',
  sshConnectError: 'Falha ao conectar ao repositório SSH.',
  connectRepoBeforeWorkspace: 'Conecte {repo} antes de criar um workspace.',
  nameTooLong: 'O nome deve ter no máximo 80 caracteres.',
  nameAlreadyExists: '"{name}" já existe.',
  blankTerminal: 'Terminal em branco'
}
