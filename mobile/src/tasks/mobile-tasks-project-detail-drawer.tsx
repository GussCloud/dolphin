import type { ConnectionPresentationModel } from './use-mobile-tasks-connection-presentation'
import {
  BottomDrawer,
  View,
  Text,
  Pressable,
  Linking,
  ExternalLink,
  colors,
  Copy,
  TaskProviderLogo,
  ActivityIndicator,
  Plus,
  RefreshCw,
  X,
  GitBranch
} from './mobile-tasks-dependencies'
import { styles } from './mobile-tasks-legacy-styles'
import { translateTasks as t } from './tasks-translate'
import {
  projectRowStatusLabel,
  SHOW_MOBILE_DETAIL_LABEL_CHIPS,
  SHOW_MOBILE_PROJECT_METADATA_EDITORS,
  githubProjectOptionColor,
  canCreateWorkspaceFromProjectRow,
  projectRowType
} from './mobile-tasks-legacy-foundation'
import { renderMobileTasksProjectFieldEditors } from './mobile-tasks-project-field-editors'
import {
  renderMobileTasksProjectLabelsEditor,
  renderMobileTasksProjectAssigneesEditor
} from './mobile-tasks-project-metadata-editors'
import { renderMobileTasksProjectLoadedDetail } from './mobile-tasks-project-detail-content'

