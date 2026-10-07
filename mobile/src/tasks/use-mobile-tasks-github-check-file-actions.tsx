import type { HostedCommentReviewActionsModel } from './use-mobile-tasks-hosted-comment-review-actions'
import { useCallback } from './mobile-tasks-dependencies'
import {
  githubPullRequestChecksRerun,
  githubPullRequestFileContentsRead,
  githubPullRequestFileViewedWrite
} from './mobile-task-item-state-operations'
import {
  githubReviewCommentWrite,
  githubReviewThreadResolve
} from './mobile-task-item-comment-operations'
import type {
  DetailComment,
  DetailPayload,
  GitHubDetailFile,
  TaskItem
} from './mobile-tasks-legacy-foundation'
import { translateTasks as t } from './tasks-translate'

export function useMobileTasksGithubCheckFileActions(model: HostedCommentReviewActionsModel) {
  const {
    client,
    detailPayload,
    expandedPrFilePath,
    mutatingStatus,
    prFileCommentDrafts,
    prFileContents,
    setDetailPayload,
    setDetailRefreshSeq,
    setError,
    setExpandedPrFilePath,
    setMutatingStatus,
    setPrFileCommentDrafts,
    setPrFileContents,
    setPrFileLoadingPath
  } = model
  const rerunGitHubChecks = useCallback(
    async (item: Extract<TaskItem, { provider: 'github' }>, failedOnly: boolean): Promise<void> => {
      if (!client || mutatingStatus || item.source.type !== 'pr') {
        return
      }
      setMutatingStatus(true)
      setError('')
      try {
        const reply = await githubPullRequestChecksRerun.request(
          client,
          {
            repo: `id:${item.source.repoId}`,
            prNumber: item.source.number,
            headSha: detailPayload?.provider === 'github' ? detailPayload.headSha : undefined,
            failedOnly
          },
          { timeoutMs: 60_000 }
        )
        const result = githubPullRequestChecksRerun.interpret(reply)
        if (result.ok === false) {
          throw new Error(result.error ?? t('rerunChecksError'))
        }
        setDetailRefreshSeq((current) => current + 1)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('rerunChecksError'))
      } finally {
        setMutatingStatus(false)
      }
    },
    [client, detailPayload, mutatingStatus]
  )

  const toggleGitHubFileViewed = useCallback(
    async (
      item: Extract<TaskItem, { provider: 'github' }>,
      file: NonNullable<Extract<DetailPayload, { provider: 'github' }>['files'][number]>
    ): Promise<void> => {
      if (!client || mutatingStatus || item.source.type !== 'pr') {
        return
      }
      if (detailPayload?.provider !== 'github' || !detailPayload.pullRequestId) {
        setError(t('viewedStateUnavailable'))
        return
      }
      const viewed = file.viewerViewedState !== 'VIEWED'
      setMutatingStatus(true)
      setError('')
      try {
        const reply = await githubPullRequestFileViewedWrite.request(
          client,
          {
            repo: `id:${item.source.repoId}`,
            pullRequestId: detailPayload.pullRequestId,
            path: file.path,
            viewed
          },
          { timeoutMs: 30_000 }
        )
        if (githubPullRequestFileViewedWrite.interpret(reply) !== true) {
          throw new Error(t('viewedStateSyncError'))
        }
        setDetailPayload((current) =>
          current?.provider === 'github'
            ? {
                ...current,
                files: current.files.map((candidate) =>
                  candidate.path === file.path
                    ? { ...candidate, viewerViewedState: viewed ? 'VIEWED' : 'UNVIEWED' }
                    : candidate
                )
              }
            : current
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : t('viewedStateUpdateError'))
      } finally {
        setMutatingStatus(false)
      }
    },
    [client, detailPayload, mutatingStatus]
  )

  const toggleGitHubReviewThread = useCallback(
    async (
      item: Extract<TaskItem, { provider: 'github' }>,
      comment: DetailComment
    ): Promise<void> => {
      if (!client || mutatingStatus || item.source.type !== 'pr' || !comment.threadId) {
        return
      }
      const resolve = !comment.isResolved
      setMutatingStatus(true)
      setError('')
      try {
        const reply = await githubReviewThreadResolve.request(
          client,
          {
            repo: `id:${item.source.repoId}`,
            threadId: comment.threadId,
            resolve
          },
          { timeoutMs: 30_000 }
        )
        if (githubReviewThreadResolve.interpret(reply) !== true) {
          throw new Error(resolve ? t('resolveThreadError') : t('reopenThreadError'))
        }
        setDetailPayload((current) =>
          current?.provider === 'github'
            ? {
                ...current,
                comments: current.comments.map((candidate) =>
                  candidate.threadId === comment.threadId
                    ? { ...candidate, isResolved: resolve }
                    : candidate
                )
              }
            : current
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : t('reviewThreadUpdateError'))
      } finally {
        setMutatingStatus(false)
      }
    },
    [client, mutatingStatus]
  )

  const toggleGitHubFileExpansion = useCallback(
    async (
      item: Extract<TaskItem, { provider: 'github' }>,
      file: GitHubDetailFile
    ): Promise<void> => {
      if (expandedPrFilePath === file.path) {
        setExpandedPrFilePath(null)
        return
      }
      setExpandedPrFilePath(file.path)
      if (prFileContents[file.path]) {
        return
      }
      if (
        !client ||
        item.source.type !== 'pr' ||
        detailPayload?.provider !== 'github' ||
        !detailPayload.headSha ||
        !detailPayload.baseSha
      ) {
        setError(t('fileContentsUnavailableError'))
        return
      }
      setPrFileLoadingPath(file.path)
      setError('')
      try {
        const reply = await githubPullRequestFileContentsRead.request(
          client,
          {
            repo: `id:${item.source.repoId}`,
            prNumber: item.source.number,
            path: file.path,
            oldPath: file.oldPath,
            status: file.status ?? 'modified',
            headSha: detailPayload.headSha,
            baseSha: detailPayload.baseSha
          },
          { timeoutMs: 30_000 }
        )
        const contents = githubPullRequestFileContentsRead.interpret(reply)
        setPrFileContents((current) => ({ ...current, [file.path]: contents }))
      } catch (err) {
        setError(err instanceof Error ? err.message : t('fileContentsLoadError'))
      } finally {
        setPrFileLoadingPath(null)
      }
    },
    [client, detailPayload, expandedPrFilePath, prFileContents]
  )

  const addGitHubFileReviewComment = useCallback(
    async (
      item: Extract<TaskItem, { provider: 'github' }>,
      file: GitHubDetailFile,
      line: number
    ): Promise<void> => {
      if (!client || mutatingStatus || item.source.type !== 'pr') {
        return
      }
      if (detailPayload?.provider !== 'github' || !detailPayload.headSha) {
        setError(t('reviewCommentNeedsHeadSha'))
        return
      }
      const draftKey = `${file.path}:${line}`
      const body = (prFileCommentDrafts[draftKey] ?? '').trim()
      if (!body) {
        return
      }
      setMutatingStatus(true)
      setError('')
      try {
        const reply = await githubReviewCommentWrite.request(
          client,
          {
            repo: `id:${item.source.repoId}`,
            prNumber: item.source.number,
            commitId: detailPayload.headSha,
            path: file.path,
            line,
            body
          },
          { timeoutMs: 30_000 }
        )
        const result = githubReviewCommentWrite.interpret(reply)
        if (result.ok === false) {
          throw new Error(result.error ?? t('reviewCommentError'))
        }
        const comment: DetailComment = result.comment ?? {
          id: `local-${Date.now()}`,
          author: t('you'),
          body,
          createdAt: new Date().toISOString(),
          path: file.path,
          line
        }
        setPrFileCommentDrafts((current) => {
          const next = { ...current }
          delete next[draftKey]
          return next
        })
        setDetailPayload((current) =>
          current?.provider === 'github'
            ? { ...current, comments: [...current.comments, comment] }
            : current
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : t('reviewCommentError'))
      } finally {
        setMutatingStatus(false)
      }
    },
    [client, detailPayload, mutatingStatus, prFileCommentDrafts]
  )
  return Object.assign(model, {
    rerunGitHubChecks,
    toggleGitHubFileViewed,
    toggleGitHubReviewThread,
    toggleGitHubFileExpansion,
    addGitHubFileReviewComment
  })
}

export type GithubCheckFileActionsModel = ReturnType<typeof useMobileTasksGithubCheckFileActions>
