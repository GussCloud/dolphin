import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { agentHistoryEn } from './en'

export const agentHistoryZh: MobileLocaleMessages<typeof agentHistoryEn> = {
  // Screen chrome
  title: '智能体会话历史',
  back: '返回',
  refresh: '刷新智能体会话',
  retry: '重试',
  sourceControl: '源代码管理',
  // Scope tabs and search
  scopeWorkspace: '工作区',
  scopeProject: '项目',
  scopeAll: '全部',
  searchPlaceholder: '搜索会话、repo:、path:',
  transcriptsSkipped: { one: '已跳过 {count} 个记录', other: '已跳过 {count} 个记录' },
  // States
  unavailableTitle: '智能体会话历史不可用',
  unavailableBody: '请在此主机上更新 Dolphin 以浏览智能体会话历史。',
  loadErrorTitle: '无法加载',
  emptyTitle: '没有智能体会话',
  emptySearch: '没有与搜索匹配的会话。',
  emptyScope: '此范围内没有过往智能体会话。',
  waitingForHost: '正在等待主机…',
  hostUnreachable: '无法连接主机',
  sessionsLoadError: '无法加载智能体会话',
  // Session cards
  untitledSession: '未命名会话',
  messageCount: { one: '{count} 条消息', other: '{count} 条消息' },
  currentWorktree: '当前工作树',
  resumeSession: '恢复智能体会话',
  // Resume
  missingResumeId: '此会话缺少恢复 ID。',
  unknownHostPlatform: '无法确定主机平台。',
  sessionQueued: '智能体会话已加入队列。',
  resumeFailed: '恢复会话失败。',
  workspaceMetadataError: '无法加载工作区元数据。',
  blockedRuntime: '运行时托管的工作区不支持从历史记录恢复。',
  blockedSsh: '此会话保存在主机上，因此无法在 SSH 工作区中恢复。请为此项目打开一个本地工作区。',
  blockedNoLocal: '恢复会话前请先打开本地工作区。'
}
