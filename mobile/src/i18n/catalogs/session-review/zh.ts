import type { MobileLocaleMessages } from '../../mobile-i18n-catalog'
import type { sessionReviewEn } from './en'

export const sessionReviewZh: MobileLocaleMessages<typeof sessionReviewEn> = {
  committedChangesUnavailable: '已提交的更改不可用',
  committedChangesFailed: '加载已提交的更改失败',
  updateDesktopToReview: '请更新 Dolphin 桌面版以在移动端审查更改。',
  loadChangesFailed: '无法加载更改',
  sourceControlResponseInvalid: '源代码管理响应无效',
  loadReviewNotesFailed: '无法加载审查备注',
  loadDiffFailed: '无法加载差异',
  committedDiffUnavailable: '已提交的差异不可用',

  scopeBranch: '分支',
  scopeStaged: '已暂存',
  scopeUnstaged: '未暂存',
  committedOnBranch: '已在分支上提交',

  waitingForDesktop: '正在等待桌面...',
  sourceControlActionFailed: '源代码管理操作失败',
  stagedWithFailures: '已暂存 {staged} 个，失败 {failed} 个',
  reviewedFilesStaged: {
    one: '已暂存 {count} 个已审查的文件',
    other: '已暂存 {count} 个已审查的文件'
  },
  saveReviewStateFailed: '无法保存审查状态',
  saveReviewFailed: '无法保存审查',
  missingWorktree: '缺少工作树',
  loadReviewFailed: '无法加载审查',
  openInSessionFailed: '无法在会话中打开',
  copyReviewNotesFailed: '无法复制审查备注',
  reviewNotesCopied: '审查备注已复制',
  sendNotesFailed: '无法发送备注',
  terminalInputLocked: '终端输入已锁定',
  reviewNotesSent: '审查备注已发送',
  createTerminalFailed: '无法创建终端',
  loadAgentSessionsFailed: '无法加载智能体会话',

  requestFailed: '请求失败：{method}',
  refreshPullRequestFailed: '无法刷新拉取请求。',
  mergePullRequestFailed: '无法合并拉取请求。',
  notConnected: '未连接',
  notConnectedToDesktop: '未连接到桌面。',
  waitingForDesktopEllipsis: '正在等待桌面…',
  launchAgentFailed: '无法启动智能体',
  commentActionFailed: '评论操作失败',
  updateTitleFailed: '无法更新标题。',
  updateReviewThreadFailed: '无法更新审查讨论串。',
  loadPullRequestFailed: '无法加载拉取请求',
  sendPromptFailed: '无法发送提示词',

  sendResumeCommandFailed: '无法发送恢复命令',
  prepareLegacyCodexFailed: '无法准备此旧版 Codex 会话。请重试恢复。'
}
