import { getExecutionHostLabel } from '../../../../shared/execution-host'
import { taskProviderLabel } from '../../../../shared/task-providers'
import { taskProviderIdentityLabel } from '../../../../shared/task-provider-identity'
import type { TaskSourceContext } from '../../../../shared/task-source-context'

export type AutomationSourceDisplay = {
  label: string
  title: string
}

export function getAutomationSourceDisplay(
  sourceContext: TaskSourceContext | null | undefined,
  hostLabelById?: ReadonlyMap<string, string>
): AutomationSourceDisplay | null {
  if (!sourceContext) {
    return null
  }
  const providerLabel = getProviderLabel(sourceContext.provider)
  const hostLabel =
    hostLabelById?.get(sourceContext.hostId) ?? getExecutionHostLabel(sourceContext.hostId)
  const identityLabel = getSourceIdentityLabel(sourceContext)
  const label = [providerLabel, hostLabel, identityLabel]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
  const title = [
    `${providerLabel} source`,
    `Host: ${hostLabel}`,
    sourceContext.accountLabel ? `Account: ${sourceContext.accountLabel}` : null,
    identityLabel ? `Source: ${identityLabel}` : null
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ')
  return { label, title }
}

function getProviderLabel(provider: TaskSourceContext['provider']): string {
  return taskProviderLabel(provider)
}

function getSourceIdentityLabel(sourceContext: TaskSourceContext): string | null {
  return (
    taskProviderIdentityLabel(sourceContext.providerIdentity) ??
    sourceContext.accountLabel ??
    sourceContext.repoId ??
    null
  )
}
