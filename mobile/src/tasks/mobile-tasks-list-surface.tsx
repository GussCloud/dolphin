import type { ConnectionPresentationModel } from './use-mobile-tasks-connection-presentation'
import {
  View,
  Text,
  ActivityIndicator,
  colors,
  TaskProviderLogo,
  Pressable
} from './mobile-tasks-dependencies'
import { styles } from './mobile-tasks-legacy-styles'
import { translateTasks as t } from './tasks-translate'
import { renderMobileTasksGitHubProjectList } from './mobile-tasks-github-project-list'
import { renderMobileTasksLinearList } from './mobile-tasks-linear-list'
import { renderMobileTasksProviderItemList } from './mobile-tasks-provider-item-list'

export function renderMobileTasksListSurface(model: ConnectionPresentationModel) {
  const {
    githubMode,
    linearConnected,
    provider,
    setLinearApiKeyDraft,
    setLinearConnectError,
    setLinearConnectState,
    setShowLinearConnect,
    taskUiReady,
    tasksSupported,
    tasksUnsupported
  } = model
  return !tasksSupported ? (
    tasksUnsupported ? (
      <View style={styles.centered}>
        <Text style={styles.emptyText}>{t('updateDesktopTitle')}</Text>
        <Text style={styles.centeredHint}>{t('updateDesktopHint')}</Text>
      </View>
    ) : (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    )
  ) : provider === 'linear' && !linearConnected ? (
    <View style={styles.centered}>
      <TaskProviderLogo provider="linear" size={32} color={colors.textSecondary} />
      <Text style={styles.emptyText}>{t('connectLinearAccountTitle')}</Text>
      <Text style={styles.centeredHint}>{t('connectLinearAccountHint')}</Text>
      <Pressable
        style={[styles.targetButton, styles.centerActionButton]}
        disabled={!taskUiReady}
        onPress={() => {
          if (!taskUiReady) {
            return
          }
          setLinearApiKeyDraft('')
          setLinearConnectState('idle')
          setLinearConnectError('')
          setShowLinearConnect(true)
        }}
      >
        <Text style={styles.targetButtonText}>{t('connectLinear')}</Text>
      </Pressable>
    </View>
  ) : provider === 'github' && githubMode === 'project' ? (
    renderMobileTasksGitHubProjectList(model)
  ) : (
    renderMobileTasksNonProjectLists(model)
  )
}

export function renderMobileTasksNonProjectLists(model: ConnectionPresentationModel) {
  const { provider } = model
  return provider === 'linear'
    ? renderMobileTasksLinearList(model)
    : renderMobileTasksProviderItemList(model)
}
