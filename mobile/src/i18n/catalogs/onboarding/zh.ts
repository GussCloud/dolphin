import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { onboardingEn } from './en'

export const onboardingZh: MobileLocaleMessages<typeof onboardingEn> = {
  // Session view step
  sessionViewTitle: '会话应如何打开？',
  sessionViewBody:
    '选择受支持的智能体会话在此设备上以终端还是 Chat UI 打开。长按会话标签页可切换其视图，也可以稍后在设置中更改默认值。',
  useChatUi: '使用 Chat UI',
  useChatUiA11y: '在 Chat UI 中打开会话',
  keepTerminal: '保留终端',
  keepTerminalA11y: '在终端中打开会话',
  // Notifications step
  notificationsTitle: '不错过智能体需要你的时刻',
  notificationsBody: '当智能体完成或等待时，在这部手机上收到通知——即使你没有在使用应用。',
  notificationsDisclosure: '在桌面端空闲 3 分钟后通过 Dolphin 推送服务发送。可随时在设置中更改。',
  enableNotifications: '启用通知',
  enableNotificationsA11y: '启用智能体通知',
  notNow: '暂不',
  notNowA11y: '暂时跳过通知',
  // Sample notification banners
  sampleNow: '现在',
  sampleCodexTitle: 'Codex 已完成',
  sampleCodexBody: '测试已通过。',
  sampleClaudeTitle: 'Claude 需要输入',
  sampleClaudeBody: '正在等你。'
}
