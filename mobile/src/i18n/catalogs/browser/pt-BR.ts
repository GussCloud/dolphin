import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { browserEn } from './en'

export const browserPtBR: MobileLocaleMessages<typeof browserEn> = {
  // Toolbar
  back: 'Voltar',
  forward: 'Avançar',
  reload: 'Recarregar',
  urlPlaceholder: 'URL',
  showWebView: 'Mostrar a versão web do site',
  showMobileView: 'Mostrar a versão móvel do site',
  // Keyboard dock
  clickModifier: 'Modificador de clique {key}',
  typeOnPage: 'Digite na página…',
  sendText: 'Enviar texto ao navegador',
  sent: 'Enviado',
  rightClick: 'Clique direito',
  // Page dialogs
  dialogTitle: 'Caixa de diálogo do navegador',
  dialogFallback: 'Caixa de diálogo do navegador',
  cancel: 'Cancelar',
  ok: 'OK',
  dialogAnswerFailed: 'Essa resposta não chegou à página.',
  // Errors
  invalidUrl: 'Digite uma URL válida.',
  streamFailed: 'Falha na transmissão do navegador.',
  commandFailed: 'Falha no comando do navegador',
  updateAppForStreaming: 'Atualize o app Dolphin para transmitir abas do navegador aqui.',
  updateDesktopForStreaming:
    'Atualize o Dolphin no desktop para transmitir abas do navegador no celular.',
  checkingStreamingSupport: 'Verificando o suporte a transmissão do navegador no desktop.',
  pageNotAvailable: 'A página do navegador ainda não está disponível.',
  streamTimedOut: 'A transmissão do navegador expirou.'
}
