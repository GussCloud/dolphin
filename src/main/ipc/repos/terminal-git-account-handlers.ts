import { ipcMain } from 'electron'
import type { Store } from '../../persistence'
import { getLocalProjectWorktreeGitOptions } from '../../project-runtime-git-options'
import { getTerminalGitAccountWarnings } from '../../pty/terminal-git-account-env'

// Why: a binding that terminals cannot honor must be visible on the project, not silently dropped.
export function registerTerminalGitAccountHandlers(store: Store): void {
  ipcMain.removeHandler('repos:getTerminalGitAccountWarnings')
  ipcMain.handle(
    'repos:getTerminalGitAccountWarnings',
    async (_event, args: { repoId?: unknown }): Promise<string[]> => {
      const repo = typeof args?.repoId === 'string' ? store.getRepo(args.repoId) : undefined
      if (!repo) {
        return []
      }
      let wslDistro: string | undefined
      try {
        wslDistro = getLocalProjectWorktreeGitOptions(store, repo).wslDistro
      } catch {
        // A runtime that needs repair cannot spawn terminals either; report on the host gh.
      }
      return getTerminalGitAccountWarnings(repo, wslDistro ? { distro: wslDistro } : undefined)
    }
  )
}
