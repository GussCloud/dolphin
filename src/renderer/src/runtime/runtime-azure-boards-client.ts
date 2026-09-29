import type { AzureBoardsApi } from '../../../preload/api/azure-boards-api'
import type { GlobalSettings } from '../../../shared/global-settings-types'
import { callRuntimeRpc, getActiveRuntimeTarget } from '@/runtime/runtime-rpc-client'

type RuntimeSettings = Pick<GlobalSettings, 'activeRuntimeEnvironmentId'> | null | undefined

// Why: Azure Boards follows the Azure DevOps sign-in, which belongs to the active
// runtime host — the remote server when one is active, otherwise this desktop.
export function getAzureBoardsClient(settings: RuntimeSettings): AzureBoardsApi {
  const target = getActiveRuntimeTarget(settings)
  if (target.kind !== 'environment') {
    const api = window.api?.azureBoards
    if (!api) {
      throw new Error('Azure Boards is not available in this client.')
    }
    return api
  }
  return {
    scope: () => callRuntimeRpc(target, 'azureBoards.scope'),
    list: (args) => callRuntimeRpc(target, 'azureBoards.list', args),
    get: (args) => callRuntimeRpc(target, 'azureBoards.get', args),
    types: (args) => callRuntimeRpc(target, 'azureBoards.types', args),
    create: (args) => callRuntimeRpc(target, 'azureBoards.create', args),
    updateState: (args) => callRuntimeRpc(target, 'azureBoards.updateState', args),
    addComment: (args) => callRuntimeRpc(target, 'azureBoards.addComment', args)
  }
}
