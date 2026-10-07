import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { filesEn } from './en'

export const filesEs: MobileLocaleMessages<typeof filesEn> = {
  // Explorer
  title: 'Archivos',
  worktreeShowingFirst: '{worktree} - Se muestran los primeros {count}',
  closeFiles: 'Cerrar archivos',
  backToSession: 'Volver a la sesión',
  retry: 'Reintentar',
  noFilesFound: 'No se encontraron archivos',
  unableToLoadFiles: 'No se pudieron cargar los archivos',
  connectingToDesktop: 'Conectando con el escritorio...',
  waitingForDesktop: 'Esperando al escritorio...',
  loading: 'Cargando...',
  unableToLoadFolder: 'No se pudo cargar la carpeta',
  retryLoadingA11y: 'Reintentar cargar {path}',
  openFolderA11y: 'Abrir carpeta {name}',
  previewFileA11y: 'Vista previa del archivo {name}',
  unavailableOnMobileA11y: '{name} no está disponible en el móvil',
  unavailableOnMobile: 'No disponible en el móvil',

  // Preview
  preview: 'Vista previa',
  file: 'Archivo',
  backToFiles: 'Volver a los archivos',
  saveArtifactA11y: 'Guardar artefacto de terminal',
  discardChangesTitle: '¿Descartar cambios?',
  unsavedEditsLost: 'Se perderán las ediciones no guardadas.',
  discard: 'Descartar',
  stay: 'Quedarse',
  loadingPreview: 'Cargando vista previa...',
  emptyFile: 'Archivo vacío',
  imageA11y: 'Imagen {title}',
  editorA11y: 'Editor de {title}',
  filePreviewA11y: 'Vista previa del archivo',
  viewMarkdownSourceA11y: 'Ver el código fuente Markdown',
  viewRenderedMarkdownA11y: 'Ver la vista previa renderizada de Markdown',
  previewTruncated: 'Vista previa truncada. Tamaño del archivo: {size}.',
  unknownSize: 'tamaño desconocido',

  // Preview errors
  unableToLoadPreview: 'No se pudo cargar la vista previa',
  unableToSaveFile: 'No se pudo guardar el archivo',
  binaryPreviewUnavailable: 'Vista previa binaria no disponible',
  fileTooLarge: 'Archivo demasiado grande para la vista previa móvil',
  reloadBeforeSaving: 'Recarga la vista previa antes de guardar',
  unableToReachFilesystem: 'No se pudo acceder al sistema de archivos del escritorio',
  fileNotFound: 'Archivo no encontrado',
  fileChangedOnDesktop:
    'El archivo cambió en el escritorio. Recarga la vista previa antes de guardar',
  sshOwnerChanged: 'No se pudo verificar la conexión SSH. Reconecta el host y vuelve a intentarlo.'
}
