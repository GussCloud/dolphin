import { ipcMain } from 'electron'
import type {
  AzureDevOpsAuthPreference,
  AzureDevOpsConfigureDefaultsResult
} from '../../shared/azure-devops-auth'
import {
  changeAzureDevOpsAuthMethod,
  refreshAzureCliSession,
  setAzureDevOpsCliDefaults
} from '../azure-devops/azure-devops-auth-commands'

function readConfigureDefaultsInput(
  value: unknown
): { organization: string; project: string | null } | null {
  if (!value || typeof value !== 'object') {
    return null
  }
  const organization = 'organization' in value ? value.organization : null
  const project = 'project' in value ? value.project : null
  if (typeof organization !== 'string') {
    return null
  }
  return { organization, project: typeof project === 'string' ? project : null }
}

export function registerAzureDevOpsHandlers(): void {
  ipcMain.handle(
    'azureDevOps:setAuthMethod',
    (_event, method: unknown): AzureDevOpsAuthPreference => changeAzureDevOpsAuthMethod(method)
  )

  ipcMain.handle(
    'azureDevOps:configureCliDefaults',
    async (_event, args: unknown): Promise<AzureDevOpsConfigureDefaultsResult> => {
      const input = readConfigureDefaultsInput(args)
      if (!input) {
        return { ok: false, error: 'Invalid Azure DevOps defaults' }
      }
      return setAzureDevOpsCliDefaults(input)
    }
  )

  ipcMain.handle('azureDevOps:refreshCliSession', (): void => refreshAzureCliSession())
}
