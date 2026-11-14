import {
  getSelectedClaudeAccountIdForTarget,
  normalizeClaudeAccountSelectionTarget,
  normalizeClaudeRuntimeSelection,
  setSelectedClaudeAccountIdForTarget,
  type ClaudeAccountSelectionTarget
} from '../runtime-selection'
import { hasLiveClaudePtys } from '../live-pty-gate'
import { ClaudeRuntimeAuthPinnedConfigDir } from './runtime-auth-pinned-config-dir'
import type { ClaudeManagedAccount } from '../../../shared/managed-account-types'

export class ClaudeRuntimeAuthSync extends ClaudeRuntimeAuthPinnedConfigDir {
  protected async doSyncForCurrentSelection(target?: ClaudeAccountSelectionTarget): Promise<void> {
    const settings = this.store.getSettings()
    const effectiveTarget = this.resolveWslDefaultTarget(target)
    const normalizedTarget = normalizeClaudeAccountSelectionTarget(effectiveTarget)
    const activeAccountId = getSelectedClaudeAccountIdForTarget(settings, normalizedTarget)
    const activeAccount = this.getActiveAccount(settings.claudeManagedAccounts, activeAccountId)
    const previousAccount = this.getActiveAccount(
      settings.claudeManagedAccounts,
      this.lastSyncedAccountId
    )
    this.managedRefreshDeferredByLivePtyAccountId = null
    const previousManagedCredentialsJson = previousAccount
      ? await this.readManagedCredentials(previousAccount)
      : null
    const previousManagedOauthAccount = previousAccount
      ? await this.readManagedOauthAccount(previousAccount)
      : null
    if (previousAccount && previousAccount.id !== activeAccount?.id) {
      if (previousManagedCredentialsJson) {
        const outgoingReadBackResult = await this.readBackRefreshedTokens(
          previousManagedCredentialsJson,
          {
            updateLastWrittenCredentialsJson: true
          }
        )
        if (
          outgoingReadBackResult.status === 'rejected' &&
          outgoingReadBackResult.runtimeCredentialsChanged &&
          hasLiveClaudePtys()
        ) {
          if (
            outgoingReadBackResult.runtimeCredentialsJson &&
            this.liveRuntimeCredentialsCanUpdateActiveAccount(
              outgoingReadBackResult.runtimeCredentialsJson,
              previousAccount,
              previousManagedCredentialsJson,
              previousManagedOauthAccount
            )
          ) {
            // Why: switching away while Claude is live must preserve verified token refreshes before replacing shared runtime credentials.
            await this.writeManagedCredentials(
              previousAccount,
              outgoingReadBackResult.runtimeCredentialsJson
            )
          } else {
            // Why: the runtime blob may lack identity proof for a live-session refresh; skip persisting it, but still let new terminals move to the account.
            console.warn(
              '[claude-runtime-auth] Skipping unverified live Claude auth read-back while switching accounts'
            )
          }
        }
      }
    }
    if (!activeAccount) {
      if (activeAccountId) {
        const nextSelection = setSelectedClaudeAccountIdForTarget(
          normalizeClaudeRuntimeSelection(settings),
          null,
          normalizedTarget
        )
        this.store.updateSettings({
          activeClaudeManagedAccountId:
            normalizedTarget.runtime === 'host' ? null : settings.activeClaudeManagedAccountId,
          activeClaudeManagedAccountIdsByRuntime: nextSelection
        })
      }
      if (normalizedTarget.runtime === 'wsl') {
        return
      }
      if (this.lastSyncedAccountId !== null) {
        await (previousAccount
          ? this.restoreSystemDefaultSnapshot(
              previousManagedCredentialsJson,
              previousManagedOauthAccount
            )
          : this.restoreSystemDefaultSnapshot(this.lastWrittenCredentialsJson, undefined))
        this.lastSyncedAccountId = null
      }
      return
    }

    if (activeAccount.managedAuthRuntime === 'wsl') {
      if (!(await this.getOwnedManagedAuthPath(activeAccount))) {
        console.warn(
          '[claude-runtime-auth] Active WSL managed account is not owned by Dolphin, restoring system default'
        )
        const nextSelection = setSelectedClaudeAccountIdForTarget(
          normalizeClaudeRuntimeSelection(settings),
          null,
          normalizedTarget
        )
        this.store.updateSettings({
          activeClaudeManagedAccountId:
            normalizedTarget.runtime === 'host' ? null : settings.activeClaudeManagedAccountId,
          activeClaudeManagedAccountIdsByRuntime: nextSelection
        })
        return
      }
      const credentialsJson = await this.readManagedCredentials(activeAccount)
      if (!credentialsJson || !this.isValidCredentialsJsonObject(credentialsJson)) {
        console.warn(
          '[claude-runtime-auth] Active WSL managed account is missing or has invalid credentials, restoring system default'
        )
        const nextSelection = setSelectedClaudeAccountIdForTarget(
          normalizeClaudeRuntimeSelection(settings),
          null,
          normalizedTarget
        )
        this.store.updateSettings({
          activeClaudeManagedAccountId:
            normalizedTarget.runtime === 'host' ? null : settings.activeClaudeManagedAccountId,
          activeClaudeManagedAccountIdsByRuntime: nextSelection
        })
        return
      }
      // Why: WSL managed accounts are isolated by their Linux CLAUDE_CONFIG_DIR; materializing into Windows ~/.claude would mix two auth stores.
      this.clearLastWrittenRuntimeState()
      return
    }

    // Why: the active account launches in its own profile (prepareActiveProfileLaunchIfAny), so
    // ~/.claude stays the user's own login. An invalid account is refused at launch, never swapped
    // for the system login, which would run with the user's personal instructions and accesses.
    await this.releaseLegacyRuntimeMaterialization(previousAccount ?? activeAccount)
  }

  /**
   * Hands ~/.claude back to the user when an earlier version materialized a managed account there:
   * tokens the CLI rotated are read back into the managed store first, so the restore can prove
   * Dolphin wrote what it replaces. A login the user made there themselves is never touched.
   */
  private async releaseLegacyRuntimeMaterialization(account: ClaudeManagedAccount): Promise<void> {
    if (this.lastSyncedAccountId === null) {
      return
    }
    const managedCredentialsJson = await this.readManagedCredentials(account)
    if (managedCredentialsJson) {
      await this.readBackRefreshedTokens(managedCredentialsJson, {
        updateLastWrittenCredentialsJson: true
      })
    }
    await this.restoreSystemDefaultSnapshot(
      await this.readManagedCredentials(account),
      await this.readManagedOauthAccount(account)
    )
    this.lastSyncedAccountId = null
  }
}
