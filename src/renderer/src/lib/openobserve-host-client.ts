import type {
  OpenObserveCliStatus,
  OpenObserveCommandResult,
  OpenObserveSaveContextInput
} from '../../../shared/openobserve-cli'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'

type RuntimeSettings = Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined

// Why: the CLI agents run belongs to the host that runs their terminals — the remote
// server when one is active, otherwise this desktop.
function desktopApi(): NonNullable<typeof window.api.openObserve> {
  const api = window.api?.openObserve
  if (!api) {
    throw new Error('OpenObserve settings are not available in this client.')
  }
  return api
}

export function getOpenObserveCliStatus(settings: RuntimeSettings): Promise<OpenObserveCliStatus> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<OpenObserveCliStatus>(target, 'openObserve.status')
    : desktopApi().status()
}

export function saveOpenObserveContext(
  settings: RuntimeSettings,
  input: OpenObserveSaveContextInput
): Promise<OpenObserveCommandResult> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<OpenObserveCommandResult>(target, 'openObserve.saveContext', input)
    : desktopApi().saveContext(input)
}

export function activateOpenObserveContext(
  settings: RuntimeSettings,
  name: string
): Promise<OpenObserveCommandResult> {
  const target = getActiveRuntimeTarget(settings)
  return target.kind === 'environment'
    ? callRuntimeRpc<OpenObserveCommandResult>(target, 'openObserve.activateContext', { name })
    : desktopApi().activateContext(name)
}
