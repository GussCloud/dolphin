import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { filesEn } from './en'

export const filesPtBR: MobileLocaleMessages<typeof filesEn> = {
  // Explorer
  title: 'Arquivos',
  worktreeShowingFirst: '{worktree} - Mostrando os primeiros {count}',
  closeFiles: 'Fechar arquivos',
  backToSession: 'Voltar para a sessão',
  retry: 'Tentar novamente',
  noFilesFound: 'Nenhum arquivo encontrado',
  unableToLoadFiles: 'Não foi possível carregar os arquivos',
  connectingToDesktop: 'Conectando ao desktop...',
  waitingForDesktop: 'Aguardando o desktop...',
  loading: 'Carregando...',
  unableToLoadFolder: 'Não foi possível carregar a pasta',
  retryLoadingA11y: 'Tentar carregar {path} novamente',
  openFolderA11y: 'Abrir pasta {name}',
  previewFileA11y: 'Visualizar arquivo {name}',
  unavailableOnMobileA11y: '{name} indisponível no celular',
  unavailableOnMobile: 'Indisponível no celular',

  // Preview
  preview: 'Prévia',
  file: 'Arquivo',
  backToFiles: 'Voltar para os arquivos',
  saveArtifactA11y: 'Salvar artefato do terminal',
  discardChangesTitle: 'Descartar alterações?',
  unsavedEditsLost: 'As edições não salvas serão perdidas.',
  discard: 'Descartar',
  stay: 'Ficar',
  loadingPreview: 'Carregando prévia...',
  emptyFile: 'Arquivo vazio',
  imageA11y: 'Imagem {title}',
  editorA11y: 'Editor de {title}',
  filePreviewA11y: 'Prévia do arquivo',
  viewMarkdownSourceA11y: 'Ver código-fonte Markdown',
  viewRenderedMarkdownA11y: 'Ver prévia renderizada do Markdown',
  previewTruncated: 'Prévia truncada. Tamanho do arquivo: {size}.',
  unknownSize: 'tamanho desconhecido',

  // Preview errors
  unableToLoadPreview: 'Não foi possível carregar a prévia',
  unableToSaveFile: 'Não foi possível salvar o arquivo',
  binaryPreviewUnavailable: 'Prévia de arquivo binário indisponível',
  fileTooLarge: 'Arquivo grande demais para a prévia no celular',
  reloadBeforeSaving: 'Recarregue a prévia antes de salvar',
  unableToReachFilesystem: 'Não foi possível acessar o sistema de arquivos do desktop',
  fileNotFound: 'Arquivo não encontrado',
  fileChangedOnDesktop: 'O arquivo mudou no desktop. Recarregue a prévia antes de salvar',
  sshOwnerChanged: 'Não foi possível verificar a conexão SSH. Reconecte o host e tente novamente.'
}
