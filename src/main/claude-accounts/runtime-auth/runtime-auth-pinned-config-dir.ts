import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'
import { writeFileAtomically } from '../../codex-accounts/fs-utils'
import { hasLiveClaudePtys } from '../live-pty-gate'
import { getClaudePinnedConfigDir } from '../managed-auth-path'
import { writeClaudeKeychainCredentialsForConfigDir } from '../keychain'
import {
  linkSharedClaudeConfig,
  seedPinnedClaudeState
} from '../pinned-config-dir/claude-pinned-config-layout'
import { ClaudeRuntimeAuthPreparationService } from './runtime-auth-preparation'
import type { ClaudeRuntimeAuthPreparation } from './runtime-auth-types'

/**
 * A worktree-pinned account runs with its own CLAUDE_CONFIG_DIR while another account is
 * global. The managed store stays the single source of truth: every pinned launch first reads
 * back what the CLI rotated there, then re-materializes the store, and the global sync reads a
 * pinned dir back before it materializes that account into ~/.claude.
 *
 * Remaining race: the same account live in two config dirs at once (a pinned pane started
 * before the user made that account global, still running). Each CLI coordinates refreshes
 * only inside its own config dir, so whichever rotates first spends the refresh token the
 * other holds; that pane must re-login. Dolphin narrows it by never refreshing an account
 * itself while Claude PTYs are live, and by routing new launches of a now-global pin to the
 * global dir (the pin equals the active account).
 */
export class ClaudeRuntimeAuthPinnedConfigDir extends ClaudeRuntimeAuthPreparationService {
  /** Persists credentials the CLI rotated inside the pinned dir; returns them when adopted. */
  protected async readBackPinnedConfigDirCredentials(
    account: ClaudeManagedAccount
  ): Promise<string | null> {
    if (account.managedAuthRuntime === 'wsl') {
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

  /** Materializes `account` into its pinned config dir; null means "use the global account". */
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
    if (!(await this.getOwnedManagedAuthPath(account))) {
      return null
    }
    await this.readBackPinnedConfigDirCredentials(account)
    let credentialsJson = await this.readManagedCredentials(account)
    if (!credentialsJson || !this.isValidCredentialsJsonObject(credentialsJson)) {
      return null
    }
    // Why: same rule as the global sync — a refresh while Claude runs could spend the token a
    // live pane (pinned or global) still holds.
    if (!hasLiveClaudePtys()) {
      credentialsJson =
        (await this.refreshManagedAccountTokenIfNeeded(account, credentialsJson)) ?? credentialsJson
    }
    const configDir = getClaudePinnedConfigDir(account.id)
    mkdirSync(configDir, { recursive: true, mode: 0o700 })
    try {
      linkSharedClaudeConfig(configDir, this.pathResolver.getRuntimePaths().configDir)
    } catch (error) {
      // Why: a missing link degrades history sharing, not authentication; keep the launch.
      console.warn('[claude-runtime-auth] Failed to link shared Claude config:', error)
    }
    const credentialsPath = join(configDir, '.credentials.json')
    if (!this.fileContentsEqual(credentialsPath, credentialsJson)) {
      writeFileAtomically(credentialsPath, credentialsJson, { mode: 0o600 })
    }
    if (process.platform === 'darwin') {
      await writeClaudeKeychainCredentialsForConfigDir(credentialsJson, configDir)
    }
    await seedPinnedClaudeState({
      pinnedConfigPath: join(configDir, '.claude.json'),
      userConfigPath: this.pathResolver.getRuntimePaths().configPath,
      oauthAccount: await this.readManagedOauthAccount(account)
    })
    return {
      configDir,
      runtime: 'host',
      wslDistro: null,
      wslLinuxConfigDir: null,
      // Why: the CLI keys its Keychain item on this literal string; never re-spell it.
      envPatch: { CLAUDE_CONFIG_DIR: configDir },
      stripAuthEnv: true,
      provenance: `managed:${account.id}:pinned`
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
