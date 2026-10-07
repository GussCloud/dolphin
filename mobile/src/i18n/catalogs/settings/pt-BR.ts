import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { settingsEn } from './en'

export const settingsPtBR: MobileLocaleMessages<typeof settingsEn> = {
  back: 'Voltar',
  on: 'Ativado',
  off: 'Desativado',
  retry: 'Tentar novamente',
  openSettings: 'Abrir configurações',

  settings: 'Configurações',
  terminal: 'Terminal',
  chatUi: 'Chat UI',
  browser: 'Navegador',
  voice: 'Voz',
  notifications: 'Notificações',
  backgroundConnection: 'Conexão em segundo plano',
  language: 'Idioma',
  troubleshooting: 'Solução de problemas',
  about: 'Sobre',
  privacyPolicy: 'Política de Privacidade',
  support: 'Suporte',

  languageHeading: 'IDIOMA DO APP',
  languageDescription: 'Escolha o idioma usado pelo app Dolphin neste dispositivo.',
  languageSystemDefault: 'Padrão do sistema',
  languageSaveError: 'Não foi possível salvar o idioma. Tente novamente.',

  aboutTagline: 'IDE de agentes open source para quem constrói 100x',
  aboutWebsite: 'Site do Dolphin',
  aboutSourceCode: 'Código-fonte do Dolphin',
  aboutOnX: 'Dolphin no X',
  aboutOpenLinkError: 'Não foi possível abrir o link. Tente novamente.',

  backgroundRelayHeading: 'RELAY',
  backgroundRelayDescription:
    'Mantém a conexão do Relay aberta depois que você sai do app, para que ela reabra na hora. Enquanto estiver ativado, o Android mostra uma notificação persistente e o consumo de bateria aumenta.',
  backgroundStayConnected: 'Manter conectado em segundo plano',
  backgroundRetentionOffSubtitle: 'Desconecta pouco depois que você sai do app.',
  backgroundRetention15m: '15 minutos',
  backgroundRetention15mSubtitle: 'Fica conectado por 15 minutos em segundo plano.',
  backgroundRetention1h: '1 hora',
  backgroundRetention1hSubtitle: 'Fica conectado por 1 hora em segundo plano.',
  backgroundRetentionAlways: 'Sempre',
  backgroundRetentionAlwaysSubtitle: 'Fica conectado até você desativar esta opção.',
  backgroundSaveError: 'Não foi possível salvar a conexão em segundo plano. Tente novamente.',
  backgroundSystemHeading: 'SISTEMA',
  backgroundSystemDescription:
    'A economia de bateria ainda pode encerrar a conexão. Permita que o Dolphin funcione sem restrições.',
  backgroundSystemDescriptionWithAutostart:
    'A economia de bateria ainda pode encerrar a conexão. Permita que o Dolphin funcione sem restrições e ative a inicialização automática.',
  backgroundBatteryOptimization: 'Otimização de bateria',
  backgroundUnrestricted: 'Sem restrições',
  backgroundRestricted: 'Restrito — toque para permitir',
  backgroundAutostart: 'Inicialização automática',
  backgroundAutostartHint: 'Necessário em Xiaomi, Redmi e POCO',

  browserLinksHeading: 'LINKS',
  browserLinksDescription: 'Escolha onde abrir os links HTTP(S) tocados na saída do terminal.',
  browserOpenTerminalLinks: 'Abrir links do terminal',
  browserModeDolphin: 'Navegador do Dolphin no desktop',
  browserModeDolphinSubtitle: 'Abre no navegador transmitido do seu desktop pareado.',
  browserModePhone: 'Navegador do celular',
  browserModePhoneSubtitle: 'Abre no Safari, Chrome ou outro navegador deste celular.',
  browserLoadError: 'Não foi possível carregar as preferências do navegador. Tente novamente.',
  browserSaveError: 'Não foi possível salvar as preferências do navegador. Tente novamente.',

  chatDefaultViewHeading: 'VISUALIZAÇÃO PADRÃO',
  chatDefaultViewDescription:
    'Escolha como as sessões de agentes compatíveis (Claude, Codex e outros agentes com chat) abrem neste dispositivo. Terminal mostra a CLI pura; Chat UI mostra uma interface de chat como a do app desktop. Você ainda pode alternar cada sessão pelo menu de toque longo.',
  chatOpenSessionsInChatUi: 'Abrir sessões no Chat UI',

  notificationsEnable: 'Ativar notificações',
  notificationsDefaultDescription:
    'Receba avisos neste dispositivo quando um agente precisar da sua resposta ou concluir uma tarefa.',
  notificationsPushDescription:
    'Receba alertas dos agentes mesmo com o app fechado. Entregues pelo serviço de push do Dolphin e pela Apple ou pelo Google.',
  notificationsBlocked: 'As notificações estão desativadas nas configurações do sistema.',
  notificationsLoadError:
    'Não foi possível carregar as configurações de notificação. Tente novamente.',
  notificationsSaveError:
    'Não foi possível salvar as configurações de notificação. Tente novamente.',
  notificationsOpenSettingsError:
    'Não foi possível abrir as configurações do sistema. Tente novamente.',
  deliveryLoadError:
    'Não foi possível carregar as configurações de entrega. Reabra esta tela para tentar de novo.',
  deliverySaveError: 'Não foi possível salvar as configurações de entrega. Tente novamente.',
  deliveryNeedsUpdatedDesktop:
    'Pareie um desktop atualizado para receber notificações neste celular.',

  pushTestHeading: 'Problemas para receber alertas?',
  pushTestDetail: 'Envie um teste pelo serviço de push do Dolphin.',
  pushTestSend: 'Enviar notificação de teste',
  pushTestSending: 'Enviando…',
  pushTestLoadHostsError: 'Não foi possível carregar os desktops pareados.',
  pushTestPairDesktop: 'Pareie um desktop e tente novamente.',
  pushTestConnectDesktop: 'Conecte um desktop e tente novamente.',
  pushTestUpdateDesktop: 'Atualize seu desktop para executar este teste.',
  pushTestReachError: 'Não foi possível acessar o desktop. Tente novamente.',
  pushTestAccepted: 'Aceito pelo serviço de push do Dolphin. Verifique se a notificação chegou.',
  pushTestNotRegistered: 'Reconecte para registrar este celular para notificações.',
  pushTestRateLimited: 'Notificações demais. Tente novamente mais tarde.',
  pushTestSendError: 'Não foi possível enviar pelo serviço de push do Dolphin. Tente novamente.',
  pushTestGenericError: 'Não foi possível enviar o teste de push.',

  credentialCleanupTitle: 'Limpeza de credenciais de pareamento',
  credentialCleanupRetryFailed:
    'Ainda não foi possível confirmar a limpeza. Tente novamente mais tarde.',
  credentialCleanupPending: {
    one: 'Não foi possível confirmar a limpeza de {count} credencial neste dispositivo.',
    other: 'Não foi possível confirmar a limpeza de {count} credenciais neste dispositivo.'
  },
  credentialCleanupUnreadable:
    'Não foi possível verificar o status da limpeza neste dispositivo. Tente novamente por segurança.',
  credentialCleanupRetryLabel: 'Tentar limpar as credenciais de pareamento novamente',

  voiceConnectDesktop: 'Conecte-se a um desktop para gerenciar as configurações de voz.',
  voiceLoadError: 'Falha ao carregar as configurações de voz.',
  voiceUpdateError: 'Não foi possível atualizar.',
  voiceSelectModelError: 'Não foi possível selecionar o modelo.',
  voiceDownloadError: 'Falha no download.',
  voiceDeleteError: 'Falha ao excluir.',
  voiceDictationHeading: 'DITADO',
  voiceEnableDictation: 'Ativar ditado por voz',
  voiceEnableDictationDescription: 'Dite texto em qualquer painel em foco no seu desktop.',
  voiceDictationMode: 'Modo de ditado',
  voiceDictationModeDescription:
    'Alternar: toque uma vez para começar e de novo para parar. Segurar: dita enquanto estiver pressionado.',
  voiceModeToggle: 'Alternar',
  voiceModeHold: 'Segurar',
  voiceSpeechModelHeading: 'MODELO DE FALA',
  voiceSpeechModel: 'Modelo de fala',
  voiceNoModelSelected: 'Nenhum selecionado',

  terminalLeaveHeading: 'AO SAIR DO APP',
  terminalLeaveDescription:
    'Enquanto você usa um terminal no celular, o Dolphin o reduz para caber na sua tela. Quando você fecha o app ou muda para outro, esta opção define se ele continua no tamanho do celular (para que ferramentas de CLI interativas não sejam redesenhadas) ou volta ao tamanho do desktop. Você sempre pode usar Restaurar este terminal ou Restaurar todos os terminais no banner para redimensionar manualmente.',
  terminalNoHosts:
    'Nenhum desktop pareado ainda. Pareie um para controlar o comportamento do terminal.',
  terminalRestoreKeepPhoneSize: 'Manter no tamanho do celular (padrão)',
  terminalRestoreAfter1Minute: 'Após 1 minuto',
  terminalRestoreAfter5Minutes: 'Após 5 minutos',
  terminalRestoreAfter30Minutes: 'Após 30 minutos',
  terminalRestoreAfterSeconds: 'Após {seconds}s',
  terminalRestorePickerTitle: 'Restaurar {host}',
  terminalTextSizeHeading: 'TAMANHO DO TEXTO',
  terminalTextSizeDescription:
    'Ajusta a escala do texto do terminal. Tamanhos menores cabem mais colunas com margens laterais; tamanhos maiores mostram menos colunas — arraste para os lados para navegar. Você também pode fazer pinça para dar zoom no próprio terminal, o que atualiza esta configuração. Vale só para a exibição neste dispositivo; não altera o terminal do desktop.',
  terminalTextSize: 'Tamanho do texto',
  terminalTextSizePickerTitle: 'Tamanho do texto do terminal',
  terminalTextSizeSmallest: 'Mínimo (50%)',
  terminalTextSizeSmaller: 'Menor (75%)',
  terminalTextSizeDefault: 'Padrão (100%)',
  terminalTextSizeLarge: 'Grande (125%)',
  terminalTextSizeLarger: 'Maior (150%)',
  terminalTextSizeLargest: 'Máximo (200%)',
  terminalKeyboardHeading: 'ENTRADA DO TECLADO',
  terminalKeyboardDescription:
    'Ativa o preenchimento automático, a correção automática e as sugestões de ortografia do celular na barra de comandos do terminal. Desativado por padrão para que o teclado nunca reescreva comandos, flags ou caminhos. A entrada direta do teclado (quando as teclas vão direto para o terminal) sempre envia as teclas sem alteração, então as sugestões não se aplicam.',
  terminalAutocomplete: 'Preenchimento e correção automáticos'
}