export function renderMobileTasksProjectMissingRepoDrawer(model: ConnectionPresentationModel) {
  const {
    copiedLinkKey,
    copyTextToClipboard,
    projectRepoNotInDolphin,
    setProjectRepoNotInDolphin,
    taskUiReady
  } = model
  return (
    <BottomDrawer
      visible={taskUiReady && projectRepoNotInDolphin != null}
      onClose={() => {
        setProjectRepoNotInDolphin(null)
      }}
    >
      {projectRepoNotInDolphin ? (
        <View>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{t('repositoryNotInDolphin')}</Text>
            <Text style={styles.sheetSubtitle}>
              {t('repositoryNotInDolphinHint', {
                slug: `${projectRepoNotInDolphin.owner}/${projectRepoNotInDolphin.repo}`
              })}
            </Text>
          </View>

          <View style={styles.actionGroup}>
            {projectRepoNotInDolphin.url ? (
              <Pressable
                style={styles.actionRow}
                onPress={() => {
                  if (projectRepoNotInDolphin.url) {
                    void Linking.openURL(projectRepoNotInDolphin.url)
                  }
                }}
              >
                <ExternalLink size={16} color={colors.textPrimary} />
                <Text style={styles.actionText}>{t('openInGitHub')}</Text>
              </Pressable>
            ) : null}
            {projectRepoNotInDolphin.url ? <View style={styles.actionSeparator} /> : null}
            <Pressable
              style={styles.actionRow}
              onPress={() =>
                void copyTextToClipboard(
                  `project-repo:${projectRepoNotInDolphin.owner}/${projectRepoNotInDolphin.repo}`,
                  `${projectRepoNotInDolphin.owner}/${projectRepoNotInDolphin.repo}`
                )
              }
            >
              <Copy size={16} color={colors.textPrimary} />
              <Text style={styles.actionText}>
                {copiedLinkKey ===
                `project-repo:${projectRepoNotInDolphin.owner}/${projectRepoNotInDolphin.repo}`
                  ? t('copied')
                  : t('copyRepository')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </BottomDrawer>
  )
}

export function renderMobileTasksProjectDetailDrawer(model: ConnectionPresentationModel) {
  const {
    activeProjectLabel,
    copiedLinkKey,
    copyTaskLink,
    createWorkspaceFromProjectRow,
    creatingKey,
    mutateProjectRowIssueType,
    projectIssueTypes,
    projectIssueTypesError,
    projectIssueTypesLoading,
    projectMutating,
    projectRowDetail,
    projectRowHostedRepo,
    projectRowItem,
    setMergeMethodProjectRow,
    setPendingHostedStateChange,
    setProjectRowItem,
    taskUiReady
  } = model
  return (
    <BottomDrawer
      visible={taskUiReady && projectRowItem != null}
      onClose={() => setProjectRowItem(null)}
    >
      {projectRowItem ? (
        <View>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetTitleRow}>
              <TaskProviderLogo provider="github" size={16} color={colors.textPrimary} />
              <Text style={styles.sheetTitle} numberOfLines={2}>
                {projectRowItem.content.title}
              </Text>
            </View>
            <Text style={styles.sheetSubtitle}>
              GitHub Project · {projectRowItem.content.repository ?? activeProjectLabel}
              {projectRowItem.content.number ? ` #${projectRowItem.content.number}` : ''}
            </Text>
          </View>

          <View style={styles.detailGroup}>
            <View style={styles.detailMetaGrid}>
              <View style={styles.detailMetaItem}>
                <Text style={styles.detailMetaLabel}>{t('type')}</Text>
                <Text style={styles.detailMetaValue}>
                  {projectRowItem.itemType === 'PULL_REQUEST'
                    ? t('pullRequest')
                    : projectRowItem.itemType === 'ISSUE'
                      ? t('issue')
                      : projectRowItem.itemType === 'DRAFT_ISSUE'
                        ? t('draftIssue')
                        : t('projectItem')}
                </Text>
              </View>
              <View style={styles.detailMetaItem}>
                <Text style={styles.detailMetaLabel}>{t('status')}</Text>
                <Text style={styles.detailMetaValue}>{projectRowStatusLabel(projectRowItem)}</Text>
              </View>
            </View>
            {SHOW_MOBILE_DETAIL_LABEL_CHIPS &&
            (projectRowDetail?.provider === 'github'
              ? projectRowDetail.labels
              : projectRowItem.content.labels.map((label) => label.name)
            ).length > 0 ? (
              <View style={styles.chipRow}>
                {(projectRowDetail?.provider === 'github'
                  ? projectRowDetail.labels
                  : projectRowItem.content.labels.map((label) => label.name)
                )
                  .slice(0, 6)
                  .map((label) => (
                    <View key={label} style={styles.detailChip}>
                      <Text style={styles.detailChipText}>{label}</Text>
                    </View>
                  ))}
              </View>
            ) : null}
            {SHOW_MOBILE_PROJECT_METADATA_EDITORS && projectRowItem.itemType === 'ISSUE' ? (
              <View style={styles.detailSection}>
                <View style={styles.detailSectionHeader}>
                  <Text style={styles.detailSectionTitle}>{t('issueType')}</Text>
                  <Text style={styles.detailSectionMeta}>
                    {projectRowItem.content.issueType?.name ?? t('noIssueType')}
                  </Text>
                </View>
                {projectIssueTypesLoading ? (
                  <View style={styles.detailLoadingInline}>
                    <ActivityIndicator size="small" color={colors.textSecondary} />
                    <Text style={styles.detailMuted}>{t('loadingIssueTypes')}</Text>
                  </View>
                ) : projectIssueTypesError ? (
                  <Text style={styles.detailError}>{projectIssueTypesError}</Text>
                ) : projectIssueTypes.length === 0 ? (
                  <Text style={styles.detailMuted}>{t('noIssueTypesConfigured')}</Text>
                ) : (
                  <View style={styles.chipRow}>
                    {projectIssueTypes.map((issueType) => {
                      const selected = projectRowItem.content.issueType?.id === issueType.id
                      return (
                        <Pressable
                          key={issueType.id}
                          style={[
                            styles.detailChip,
                            selected ? styles.detailChipSelected : undefined
                          ]}
                          disabled={projectMutating || selected}
                          onPress={() => void mutateProjectRowIssueType(projectRowItem, issueType)}
                        >
                          <View style={styles.issueTypeChipContent}>
                            <View
                              style={[
                                styles.issueTypeDot,
                                { backgroundColor: githubProjectOptionColor(issueType.color) }
                              ]}
                            />
                            <Text style={styles.detailChipText}>{issueType.name}</Text>
                          </View>
                        </Pressable>
                      )
                    })}
                    {projectRowItem.content.issueType ? (
                      <Pressable
                        style={styles.detailChip}
                        disabled={projectMutating}
                        onPress={() => void mutateProjectRowIssueType(projectRowItem, null)}
                      >
                        <Text style={styles.detailChipText}>{t('clearType')}</Text>
                      </Pressable>
                    ) : null}
                  </View>
                )}
              </View>
            ) : null}
            {renderMobileTasksProjectFieldEditors(model)}
            {renderMobileTasksProjectLabelsEditor(model)}
            {renderMobileTasksProjectAssigneesEditor(model)}
            {renderMobileTasksProjectLoadedDetail(model)}
          </View>

          <View style={styles.actionGroup}>
            {canCreateWorkspaceFromProjectRow(projectRowItem) ? (
              <Pressable
                style={styles.actionRow}
                disabled={creatingKey === `github-project:${projectRowItem.id}`}
                onPress={() => void createWorkspaceFromProjectRow(projectRowItem)}
              >
                <Plus size={16} color={colors.textPrimary} />
                <Text style={styles.actionText}>{t('createWorkspace')}</Text>
              </Pressable>
            ) : (
              <Text style={styles.emptyInlineText}>{t('workspaceFromProjectRowUnsupported')}</Text>
            )}

            {projectRowItem.content.url ? (
              <>
                {canCreateWorkspaceFromProjectRow(projectRowItem) ? (
                  <View style={styles.actionSeparator} />
                ) : null}
                <Pressable
                  style={styles.actionRow}
                  onPress={() => {
                    if (projectRowItem.content.url) {
                      void Linking.openURL(projectRowItem.content.url)
                    }
                  }}
                >
                  <ExternalLink size={16} color={colors.textPrimary} />
                  <Text style={styles.actionText}>{t('openInGitHub')}</Text>
                </Pressable>
                <View style={styles.actionSeparator} />
                <Pressable
                  style={styles.actionRow}
                  onPress={() =>
                    projectRowItem.content.url
                      ? void copyTaskLink(
                          `github-project:${projectRowItem.id}`,
                          projectRowItem.content.url
                        )
                      : undefined
                  }
                >
                  <Copy size={16} color={colors.textPrimary} />
                  <Text style={styles.actionText}>
                    {copiedLinkKey === `github-project:${projectRowItem.id}`
                      ? t('copied')
                      : t('copyGitHubLink')}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {projectRowType(projectRowItem) &&
            projectRowItem.content.state !== 'MERGED' &&
            projectRowItem.itemType !== 'DRAFT_ISSUE' ? (
              <>
                <View style={styles.actionSeparator} />
                <Pressable
                  style={styles.actionRow}
                  disabled={projectMutating}
                  onPress={() => {
                    const nextState = projectRowItem.content.state === 'CLOSED' ? 'open' : 'closed'
                    if (projectRowItem.itemType === 'PULL_REQUEST') {
                      setPendingHostedStateChange({
                        source: 'project',
                        row: projectRowItem,
                        nextState
                      })
                      return
                    }
                    setPendingHostedStateChange({
                      source: 'project',
                      row: projectRowItem,
                      nextState
                    })
                  }}
                >
                  {projectRowItem.content.state === 'CLOSED' ? (
                    <RefreshCw size={16} color={colors.textPrimary} />
                  ) : (
                    <X size={16} color={colors.textPrimary} />
                  )}
                  <Text style={styles.actionText}>
                    {projectRowItem.content.state === 'CLOSED' ? t('reopenItem') : t('closeItem')}
                  </Text>
                </Pressable>
              </>
            ) : null}
            {projectRowItem.itemType === 'PULL_REQUEST' &&
            projectRowItem.content.state !== 'CLOSED' &&
            projectRowItem.content.state !== 'MERGED' ? (
              <>
                <View style={styles.actionSeparator} />
                <Pressable
                  style={styles.actionRow}
                  disabled={projectMutating || !projectRowHostedRepo}
                  onPress={() => setMergeMethodProjectRow(projectRowItem)}
                >
                  <GitBranch size={16} color={colors.textPrimary} />
                  <Text style={styles.actionText}>{t('mergePullRequestAction')}</Text>
                </Pressable>
                {!projectRowHostedRepo ? (
                  <Text style={styles.emptyInlineText}>{t('mergeRequiresRepository')}</Text>
                ) : null}
              </>
            ) : null}
          </View>
        </View>
      ) : null}
    </BottomDrawer>
  )
}
