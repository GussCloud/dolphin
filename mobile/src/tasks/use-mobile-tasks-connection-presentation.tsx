import type { ProviderViewProjectionModel } from './use-mobile-tasks-provider-view-projection'
import { classifyConnection } from './mobile-tasks-dependencies'
import { translateTasks as t } from './tasks-translate'

export function useMobileTasksConnectionPresentation(model: ProviderViewProjectionModel) {
  const {
    connState,
    githubMode,
    lastConnectedAt,
    provider,
    query,
    reconnectAttempts,
    relayRecovery
  } = model
  const headerVerdict = classifyConnection({
    state: connState,
    reconnectAttempts,
    lastConnectedAt,
    ...relayRecovery
  })
  const emptyLabel =
    connState !== 'connected'
      ? t('emptyDisconnected')
      : query
        ? t('emptyNoMatches')
        : provider === 'github'
          ? t('emptyGitHub')
          : provider === 'gitlab'
            ? t('emptyGitLab')
            : t('emptyLinear')
  const isGithubProjectSearch = provider === 'github' && githubMode === 'project'
  return Object.assign(model, { headerVerdict, emptyLabel, isGithubProjectSearch })
}

export type ConnectionPresentationModel = ReturnType<typeof useMobileTasksConnectionPresentation>
