import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { tasksWorkspaceEn } from './en'

export const tasksWorkspaceZh: MobileLocaleMessages<typeof tasksWorkspaceEn> = {
  // Setup hooks source
  setupSourceLegacy: '本地钩子',
  setupSourceRepository: '仓库钩子',

  // Workspace create drawer
  selectRepository: '选择仓库',
  sshConnection: 'SSH 连接',
  remoteRepository: '远程仓库',
  connecting: '正在连接...',
  workspaceName: '工作区名称',
  optionalHint: '[可选]',
  agent: '智能体',
  connectRepositoryFirst: '请先连接仓库',
  detectingAgents: '正在检测智能体...',
  advanced: '高级',
  startFrom: '起始位置',
  defaultBranch: '默认分支',
  createFromRef: '从 {ref} 创建',
  linearWorkspaceNeedsRepository: '请先添加 Git 仓库，再创建 Linear 工作区。',
  repositoryNotFound: '未找到仓库。',
  connectRepository: '连接仓库',

  // Workspace option pickers
  startFromTitle: '起始位置',
  startFromSubtitle: '选择一个现有分支或引用。',
  searchBranches: '搜索分支',
  defaultBranchSubtitle: '使用此仓库配置的基础分支',
  noBranchesMatch: '没有匹配的分支。',
  branchNameLabel: '分支名称：{branch}',
  sparseCheckoutTitle: '稀疏检出',
  fullCheckout: '完整检出',
  fullCheckoutSubtitle: '使用整个仓库',
  editPresetLabel: '编辑 {name}',
  newPreset: '新建预设',

  // Sparse presets and setup trust
  newSparsePreset: '新建稀疏预设',
  editSparsePreset: '编辑稀疏预设',
  presetName: '名称',
  presetDirectories: '目录',
  directoryCount: { one: '{count} 个目录', other: '{count} 个目录' },
  runSetupScriptTitle: '运行设置脚本？',
  setupChoiceRequired: '创建此工作区前，需要为 {repo} 选择设置方式。',
  runSetupAndCreate: '运行设置并创建',
  skipSetupAndCreate: '跳过设置并创建',
  setupScriptChanged: '{repo} 的设置脚本已更改',
  runSetupFrom: '运行 {repo} 的设置？',
  setupTrustWarning:
    '此仓库的 dolphin.yaml 会在工作区启动前在你的计算机上运行。请仅在信任此仓库时运行。',
  newSetupScript: '新的设置脚本',
  setupScript: '设置脚本',
  trustSetupScriptError: '信任设置脚本失败。',
  runHooks: '运行钩子',
  alwaysTrustAndRun: '始终信任并运行',
  dontRun: '不运行',

  // Workspace create operations
  sshConnected: '已连接',
  sshConnecting: '正在连接',
  sshDeployingRelay: '正在部署中继',
  sshReconnecting: '正在重新连接',
  sshAuthFailed: '身份验证失败',
  sshReconnectFailed: '重新连接失败',
  sshConnectionFailed: '连接失败',
  sshDisconnected: '已断开连接',
  agentLaunchUnsupportedWarning: '工作区已创建，但这台电脑无法从手机启动智能体。',
  agentLaunchFailedWarning: '工作区已创建，但智能体未能启动：{reason}',
  searchFailed: '搜索失败',
  sparseDirectoriesInvalid: '请使用相对于仓库的目录，不要使用根目录、绝对路径或父级路径段。',
  sparseDirectoriesEmpty: '请至少添加一个目录。',
  unknownError: '未知错误',
  createWorkspaceError: '创建工作区失败',

  // Smart workspace source modes
  smartModeSmart: '智能',
  smartModeBranch: '分支',
  smartModeName: '名称',

  // Action errors
  resolveBaseBranchError: '解析基础分支失败。',
  agentDisabled: '所选智能体已禁用。请在创建前选择一个已启用的智能体。',
  nameRequired: '名称为必填项。',
  openShellSubtitle: '打开一个 shell',
  sparsePresetsLoadError: '加载稀疏预设失败。',
  branchSearchError: '搜索分支失败。',
  sparsePresetSaveError: '保存稀疏预设失败。',
  sshStateReadError: '读取 SSH 连接状态失败。',
  sshConnectError: '连接 SSH 仓库失败。',
  connectRepoBeforeWorkspace: '请先连接 {repo}，再创建工作区。',
  nameTooLong: '名称不能超过 80 个字符。',
  nameAlreadyExists: '“{name}”已存在。',
  blankTerminal: '空白终端'
}
