import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'
import { writeFileAtomically } from '../../codex-accounts/fs-utils'
import { hasLiveClaudePtys } from '../live-pty-gate'
import { isOauthTokenExpiring } from '../oauth-refresh'
import { getClaudePinnedConfigDir } from '../managed-auth-path'
import { writeClaudeKeychainCredentialsForConfigDir } from '../keychain'
import {
  isolateClaudeProfileDir,
  seedClaudeProfileState
} from '../pinned-config-dir/claude-pinned-config-layout'
import { ClaudeRuntimeAuthPreparationService } from './runtime-auth-preparation'
import { installClaudeProfileHooks } from '../profile/claude-profile-hooks'
import { isDefaultClaudeConfigDir } from '../claude-account-config-dir'
import type { ClaudeRuntimeAuthPreparation } from './runtime-auth-types'

/**
 * Every host-managed account launches in its own isolated profile (its CLAUDE_CONFIG_DIR), whether
 * it is pinned or the active account. The managed store stays the single source of truth for
 * credentials: every launch first reads back what the CLI rotated in the profile, then
 * re-materializes the store there. Dolphin never refreshes an account itself while Claude PTYs
 * are live, so a running pane keeps the refresh token it holds.
 */
export class ClaudeRuntimeAuthPinnedConfigDir extends ClaudeRuntimeAuthPreparationService {
  /** Persists credentials the CLI rotated inside the pinned dir; returns them when adopted. */
  protected async readBackPinnedConfigDirCredentials(
    account: ClaudeManagedAccount
  ): Promise<string | null> {
    if (account.managedAuthRuntime === 'wsl' || account.linkedConfigDir) {
      return null
    }
    const configDir = getClaudePinnedConfigDir(account.id)
    if (!existsSync(configDir)) {
      return null
    }
    const managedCredentialsJson = await this.readManagedCredentials(account)
    if (!managedCredentialsJson) {
      return null
    }
    const managedOauthAccount = await this.readManagedOauthAccount(account)
    const pinnedOauthAccount = this.readPinnedOauthAccount(configDir)
    const candidates = [this.readPinnedCredentialsFile(configDir)]
    if (process.platform === 'darwin') {
      candidates.unshift(await this.readActiveClaudeKeychainCredentialsBestEffort(configDir))
    }
    const accepted = candidates.filter(
      (candidate): candidate is string =>
        candidate !== null &&
        candidate !== managedCredentialsJson &&
        this.isValidCredentialsJsonObject(candidate) &&
        // Why: a `/login` inside a pinned pane may hold another identity; only proof of this
        // account (and a newer token) may overwrite its managed store.
        this.runtimeCredentialsMatchAccount(
          candidate,
          pinnedOauthAccount,
          account,
          managedCredentialsJson,
          managedOauthAccount
        ) === 'match' &&
        !this.runtimeCredentialsAreOlder(candidate, managedCredentialsJson) &&
        (this.runtimeCredentialsAreFresher(candidate, managedCredentialsJson) ||
          this.compareRefreshTokens(candidate, managedCredentialsJson) === 'different')
    )
    if (accepted.length === 0) {
      return null
    }
    const freshest = accepted.reduce((best, candidate) =>
      this.runtimeCredentialsAreFresher(candidate, best) ? candidate : best
    )
    await this.writeManagedCredentials(account, freshest)
    return freshest
  }

