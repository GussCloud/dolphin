import type { ConnectionPresentationModel } from './use-mobile-tasks-connection-presentation'
import {
  View,
  ActivityIndicator,
  colors,
  Text,
  Pressable,
  Linking,
  ExternalLink,
  TextInput
} from './mobile-tasks-dependencies'
import { styles, getGitLabPipelineStatusStyle } from './mobile-tasks-legacy-styles'
import { translateTasks as t } from './tasks-translate'
import {
  taskKindLabel,
  SHOW_MOBILE_DETAIL_LABEL_CHIPS,
  SHOW_MOBILE_DETAIL_REVIEW_PANELS,
  isFailedGitHubCheck,
  formatDurationSeconds,
  SHOW_MOBILE_LINEAR_DETAIL_TOOLS,
  discussionSummary,
  taskStatusLabel
} from './mobile-tasks-legacy-foundation'
import {
  renderMobileTasksItemBodyEditor,
  renderMobileTasksItemReviewPanel,
  renderMobileTasksItemFiles
} from './mobile-tasks-item-review-sections'
import { renderMobileTasksItemFieldEditors } from './mobile-tasks-item-field-editors'

export function renderMobileTasksItemDetailContent(model: ConnectionPresentationModel) {
  const {
    actionItem,
    addHostedItemComment,
    addLinearComment,
    createLinearSubIssue,
    detailCommentGroups,
    detailError,
    detailLoading,
    detailPayload,
    itemCommentDraft,
    linearCommentDraft,
    linearSubIssueTitle,
    mutatingStatus,
    openLinearSubIssue,
    refreshGitHubChecks,
    renderCommentComposer,
    renderDetailCommentGroup,
    rerunGitHubChecks,
    setItemCommentDraft,
    setLinearCommentDraft,
    setLinearSubIssueTitle
  } = model
  if (!actionItem) {
    return null
  }
  return detailLoading ? (
    <View style={styles.detailLoading}>
      <ActivityIndicator size="small" color={colors.textSecondary} />
    </View>
  ) : detailError ? (
    <Text style={styles.detailError}>{detailError}</Text>
  ) : detailPayload ? (
    <>
      <View style={styles.detailMetaGrid}>
        <View style={styles.detailMetaItem}>
          <Text style={styles.detailMetaLabel}>{t('type')}</Text>
          <Text style={styles.detailMetaValue}>{taskKindLabel(actionItem)}</Text>
        </View>
        <View style={styles.detailMetaItem}>
          <Text style={styles.detailMetaLabel}>{t('status')}</Text>
          <Text style={styles.detailMetaValue}>{taskStatusLabel(actionItem)}</Text>
        </View>
        {detailPayload.provider === 'linear' && detailPayload.assignee ? (
          <View style={styles.detailMetaItem}>
            <Text style={styles.detailMetaLabel}>{t('assignee')}</Text>
            <Text style={styles.detailMetaValue}>{detailPayload.assignee}</Text>
          </View>
        ) : null}
        {detailPayload.provider === 'linear' && detailPayload.project ? (
          <View style={styles.detailMetaItem}>
            <Text style={styles.detailMetaLabel}>{t('project')}</Text>
            <Text style={styles.detailMetaValue}>{detailPayload.project.name}</Text>
          </View>
        ) : null}
        {(detailPayload.provider === 'github' || detailPayload.provider === 'gitlab') &&
        detailPayload.assignees.length > 0 ? (
          <View style={styles.detailMetaItem}>
            <Text style={styles.detailMetaLabel}>{t('assignees')}</Text>
            <Text style={styles.detailMetaValue}>{detailPayload.assignees.join(', ')}</Text>
          </View>
        ) : null}
      </View>

      {SHOW_MOBILE_DETAIL_LABEL_CHIPS && detailPayload.labels.length > 0 ? (
        <View style={styles.chipRow}>
          {detailPayload.labels.map((label) => (
            <View key={label} style={styles.detailChip}>
              <Text style={styles.detailChipText}>{label}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>{t('description')}</Text>
        {renderMobileTasksItemBodyEditor(model)}
      </View>

      {renderMobileTasksItemFieldEditors(model)}

      {renderMobileTasksItemReviewPanel(model)}

      {SHOW_MOBILE_DETAIL_REVIEW_PANELS &&
      detailPayload.provider === 'github' &&
      actionItem.provider === 'github' &&
      actionItem.source.type === 'pr' ? (
        <View style={styles.detailSection}>
          <View style={styles.detailSectionHeader}>
            <Text style={styles.detailSectionTitle}>{t('checks')}</Text>
            <View style={styles.inlineActionRow}>
              <Pressable
                style={styles.inlineSaveButtonCompact}
                disabled={mutatingStatus}
                onPress={() => void refreshGitHubChecks(actionItem)}
              >
                <Text style={styles.inlineSaveText}>{t('refresh')}</Text>
              </Pressable>
              <Pressable
                style={styles.inlineSaveButtonCompact}
                disabled={mutatingStatus || !detailPayload.checks.some(isFailedGitHubCheck)}
                onPress={() => void rerunGitHubChecks(actionItem, true)}
              >
                <Text style={styles.inlineSaveText}>{t('rerunFailed')}</Text>
              </Pressable>
              <Pressable
                style={styles.inlineSaveButtonCompact}
                disabled={mutatingStatus || detailPayload.checks.length === 0}
                onPress={() => void rerunGitHubChecks(actionItem, false)}
              >
                <Text style={styles.inlineSaveText}>{t('rerunAll')}</Text>
              </Pressable>
            </View>
          </View>
          {detailPayload.checks.length === 0 ? (
            <Text style={styles.detailMuted}>{t('noChecksFound')}</Text>
          ) : (
            detailPayload.checks.map((check) => (
              <Pressable
                key={`${check.name}:${check.status}:${check.url ?? ''}`}
                style={styles.fileActionRow}
                disabled={!check.url}
                onPress={() => {
                  if (check.url) {
                    void Linking.openURL(check.url)
                  }
                }}
              >
                <Text style={styles.detailLine} numberOfLines={2}>
                  {check.name} · {check.conclusion ?? check.status}
                </Text>
                {check.url ? <ExternalLink size={14} color={colors.textSecondary} /> : null}
              </Pressable>
            ))
          )}
        </View>
      ) : null}

      {renderMobileTasksItemFiles(model)}

      {SHOW_MOBILE_DETAIL_REVIEW_PANELS &&
      detailPayload.provider === 'gitlab' &&
      actionItem.provider === 'gitlab' &&
      actionItem.source.type === 'mr' ? (
        <View style={styles.detailSection}>
          <View style={styles.detailSectionHeader}>
            <Text style={styles.detailSectionTitle}>{t('pipeline')}</Text>
            <Text style={styles.detailSectionMeta}>
              {detailPayload.pipelineJobs.length
                ? t('jobCount', { count: detailPayload.pipelineJobs.length })
                : t('none')}
            </Text>
          </View>
          {detailPayload.pipelineJobs.length === 0 ? (
            <Text style={styles.detailMuted}>{t('noPipelineRuns')}</Text>
          ) : (
            detailPayload.pipelineJobs.map((job) => {
              const duration = formatDurationSeconds(job.duration)
              return (
                <Pressable
                  key={`${job.id ?? job.stage}:${job.name}`}
                  style={styles.fileCard}
                  disabled={!job.webUrl}
                  onPress={() => {
                    if (job.webUrl) {
                      void Linking.openURL(job.webUrl)
                    }
                  }}
                >
                  <View style={styles.fileActionRow}>
                    <Text style={styles.detailLine} numberOfLines={2}>
                      {job.name}
                    </Text>
                    <View
                      style={[styles.pipelineStatusChip, getGitLabPipelineStatusStyle(job.status)]}
                    >
                      <Text style={styles.pipelineStatusText}>{job.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.detailMuted}>
                    {[job.stage, duration].filter(Boolean).join(' · ')}
                  </Text>
                </Pressable>
              )
            })
          )}
        </View>
      ) : null}

      {SHOW_MOBILE_LINEAR_DETAIL_TOOLS &&
      detailPayload.provider === 'linear' &&
      actionItem.provider === 'linear' ? (
        <View style={styles.detailSection}>
          <View style={styles.detailSectionHeader}>
            <Text style={styles.detailSectionTitle}>{t('subIssues')}</Text>
            <Text style={styles.detailSectionMeta}>
              {detailPayload.children.length || t('none')}
            </Text>
          </View>
          {detailPayload.children.length === 0 ? (
            <Text style={styles.detailMuted}>{t('noSubIssues')}</Text>
          ) : (
            detailPayload.children.map((child) => (
              <Pressable
                key={child.id}
                style={styles.fileActionRow}
                disabled={mutatingStatus}
                onPress={() => void openLinearSubIssue(child, actionItem.source.workspaceId)}
              >
                <Text style={styles.detailLine}>
                  {child.identifier} · {child.title}
                </Text>
                <Text style={styles.detailSectionMeta}>{t('open')}</Text>
              </Pressable>
            ))
          )}
          <TextInput
            style={[styles.input, styles.stackedInput]}
            value={linearSubIssueTitle}
            onChangeText={setLinearSubIssueTitle}
            placeholder={t('subIssueTitlePlaceholder')}
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            style={styles.inlineSaveButton}
            disabled={mutatingStatus || linearSubIssueTitle.trim().length === 0}
            onPress={() => void createLinearSubIssue(actionItem)}
          >
            <Text style={styles.inlineSaveText}>{t('addSubIssue')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.detailSection}>
        <View style={styles.detailSectionHeader}>
          <Text style={styles.detailSectionTitle}>{t('discussion')}</Text>
          <Text style={styles.detailSectionMeta}>
            {discussionSummary(detailPayload.comments.length)}
          </Text>
        </View>
        {detailPayload.comments.length === 0 ? (
          <Text style={styles.detailMuted}>{t('noComments')}</Text>
        ) : (
          detailCommentGroups.map(renderDetailCommentGroup)
        )}
        {(detailPayload.provider === 'github' && actionItem.provider === 'github') ||
        (detailPayload.provider === 'gitlab' && actionItem.provider === 'gitlab')
          ? renderCommentComposer({
              value: itemCommentDraft,
              onChangeText: setItemCommentDraft,
              disabled: mutatingStatus,
              onSubmit: () => void addHostedItemComment(actionItem)
            })
          : null}
        {detailPayload.provider === 'linear' && actionItem.provider === 'linear'
          ? renderCommentComposer({
              value: linearCommentDraft,
              onChangeText: setLinearCommentDraft,
              disabled: mutatingStatus,
              onSubmit: () => void addLinearComment(actionItem)
            })
          : null}
      </View>
    </>
  ) : null
}
