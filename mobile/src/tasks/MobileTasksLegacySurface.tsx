import type { ConnectionPresentationModel } from './use-mobile-tasks-connection-presentation'
import {
  SafeAreaView,
  View,
  Text,
  Pressable,
  AlertTriangle,
  colors,
  ActionSheetModal,
  GitBranch,
  ConfirmModal
} from './mobile-tasks-dependencies'
import { styles } from './mobile-tasks-legacy-styles'
import { translateTasks as t } from './tasks-translate'
import { useMobileLocale } from '../i18n/use-mobile-translation'
import {
  getHostedReviewMergeMethodLabel,
  getHostedMergeConfirmMessage,
  getProjectGitHubMergeConfirmMessage,
  getHostedStateConfirmTitle,
  getHostedStateConfirmMessage,
  getHostedStateConfirmLabel
} from './mobile-tasks-legacy-foundation'
import { renderMobileTasksChrome } from './mobile-tasks-screen-chrome'
import { renderMobileTasksListSurface } from './mobile-tasks-list-surface'
import {
  renderMobileTasksProviderPicker,
  renderMobileTasksRepoPicker,
  renderMobileTasksGitHubIssueSourcePicker,
  renderMobileTasksGitHubViewPicker,
  renderMobileTasksGitHubPresetPicker,
  renderMobileTasksPagePicker
} from './mobile-tasks-provider-pickers'
import {
  renderMobileTasksGitHubProjectPicker,
  renderMobileTasksGitHubProjectViewPicker,
  renderMobileTasksGitHubProjectSortPicker
} from './mobile-tasks-github-project-pickers'
import {
  renderMobileTasksGitHubProjectFieldsPicker,
  renderMobileTasksGitLabViewPicker,
  renderMobileTasksGitLabFilterPicker,
  renderMobileTasksLinearFilterPicker,
  renderMobileTasksLinearWorkspacePicker,
  renderMobileTasksLinearTeamPicker,
  renderMobileTasksLinearStatusPicker
} from './mobile-tasks-filter-pickers'
import {
  renderMobileTasksLinearViewPicker,
  renderMobileTasksLinearGroupPicker,
  renderMobileTasksLinearOrderPicker,
  renderMobileTasksLinearDisplayPicker,
  renderMobileTasksSortPicker
} from './mobile-tasks-list-display-pickers'
import {
  renderMobileTasksCreateDrawer,
  renderMobileTasksCreateTargetPicker,
  renderMobileTasksLinearConnectDrawer,
  renderMobileTasksWorkspaceCreateTargetPicker
} from './mobile-tasks-create-drawers'
import {
  renderMobileTasksWorkspaceCreateDrawer,
  renderMobileTasksWorkspaceCreateRepoPicker,
  renderMobileTasksWorkspaceAgentPicker
} from './mobile-tasks-workspace-create-drawer'
import {
  renderMobileTasksWorkspaceBaseBranchPicker,
  renderMobileTasksWorkspaceSparsePicker
} from './mobile-tasks-workspace-option-pickers'
import {
  renderMobileTasksWorkspaceSparseDrawer,
  renderMobileTasksSetupTrustDrawer,
  renderMobileTasksDolphinYamlTrustDrawer
} from './mobile-tasks-workspace-trust-drawers'
import {
  renderMobileTasksProjectMissingRepoDrawer,
  renderMobileTasksProjectDetailDrawer
} from './mobile-tasks-project-detail-drawer'
import { renderMobileTasksItemDetailDrawer } from './mobile-tasks-item-detail-drawer'

const SLUG_MARKER = '\u0000'

