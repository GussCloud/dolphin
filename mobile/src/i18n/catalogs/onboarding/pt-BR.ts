import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { onboardingEn } from './en'

export const onboardingPtBR: MobileLocaleMessages<typeof onboardingEn> = {
  // Session view step
  sessionViewTitle: 'Como as sessões devem abrir?',
  sessionViewBody:
    'Escolha se as sessões de agentes compatíveis abrem no terminal ou no Chat UI neste dispositivo. Toque e segure uma aba de sessão para alternar a visualização, ou altere o padrão depois nas Configurações.',
  useChatUi: 'Usar Chat UI',
  useChatUiA11y: 'Abrir sessões no Chat UI',
  keepTerminal: 'Manter terminal',
  keepTerminalA11y: 'Abrir sessões no terminal',
  // Notifications step
  notificationsTitle: 'Não perca quando um agente precisar de você',
  notificationsBody:
    'Receba uma notificação neste celular quando um agente terminar ou estiver aguardando — mesmo que você não esteja usando o app.',
  notificationsDisclosure:
    'Enviadas pelo serviço de push do Dolphin depois que seu desktop ficar 3 minutos ocioso. Altere quando quiser nas Configurações.',
  enableNotifications: 'Ativar notificações',
  enableNotificationsA11y: 'Ativar notificações de agentes',
  notNow: 'Agora não',
  notNowA11y: 'Pular notificações por enquanto',
  // Sample notification banners
  sampleNow: 'agora',
  sampleCodexTitle: 'Codex terminou',
  sampleCodexBody: 'Os testes estão passando.',
  sampleClaudeTitle: 'Claude precisa de uma resposta',
  sampleClaudeBody: 'Aguardando você.'
}
