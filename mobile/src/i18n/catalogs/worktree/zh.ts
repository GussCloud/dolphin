import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { worktreeEn } from './en'

export const worktreeZh: MobileLocaleMessages<typeof worktreeEn> = {
  // Agent states (mirror desktop agentStateLabel)
  agentWorking: '工作中',
  agentMonitoring: '监控后台任务',
  agentBlocked: '已阻塞',
  agentWaiting: '等待输入',
  agentInterrupted: '已中断',
  agentDone: '完成',
  agentIdle: '空闲',
  agentUnverifiable: '无法确认',
  teammate: '队友',
  // Host card summary
  worktreeListUnavailable: '工作树列表不可用',
  worktreeCount: { one: '{count} 个工作树', other: '{count} 个工作树' },
  worktreeCountWithActive: '{worktrees} · {active} 个活跃',
  lastKnown: '最近已知：{summary}',
  // Workspace list states
  catalogLoadError: '无法从此主机加载工作区',
  catalogLoadErrorDetail: '{command} 失败（{error}）— 正在自动重试',
  emptySearch: '没有匹配的工作树',
  emptyFiltered: '没有符合筛选条件的工作树',
  empty: '没有工作树',
  // Sections
  sectionPinned: '已固定',
  sectionAll: '全部',
  prGroupDone: '完成',
  prGroupInReview: '审核中',
  prGroupInProgress: '进行中',
  prGroupClosed: '已关闭',
  // Sort and group pickers
  sortSmart: '智能体活动',
  sortSmartSubtitle: '先显示需要关注的智能体，再按最近活动',
  sortName: '名称',
  sortNameSubtitle: '按名称字母顺序',
  sortRecent: '最近',
  sortRecentSubtitle: '最新输出优先',
  sortRepo: '仓库',
  sortRepoSubtitle: '先按仓库，再按工作区名称',
  sortManual: '手动',
  sortManualSubtitle: '服务器顺序',
  groupNone: '不分组',
  groupStatus: '状态',
  groupRepository: '仓库',
  groupPrStatus: 'PR 状态',
  // Relative time (desktop formatTimeAgo thresholds)
  timeJustNow: '刚刚',
  timeMinutes: '{minutes}分钟',
  timeHours: '{hours}小时',
  timeDays: '{days}天'
}
