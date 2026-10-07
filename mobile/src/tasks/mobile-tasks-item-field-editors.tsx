import type { ConnectionPresentationModel } from './use-mobile-tasks-connection-presentation'
import {
  SHOW_MOBILE_DETAIL_METADATA_EDITORS,
  splitCommaList
} from './mobile-tasks-legacy-foundation'
import {
  View,
  Text,
  TextInput,
  colors,
  Pressable,
  ActivityIndicator,
  Check
} from './mobile-tasks-dependencies'
import { styles } from './mobile-tasks-legacy-styles'
import { translateTasks as t } from './tasks-translate'

export function renderMobileTasksItemFieldEditors(model: ConnectionPresentationModel) {
  const {
    actionItem,
    detailPayload,
    itemAddAssigneesDraft,
    itemAddLabelsDraft,
    itemAssignableUsers,
    itemAssignableUsersError,
    itemAssignableUsersLoading,
    itemAvailableLabels,
    itemLabelsError,
    itemLabelsLoading,
    itemRemoveAssigneesDraft,
    itemRemoveLabelsDraft,
    itemTitleDraft,
    mutatingStatus,
    setItemAddAssigneesDraft,
    setItemAddLabelsDraft,
    setItemRemoveAssigneesDraft,
    setItemRemoveLabelsDraft,
    setItemTitleDraft,
    updateGitHubIssueMetadata,
    updateGitHubPullRequestMetadata,
    updateGitLabIssueMetadata
  } = model
  if (!actionItem || !detailPayload) {
    return null
  }
  return SHOW_MOBILE_DETAIL_METADATA_EDITORS &&
    ((actionItem.provider === 'github' &&
      detailPayload.provider === 'github' &&
      (actionItem.source.type === 'issue' || actionItem.source.type === 'pr')) ||
      (actionItem.provider === 'gitlab' &&
        (actionItem.source.type === 'issue' || actionItem.source.type === 'mr') &&
        detailPayload.provider === 'gitlab')) ? (
    <>
      <View style={styles.detailSection}>
        <Text style={styles.detailSectionTitle}>{t('title')}</Text>
        <TextInput
          style={styles.input}
          value={itemTitleDraft}
          onChangeText={setItemTitleDraft}
          placeholder={t('title')}
          placeholderTextColor={colors.textMuted}
        />
        <Pressable
          style={styles.inlineSaveButton}
          disabled={
            mutatingStatus ||
            itemTitleDraft.trim().length === 0 ||
            itemTitleDraft.trim() === actionItem.title
          }
          onPress={() => {
            if (actionItem.provider === 'github' && actionItem.source.type === 'pr') {
              void updateGitHubPullRequestMetadata(actionItem, {
                title: itemTitleDraft.trim()
              })
              return
            }
            if (actionItem.provider === 'github') {
              void updateGitHubIssueMetadata(actionItem, {
                title: itemTitleDraft.trim()
              })
              return
            }
            if (actionItem.provider === 'gitlab') {
              void updateGitLabIssueMetadata(actionItem, {
                title: itemTitleDraft.trim()
              })
            }
          }}
        >
          <Text style={styles.inlineSaveText}>{t('saveTitle')}</Text>
        </Pressable>
      </View>

      <View style={styles.detailSection}>
        <View style={styles.detailSectionHeader}>
          <Text style={styles.detailSectionTitle}>{t('labels')}</Text>
          <Text style={styles.detailSectionMeta}>{detailPayload.labels.length || t('none')}</Text>
        </View>
        {actionItem.provider === 'github' ? (
          itemLabelsLoading ? (
            <View style={styles.detailLoadingInline}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={styles.detailMuted}>{t('loadingLabels')}</Text>
            </View>
          ) : itemLabelsError ? (
            <Text style={styles.detailError}>{itemLabelsError}</Text>
          ) : itemAvailableLabels.length === 0 ? (
            <Text style={styles.detailMuted}>{t('noLabelsInRepository')}</Text>
          ) : (
            <View style={styles.chipRow}>
              {[...new Set([...itemAvailableLabels, ...detailPayload.labels])].map((label) => {
                const selected = detailPayload.labels.includes(label)
                return (
                  <Pressable
                    key={label}
                    style={[styles.detailChip, selected ? styles.detailChipSelected : undefined]}
                    disabled={mutatingStatus}
                    onPress={() =>
                      void updateGitHubIssueMetadata(
                        actionItem,
                        selected ? { removeLabels: [label] } : { addLabels: [label] }
                      )
                    }
                  >
                    <View style={styles.issueTypeChipContent}>
                      {selected ? <Check size={12} color={colors.accentBlue} /> : null}
                      <Text style={styles.detailChipText}>{label}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )
        ) : (
          <>
            <TextInput
              style={styles.input}
              value={itemAddLabelsDraft}
              onChangeText={setItemAddLabelsDraft}
              placeholder={t('addLabelsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.stackedInput]}
              value={itemRemoveLabelsDraft}
              onChangeText={setItemRemoveLabelsDraft}
              placeholder={t('removeLabelsPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.inlineSaveButton}
              disabled={
                mutatingStatus ||
                (splitCommaList(itemAddLabelsDraft).length === 0 &&
                  splitCommaList(itemRemoveLabelsDraft).length === 0)
              }
              onPress={() =>
                void updateGitLabIssueMetadata(actionItem, {
                  addLabels: splitCommaList(itemAddLabelsDraft),
                  removeLabels: splitCommaList(itemRemoveLabelsDraft)
                })
              }
            >
              <Text style={styles.inlineSaveText}>{t('updateLabels')}</Text>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.detailSection}>
        <View style={styles.detailSectionHeader}>
          <Text style={styles.detailSectionTitle}>{t('assignees')}</Text>
          <Text style={styles.detailSectionMeta}>
            {detailPayload.assignees.length || t('none')}
          </Text>
        </View>
        {actionItem.provider === 'github' ? (
          itemAssignableUsersLoading ? (
            <View style={styles.detailLoadingInline}>
              <ActivityIndicator size="small" color={colors.textSecondary} />
              <Text style={styles.detailMuted}>{t('loadingAssignees')}</Text>
            </View>
          ) : itemAssignableUsersError ? (
            <Text style={styles.detailError}>{itemAssignableUsersError}</Text>
          ) : itemAssignableUsers.length === 0 ? (
            <Text style={styles.detailMuted}>{t('noAssignableUsers')}</Text>
          ) : (
            <View style={styles.chipRow}>
              {[
                ...new Map(
                  [
                    ...itemAssignableUsers,
                    ...detailPayload.assignees.map((login) => ({
                      login,
                      name: null,
                      avatarUrl: null
                    }))
                  ].map((user) => [user.login, user])
                ).values()
              ].map((user) => {
                const selected = detailPayload.assignees.includes(user.login)
                return (
                  <Pressable
                    key={user.login}
                    style={[styles.detailChip, selected ? styles.detailChipSelected : undefined]}
                    disabled={mutatingStatus}
                    onPress={() =>
                      void updateGitHubIssueMetadata(
                        actionItem,
                        selected
                          ? { removeAssignees: [user.login] }
                          : { addAssignees: [user.login] }
                      )
                    }
                  >
                    <View style={styles.issueTypeChipContent}>
                      {selected ? <Check size={12} color={colors.accentBlue} /> : null}
                      <Text style={styles.detailChipText}>{user.login}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </View>
          )
        ) : actionItem.source.type === 'issue' ? (
          <>
            <TextInput
              style={styles.input}
              value={itemAddAssigneesDraft}
              onChangeText={setItemAddAssigneesDraft}
              placeholder={t('addUsernamesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <TextInput
              style={[styles.input, styles.stackedInput]}
              value={itemRemoveAssigneesDraft}
              onChangeText={setItemRemoveAssigneesDraft}
              placeholder={t('removeUsernamesPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
            />
            <Pressable
              style={styles.inlineSaveButton}
              disabled={
                mutatingStatus ||
                (splitCommaList(itemAddAssigneesDraft).length === 0 &&
                  splitCommaList(itemRemoveAssigneesDraft).length === 0)
              }
              onPress={() =>
                void updateGitLabIssueMetadata(actionItem, {
                  addAssignees: splitCommaList(itemAddAssigneesDraft),
                  removeAssignees: splitCommaList(itemRemoveAssigneesDraft)
                })
              }
            >
              <Text style={styles.inlineSaveText}>{t('updateAssignees')}</Text>
            </Pressable>
          </>
        ) : null}
      </View>
    </>
  ) : null
}