export function MobileTasksLegacySurface({ model }: { model: ConnectionPresentationModel }) {
  // Why: render helpers read copy through translateTasks; subscribing re-renders on a language change.
  useMobileLocale()
  const {
    error,
    githubMode,
    githubProjectTable,
    githubSourceErrors,
    githubSourceFallbacks,
    loading,
    mergeHostedReview,
    mergeMethodProjectRow,
    mergeMethodTaskItem,
    mergeProjectGitHubPullRequest,
    mutateProjectRowIssueOrPr,
    pendingHostedMerge,
    pendingHostedStateChange,
    pendingProjectGitHubMerge,
    provider,
    retryGitHubIssueSourceFetch,
    retryingGithubSourceRepoPaths,
    setMergeMethodProjectRow,
    setMergeMethodTaskItem,
    setPendingHostedMerge,
    setPendingHostedStateChange,
    setPendingProjectGitHubMerge,
    taskUiReady,
    toggleGitHubStatus,
    toggleGitLabStatus
  } = model
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderMobileTasksChrome(model)}

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!error && provider === 'github' && githubMode === 'items'
        ? githubSourceFallbacks.map((fallback) => (
            <View
              key={`github-source-fallback:${fallback.repoId}`}
              style={styles.sourceNoticeBanner}
            >
              <Text style={styles.sourceNoticeText}>
                {t('issueSourceFallback', { repo: fallback.repoLabel })}
              </Text>
            </View>
          ))
        : null}

      {!error && provider === 'github' && githubMode === 'items'
        ? githubSourceErrors.map((sourceError) => {
            const isRetrying = retryingGithubSourceRepoPaths.has(sourceError.repoPath)
            // Why split on a marker: the slug is styled inline, and its position differs per language.
            const [sourceErrorBefore, sourceErrorAfter] = t('issueSourceLoadError', {
              slug: SLUG_MARKER
            }).split(SLUG_MARKER)
            return (
              <View
                key={`github-source-error:${sourceError.repoId}:${sourceError.source.owner}/${sourceError.source.repo}`}
                style={styles.sourceErrorBanner}
              >
                <View style={styles.sourceErrorCopy}>
                  <Text style={styles.sourceErrorText}>
                    {sourceErrorBefore}
                    <Text style={styles.sourceErrorSlug}>
                      {sourceError.source.owner}/{sourceError.source.repo}
                    </Text>
                    {sourceErrorAfter}
                  </Text>
                  <Text style={styles.sourceErrorMessage} numberOfLines={2}>
                    {sourceError.message}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('issueSourceRetryLabel', {
                    slug: `${sourceError.source.owner}/${sourceError.source.repo}`
                  })}
                  style={styles.sourceErrorRetry}
                  disabled={loading || isRetrying}
                  onPress={() => void retryGitHubIssueSourceFetch(sourceError.repoPath)}
                >
                  <Text style={styles.sourceErrorRetryText}>
                    {isRetrying ? t('retrying') : t('retry')}
                  </Text>
                </Pressable>
              </View>
            )
          })
        : null}

      {!error &&
      provider === 'github' &&
      githubMode === 'project' &&
      githubProjectTable?.parentFieldDropped === true ? (
        <View style={styles.projectDataNotice}>
          <AlertTriangle size={15} color={colors.statusAmber} />
          <Text style={styles.projectDataNoticeText}>{t('subIssueDataUnavailable')}</Text>
        </View>
      ) : null}

      {renderMobileTasksListSurface(model)}

      {renderMobileTasksProviderPicker(model)}

      {renderMobileTasksRepoPicker(model)}

      {renderMobileTasksGitHubIssueSourcePicker(model)}

      {renderMobileTasksGitHubViewPicker(model)}

      {renderMobileTasksGitHubPresetPicker(model)}

      {renderMobileTasksPagePicker(model)}

      {renderMobileTasksGitHubProjectPicker(model)}

      {renderMobileTasksGitHubProjectViewPicker(model)}

      {renderMobileTasksGitHubProjectSortPicker(model)}

      {renderMobileTasksGitHubProjectFieldsPicker(model)}

      {renderMobileTasksGitLabViewPicker(model)}

      {renderMobileTasksGitLabFilterPicker(model)}

      {renderMobileTasksLinearFilterPicker(model)}

      {renderMobileTasksLinearWorkspacePicker(model)}

      {renderMobileTasksLinearTeamPicker(model)}

      {renderMobileTasksLinearStatusPicker(model)}

      {renderMobileTasksLinearViewPicker(model)}

      {renderMobileTasksLinearGroupPicker(model)}

      {renderMobileTasksLinearOrderPicker(model)}

      {renderMobileTasksLinearDisplayPicker(model)}

      {renderMobileTasksSortPicker(model)}

      {renderMobileTasksCreateDrawer(model)}

      {renderMobileTasksCreateTargetPicker(model)}

      {renderMobileTasksLinearConnectDrawer(model)}

      {renderMobileTasksWorkspaceCreateTargetPicker(model)}

      {renderMobileTasksWorkspaceCreateDrawer(model)}

      {renderMobileTasksWorkspaceCreateRepoPicker(model)}

      {renderMobileTasksWorkspaceAgentPicker(model)}

      {renderMobileTasksWorkspaceBaseBranchPicker(model)}

      {renderMobileTasksWorkspaceSparsePicker(model)}

      {renderMobileTasksWorkspaceSparseDrawer(model)}

      {renderMobileTasksSetupTrustDrawer(model)}

      {renderMobileTasksDolphinYamlTrustDrawer(model)}

      {renderMobileTasksProjectMissingRepoDrawer(model)}

      {renderMobileTasksProjectDetailDrawer(model)}

      {renderMobileTasksItemDetailDrawer(model)}

      <ActionSheetModal
        visible={taskUiReady && mergeMethodProjectRow != null}
        title={t('mergeMethodTitle')}
        message={t('mergeMethodPrMessage')}
        actions={
          mergeMethodProjectRow
            ? (['squash', 'merge', 'rebase'] as const).map((method) => ({
                label: getHostedReviewMergeMethodLabel(method),
                icon: GitBranch,
                onPress: () => {
                  setPendingProjectGitHubMerge({ row: mergeMethodProjectRow, method })
                }
              }))
            : []
        }
        onClose={() => setMergeMethodProjectRow(null)}
      />
      <ActionSheetModal
        visible={taskUiReady && mergeMethodTaskItem != null}
        title={t('mergeMethodTitle')}
        message={
          mergeMethodTaskItem?.provider === 'gitlab'
            ? t('mergeMethodMrMessage')
            : t('mergeMethodPrMessage')
        }
        actions={
          mergeMethodTaskItem
            ? (mergeMethodTaskItem.provider === 'gitlab'
                ? (['merge', 'squash', 'rebase'] as const)
                : (['squash', 'merge', 'rebase'] as const)
              ).map((method) => ({
                label:
                  mergeMethodTaskItem.provider === 'gitlab' && method === 'merge'
                    ? t('merge')
                    : getHostedReviewMergeMethodLabel(method),
                icon: GitBranch,
                onPress: () => {
                  const item = mergeMethodTaskItem
                  setPendingHostedMerge({ item, method })
                }
              }))
            : []
        }
        onClose={() => setMergeMethodTaskItem(null)}
      />
      <ConfirmModal
        visible={taskUiReady && pendingHostedMerge != null}
        title={
          pendingHostedMerge?.item.provider === 'gitlab'
            ? t('mergeRequestTitle')
            : t('mergePullRequestTitle')
        }
        message={pendingHostedMerge ? getHostedMergeConfirmMessage(pendingHostedMerge) : undefined}
        confirmLabel={
          pendingHostedMerge
            ? getHostedReviewMergeMethodLabel(pendingHostedMerge.method)
            : t('merge')
        }
        onConfirm={() => {
          if (!taskUiReady || !pendingHostedMerge) {
            return
          }
          void mergeHostedReview(pendingHostedMerge.item, pendingHostedMerge.method)
        }}
        onCancel={() => setPendingHostedMerge(null)}
      />
      <ConfirmModal
        visible={taskUiReady && pendingProjectGitHubMerge != null}
        title={t('mergePullRequestTitle')}
        message={
          pendingProjectGitHubMerge
            ? getProjectGitHubMergeConfirmMessage(pendingProjectGitHubMerge)
            : undefined
        }
        confirmLabel={
          pendingProjectGitHubMerge
            ? getHostedReviewMergeMethodLabel(pendingProjectGitHubMerge.method)
            : t('merge')
        }
        onConfirm={() => {
          if (!taskUiReady || !pendingProjectGitHubMerge) {
            return
          }
          void mergeProjectGitHubPullRequest(
            pendingProjectGitHubMerge.row,
            pendingProjectGitHubMerge.method
          )
        }}
        onCancel={() => setPendingProjectGitHubMerge(null)}
      />
      <ConfirmModal
        visible={taskUiReady && pendingHostedStateChange != null}
        title={
          pendingHostedStateChange
            ? getHostedStateConfirmTitle(pendingHostedStateChange)
            : t('updateItemTitle')
        }
        message={
          pendingHostedStateChange
            ? getHostedStateConfirmMessage(pendingHostedStateChange)
            : undefined
        }
        confirmLabel={
          pendingHostedStateChange
            ? getHostedStateConfirmLabel(pendingHostedStateChange)
            : t('confirm')
        }
        destructive={pendingHostedStateChange?.nextState === 'closed'}
        onConfirm={() => {
          if (!taskUiReady || !pendingHostedStateChange) {
            return
          }
          if (pendingHostedStateChange.source === 'task') {
            if (pendingHostedStateChange.item.provider === 'gitlab') {
              void toggleGitLabStatus(pendingHostedStateChange.item)
              return
            }
            void toggleGitHubStatus(pendingHostedStateChange.item)
            return
          }
          void mutateProjectRowIssueOrPr(pendingHostedStateChange.row, {
            state: pendingHostedStateChange.nextState
          })
        }}
        onCancel={() => setPendingHostedStateChange(null)}
      />
    </SafeAreaView>
  )
}
