import { ipcMain } from 'electron'
import type {
  AzureDevOpsAuthPreference,
  AzureDevOpsConfigureDefaultsResult
} from '../../shared/azure-devops-auth'
import {
  changeAzureDevOpsAuthMethod,
  listAzureDevOpsRepositoriesResult,
  refreshAzureCliSession,
  setAzureCliAutoRenew,
  setAzureDevOpsCliDefaults
} from '../azure-devops/azure-devops-auth-commands'
import type { AzureDevOpsOrgLinkStatus } from '../../shared/azure-devops-org-link'
import {
  getAzureDevOpsOrgLink,
  startAzureDevOpsOrgLinkAutoCheck
} from '../azure-devops/dolphin-org-link'

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
  startAzureDevOpsOrgLinkAutoCheck()

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

  ipcMain.handle(
    'azureDevOps:setCliAutoRenew',
    (_event, enabled: unknown): AzureDevOpsAuthPreference => setAzureCliAutoRenew(enabled)
  )

  ipcMain.handle('azureDevOps:refreshCliSession', (): void => refreshAzureCliSession())

  ipcMain.handle('azureDevOps:listRepositories', () => listAzureDevOpsRepositoriesResult())

  ipcMain.handle(
    'azureDevOps:orgLink',
    (_event, args: unknown): Promise<AzureDevOpsOrgLinkStatus> =>
      getAzureDevOpsOrgLink({
        force: Boolean(args && typeof args === 'object' && 'force' in args && args.force === true)
      })
  )
}
