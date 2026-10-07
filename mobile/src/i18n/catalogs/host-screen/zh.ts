import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostScreenEn } from './en'

export const hostScreenZh: MobileLocaleMessages<typeof hostScreenEn> = {
  // Shared
  cancel: '取消',
  delete: '删除',
  remove: '移除',
  accounts: '账户',
  tasks: '任务',
  // Header
  backToHosts: '返回主机列表',
  reconnect: '重新连接',
  floatingWorkspace: '浮动工作区',
  hideSidebar: '隐藏侧边栏',
  newWorkspace: '新建工作区',
  closeSearch: '关闭搜索',
  searchWorkspaces: '搜索工作区',
  // Toolbar
  filter: '筛选',
  filterWithCount: '筛选 {count}',
  filterWithCountParens: '筛选（{count}）',
  filterWorkspaces: '筛选工作区',
  filterWorkspacesActive: {
    one: '筛选工作区，{count} 个已启用',
    other: '筛选工作区，{count} 个已启用'
  },
  sortBy: '排序方式：{label}',
  groupWorkspaces: '分组工作区',
  group: '分组',
  groupStatusShort: '状态',
  groupRepoShort: '仓库',
  groupPrShort: 'PR',
  // Pickers and filters
  sortByTitle: '排序方式',
  groupByTitle: '分组方式',
  clearFilters: '清除筛选',
  filterWorkspacesSection: '工作区',
  hideSleeping: '隐藏休眠的',
  hideDefaultBranch: '隐藏默认分支',
  filterRepositoriesSection: '仓库',
  searchWorktreesPlaceholder: '搜索工作树…',
  searchWorktrees: '搜索工作树',
  // Worktree actions
  sleep: '休眠',
  pin: '固定',
  unpin: '取消固定',
  deleteWorktreeTitle: '删除工作树',
  deleteWorktreeMessage: '删除“{name}”（{branch}）？',
  // Host
  removeHostTitle: '移除主机',
  removeHostMessage: '移除“{name}”？你可以稍后重新配对。',
  removeHostError: '无法移除主机，请重试。',
  hostNotFound: '未找到主机'
}
