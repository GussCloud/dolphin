import { ipcMain } from 'electron'
import { appStarSourceSchema } from '../../shared/gh-star-source'
import { githubHostFromIdentityKey } from '../../shared/github/repository-identity-key'
import { diagnoseGhAuth } from '../github/auth-diagnose'
import { checkDolphinStarred, getAuthenticatedViewer, starDolphin } from '../github/client'
import {
  listGhAccountBindingInventory,
  validateGhAccountBinding
} from '../github/gh-account-binding-inventory'
import { getGhAccountProfile } from '../github/gh-account-profile'
import { getRateLimit } from '../github/rate-limit'
import type { Store } from '../persistence'
import { getCohortAtEmit } from '../telemetry/cohort-classifier'
import { track } from '../telemetry/client'
import { assertRegisteredGitHubRepo, getGitHubLocalGitOptionArgs } from './github-repo-routing'

const WSL_DISTRO_NAME_RE = /^[A-Za-z0-9._-]{1,64}$/

export function registerGitHubAccountHandlers(store: Store): void {
  ipcMain.handle('gh:viewer', () => getAuthenticatedViewer())
  ipcMain.handle('gh:checkDolphinStarred', () => checkDolphinStarred())
  ipcMain.handle('gh:starDolphin', async (_event, source: unknown) => {
    const sourceParse = appStarSourceSchema.safeParse(source)
    const starred = await starDolphin()
    if (starred && sourceParse.success) {
      track('app_starred_dolphin', {
        source: sourceParse.data,
        ...getCohortAtEmit()
      })
    }
    return starred
  })

  ipcMain.handle('gh:rateLimit', (_event, args?: { force?: boolean }) =>
    getRateLimit(args?.force ? { force: true } : undefined)
  )

  ipcMain.handle('gh:diagnoseAuth', (_event, args?: { host?: string }) =>
    diagnoseGhAuth(args?.host)
  )

  ipcMain.handle(
    'gh:listBindableAccounts',
    (_event, args: { repoPath: string; repoId?: string; refreshCapability?: boolean }) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      const requiredHost = githubHostFromIdentityKey(repo.gitRemoteIdentity?.canonicalKey)
      return listGhAccountBindingInventory(getGitHubLocalGitOptionArgs(store, repo)[0] ?? {}, {
        refreshCapability: args.refreshCapability === true,
        ...(requiredHost ? { requiredHost } : {})
      })
    }
  )

  // Why no repo: add/clone dialogs choose an account before the project row exists.
  ipcMain.handle(
    'gh:listHostAccounts',
    (_event, args?: { host?: unknown; refreshCapability?: unknown; wslDistro?: unknown }) => {
      const host = typeof args?.host === 'string' ? args.host.trim() : ''
      // Why: a WSL project's push resolves its token with the distro's gh, so list that gh's logins.
      const wslDistro = args?.wslDistro
      if (
        wslDistro !== undefined &&
        (typeof wslDistro !== 'string' || !WSL_DISTRO_NAME_RE.test(wslDistro))
      ) {
        // Why reject, not fall back: the host's gh would list a different set of logins.
        return Promise.reject(new Error(`Invalid WSL distro name: ${String(wslDistro)}`))
      }
      return listGhAccountBindingInventory(wslDistro ? { wslDistro } : {}, {
        refreshCapability: args?.refreshCapability === true,
        ...(host ? { requiredHost: host } : {})
      })
    }
  )

  // Why: suggests the commit author for an account picked before the project exists.
  ipcMain.handle('gh:accountProfile', (_event, binding: unknown) => getGhAccountProfile(binding))

  ipcMain.handle(
    'gh:validateAccountBinding',
    (_event, args: { repoPath: string; repoId?: string; host: string; user: string }) => {
      const repo = assertRegisteredGitHubRepo(args, store)
      const requiredHost = githubHostFromIdentityKey(repo.gitRemoteIdentity?.canonicalKey)
      return validateGhAccountBinding(
        { host: args.host, user: args.user },
        getGitHubLocalGitOptionArgs(store, repo)[0] ?? {},
        requiredHost ? { requiredHost } : {}
      )
    }
  )
}
