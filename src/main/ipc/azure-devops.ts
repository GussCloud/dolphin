import { BrowserWindow, ipcMain } from 'electron'
import {
  isAzureCliSignInMode,
  type AzureCliSignInResult,
  type AzureCliSignInState,
  type AzureDevOpsAuthPreference,
  type AzureDevOpsConfigureDefaultsResult
} from '../../shared/azure-devops-auth'
import {
  getAzureCliSignInState,
  onAzureCliSignInStateChanged
} from '../azure-devops/azure-cli-sign-in-notice'
import {
  cancelAzureCliSignIn,
  startAzureCliSignIn
} from '../azure-devops/azure-cli-interactive-sign-in'
import { broadcastAzureCliSignInState } from './azure-cli-sign-in-state-broadcast'
import {
  changeAzureDevOpsAuthMethod,
  listAzureDevOpsRepositoriesResult,
  refreshAzureCliSession,
  setAzureCliAutoRenew,
  setAzureDevOpsCliDefaults
} from '../azure-devops/azure-devops-auth-commands'
import { getAzureDevOpsPullRequestBoard } from '../azure-devops/pull-request-board'
import { getAzureDevOpsPullRequestComments } from '../azure-devops/pull-request-comments'
import { getAzureDevOpsReviewerAvatar } from '../azure-devops/reviewer-avatar'
import type {
  AzureDevOpsOrgLinkArgs,
  AzureDevOpsOrgLinkStatus
} from '../../shared/azure-devops-org-link'
import {
  getAzureDevOpsOrgLink,
  startAzureDevOpsOrgLinkAutoCheck,
  type AzureDevOpsOrgLinkAutoCheckOptions
} from '../azure-devops/dolphin-org-link'

// Why: older renderers send `{ force }` only, so every field is optional and strict-true.
function readOrgLinkArgs(value: unknown): AzureDevOpsOrgLinkArgs {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return {
    force: 'force' in value && value.force === true,
    signIn: 'signIn' in value && value.signIn === true
  }
}

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

export function registerAzureDevOpsHandlers(
  orgLinkOptions: AzureDevOpsOrgLinkAutoCheckOptions = {}
): void {
  startAzureDevOpsOrgLinkAutoCheck(orgLinkOptions)
  // Why desktop-only: a remote host's `az login` redirect cannot reach this desktop's window.
  onAzureCliSignInStateChanged(broadcastAzureCliSignInState)

  ipcMain.handle('azureDevOps:getCliSignInState', (): AzureCliSignInState =>
    getAzureCliSignInState()
  )

  ipcMain.handle(
    'azureDevOps:startCliSignIn',
    (event, mode: unknown): Promise<AzureCliSignInResult> => {
      if (!isAzureCliSignInMode(mode)) {
        return Promise.resolve({ ok: false, error: 'Invalid Azure CLI sign-in mode' })
      }
      return startAzureCliSignIn(mode, { parent: BrowserWindow.fromWebContents(event.sender) })
    }
  )

  ipcMain.handle('azureDevOps:cancelCliSignIn', (): void => cancelAzureCliSignIn())

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

  ipcMain.handle('azureDevOps:pullRequestBoard', () => getAzureDevOpsPullRequestBoard())

  ipcMain.handle('azureDevOps:pullRequestComments', (_event, args: unknown) =>
    getAzureDevOpsPullRequestComments(args)
  )

  ipcMain.handle('azureDevOps:reviewerAvatar', (_event, url: unknown) =>
    getAzureDevOpsReviewerAvatar(url)
  )

  ipcMain.handle(
    'azureDevOps:orgLink',
    (_event, args: unknown): Promise<AzureDevOpsOrgLinkStatus> =>
      getAzureDevOpsOrgLink(readOrgLinkArgs(args))
  )
}
