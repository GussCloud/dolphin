import { homedir } from 'node:os'
import { dialog, ipcMain } from 'electron'
import type { ClaudeAccountAddTarget, ClaudeAccountService } from '../claude-accounts/service'
import type { ClaudeAccountSelectionTarget } from '../claude-accounts/runtime-selection'

export function registerClaudeAccountHandlers(claudeAccounts: ClaudeAccountService): void {
  ipcMain.handle('claudeAccounts:list', () => claudeAccounts.listAccounts())
  ipcMain.handle('claudeAccounts:add', (_event, args?: ClaudeAccountAddTarget) =>
    claudeAccounts.addAccount(args)
  )
  ipcMain.handle('claudeAccounts:discoverFolders', () => claudeAccounts.discoverConfigFolders())
  ipcMain.handle('claudeAccounts:linkFolder', (_event, args: { configDir: string }) =>
    claudeAccounts.linkConfigFolder(args.configDir)
  )
  ipcMain.handle('claudeAccounts:pickFolder', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      defaultPath: homedir(),
      // Why: account folders are dot-folders (~/.claude-*), hidden by default on macOS.
      properties: ['openDirectory', 'showHiddenFiles']
    })
    return result.canceled ? null : (result.filePaths[0] ?? null)
  })
  ipcMain.handle('claudeAccounts:cancelPendingLogin', () => claudeAccounts.cancelPendingLogin())
  ipcMain.handle('claudeAccounts:reauthenticate', (_event, args: { accountId: string }) =>
    claudeAccounts.reauthenticateAccount(args.accountId)
  )
  ipcMain.handle('claudeAccounts:remove', (_event, args: { accountId: string }) =>
    claudeAccounts.removeAccount(args.accountId)
  )
  ipcMain.handle(
    'claudeAccounts:select',
    (_event, args: { accountId: string | null } & ClaudeAccountSelectionTarget) => {
      if (!args.runtime) {
        return claudeAccounts.selectAccount(args.accountId)
      }
      return claudeAccounts.selectAccountForTarget(args.accountId, args)
    }
  )
}
