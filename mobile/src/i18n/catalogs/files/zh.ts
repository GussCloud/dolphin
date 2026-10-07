import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { filesEn } from './en'

export const filesZh: MobileLocaleMessages<typeof filesEn> = {
  // Explorer
  title: '文件',
  worktreeShowingFirst: '{worktree} - 仅显示前 {count} 个',
  closeFiles: '关闭文件',
  backToSession: '返回会话',
  retry: '重试',
  noFilesFound: '未找到文件',
  unableToLoadFiles: '无法加载文件',
  connectingToDesktop: '正在连接桌面端...',
  waitingForDesktop: '正在等待桌面端...',
  loading: '加载中...',
  unableToLoadFolder: '无法加载文件夹',
  retryLoadingA11y: '重新加载 {path}',
  openFolderA11y: '打开文件夹 {name}',
  previewFileA11y: '预览文件 {name}',
  unavailableOnMobileA11y: '{name} 在手机上不可用',
  unavailableOnMobile: '手机上不可用',

  // Preview
  preview: '预览',
  file: '文件',
  backToFiles: '返回文件',
  saveArtifactA11y: '保存终端产物',
  discardChangesTitle: '放弃更改？',
  unsavedEditsLost: '未保存的编辑将会丢失。',
  discard: '放弃',
  stay: '留下',
  loadingPreview: '正在加载预览...',
  emptyFile: '空文件',
  imageA11y: '{title} 图片',
  editorA11y: '{title} 编辑器',
  filePreviewA11y: '文件预览',
  viewMarkdownSourceA11y: '查看 Markdown 源码',
  viewRenderedMarkdownA11y: '查看渲染后的 Markdown 预览',
  previewTruncated: '预览已截断。文件大小：{size}。',
  unknownSize: '未知大小',

  // Preview errors
  unableToLoadPreview: '无法加载预览',
  unableToSaveFile: '无法保存文件',
  binaryPreviewUnavailable: '无法预览二进制文件',
  fileTooLarge: '文件过大，无法在手机上预览',
  reloadBeforeSaving: '请先重新加载预览再保存',
  unableToReachFilesystem: '无法访问桌面端文件系统',
  fileNotFound: '未找到文件',
  fileChangedOnDesktop: '文件已在桌面端更改。请先重新加载预览再保存',
  sshOwnerChanged: '无法验证 SSH 连接。请重新连接主机后重试。'
}
