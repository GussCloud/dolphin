import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { mobileWebShellEn } from './en'

export const mobileWebShellPtBR: MobileLocaleMessages<typeof mobileWebShellEn> = {
  // Waiting and progress
  opening: 'Abrindo workspace',
  checkingHost: 'Verificando host',
  downloading: 'Baixando workspace',
  downloadProgress: '{completedAssets}/{totalAssets} arquivos · {receivedBytes}/{totalBytes} bytes',
  offline: 'Conecte-se a este host para baixar o workspace',
  loading: 'Carregando',
  // Failures
  failureIsolationUnavailable:
    'O WebView deste dispositivo é antigo demais para abrir o workspace com segurança.',
  failureDownload: 'Não foi possível baixar o workspace deste host.',
  failureStatusUnreadable: 'Não foi possível ler o status deste host. Volte e abra-o de novo.',
  failureStoppedResponding: 'O workspace parou de responder.',
  failureCouldNotOpen: 'Não foi possível abrir o workspace baixado.',
  tryAgain: 'Tentar novamente',
  updateFailedNotice:
    'Não foi possível atualizar o workspace deste host. Mostrando a última versão que funcionou.',
  requestOversized:
    'Esta ação envia dados demais de uma vez para chegar ao Dolphin. Tente com menos arquivos.',
  // Unavailable route
  routeUnavailable: 'Esta tela do workspace não está disponível neste host.',
  backToHosts: 'Voltar aos hosts',
  backToWorkspaces: 'Voltar aos workspaces'
}
