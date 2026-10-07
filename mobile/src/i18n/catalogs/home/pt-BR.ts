import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { homeEn } from './en'

export const homePtBR: MobileLocaleMessages<typeof homeEn> = {
  // Shared
  pleaseTryAgain: 'Tente novamente.',
  remove: 'Remover',
  update: 'Atualizar',
  tasks: 'Tarefas',
  openSettings: 'Abrir configurações',
  // Host actions
  checkPairingErrorTitle: 'Não foi possível verificar o pareamento',
  removeHostErrorTitle: 'Não foi possível remover o host',
  removeHostTitle: 'Remover host',
  removeHostMessage: 'Remover "{name}"? Você pode parear de novo depois.',
  updateDesktopTitle: 'Atualizar desktop',
  // Empty state
  emptyTitle: 'Conecte seu desktop',
  emptyBody:
    'Pareie com o Dolphin no seu computador para acompanhar seus agentes, entrar em qualquer terminal e conduzir o trabalho pelo celular.',
  pairDesktop: 'Parear desktop',
  howItWorks: 'Como funciona',
  stepOpenDesktopTitle: 'Abra o Dolphin no desktop',
  stepOpenDesktopDesc: 'Vá em Configurações → Mobile e gere um QR code de pareamento.',
  stepScanTitle: 'Escaneie o código',
  stepScanDesc: 'Toque no botão acima para abrir o leitor. Aponte para o QR code na sua tela.',
  stepConnectedTitle: 'Pronto, conectado',
  stepConnectedDesc: 'Seu desktop vai aparecer aqui. Tudo é criptografado de ponta a ponta.',
  // List header and footer
  welcomeBack: 'Bem-vindo de volta',
  statAgentsSpawned: 'Agentes iniciados',
  statAgentTime: 'Tempo de agentes',
  statPRsCreated: 'PRs criados',
  durationDaysHours: '{days}d {hours}h',
  durationHoursMinutes: '{hours}h {minutes}min',
  durationMinutes: '{minutes}min',
  desktops: 'Desktops',
  resume: 'Retomar',
  accountUsage: 'Uso da conta',
  systemDefaultAccount: 'Padrão do sistema',
  noTaskSources: 'Nenhuma fonte de tarefas conectada',
  openProviderTasks: 'Abrir tarefas do {provider}'
}
