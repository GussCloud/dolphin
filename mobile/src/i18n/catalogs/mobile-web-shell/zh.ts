import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { mobileWebShellEn } from './en'

export const mobileWebShellZh: MobileLocaleMessages<typeof mobileWebShellEn> = {
  // Waiting and progress
  opening: '正在打开工作区',
  checkingHost: '正在检查主机',
  downloading: '正在下载工作区',
  downloadProgress: '{completedAssets}/{totalAssets} 个文件 · {receivedBytes}/{totalBytes} 字节',
  offline: '连接到此主机以下载工作区',
  loading: '正在加载',
  // Failures
  failureIsolationUnavailable: '此设备的 WebView 版本过旧，无法安全打开工作区。',
  failureDownload: '无法从此主机下载工作区。',
  failureStatusUnreadable: '无法读取此主机的状态。请返回并重新打开。',
  failureStoppedResponding: '工作区已停止响应。',
  failureCouldNotOpen: '无法打开已下载的工作区。',
  tryAgain: '重试',
  updateFailedNotice: '无法从此主机更新工作区。正在显示上一个可用的版本。',
  requestOversized: '此操作一次发送的数据过多，无法送达 Dolphin。请减少文件数量后重试。',
  // Unavailable route
  routeUnavailable: '此主机上无法使用该工作区界面。',
  backToHosts: '返回主机列表',
  backToWorkspaces: '返回工作区列表'
}
