import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { homeEn } from './en'

export const homeZh: MobileLocaleMessages<typeof homeEn> = {
  // Shared
  pleaseTryAgain: '请重试。',
  remove: '移除',
  update: '更新',
  tasks: '任务',
  openSettings: '打开设置',
  // Host actions
  checkPairingErrorTitle: '无法检查配对',
  removeHostErrorTitle: '无法移除主机',
  removeHostTitle: '移除主机',
  removeHostMessage: '移除“{name}”？你可以稍后重新配对。',
  updateDesktopTitle: '更新桌面端',
  // Empty state
  emptyTitle: '连接你的桌面端',
  emptyBody: '与电脑上的 Dolphin 配对，即可查看智能体状态、进入任意终端，并在手机上推进工作。',
  pairDesktop: '配对桌面端',
  howItWorks: '使用方式',
  stepOpenDesktopTitle: '打开 Dolphin 桌面端',
  stepOpenDesktopDesc: '前往 设置 → 移动端，生成配对二维码。',
  stepScanTitle: '扫描二维码',
  stepScanDesc: '点按上方按钮打开扫描器，对准屏幕上的二维码。',
  stepConnectedTitle: '已连接',
  stepConnectedDesc: '你的桌面端会显示在这里。所有内容均为端到端加密。',
  // List header and footer
  welcomeBack: '欢迎回来',
  statAgentsSpawned: '已启动智能体',
  statAgentTime: '智能体时长',
  statPRsCreated: '已创建 PR',
  durationDaysHours: '{days}天 {hours}小时',
  durationHoursMinutes: '{hours}小时 {minutes}分钟',
  durationMinutes: '{minutes}分钟',
  desktops: '桌面端',
  resume: '继续',
  accountUsage: '账户用量',
  systemDefaultAccount: '系统默认',
  noTaskSources: '未连接任务来源',
  openProviderTasks: '打开 {provider} 任务'
}
