import { BrowserWindow } from 'electron'
import {
  AZURE_CLI_SIGN_IN_STATE_CHANNEL,
  type AzureCliSignInState
} from '../../shared/azure-devops-auth'
import { isAzureDevOpsSignInWindow } from '../azure-devops/azure-devops-sign-in-window'

export function broadcastAzureCliSignInState(state: AzureCliSignInState): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed() || isAzureDevOpsSignInWindow(window)) {
      continue
    }
    try {
      window.webContents.send(AZURE_CLI_SIGN_IN_STATE_CHANNEL, state)
    } catch {
      // A renderer can disappear between isDestroyed() and send().
    }
  }
}
