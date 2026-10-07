import { type ReactNode, View, Text } from './mobile-tasks-dependencies'
import { COMMENT_REACTION_EMOJI } from './mobile-tasks-options'
import type { DetailCommentGroup } from './mobile-tasks-view-state-types'
import type { TaskItem } from './mobile-tasks-project-workspace-types'
import type { DetailComment } from './mobile-tasks-provider-detail-types'
import { styles } from './mobile-tasks-legacy-styles'
import { translateTasks as t } from './tasks-translate'

export function taskKindLabel(item: TaskItem): string {
  if (item.provider === 'github') {
    return item.source.type === 'pr' ? t('pullRequest') : t('issue')
  }
  if (item.provider === 'gitlab') {
    return item.source.type === 'mr' ? t('mergeRequest') : t('issue')
  }
  if (item.provider === 'gitlabTodo') {
    if (item.source.targetType === 'MergeRequest') {
      return t('mergeRequestTodo')
    }
    return item.source.targetType === 'Issue' ? t('issueTodo') : t('gitlabTodo')
  }
  return t('linearTicket')
}

export function taskExternalOpenLabel(item: TaskItem): string {
  if (item.provider === 'github') {
    return t('openInGitHub')
  }
  if (item.provider === 'gitlab' || item.provider === 'gitlabTodo') {
    return t('openInGitLab')
  }
  return t('openInLinear')
}

export function taskStatusActionLabel(item: TaskItem): string {
  if (item.provider !== 'github' && item.provider !== 'gitlab') {
    return ''
  }
  const reopen = item.source.state === 'closed'
  if (item.source.type === 'pr') {
    return reopen ? t('reopenPullRequestAction') : t('closePullRequestAction')
  }
  if (item.source.type === 'mr') {
    return reopen ? t('reopenMergeRequestAction') : t('closeMergeRequestAction')
  }
  return reopen ? t('reopenIssueAction') : t('closeIssueAction')
}

export function isGitHubPrMergeBlocked(item: Extract<TaskItem, { provider: 'github' }>): boolean {
  return item.source.type === 'pr' && item.source.mergeable === 'CONFLICTING'
}

export function commentAuthor(comment: DetailComment): string {
  return comment.author ?? comment.user?.displayName ?? 'unknown'
}

export function commentDate(value: string | undefined): string {
  if (!value) {
    return ''
  }
  const time = Date.parse(value)
  return Number.isFinite(time) ? new Date(time).toLocaleDateString() : ''
}

export function formatDurationSeconds(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return ''
  }
  const seconds = Math.max(0, Math.floor(value))
  if (seconds >= 60) {
    return t('durationMinutesSeconds', { minutes: Math.floor(seconds / 60), seconds: seconds % 60 })
  }
  return t('durationSeconds', { seconds })
}

export function commentSourceLabel(comment: DetailComment): string {
  if (comment.path) {
    const line =
      typeof comment.line === 'number'
        ? typeof comment.startLine === 'number' && comment.startLine !== comment.line
          ? `${comment.startLine}-${comment.line}`
          : String(comment.line)
        : ''
    const location = line ? `${comment.path}:${line}` : comment.path
    return comment.isResolved
      ? t('commentResolvedReviewAt', { location })
      : t('commentReviewAt', { location })
  }
  if (comment.threadId) {
    return comment.isResolved ? t('commentResolvedReviewThread') : t('commentReviewThread')
  }
  return t('commentTopLevel')
}

export function groupDetailComments(comments: DetailComment[]): DetailCommentGroup[] {
  const threads = new Map<string, { root: DetailComment; replies: DetailComment[] }>()
  const groups: DetailCommentGroup[] = []
  const emittedThreads = new Set<string>()

  for (const comment of comments) {
    if (!comment.threadId) {
      continue
    }
    const existing = threads.get(comment.threadId)
    if (existing) {
      existing.replies.push(comment)
    } else {
      threads.set(comment.threadId, { root: comment, replies: [] })
    }
  }

  for (const comment of comments) {
    if (!comment.threadId) {
      groups.push({ kind: 'standalone', comment })
      continue
    }
    if (emittedThreads.has(comment.threadId)) {
      continue
    }
    emittedThreads.add(comment.threadId)
    const thread = threads.get(comment.threadId)
    if (thread) {
      groups.push({ kind: 'thread', threadId: comment.threadId, ...thread })
    }
  }

  return groups
}

export function detailCommentGroupId(group: DetailCommentGroup): string {
  return group.kind === 'thread' ? `thread:${group.threadId}` : `comment:${group.comment.id}`
}

export function detailCommentGroupRoot(group: DetailCommentGroup): DetailComment {
  return group.kind === 'thread' ? group.root : group.comment
}

export function detailCommentGroupCount(group: DetailCommentGroup): number {
  return group.kind === 'thread' ? 1 + group.replies.length : 1
}

export function isResolvedDetailCommentGroup(group: DetailCommentGroup): boolean {
  return detailCommentGroupRoot(group).isResolved === true
}

export function discussionSummary(count: number): string {
  if (count === 0) {
    return t('noCommentsYet')
  }
  return t('commentCount', { count })
}

export function renderCommentReactions(comment: DetailComment): ReactNode {
  const reactions = (comment.reactions ?? []).filter((reaction) => reaction.count > 0)
  if (reactions.length === 0) {
    return null
  }
  return (
    <View style={styles.reactionRow}>
      {reactions.map((reaction) => (
        <View key={reaction.content} style={styles.reactionChip}>
          <Text style={styles.reactionText}>
            {COMMENT_REACTION_EMOJI[reaction.content ?? '']} {reaction.count}
          </Text>
        </View>
      ))}
    </View>
  )
}
