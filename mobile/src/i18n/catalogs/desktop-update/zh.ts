import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { desktopUpdateEn } from './en'

export const desktopUpdateZh: MobileLocaleMessages<typeof desktopUpdateEn> = {
  // Host card tag
  tagAvailable: '有可用更新',
  tagReady: '更新已就绪',
  tagManual: '有可用更新 · 请在桌面端安装',
  tagStarting: '正在开始更新…',
  tagDownloading: '正在下载 {percent}%',
  tagInstalling: '正在重启桌面端…',
  tagFailed: '更新失败 · 重试',
  // Install confirmation
  confirmInstallVersion: '要在“{hostName}”上安装 Dolphin {version} 吗？Dolphin 将在该桌面端重启。',
  confirmInstallLatest: '要在“{hostName}”上安装最新版 Dolphin 吗？Dolphin 将在该桌面端重启。',
  confirmLastAttemptFailed: '上次尝试失败：{message}',
  // Errors
  errorRestartedOnOlder: '桌面端以 {installedVersion} 重启；{targetVersion} 未安装。',
  errorManualRequired: '此桌面端需要手动更新。',
  errorNotAvailable: '桌面端不再报告有可用更新。',
  errorNotDownloaded: '更新尚未在桌面端下载完成。',
  errorUpdaterTimeout: '等待桌面端更新程序超时。'
}
