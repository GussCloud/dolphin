import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { diagnosticsEn } from './en'

export const diagnosticsPtBR: MobileLocaleMessages<typeof diagnosticsEn> = {
  // Shared chrome
  back: 'Voltar',
  troubleshooting: 'Solução de problemas',
  networkDiagnostics: 'Diagnóstico de rede',
  // Troubleshoot screen
  running: 'Executando…',
  runAgain: 'Executar novamente',
  runDiagnostics: 'Executar diagnóstico',
  viewNetworkDiagnostics: 'Ver diagnóstico de rede',
  commonIssues: 'Problemas comuns',
  // Diagnostic checks
  checkPairedHosts: 'Hosts pareados',
  checkPairedCount: { one: '{count} pareado', other: '{count} pareados' },
  checkPairedNone: 'Nenhum — escaneie um QR para parear',
  checkPairedReadError: 'Não foi possível ler os dados do host',
  checkInternet: 'Internet',
  checkInternetConnected: 'Conectado',
  checkInternetUnexpected: 'Resposta inesperada',
  checkInternetNone: 'Sem conexão',
  checkReachableAt: 'Acessível em {endpoint}',
  checkHosts: 'Hosts',
  checkHostsError: 'Não foi possível testar',
  checkPlatform: 'Plataforma',
  cannotReach: 'Não foi possível acessar {endpoint}',
  cannotReachTailscale: 'Não foi possível acessar {endpoint} — verifique o Tailscale',
  // Common issues: push notifications
  notifTitle: 'Notificações push',
  notifStep1:
    'Verifique se as configurações do sistema permitem notificações do Dolphin e se o Foco ou o Não perturbe está desativado.',
  notifStep2:
    'Tente os dados móveis ou outra rede Wi-Fi. Se os alertas chegarem depois da troca, sua rede pode estar atrasando a entrega.',
  // Common issues: different Wi-Fi
  wifiTitle: 'Redes Wi-Fi diferentes',
  wifiStep1:
    'Os dois dispositivos precisam estar na mesma LAN (a menos que conectados pelo Tailscale).',
  wifiStep2: 'Ethernet e Wi-Fi precisam estar na mesma sub-rede.',
  wifiStep3: 'Tente reconectar o Wi-Fi nos dois dispositivos.',
  // Common issues: firewall
  firewallTitle: 'Firewall bloqueando a porta 6768',
  firewallStep1: 'macOS: Ajustes do Sistema → Rede → Firewall — permita o Dolphin.',
  firewallStep2:
    'Windows: Firewall do Defender → Permitir app — ative o Dolphin para redes privadas.',
  firewallStep3: 'Linux: sudo ufw allow 6768',
  firewallStep4: 'Redes corporativas ou de escolas podem bloquear P2P — tente um hotspot pessoal.',
  // Common issues: desktop not running
  desktopTitle: 'O app desktop não está em execução',
  desktopStep1: 'O Dolphin precisa estar aberto no desktop para aceitar conexões.',
  desktopStep2: 'Tente reiniciar o Dolphin — o servidor complementar inicia junto com o app.',
  desktopStep3: 'Depois de uma atualização, talvez seja preciso parear de novo pelo QR code.',
  // Common issues: timeout
  timeoutTitle: 'Tempo de conexão esgotado',
  timeoutStep1: 'Verifique a intensidade do sinal Wi-Fi no celular.',
  timeoutStep2: 'Volte à lista de hosts e toque no seu host para tentar novamente.',
  timeoutStep3: 'Reinicie os dois apps se os tempos esgotados continuarem.',
  // Common issues: Tailscale
  tailscaleTitle: 'Host do Tailscale inacessível',
  tailscaleStep1:
    'Endereços como 100.x.x.x ou *.ts.net conectam pelo Tailscale — mantenha-o ATIVADO.',
  tailscaleStep2:
    'iOS/Android podem travar o túnel sem aviso: desative e ative o Tailscale de novo no app do Tailscale.',
  tailscaleStep3: 'Verifique se o desktop está ativo e aparece como conectado na sua tailnet.',
  tailscaleStep4: 'Atualize o app do Tailscale — versões recentes corrigem bugs de reconexão.',
  // Common issues: other VPNs
  vpnTitle: 'Interferência de outras VPNs',
  vpnStep1: 'VPNs que não são o Tailscale podem rotear o tráfego local por um servidor remoto.',
  vpnStep2: 'Desative essa VPN ou ative o túnel dividido / "Permitir LAN".',
  // Network diagnostics screen
  stateConnecting: 'Conectando',
  stateHandshaking: 'Negociando',
  stateConnected: 'Conectado',
  stateDisconnected: 'Desconectado',
  stateReconnecting: 'Reconectando',
  stateAuthFailed: 'Falha na autenticação',
  stateWithAttempt: '{state} · tentativa {attempt}',
  copied: 'Copiado',
  copyReport: 'Copiar relatório',
  whatThisSuggests: 'O que isso indica',
  sendPrivacyHint:
    'Envia um relatório anonimizado e com tamanho limitado, incluindo nome do host, endpoint, versões, estado da conexão e eventos — nunca o conteúdo do terminal ou credenciais.',
  sending: 'Enviando…',
  diagnosticsSent: 'Diagnóstico enviado',
  retrySending: 'Tentar enviar novamente',
  sendDiagnostics: 'Enviar diagnóstico ao Dolphin',
  noEvents:
    'Ainda não há eventos de conexão. Eles aparecem quando o app tenta se conectar a este host.',
  noPairedHosts: 'Nenhum host pareado.',
  // Connection diagnosis (the shareable report renders these in English)
  causeHealthy: 'A conexão está saudável.',
  causeHealthyVia: 'A conexão via {path} está saudável.',
  nextNoAction: 'Nenhuma ação necessária.',
  pathTailscaleDirect: 'Tailscale/direta',
  pathLanDirect: 'LAN/direta',
  causeBeforeNetworkChange: 'Antes da última mudança de rede: {cause}',
  causeBeforeResume: 'Antes da última retomada do app: {cause}',
  causeRelayCredentialRejected: 'O Relay rejeitou a credencial de retomada salva.',
  nextRelayCredentialRejected:
    'Tente uma conexão direta; se o Relay continuar retornando 401, pareie este dispositivo de novo.',
  causeRelayUnavailable: 'O serviço Relay ficou temporariamente indisponível.',
  causeRelayUnavailableRetry:
    'O serviço Relay ficou temporariamente indisponível e pediu ao Dolphin para tentar de novo em {delay}.',
  nextRelayUnavailable: 'Mantenha o Dolphin aberto; a recuperação deve tentar novamente sozinha.',
  delaySeconds: '{seconds} s',
  delayMinutes: '{minutes} min',
  causeRelayLiveness: 'O Relay parou de responder às verificações de integridade autenticadas.',
  causeHostLiveness:
    'O host conectado parou de responder às verificações de integridade autenticadas.',
  nextLiveness: 'O Dolphin fechou a sessão obsoleta e iniciou a recuperação.',
  causeRelaySessionFailed: 'A sessão ativa do Relay foi encerrada inesperadamente.',
  nextRelaySessionFailed:
    'O Dolphin iniciou a recuperação do Relay; o histórico de eventos inclui o motivo do fechamento da célula.',
  causeAuthRejected: 'O desktop rejeitou este dispositivo durante a autenticação.',
  nextAuthRejected:
    'Confirme que o dispositivo ainda está pareado; pareie de novo se a rejeição se repetir.',
  causeTailscaleTimeout:
    'O endpoint do Tailscale salvo não respondeu antes do tempo limite de conexão.',
  causeDirectTimeout: 'O endpoint direto salvo não respondeu antes do tempo limite de conexão.',
  nextRelayRecoveryInProgress:
    'A recuperação do Relay está em andamento; mantenha o Dolphin aberto enquanto ele tenta novamente.',
  nextCheckNetwork: 'Verifique a rede local/VPN e confirme que o desktop está ativo.',
  causeHandshakeTimeout: 'O endpoint abriu, mas o handshake criptografado do Dolphin não terminou.',
  nextHandshakeTimeout:
    'Confirme que o desktop está com uma versão compatível do Dolphin e tente novamente.',
  causeRelayRecoveryPending:
    'A recuperação pelo Relay foi selecionada, mas ainda não há uma falha mais específica registrada.',
  nextRelayRecoveryPending:
    'Mantenha esta página aberta enquanto o próximo evento de recuperação é registrado.',
  causeUnknown: 'Não é possível determinar uma única causa de falha pelos eventos registrados.',
  nextUnknown:
    'Execute o diagnóstico e copie o relatório novamente após a próxima tentativa de conexão.',
  causeRelayHostOffline:
    'O Relay respondeu, mas o desktop não está conectado a ele (código de fechamento {code}, host offline).',
  nextRelayHostOffline:
    'Verifique se o desktop está ativo, se o Dolphin está em execução e conectado ao Dolphin Cloud.',
  causeRelayCredentialRefused:
    'O Relay recusou a credencial de relay deste dispositivo (código de fechamento {code}).',
  nextRelayCredentialRefused: 'Pareie este celular com o desktop de novo.',
  causeRelayUnreachable:
    'O celular não conseguiu acessar a célula do Relay (fechamento de transporte {code}).',
  nextRelayUnreachable:
    'Verifique a conexão de rede deste celular; a recuperação do Relay tenta novamente sozinha.',
  causeRelayConnecting:
    'O Relay encerrou a conexão com o código {code}; a recuperação resolve de novo e tenta outra vez.',
  nextRelayConnecting: 'Mantenha o Dolphin aberto enquanto a recuperação do Relay tenta novamente.',
  causeRelayDialNoAnswer: 'A conexão com o Relay falhou antes de a célula responder.',
  // Developer and OTA rows
  hybridShellDevelopmentBuild: 'Shell híbrido (build de desenvolvimento)',
  hybridShellOtaBuild: 'Shell híbrido (build OTA)',
  openHybridShell: 'Abrir o shell híbrido do primeiro host pareado',
  workspaceUpdates: 'Atualizações do workspace',
  // Workspace update failures
  updateFailedAgo: 'A última atualização de {host} falhou há {ago}: {reason}.',
  updateFailedJustNow: 'A última atualização de {host} acabou de falhar: {reason}.',
  reasonWithGeneration: '{reason} (geração {generation})',
  outcomeOpenedCached: 'Voltou para a versão salva.',
  outcomeOpenedCachedGeneration: 'Voltou para a versão salva (geração {generation}).',
  outcomeWall: 'O workspace foi bloqueado.',
  outcomeWallReason: 'Bloqueado: {reason}.',
  outcomeNativeRoute: 'A tela nativa foi exibida.',
  outcomeFailed: 'A tela de falha foi exibida.',
  outcomeWaiting: 'Aguardou o host.',
  reasonNoConnection: 'sem conexão com o host',
  reasonConnectionLost: 'a conexão caiu',
  reasonHostRefused: 'o host recusou a leitura',
  reasonReplyUnreadable: 'o host enviou uma resposta que este app não conseguiu ler',
  reasonChunkOversize: 'um bloco era maior do que o host permite',
  reasonAssetOverlong: 'um recurso era maior do que o manifesto declara',
  reasonAssetNoProgress: 'a leitura de um recurso não avançou',
  reasonAssetShort: 'um recurso terminou antes do tamanho declarado',
  reasonAssetChecksumMismatch: 'checksum do recurso não confere',
  reasonBuildChangedMidFetch: 'o build do host mudou durante o download',
  reasonChunkMisrouted: 'um bloco respondeu ao recurso ou deslocamento errado',
  reasonAssetEntryChanged: 'um recurso não correspondia mais ao manifesto',
  reasonRangeUndecodable: 'uma leitura compactada não pôde ser decodificada',
  reasonFetchStopped: 'o download foi interrompido',
  reasonCacheWriteFailed: 'falha ao salvar o download neste celular',
  reasonUnrecognisedError: 'um erro não reconhecido',
  hostCodeUnavailable: 'o host não tem pacote de workspace',
  hostCodeBuildChanged: 'o build do host mudou durante o download',
  hostCodeAssetUnknown: 'o host não reconheceu um recurso',
  hostCodeAssetChanged: 'um recurso mudou no host',
  hostCodeOffsetInvalid: 'o host recusou um deslocamento de leitura',
  hostCodeReadLimited: 'o host limitou leituras simultâneas',
  wallBundleUnavailable: 'o host não tem pacote de workspace',
  wallBundleShellTooOld: 'este app é antigo demais para o pacote salvo',
  wallHostTooOldForBundle: 'o host é antigo demais para o pacote salvo',
  wallBundleTooOldForHost: 'o pacote salvo é antigo demais para o host'
}
