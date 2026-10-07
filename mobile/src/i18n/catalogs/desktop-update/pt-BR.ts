import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { desktopUpdateEn } from './en'

export const desktopUpdatePtBR: MobileLocaleMessages<typeof desktopUpdateEn> = {
  // Host card tag
  tagAvailable: 'Atualização disponível',
  tagReady: 'Atualização pronta',
  tagManual: 'Atualização disponível · Instale no desktop',
  tagStarting: 'Iniciando atualização…',
  tagDownloading: 'Baixando {percent}%',
  tagInstalling: 'Reiniciando desktop…',
  tagFailed: 'Falha na atualização · Tentar novamente',
  // Install confirmation
  confirmInstallVersion:
    'Instalar o Dolphin {version} em "{hostName}"? O Dolphin será reiniciado nesse desktop.',
  confirmInstallLatest:
    'Instalar a versão mais recente do Dolphin em "{hostName}"? O Dolphin será reiniciado nesse desktop.',
  confirmLastAttemptFailed: 'A última tentativa falhou: {message}',
  // Errors
  errorRestartedOnOlder:
    'O desktop reiniciou na {installedVersion}; a {targetVersion} não foi instalada.',
  errorManualRequired: 'Este desktop precisa ser atualizado manualmente.',
  errorNotAvailable: 'O desktop não informa mais uma atualização disponível.',
  errorNotDownloaded: 'A atualização ainda não terminou de baixar no desktop.',
  errorUpdaterTimeout: 'Tempo esgotado aguardando o atualizador do desktop.'
}
