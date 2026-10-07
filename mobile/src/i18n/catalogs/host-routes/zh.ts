import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { hostRoutesEn } from './en'

export const hostRoutesZh: MobileLocaleMessages<typeof hostRoutesEn> = {
  // Route titles
  routeHost: '主机',
  routeAccounts: '账户',
  routeTasks: '任务',
  routeTerminal: '终端',
  routeSourceControl: '源代码管理',
  routeAgentHistory: '代理会话历史',
  routeChanges: '更改',
  routePullRequest: 'PR',
  routeWorkspace: '工作区',

  // Edit host
  editHost: '编辑主机',
  back: '返回',
  save: '保存',
  saveHostA11y: '保存主机',
  goBack: '返回',
  missingHost: '缺少主机。',
  hostRemoved: '此主机已从这台手机中移除。',
  failedToLoadHost: '加载主机失败。',
  failedToSaveHost: '保存主机失败。',
  editHelp:
    '更改显示名称或连接地址。名称留空则使用桌面端报告的名称。修改地址只会改变这台手机的连接目标，不会重新配对。当同一台桌面端可通过不同 IP 访问时使用（例如家庭局域网与 Tailscale）。',
  name: '名称',
  hostNamePlaceholder: '主机名称',
  address: '地址',
  addressHint: '支持 IP、host:port 或 ws:// / wss://。未填写端口时使用当前端口（或 6768）。',
  connectsTo: '连接到 {endpoint}',

  // Accounts
  accounts: '账户',
  invalidSnapshot: '主机返回的账户数据无效',
  hostNotFound: '未找到主机',
  couldNotSwitchAccount: '无法切换账户',
  systemDefault: '系统默认',
  useAgentLogin: '使用代理自身的登录',
  connectingToHost: '正在连接 {host}…',
  connectingToHostGeneric: '正在连接主机…',
  loadingAccounts: '正在加载账户…',
  addAccountsHint: '请在桌面端的“设置 → 账户”中添加账户或重新验证。'
}