  /** Materializes `account` into its isolated profile; null means its credentials are unusable. */
  protected async preparePinnedAccountLaunch(
    account: ClaudeManagedAccount
  ): Promise<ClaudeRuntimeAuthPreparation | null> {
    if (account.managedAuthRuntime === 'wsl') {
      // Why: WSL accounts already own a Linux CLAUDE_CONFIG_DIR; nothing to materialize.
      return account.wslLinuxAuthPath
        ? {
            configDir: account.managedAuthPath,
            runtime: 'wsl',
            wslDistro: account.wslDistro ?? null,
            wslLinuxConfigDir: account.wslLinuxAuthPath,
            envPatch: { CLAUDE_CONFIG_DIR: account.wslLinuxAuthPath },
            stripAuthEnv: true,
            provenance: `managed:${account.id}:wsl:${account.wslDistro ?? ''}:pinned`
          }
        : null
    }
    if (account.linkedConfigDir) {
      return this.prepareLinkedFolderLaunch(account, account.linkedConfigDir)
    }
    if (!(await this.getOwnedManagedAuthPath(account))) {
      return null
    }
    await this.readBackPinnedConfigDirCredentials(account)
    let credentialsJson = await this.readManagedCredentials(account)
    if (!credentialsJson || !this.isValidCredentialsJsonObject(credentialsJson)) {
      return null
    }
    // Why: a refresh while Claude runs could spend the single-use token a live pane still holds.
    const refreshDeferredByLivePty = hasLiveClaudePtys() && isOauthTokenExpiring(credentialsJson)
    if (!hasLiveClaudePtys()) {
      credentialsJson =
        (await this.refreshManagedAccountTokenIfNeeded(account, credentialsJson)) ?? credentialsJson
    }
    const configDir = getClaudePinnedConfigDir(account.id)
    mkdirSync(configDir, { recursive: true, mode: 0o700 })
    // Why no catch: a profile that failed to isolate could still hold another account's
    // instructions and accesses; the launch must fail rather than run on a half-shared dir.
    const isolation = isolateClaudeProfileDir(
      configDir,
      this.pathResolver.getRuntimePaths().configDir
    )
    const credentialsPath = join(configDir, '.credentials.json')
    if (!this.fileContentsEqual(credentialsPath, credentialsJson)) {
      writeFileAtomically(credentialsPath, credentialsJson, { mode: 0o600 })
    }
    if (process.platform === 'darwin') {
      await writeClaudeKeychainCredentialsForConfigDir(credentialsJson, configDir)
    }
    await seedClaudeProfileState({
      profileConfigPath: join(configDir, '.claude.json'),
      userConfigPath: this.pathResolver.getRuntimePaths().configPath,
      oauthAccount: await this.readManagedOauthAccount(account),
      dropInheritedSharedState: isolation.firstIsolation
    })
    try {
      await installClaudeProfileHooks(configDir, this.store.getSettings())
    } catch (error) {
      // Why keep the launch: missing hooks cost the status row, not isolation or authentication.
      console.warn('[claude-runtime-auth] Failed to install hooks in Claude profile:', error)
    }
    return {
      configDir,
      runtime: 'host',
      wslDistro: null,
      wslLinuxConfigDir: null,
      // Why: the CLI keys its Keychain item on this literal string; never re-spell it.
      envPatch: { CLAUDE_CONFIG_DIR: configDir },
      stripAuthEnv: true,
      ...(refreshDeferredByLivePty ? { managedRefreshDeferredByLivePty: true } : {}),
      provenance: `managed:${account.id}:pinned`
    }
  }

  /**
   * A folder the user already manages: the CLI's own login there is used as is. Dolphin never
   * writes credentials, copies, isolates or refreshes anything in it.
   */
  private async prepareLinkedFolderLaunch(
    account: ClaudeManagedAccount,
    configDir: string
  ): Promise<ClaudeRuntimeAuthPreparation> {
    if (!existsSync(configDir)) {
      throw new Error(
        `The folder linked to the Claude account ${account.email} (${configDir}) no longer exists. Link it again in Settings > Accounts.`
      )
    }
    const isDefault = isDefaultClaudeConfigDir(configDir)
    if (!isDefault) {
      try {
        await installClaudeProfileHooks(configDir, this.store.getSettings())
      } catch (error) {
        console.warn(
          '[claude-runtime-auth] Failed to install hooks in linked Claude folder:',
          error
        )
      }
    }
    return {
      configDir,
      runtime: 'host',
      wslDistro: null,
      wslLinuxConfigDir: null,
      // Why: the default dir must launch without CLAUDE_CONFIG_DIR, or the CLI looks for its state
      // and Keychain item elsewhere and the user's login appears lost.
      envPatch: isDefault ? {} : { CLAUDE_CONFIG_DIR: configDir },
      stripAuthEnv: true,
      provenance: `managed:${account.id}:linked`
    }
  }

  private readPinnedCredentialsFile(configDir: string): string | null {
    try {
      const path = join(configDir, '.credentials.json')
      return existsSync(path) ? readFileSync(path, 'utf-8') : null
    } catch {
      return null
    }
  }

  private readPinnedOauthAccount(configDir: string): unknown {
    return this.readJsonObject(join(configDir, '.claude.json'))?.oauthAccount ?? null
  }
}
