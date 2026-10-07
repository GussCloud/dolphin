import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { browserEn } from './en'

export const browserZh: MobileLocaleMessages<typeof browserEn> = {
  // Toolbar
  back: '后退',
  forward: '前进',
  reload: '重新加载',
  urlPlaceholder: '网址',
  showWebView: '显示网页版网站视图',
  showMobileView: '显示移动版网站视图',
  // Keyboard dock
  clickModifier: '{key} 点击修饰键',
  typeOnPage: '在页面上输入…',
  sendText: '将文本发送到浏览器',
  sent: '已发送',
  rightClick: '右键点击',
  // Page dialogs
  dialogTitle: '浏览器对话框',
  dialogFallback: '浏览器对话框',
  cancel: '取消',
  ok: '确定',
  dialogAnswerFailed: '该回应未送达页面。',
  // Errors
  invalidUrl: '请输入有效的网址。',
  streamFailed: '浏览器流失败。',
  commandFailed: '浏览器命令失败',
  updateAppForStreaming: '请更新 Dolphin 应用以在此处串流浏览器标签页。',
  updateDesktopForStreaming: '请更新桌面端 Dolphin 以在移动端串流浏览器标签页。',
  checkingStreamingSupport: '正在检查桌面端浏览器串流支持。',
  pageNotAvailable: '浏览器页面尚不可用。',
  streamTimedOut: '浏览器流超时。'
}
