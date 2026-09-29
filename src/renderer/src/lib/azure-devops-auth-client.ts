import type {
  AzureDevOpsAuthMethod,
  AzureDevOpsAuthPreference,
  AzureDevOpsConfigureDefaultsResult
} from '../../../shared/azure-devops-auth'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'

type RuntimeSettings = Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined

// Why: Azure DevOps auth belongs to the host that runs the forge code — the remote
// server when one is active (same scope rule as gh/glab), otherwise this desktop.
function desktopApi(): NonNullable<typeof window.api.azureDevOps> {
  const api = window.api?.azureDevOps
  if (!api) {
    throw new Error('Azure DevOps settings are not available in this client.')
  }
  return api
}

export function setAzureDevOpsAuthMethod(
  settings: RuntimeSettings,
  method: AzureDevOpsAuthMethod
): Promise<AzureDevOpsAuthPreference> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<AzureDevOpsAuthPreference>(target, 'azureDevOps.setAuthMethod', { method })
    : desktopApi().setAuthMethod(method)
}

export function configureAzureDevOpsCliDefaults(
  settings: RuntimeSettings,
  args: { organization: string; project: string | null }
): Promise<AzureDevOpsConfigureDefaultsResult> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<AzureDevOpsConfigureDefaultsResult>(
        target,
        'azureDevOps.configureCliDefaults',
        args
      )
    : desktopApi().configureCliDefaults(args)
}

export function refreshAzureCliSession(settings: RuntimeSettings): Promise<void> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<void>(target, 'azureDevOps.refreshCliSession')
    : desktopApi().refreshCliSession()
}
